import { BadRequestError } from '../../common/errors/BadRequestError.js'
import { localDateStr } from '../../common/utils/date.js'

// 日期统一 YYYY-MM-DD，且不允许未来（补记的是已发生的事）
function normalizeDate(value, label = '日期') {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestError(`${label}格式应为 YYYY-MM-DD`)
  if (s > localDateStr()) throw new BadRequestError(`${label}不能选未来`)
  return s
}

const STATUSES = ['todo', 'doing', 'done']

export function validateCreate(body = {}) {
  const { title, description, category, priority, status } = body
  if (!title || !String(title).trim()) throw new BadRequestError('心愿内容不能为空')
  return {
    title,
    description,
    category,
    priority,
    status,
    startedAt: normalizeDate(body.startedAt, '开始日期'),
    completedAt: normalizeDate(body.completedAt, '完成日期'),
  }
}

export function validateStatus(body = {}) {
  const { status } = body
  if (!STATUSES.includes(status)) throw new BadRequestError('状态不合法')
  return { status, date: normalizeDate(body.date) }
}

// 编辑更新：白名单字段；startedAt / completedAt 支持 null 清空
export function validateUpdate(body = {}) {
  const changes = {}
  if (body.title !== undefined) {
    if (!String(body.title).trim()) throw new BadRequestError('心愿内容不能为空')
    changes.title = body.title
  }
  if (body.description !== undefined) changes.description = body.description
  if (body.category !== undefined) changes.category = body.category
  if (body.priority !== undefined) changes.priority = body.priority
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw new BadRequestError('状态不合法')
    changes.status = body.status
  }
  if (body.startedAt !== undefined) changes.startedAt = normalizeDate(body.startedAt, '开始日期')
  if (body.completedAt !== undefined) changes.completedAt = normalizeDate(body.completedAt, '完成日期')
  return changes
}
