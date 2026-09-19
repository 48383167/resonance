import { BadRequestError } from '../../common/errors/BadRequestError.js'

export const MAX_MOMENT_PLACES = 5

function normalizePlaceIds(value) {
  if (!Array.isArray(value)) throw new BadRequestError('placeIds 必须是数组')
  const ids = [...new Set(value.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))]
  if (ids.length > MAX_MOMENT_PLACES) throw new BadRequestError(`一次最多关联 ${MAX_MOMENT_PLACES} 家店`)
  return ids
}

export function validateCreate(body = {}) {
  const { content, mood, location, longitude, latitude, momentDate, photos, placeIds } = body
  if (!content || !String(content).trim()) {
    throw new BadRequestError('内容不能为空')
  }
  const normalizedPhotos = Array.isArray(photos)
    ? photos.filter((p) => p && String(p).trim()).map((p) => String(p))
    : []
  return {
    content,
    mood,
    location,
    longitude,
    latitude,
    momentDate,
    photos: normalizedPhotos,
    placeIds: placeIds === undefined ? [] : normalizePlaceIds(placeIds),
  }
}

// 条目级分享可见性：showInShare 必须是布尔值
export function validateShowInShare(body = {}) {
  if (typeof body.showInShare !== 'boolean') {
    throw new BadRequestError('showInShare 必须为布尔值')
  }
  return body.showInShare
}
