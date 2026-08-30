import { BadRequestError } from '../../common/errors/BadRequestError.js'

// 观测台总展示开关：enabled 必须为布尔值
export function validateVisibility(body = {}) {
  const { enabled } = body || {}
  if (typeof enabled !== 'boolean') {
    throw new BadRequestError('enabled 必须为布尔值')
  }
  return { enabled }
}
