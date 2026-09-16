import { AppError } from '../../common/errors/AppError.js'
import { BadRequestError } from '../../common/errors/BadRequestError.js'

const CATEGORIES = ['diet', 'allergy', 'period', 'preference', 'other']
const SEVERITIES = ['mild', 'moderate', 'severe']

function normalizeTitle(title) {
  if (typeof title !== 'string' || !title.trim()) throw new BadRequestError('标题不能为空')
  const t = title.trim()
  if (t.length > 80) throw new BadRequestError('标题最多 80 字')
  return t
}

function normalizeContent(content) {
  const c = content == null ? '' : String(content)
  if (c.length > 2000) throw new BadRequestError('内容最多 2000 字')
  return c
}

// 公共字段归一化与校验：category/severity/period 相关规则按契约执行
function normalizeFields({ category, title, content, severity, startDate, endDate, cycleDays }) {
  if (!CATEGORIES.includes(category)) throw new AppError('分类非法', 400, 'INVALID_CARE_CATEGORY')
  const t = normalizeTitle(title)
  const c = normalizeContent(content)

  let sev = null
  if (severity !== null && severity !== undefined && severity !== '') {
    if (category !== 'allergy') throw new AppError('只有过敏档案可设置严重程度', 400, 'INVALID_CARE_SEVERITY')
    if (!SEVERITIES.includes(severity)) throw new AppError('严重程度非法', 400, 'INVALID_CARE_SEVERITY')
    sev = severity
  }

  let s = null
  let e = null
  let cyc = null
  if (category === 'period') {
    if (!startDate) throw new AppError('例假需填写开始日期', 400, 'INVALID_PERIOD_RANGE')
    s = startDate
    if (endDate) {
      if (endDate < startDate) throw new AppError('例假日期区间非法', 400, 'INVALID_PERIOD_RANGE')
      e = endDate
    }
    if (cycleDays !== undefined && cycleDays !== null && cycleDays !== '') {
      const cd = Number(cycleDays)
      if (!Number.isInteger(cd) || cd < 15 || cd > 60) throw new AppError('周期天数超出 15~60', 400, 'INVALID_CYCLE_DAYS')
      cyc = cd
    }
  }

  return { category, title: t, content: c, severity: sev, startDate: s, endDate: e, cycleDays: cyc }
}

export function validateCreate(body = {}) {
  return normalizeFields({
    category: body.category,
    title: body.title,
    content: body.content ?? '',
    severity: body.severity ?? null,
    startDate: body.startDate ?? null,
    endDate: body.endDate ?? null,
    cycleDays: body.cycleDays ?? null,
  })
}

// 合并更新：字段可选；切换分类时清理不适用字段（非 allergy 清 severity，非 period 清日期）
export function validateUpdate(body = {}, existing = {}) {
  const category = body.category !== undefined ? body.category : existing.category
  const severity = category === 'allergy'
    ? (body.severity !== undefined ? body.severity : (existing.severity ?? null))
    : (body.severity ?? null)
  return normalizeFields({
    category,
    title: body.title !== undefined ? body.title : existing.title,
    content: body.content !== undefined ? body.content : (existing.content ?? ''),
    severity,
    startDate: category === 'period' ? (body.startDate !== undefined ? body.startDate : (existing.start_date ?? null)) : null,
    endDate: category === 'period' ? (body.endDate !== undefined ? body.endDate : (existing.end_date ?? null)) : null,
    cycleDays: category === 'period' ? (body.cycleDays !== undefined ? body.cycleDays : (existing.cycle_days ?? null)) : null,
  })
}
