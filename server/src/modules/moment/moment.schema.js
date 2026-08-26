import { BadRequestError } from '../../common/errors/BadRequestError.js'

export function validateCreate(body = {}) {
  const { content, mood, location, longitude, latitude, momentDate, photos } = body
  if (!content || !String(content).trim()) {
    throw new BadRequestError('内容不能为空')
  }
  return { content, mood, location, longitude, latitude, momentDate, photos }
}
