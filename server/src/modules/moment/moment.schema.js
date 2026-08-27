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
