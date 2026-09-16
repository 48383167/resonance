import { BadRequestError } from '../../common/errors/BadRequestError.js'

const GENDERS = ['', 'male', 'female']

export function validateProfile(body = {}) {
  const { nickname, avatarFileId, gender } = body
  if (nickname != null && !String(nickname).trim()) throw new BadRequestError('昵称不能为空')
  if (gender != null && !GENDERS.includes(gender)) throw new BadRequestError('性别不合法')
  return { nickname, avatarFileId, gender }
}
