import { BadRequestError } from '../../common/errors/BadRequestError.js'

export const MAX_MESSAGE_LENGTH = 2000
export const MAX_TITLE_LENGTH = 40

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
