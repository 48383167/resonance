import { AppError } from '../../common/errors/AppError.js'
import { BadRequestError } from '../../common/errors/BadRequestError.js'
import { normalizeItems, itemsFromContent, itemsToContent } from './rule.items.js'

const TYPES = ['redline', 'rule', 'suggestion']
const STATUSES = ['active', 'archived']

function normalizeTitle(title) {
  if (typeof title !== 'string' || !title.trim()) throw new BadRequestError('标题不能为空')
  const t = title.trim()
  if (t.length > 80) throw new BadRequestError('标题最多 80 字')
  return t
}

// 条目入参：优先 items 数组；仅传 content（旧契约）时按行拆分
function normalizeItemsInput(body) {
  if (body.items !== undefined) return normalizeItems(body.items)
  return itemsFromContent(body.content)
}

export function validateCreate(body = {}) {
  const type = body.type != null && body.type !== '' ? body.type : 'rule'
  if (!TYPES.includes(type)) throw new AppError('规矩类型非法', 400, 'INVALID_RULE_TYPE')
  const status = body.status !== undefined ? body.status : 'active'
  if (!STATUSES.includes(status)) throw new BadRequestError('状态不合法')
  const items = normalizeItemsInput(body)
  return {
    type,
    title: normalizeTitle(body.title),
    items,
    content: itemsToContent(items),
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
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) throw new BadRequestError('状态不合法')
    changes.status = body.status
  }
  if (body.items !== undefined || body.content !== undefined) {
    const items = normalizeItemsInput(body)
    changes.items = items
    changes.content = itemsToContent(items)
  }
  return changes
}
