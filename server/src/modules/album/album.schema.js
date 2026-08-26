import { BadRequestError } from '../../common/errors/BadRequestError.js'

export function validateCreate(body = {}) {
  const { name, coverUrl, description } = body
  if (!name || !String(name).trim()) throw new BadRequestError('相册名不能为空')
  return { name, coverUrl, description }
}

export function validateUpdate(body = {}) {
  const { name, description } = body
  if (name != null && !String(name).trim()) throw new BadRequestError('相册名不能为空')
  return { name, description }
}

export function validatePhotoUrl(body = {}) {
  const { url, caption } = body
  if (!url) throw new BadRequestError('图片 URL 不能为空')
  return { url, caption }
}

export function validateCoverUrl(body = {}) {
  const { url } = body
  if (!url) throw new BadRequestError('封面 URL 不能为空')
  return { url }
}
