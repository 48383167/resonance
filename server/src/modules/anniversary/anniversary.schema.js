import { BadRequestError } from '../../common/errors/BadRequestError.js'

export function validateCreate(body = {}) {
  const { title, type, date, description } = body
  if (!title || !String(title).trim()) throw new BadRequestError('名称不能为空')
  if (!date) throw new BadRequestError('请选择日期')
  return { title, type, date, description }
}
