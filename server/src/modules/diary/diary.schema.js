import { BadRequestError } from '../../common/errors/BadRequestError.js'

// 日记请求参数校验（后续可替换为 Zod Schema，见重构计划 §10）
function normalizeMedia(media, includeLegacyUrls = false) {
  if (!Array.isArray(media)) return []
  return media
    .filter((m) => m && typeof m === 'object' && (m.fileId || (includeLegacyUrls && m.url)))
    .map((m) => {
      const type = ['image', 'video', 'file'].includes(m.type) ? m.type : 'file'
      if (m.fileId) return { fileId: String(m.fileId), type }
      return { url: String(m.url), type }
    })
}

export function validateCreate(body = {}) {
  const { title, content, typingSpeed, deleteCount, pauseDuration, weatherCode, timeColorHex, media } = body
  if (!content || !String(content).trim()) {
    throw new BadRequestError('内容不能为空')
  }
  const normalizedMedia = normalizeMedia(media)
  return { title, content, typingSpeed, deleteCount, pauseDuration, weatherCode, timeColorHex, media: normalizedMedia }
}

// 编辑使用完整提交：正文必填，附件数组用于明确替换现有附件。
// 允许旧版 URL 继续保留，避免编辑旧数据时意外丢失附件。
export function validateUpdate(body = {}) {
  const { title, content, typingSpeed, deleteCount, pauseDuration, weatherCode, timeColorHex, media } = body
  if (!content || !String(content).trim()) {
    throw new BadRequestError('内容不能为空')
  }
  return {
    title,
    content,
    typingSpeed,
    deleteCount,
    pauseDuration,
    weatherCode,
    timeColorHex,
    media: normalizeMedia(media, true),
  }
}

export function validateCalendar(query = {}) {
  const year = Number(query.year)
  const month = Number(query.month)
  if (!year || !month || month < 1 || month > 12) {
    throw new BadRequestError('年份或月份不合法')
  }
  return { year, month }
}
