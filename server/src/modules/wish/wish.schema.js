import { BadRequestError } from '../../common/errors/BadRequestError.js'

export function validateCreate(body = {}) {
  const { title, description, category, priority, status } = body
  if (!title || !String(title).trim()) throw new BadRequestError('心愿内容不能为空')
  return { title, description, category, priority, status }
}

export function validateStatus(body = {}) {
  const { status } = body
  if (!['todo', 'doing', 'done'].includes(status)) throw new BadRequestError('状态不合法')
  return { status }
}
