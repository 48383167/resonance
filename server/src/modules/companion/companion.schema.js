import { BadRequestError } from '../../common/errors/BadRequestError.js'

export const MAX_MESSAGE_LENGTH = 2000
export const MAX_TITLE_LENGTH = 40
export const MAX_MEMORY_LENGTH = 160

function normalizeText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new BadRequestError(`${label}不能为空`)
  if (text.length > maxLength) throw new BadRequestError(`${label}最多 ${maxLength} 字`)
  return text
}

export function validateConsent(body = {}) {
  if (typeof body.accepted !== 'boolean') {
    throw new BadRequestError('accepted 必须为布尔值')
  }
  return { accepted: body.accepted }
}

export function validateCreateConversation(body = {}) {
  if (body.title == null || body.title === '') return { title: '新的倾诉' }
  return { title: normalizeText(body.title, '标题', MAX_TITLE_LENGTH) }
}

export function validateMessage(body = {}) {
  return { content: normalizeText(body.content, '消息', MAX_MESSAGE_LENGTH) }
}

export function validateCreateMemory(body = {}) {
  return { content: normalizeText(body.content, '记忆', MAX_MEMORY_LENGTH) }
}

export function validateUpdateMemory(body = {}) {
  const changes = {}
  if (Object.hasOwn(body, 'content')) {
    changes.content = normalizeText(body.content, '记忆', MAX_MEMORY_LENGTH)
  }
  if (Object.hasOwn(body, 'enabled')) {
    if (typeof body.enabled !== 'boolean') throw new BadRequestError('enabled 必须为布尔值')
    changes.enabled = body.enabled
  }
  if (!Object.keys(changes).length) {
    throw new BadRequestError('至少提供 content 或 enabled 之一')
  }
  return changes
}
