import { BadRequestError } from '../../common/errors/BadRequestError.js'

export function validateCreate(body = {}) {
  const { title, type, date, description } = body
  if (!title || !String(title).trim()) throw new BadRequestError('名称不能为空')
  if (!date) throw new BadRequestError('请选择日期')
  return { title, type, date, description }
}

// 条目级分享可见性：showInShare 必须是布尔值
export function validateShowInShare(body = {}) {
  if (typeof body.showInShare !== 'boolean') {
    throw new BadRequestError('showInShare 必须为布尔值')
  }
  return body.showInShare
}
