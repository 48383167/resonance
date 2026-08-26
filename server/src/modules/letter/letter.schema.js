import { BadRequestError } from '../../common/errors/BadRequestError.js'

export function validateCreate(body = {}) {
  const { title, content, isSecret } = body
  if (!content || !String(content).trim()) throw new BadRequestError('信的内容不能为空')
  return { title, content, isSecret }
}

export function validateUpdate(body = {}) {
  const { title, content, isSecret } = body
  if (content != null && !String(content).trim()) throw new BadRequestError('信的内容不能为空')
  return { title, content, isSecret }
}
