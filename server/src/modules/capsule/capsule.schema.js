import { BadRequestError } from '../../common/errors/BadRequestError.js'

export function validateCreate(body = {}) {
  const { title, content, photoUrl, unlockDate } = body
  if (!content || !String(content).trim()) throw new BadRequestError('内容不能为空')
  if (!unlockDate) throw new BadRequestError('请选择解锁日期')
  return { title, content, photoUrl, unlockDate }
}
