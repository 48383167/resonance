import { BadRequestError } from '../../common/errors/BadRequestError.js'

export function validateProfile(body = {}) {
  const { nickname, avatarUrl } = body
  if (nickname != null && !String(nickname).trim()) throw new BadRequestError('昵称不能为空')
  return { nickname, avatarUrl }
}
