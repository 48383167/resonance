import { AppError } from '../../common/errors/AppError.js'
import { BadRequestError } from '../../common/errors/BadRequestError.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 部分更新：只校验/返回请求里出现的字段，未出现的由 service 合并
export function validateMailSettings(body = {}) {
  const patch = {}
  if (body.email !== undefined) {
    const email = String(body.email ?? '').trim()
    if (email && !EMAIL_RE.test(email)) throw new AppError('邮箱格式不正确', 400, 'INVALID_EMAIL')
    patch.email = email
  }
  for (const key of ['periodRemind', 'anniversaryRemind', 'aiContent']) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== 'boolean') throw new BadRequestError(`${key} 必须为布尔值`)
      patch[key] = body[key]
    }
  }
  return patch
}

export function validatePreviewType(query = {}) {
  const type = query.type
  if (!['period', 'anniversary'].includes(type)) {
    throw new AppError('预览类型不支持', 400, 'INVALID_PREVIEW_TYPE')
  }
  return type
}
