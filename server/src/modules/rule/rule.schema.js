import { AppError } from '../../common/errors/AppError.js'
import { BadRequestError } from '../../common/errors/BadRequestError.js'

const TYPES = ['redline', 'rule', 'suggestion']
const STATUSES = ['active', 'archived']

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

export function validateCreate(body = {}) {
  const type = body.type != null && body.type !== '' ? body.type : 'rule'
  if (!TYPES.includes(type)) throw new AppError('规矩类型非法', 400, 'INVALID_RULE_TYPE')
  const status = body.status !== undefined ? body.status : 'active'
  if (!STATUSES.includes(status)) throw new BadRequestError('状态不合法')
  return {
    type,
    title: normalizeTitle(body.title),
    content: normalizeContent(body.content),
    status,
  }
}

export function validateUpdate(body = {}) {
  const changes = {}
  if (body.type !== undefined) {
    if (!TYPES.includes(body.type)) throw new AppError('规矩类型非法', 400, 'INVALID_RULE_TYPE')
    changes.type = body.type
  }
  if (body.title !== undefined) changes.title = normalizeTitle(body.title)
  if (body.content !== undefined) changes.content = normalizeContent(body.content)
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw new BadRequestError('状态不合法')
    changes.status = body.status
  }
  return changes
}
