import { BadRequestError } from '../../common/errors/BadRequestError.js'

export function validateCreate(body = {}) {
  const { content, mood, location, longitude, latitude, momentDate, photos } = body
  if (!content || !String(content).trim()) {
    throw new BadRequestError('内容不能为空')
  }
  const normalizedPhotos = Array.isArray(photos)
    ? photos.filter((p) => p && String(p).trim()).map((p) => String(p))
    : []
  return { content, mood, location, longitude, latitude, momentDate, photos: normalizedPhotos }
}

// 条目级分享可见性：showInShare 必须是布尔值
export function validateShowInShare(body = {}) {
  if (typeof body.showInShare !== 'boolean') {
    throw new BadRequestError('showInShare 必须为布尔值')
  }
  return body.showInShare
}
