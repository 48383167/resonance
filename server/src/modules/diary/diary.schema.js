import { BadRequestError } from '../../common/errors/BadRequestError.js'

// 日记请求参数校验（后续可替换为 Zod Schema，见重构计划 §10）
export function validateCreate(body = {}) {
  const { title, content, typingSpeed, deleteCount, pauseDuration, weatherCode, timeColorHex, media } = body
  if (!content || !String(content).trim()) {
    throw new BadRequestError('内容不能为空')
  }
  return { title, content, typingSpeed, deleteCount, pauseDuration, weatherCode, timeColorHex, media }
}

export function validateCalendar(query = {}) {
  const year = Number(query.year)
  const month = Number(query.month)
  if (!year || !month || month < 1 || month > 12) {
    throw new BadRequestError('年份或月份不合法')
  }
  return { year, month }
}
