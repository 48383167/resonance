import { BadRequestError } from '../../common/errors/BadRequestError.js'

export const TARGET_TYPES = ['entry', 'moment', 'food']
export const MAX_CONTENT_LENGTH = 500

function normalizeTargetType(value) {
  if (!TARGET_TYPES.includes(value)) {
    throw new BadRequestError('targetType 必须是 entry、moment 或 food')
  }
  return value
}

function normalizeTargetId(value) {
  const targetId = typeof value === 'string' ? value.trim() : ''
  if (!targetId) throw new BadRequestError('targetId 不能为空')
  return targetId
}

// parentId 可选：空值表示顶层评论；回复时传入目标评论 ID
function normalizeParentId(value) {
  if (value == null || value === '') return null
  const parentId = typeof value === 'string' ? value.trim() : ''
  if (!parentId) throw new BadRequestError('parentId 不能为空')
  return parentId
}

export function validateList(query = {}) {
  return {
    targetType: normalizeTargetType(query.targetType),
    targetId: normalizeTargetId(query.targetId),
  }
}

export function validateRead(body = {}) {
  return {
    targetType: normalizeTargetType(body.targetType),
    targetId: normalizeTargetId(body.targetId),
  }
}

export function validateCreate(body = {}) {
  const targetType = normalizeTargetType(body.targetType)
  const targetId = normalizeTargetId(body.targetId)
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) throw new BadRequestError('评论内容不能为空')
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new BadRequestError(`评论最多 ${MAX_CONTENT_LENGTH} 字`)
  }
  return { targetType, targetId, content, parentId: normalizeParentId(body.parentId) }
}
