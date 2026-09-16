import { AppError } from '../../common/errors/AppError.js'
import { localDateStr } from '../../common/utils/date.js'
import { isMailerConfigured } from '../../config/mailer.js'
import { isDeepSeekConfigured } from '../../config/deepseek.js'
import { createReminderContent } from '../../infrastructure/ai/deepseek.adapter.js'
import { sendMail } from '../../infrastructure/mail/index.js'
import * as careService from '../care/care.service.js'
import * as anniversaryRepository from '../anniversary/anniversary.repository.js'
import * as notificationRepository from './notification.repository.js'
import * as notificationSchema from './notification.schema.js'
import {
  PERIOD_WINDOW_DAYS,
  ANNIVERSARY_WINDOW_DAYS,
  ANNIVERSARY_DAY_OF_DAYS,
  periodEmailSubject,
  anniversaryEmailSubject,
  fallbackPeriodBody,
  fallbackAnniversaryBody,
} from './notification.policy.js'

// —— 日期助手（服务器本地时区，与纪念日/胶囊的日期语义一致） ——
function parseLocalDate(s) {
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatLocalDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function diffFromToday(dateStr) {
  return Math.round((parseLocalDate(dateStr) - parseLocalDate(localDateStr())) / 86400000)
}

// 纪念日按「同月同日」每年重复：今天已过则取明年
function nextOccurrence(dateStr) {
  const base = parseLocalDate(dateStr)
  const today = parseLocalDate(localDateStr())
  let candidate = new Date(today.getFullYear(), base.getMonth(), base.getDate())
  if (candidate < today) candidate = new Date(today.getFullYear() + 1, base.getMonth(), base.getDate())
  return formatLocalDate(candidate)
}

function groupPairs(users) {
  const map = new Map()
  for (const user of users) {
    const key = user.pair_code || user.id
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(user)
  }
  return [...map.values()]
}

function toSettingsVO(row) {
  return {
    email: row?.email || '',
    periodRemind: Boolean(row?.period_remind),
    anniversaryRemind: Boolean(row?.anniversary_remind),
    aiContent: row?.ai_content === undefined ? true : Boolean(row.ai_content),
    mailerConfigured: isMailerConfigured(),
    aiConfigured: isDeepSeekConfigured(),
  }
}

export function getMailSettings(userId) {
  return toSettingsVO(notificationRepository.findMailSettings(userId))
}

export function updateMailSettings(userId, raw) {
  const patch = notificationSchema.validateMailSettings(raw)
  const existing = getMailSettings(userId)
  notificationRepository.upsertMailSettings(userId, {
    email: patch.email !== undefined ? patch.email : existing.email,
    periodRemind: patch.periodRemind !== undefined ? patch.periodRemind : existing.periodRemind,
    anniversaryRemind: patch.anniversaryRemind !== undefined ? patch.anniversaryRemind : existing.anniversaryRemind,
    aiContent: patch.aiContent !== undefined ? patch.aiContent : existing.aiContent,
  })
  return toSettingsVO(notificationRepository.findMailSettings(userId))
}

export async function sendTestMail(userId) {
  if (!isMailerConfigured()) {
    throw new AppError('服务器尚未配置 QQ 邮箱 SMTP，请先在 .env 中填写 SMTP_USER / SMTP_PASS', 503, 'MAIL_NOT_CONFIGURED')
  }
  const settings = getMailSettings(userId)
  if (!settings.email) {
    throw new AppError('请先填写收件邮箱并保存', 400, 'MAIL_EMAIL_REQUIRED')
  }
  await sendMail({
    to: settings.email,
    subject: '共鸣 · 邮件提醒测试',
    text: '这是一封测试邮件，说明「共鸣」的邮件提醒已经配置成功。\n收到这封邮件后，例假与纪念日提醒就能正常送达了。',
  })
  return { sent: true, email: settings.email }
}

// —— 文案生成：AI 优先（受 policy 系统提示词约束），失败/关闭时回退模板 ——
function sanitizeBody(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*#>`]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, 300)
    .trim()
}

async function generateBody({ recipient, kind, facts, fallback }) {
  if (!recipient.ai_content || !isDeepSeekConfigured()) {
    return { body: fallback(), source: 'template' }
  }
  try {
    const content = await createReminderContent({ userId: recipient.id, kind, facts })
    const body = sanitizeBody(content)
    return body ? { body, source: 'ai' } : { body: fallback(), source: 'template' }
  } catch (error) {
    console.error(`[notification] AI 文案生成失败，使用模板：${error?.message || error}`)
    return { body: fallback(), source: 'template' }
  }
}

async function deliver({ dedupeKey, recipient, subject, body, kind }) {
  try {
    await sendMail({ to: recipient.email, subject, text: body })
    notificationRepository.markSent(dedupeKey, { userId: recipient.id, email: recipient.email })
    return true
  } catch (error) {
    notificationRepository.markFailed(dedupeKey, {
      userId: recipient.id,
      email: recipient.email,
      error: error?.message || error,
    })
    console.error(`[notification] 邮件发送失败（${kind} → ${recipient.email}）：${error?.message || error}`)
    return false
  }
}

// —— 触发数据 ——
function periodSubjectsFor(pairUsers) {
  try {
    return careService.periodSummary(pairUsers[0].id).subjects || []
  } catch {
    return []
  }
}

function nearestAnniversary() {
  let best = null
  for (const anniversary of anniversaryRepository.list()) {
    const occurrence = nextOccurrence(anniversary.date)
    const daysUntil = diffFromToday(occurrence)
    if (!best || daysUntil < best.daysUntil) best = { anniversary, occurrence, daysUntil }
  }
  return best
}

function periodFacts({ recipient, entry, daysUntil }) {
  return [
    recipient.id === entry.subject.id ? '收件人就是例假本人' : '收件人是她的伴侣',
    `收件人昵称：${recipient.nickname}`,
    `例假对象昵称：${entry.subject.nickname}`,
    `预计日期：${entry.nextStart}（还有 ${daysUntil} 天）`,
    `周期参考：约 ${entry.avgCycle} 天`,
    '请写这封提醒邮件的正文。',
  ].join('\n')
}

function anniversaryFacts({ recipient, anniversary, occurrence, daysUntil }) {
  return [
    `纪念日名称：${anniversary.title}`,
    `日期：${occurrence}（${daysUntil === 0 ? '就是今天' : `还有 ${daysUntil} 天`}）`,
    anniversary.description ? `描述：${String(anniversary.description).slice(0, 100)}` : '描述：无',
    `收件人昵称：${recipient.nickname}`,
    '请写这封提醒邮件的正文。',
  ].join('\n')
}

// —— 提醒执行：调度器与「立即检查」共用；DB 去重保证一个周期/一个节点每人只发一封 ——
export async function runReminders() {
  if (!isMailerConfigured()) {
    return { skipped: 'MAIL_NOT_CONFIGURED', sent: 0, failed: 0 }
  }
  const users = notificationRepository.listUsersWithMailSettings()
  let sent = 0
  let failed = 0

  for (const pairUsers of groupPairs(users)) {
    // 例假：进入预测前 3 天窗口发一封
    for (const entry of periodSubjectsFor(pairUsers)) {
      if (!entry?.nextStart || !entry?.subject?.id) continue
      const daysUntil = diffFromToday(entry.nextStart)
      if (daysUntil < 1 || daysUntil > PERIOD_WINDOW_DAYS) continue
      for (const recipient of pairUsers) {
        if (!recipient.email || !recipient.period_remind) continue
        const dedupeKey = `period:${entry.subject.id}:${entry.nextStart}:${recipient.id}`
        if (notificationRepository.hasSent(dedupeKey)) continue
        const role = recipient.id === entry.subject.id ? 'self' : 'partner'
        const facts = periodFacts({ recipient, entry, daysUntil })
        const fallback = () => fallbackPeriodBody({
          role,
          subjectNickname: entry.subject.nickname,
          daysUntil,
          nextStart: entry.nextStart,
        })
        const { body } = await generateBody({ recipient, kind: 'period', facts, fallback })
        const ok = await deliver({
          dedupeKey,
          recipient,
          subject: periodEmailSubject({ daysUntil }),
          body,
          kind: 'period',
        })
        ok ? sent++ : failed++
      }
    }

    // 纪念日：提前 3 天与当天各一封
    for (const anniversary of anniversaryRepository.list()) {
      const occurrence = nextOccurrence(anniversary.date)
      const daysUntil = diffFromToday(occurrence)
      if (daysUntil !== ANNIVERSARY_DAY_OF_DAYS && daysUntil !== ANNIVERSARY_WINDOW_DAYS) continue
      const stage = daysUntil === 0 ? 'd0' : 'd3'
      for (const recipient of pairUsers) {
        if (!recipient.email || !recipient.anniversary_remind) continue
        const dedupeKey = `anniversary:${anniversary.id}:${occurrence}:${stage}:${recipient.id}`
        if (notificationRepository.hasSent(dedupeKey)) continue
        const facts = anniversaryFacts({ recipient, anniversary, occurrence, daysUntil })
        const fallback = () => fallbackAnniversaryBody({ title: anniversary.title, date: occurrence, daysUntil })
        const { body } = await generateBody({ recipient, kind: 'anniversary', facts, fallback })
        const ok = await deliver({
          dedupeKey,
          recipient,
          subject: anniversaryEmailSubject({ title: anniversary.title, daysUntil }),
          body,
          kind: 'anniversary',
        })
        ok ? sent++ : failed++
      }
    }
  }

  return { sent, failed }
}

// —— 预览：只生成不发送，用于设置页预览与排障 ——
export async function preview(userId, type) {
  notificationSchema.validatePreviewType({ type })
  const users = notificationRepository.listUsersWithMailSettings()
  const me = users.find((user) => user.id === userId)
  const pairUsers = users.filter((user) =>
    me?.pair_code ? user.pair_code === me.pair_code : user.id === userId)

  if (type === 'period') {
    const entry = periodSubjectsFor(pairUsers)[0]
    if (!entry?.nextStart) return { type, items: [], reason: 'NO_PERIOD_DATA' }
    const daysUntil = diffFromToday(entry.nextStart)
    const items = []
    for (const recipient of pairUsers) {
      const role = recipient.id === entry.subject.id ? 'self' : 'partner'
      const facts = periodFacts({ recipient, entry, daysUntil })
      const fallback = () => fallbackPeriodBody({
        role,
        subjectNickname: entry.subject.nickname,
        daysUntil,
        nextStart: entry.nextStart,
      })
      const { body, source } = await generateBody({ recipient, kind: 'period', facts, fallback })
      items.push({
        role,
        recipient: { id: recipient.id, nickname: recipient.nickname },
        subject: periodEmailSubject({ daysUntil }),
        body,
        source,
      })
    }
    return { type, items }
  }

  const upcoming = nearestAnniversary()
  if (!upcoming) return { type: 'anniversary', items: [], reason: 'NO_ANNIVERSARY' }
  const { anniversary, occurrence, daysUntil } = upcoming
  const items = []
  for (const recipient of pairUsers) {
    const facts = anniversaryFacts({ recipient, anniversary, occurrence, daysUntil })
    const fallback = () => fallbackAnniversaryBody({ title: anniversary.title, date: occurrence, daysUntil })
    const { body, source } = await generateBody({ recipient, kind: 'anniversary', facts, fallback })
    items.push({
      recipient: { id: recipient.id, nickname: recipient.nickname },
      subject: anniversaryEmailSubject({ title: anniversary.title, daysUntil }),
      body,
      source,
    })
  }
  return { type: 'anniversary', items }
}
