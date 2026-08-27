import { NotFoundError } from '../../common/errors/NotFoundError.js'
import * as coupleService from '../couple/couple.service.js'
import { emitDiaryCreated, emitDiaryUpdated, emitDiaryDeleted } from '../../infrastructure/socket/diary.socket.js'
import { softDeleteQuietly } from '../file/file.service.js'
import * as diaryRepository from './diary.repository.js'
import * as diarySchema from './diary.schema.js'

function coupleIdOf(userId) {
  return coupleService.getUserCouple(userId)?.pairCode || null
}

export function getList() {
  return diaryRepository.listAll()
}

export function getCalendar(query) {
  const { year, month } = diarySchema.validateCalendar(query)
  return diaryRepository.listByMonth(year, month)
}

export function getDetail(id) {
  const entry = diaryRepository.findById(id)
  if (!entry) throw new NotFoundError('日记不存在')
  return diaryRepository.attachContents(entry)
}

export function create(userId, raw) {
  const data = diarySchema.validateCreate(raw)
  const entry = diaryRepository.create({
    title: data.title,
    weatherCode: data.weatherCode,
    timeColorHex: data.timeColorHex,
    media: data.media,
  })
  diaryRepository.createContent({
    entryId: entry.id,
    userId,
    content: data.content,
    typingSpeed: data.typingSpeed,
    deleteCount: data.deleteCount,
    pauseDuration: data.pauseDuration,
  })
  const assembled = diaryRepository.attachContents(entry)
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitDiaryCreated(coupleId, assembled)
  return assembled
}

export function setVisibility(userId, id, isPublic) {
  const entry = diaryRepository.findById(id)
  if (!entry) throw new NotFoundError('日记不存在')
  diaryRepository.setVisibility(id, Boolean(isPublic))
  const assembled = diaryRepository.attachContents(diaryRepository.findById(id))
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitDiaryUpdated(coupleId, assembled)
  return assembled
}

export function remove(userId, id) {
  const entry = diaryRepository.findById(id)
  if (!entry) throw new NotFoundError('日记不存在')
  diaryRepository.remove(id)
  // 级联回收附件文件（软删除墓碑，URL 立即失效）
  let media = []
  try { media = JSON.parse(entry.media || '[]') } catch { /* 忽略 */ }
  for (const m of media) {
    if (m && typeof m === 'object' && m.fileId) softDeleteQuietly(m.fileId, userId)
  }
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitDiaryDeleted(coupleId, id)
  return null
}
