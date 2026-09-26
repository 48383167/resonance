import { NotFoundError } from '../../common/errors/NotFoundError.js'
import { ForbiddenError } from '../../common/errors/ForbiddenError.js'
import { transaction } from '../../config/database.js'
import { parsePage } from '../../common/utils/paging.js'
import * as coupleService from '../couple/couple.service.js'
import { emitDiaryCreated, emitDiaryUpdated, emitDiaryDeleted } from '../../infrastructure/socket/diary.socket.js'
import { softDeleteQuietly } from '../file/file.service.js'
import * as commentService from '../comment/comment.service.js'
import * as readService from '../read/read.service.js'
import * as diaryRepository from './diary.repository.js'
import * as diarySchema from './diary.schema.js'

function coupleIdOf(userId) {
  return coupleService.getUserCouple(userId)?.pairCode || null
}

// 列表装饰：评论未读 + 内容未读（Ta 新写、我还没打开过日记列表）
function decorateEntries(entries, userId) {
  commentService.attachCounts('entry', entries, userId)
  return readService.attachUnread('entry', userId, entries)
}

// 列表：带 limit/offset 时返回 { items, total }（新分页契约）；否则保持旧数组形态
export function getList(userId, query = {}) {
  const { offset, limit, paginated } = parsePage(query)
  if (!paginated) {
    const entries = diaryRepository.attachContentsBatch(diaryRepository.listAll())
    return decorateEntries(entries, userId)
  }
  const { items, total } = diaryRepository.listPage(offset, limit)
  diaryRepository.attachContentsBatch(items)
  return { items: decorateEntries(items, userId), total }
}

export function getCalendar(query, userId) {
  const { year, month } = diarySchema.validateCalendar(query)
  const entries = diaryRepository.attachContentsBatch(diaryRepository.listByMonth(year, month))
  return decorateEntries(entries, userId)
}

export function getDetail(id) {
  const entry = diaryRepository.findById(id)
  if (!entry) throw new NotFoundError('日记不存在')
  return diaryRepository.attachContents(entry)
}

export function create(userId, raw) {
  const data = diarySchema.validateCreate(raw)
  // entries + entry_contents 两写原子化：任一失败整体回滚，避免产生孤儿日记或孤儿内容
  const entry = transaction(() => {
    const created = diaryRepository.create({
      title: data.title,
      weatherCode: data.weatherCode,
      timeColorHex: data.timeColorHex,
      media: data.media,
    })
    diaryRepository.createContent({
      entryId: created.id,
      userId,
      content: data.content,
      typingSpeed: data.typingSpeed,
      deleteCount: data.deleteCount,
      pauseDuration: data.pauseDuration,
    })
    return created
  })
  const assembled = diaryRepository.attachContents(entry)
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitDiaryCreated(coupleId, assembled)
  return assembled
}

function mediaFileIds(media) {
  let raw = media
  if (typeof media === 'string') {
    try { raw = JSON.parse(media) } catch { raw = [] /* 忽略损坏的附件数据 */ }
  }
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m) => m && typeof m === 'object' && m.fileId)
    .map((m) => m.fileId)
}

export function update(userId, id, raw) {
  const entry = diaryRepository.findById(id)
  if (!entry) throw new NotFoundError('日记不存在')

  const content = diaryRepository.findContentByUser(id, userId)
  if (!content) throw new ForbiddenError('只能编辑自己写的日记')

  const data = diarySchema.validateUpdate(raw)
  const nextIds = new Set(mediaFileIds(data.media))
  for (const fileId of mediaFileIds(entry.media)) {
    if (!nextIds.has(fileId)) softDeleteQuietly(fileId, userId)
  }

  diaryRepository.update(id, data)
  diaryRepository.updateContent(content.id, data)
  const assembled = diaryRepository.attachContents(diaryRepository.findById(id))
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitDiaryUpdated(coupleId, assembled)
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
  commentService.removeByTarget('entry', id)
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
