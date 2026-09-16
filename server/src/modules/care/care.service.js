import { AppError } from '../../common/errors/AppError.js'
import { transaction } from '../../config/database.js'
import { findById as findUserById } from '../auth/auth.repository.js'
import { getUserCouple } from '../couple/couple.service.js'
import * as careRepository from './care.repository.js'
import * as careSchema from './care.schema.js'
import * as pinRepository from '../pin/pin.repository.js'
import { emitCareCreated, emitCareUpdated, emitCareDeleted } from '../../infrastructure/socket/care.socket.js'

// subject 校验：缺省为伴侣（未配对为自己）；不在成员内 → INVALID_CARE_SUBJECT
function resolveSubject(couple, subjectId) {
  const members = couple ? couple.members : []
  const resolved = subjectId || (couple?.partner ? couple.partner.id : couple?.me?.id)
  if (!members.some((m) => m.id === resolved)) {
    throw new AppError('档案对象不是情侣成员', 400, 'INVALID_CARE_SUBJECT')
  }
  return resolved
}

function broadcast(couple, fn) {
  if (couple) fn(couple.pairCode)
}

export function list(query = {}) {
  return careRepository.list(query)
}

export function getDetail(id) {
  const item = careRepository.findById(id)
  if (!item) throw new AppError('档案不存在', 404, 'CARE_ITEM_NOT_FOUND')
  return item
}

export function create(userId, raw) {
  const couple = getUserCouple(userId)
  const data = careSchema.validateCreate(raw)
  const subjectId = resolveSubject(couple, raw.subjectId)
  const item = careRepository.create({ authorId: userId, subjectId, ...data })
  broadcast(couple, (pairCode) => emitCareCreated(pairCode, item))
  return item
}

export function update(id, userId, raw) {
  const couple = getUserCouple(userId)
  const existing = careRepository.findById(id)
  if (!existing) throw new AppError('档案不存在', 404, 'CARE_ITEM_NOT_FOUND')
  const data = careSchema.validateUpdate(raw, existing)
  const subjectId = resolveSubject(couple, raw.subjectId !== undefined ? raw.subjectId : existing.subject_id)
  const item = careRepository.update(id, { ...data, subjectId })
  broadcast(couple, (pairCode) => emitCareUpdated(pairCode, item))
  return item
}

export function remove(id, userId) {
  const couple = getUserCouple(userId)
  const existing = careRepository.findById(id)
  if (!existing) throw new AppError('档案不存在', 404, 'CARE_ITEM_NOT_FOUND')
  transaction(() => {
    careRepository.remove(id)
    pinRepository.removeByTarget('care', id)
  })
  broadcast(couple, (pairCode) => emitCareDeleted(pairCode, { id }))
  return null
}

// —— 例假预测：纯日期运算（服务端只算原始数据，倒计时由前端本地计算） ——
function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function addDays(s, n) {
  const d = parseDate(s)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function diffDays(a, b) {
  return Math.round((parseDate(a) - parseDate(b)) / 86400000)
}

function computeSubject(subjectId, records) {
  const sorted = [...records].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const seen = new Set()
  const deduped = []
  for (const r of sorted) {
    if (seen.has(r.start_date)) continue
    seen.add(r.start_date)
    deduped.push(r)
  }

  // 相邻开始日间隔只采用 15~60 天
  const intervals = []
  for (let i = 1; i < deduped.length; i++) {
    const d = diffDays(deduped[i].start_date, deduped[i - 1].start_date)
    if (d >= 15 && d <= 60) intervals.push(d)
  }
  const recent = intervals.slice(-3)
  const latest = deduped[deduped.length - 1]

  // avgCycle：最近 3 个区间均值四舍五入；无有效区间回退 cycle_days → 28
  let avgCycle
  if (recent.length) {
    avgCycle = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
  } else {
    avgCycle = latest.cycle_days || 28
  }

  // nextStart 不早于最近开始日；若出现倒退再顺延一个周期
  let nextStart = addDays(latest.start_date, avgCycle)
  if (nextStart <= latest.start_date) nextStart = addDays(latest.start_date, avgCycle * 2)

  // durationDays：优先最近一条，其次有效区间均值，最后 5
  let durationDays
  if (latest.end_date && latest.end_date >= latest.start_date) {
    durationDays = diffDays(latest.end_date, latest.start_date) + 1
  } else {
    const durations = deduped
      .filter((r) => r.end_date && r.end_date >= r.start_date)
      .map((r) => diffDays(r.end_date, r.start_date) + 1)
    durationDays = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 5
  }

  const latestEnd = (latest.end_date && latest.end_date >= latest.start_date) ? latest.end_date : null

  return {
    subject: findUserById(subjectId),
    latestStart: latest.start_date,
    latestEnd,
    durationDays,
    avgCycle,
    intervals: recent.length,
    nextStart,
  }
}

export function periodSummary() {
  const records = careRepository.listPeriodRecords()
  const bySubject = new Map()
  for (const r of records) {
    if (!bySubject.has(r.subject_id)) bySubject.set(r.subject_id, [])
    bySubject.get(r.subject_id).push(r)
  }
  const subjects = []
  for (const [subjectId, recs] of bySubject) {
    subjects.push(computeSubject(subjectId, recs))
  }
  return { subjects }
}

export function dashboardSummary() {
  const { subjects } = periodSummary()
  const alerts = careRepository.listAllergyAlerts().slice(0, 3).map((a) => ({
    id: a.id,
    title: a.title,
    severity: a.severity,
    category: a.category,
    subject: a.subject,
  }))
  return { periods: subjects, alerts }
}
