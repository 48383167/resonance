import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { resolveItems } from '../file/file.service.js'

function getContents(entryId) {
  return db.prepare('SELECT * FROM entry_contents WHERE entry_id = ? ORDER BY rowid ASC').all(entryId)
}

// 批量取正文分片：一次 IN 查询后按 entry_id 分组（列表接口避免逐篇查询）
export function getContentsByEntryIds(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))]
  const byEntry = new Map(uniq.map((id) => [id, []]))
  if (!uniq.length) return byEntry
  const placeholders = uniq.map(() => '?').join(', ')
  const rows = db.prepare(
    `SELECT * FROM entry_contents WHERE entry_id IN (${placeholders}) ORDER BY rowid ASC`
  ).all(...uniq)
  for (const row of rows) byEntry.get(row.entry_id)?.push(row)
  return byEntry
}

function parseMedia(media) {
  try {
    const raw = JSON.parse(media || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function mediaIdsOf(raw) {
  return raw
    .filter((it) => it && typeof it === 'object' && it.fileId)
    .map((it) => it.fileId)
}

// 附件组装：旧值 {url,type} 兼容直出；新值 {fileId,type} → files 表解析出 {id,url,type,name}
function mapMedia(raw, byId) {
  return raw.map((it) => {
    if (typeof it === 'string' && it) return { id: '', url: it, type: 'file', name: '' }
    if (!it || typeof it !== 'object') return null
    if (it.fileId) return byId.get(it.fileId) || null
    if (it.url) return { id: '', url: it.url, type: it.type || 'file', name: '' }
    return null
  }).filter(Boolean)
}

function assembleMedia(entry, byId) {
  const raw = parseMedia(entry.media)
  const fileMap = byId || new Map(resolveItems(mediaIdsOf(raw)).map((i) => [i.id, i]))
  entry.media = mapMedia(raw, fileMap)
  return entry
}

// 组装单篇日记：挂载内容分片 + 解析附件 JSON（就地修改并返回）
export function attachContents(entry) {
  entry.contents = getContents(entry.id)
  return assembleMedia(entry)
}

// 批量组装日记：正文分片一次 IN 查询、附件一次性解析，供列表接口使用
export function attachContentsBatch(entries) {
  if (!entries.length) return entries
  const contentMap = getContentsByEntryIds(entries.map((entry) => entry.id))
  const mediaRaw = new Map(entries.map((entry) => [entry.id, parseMedia(entry.media)]))
  const allFileIds = []
  for (const raw of mediaRaw.values()) allFileIds.push(...mediaIdsOf(raw))
  const byId = new Map(resolveItems(allFileIds).map((i) => [i.id, i]))
  for (const entry of entries) {
    entry.contents = contentMap.get(entry.id) || []
    entry.media = mapMedia(mediaRaw.get(entry.id), byId)
  }
  return entries
}

export function findById(id) {
  return db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
}

export function listAll() {
  return db.prepare('SELECT * FROM entries ORDER BY datetime(created_at) DESC, id DESC').all()
}

// 分页列表：按创建时间倒序（id 兜底保证翻页不重不漏）
export function listPage(offset, limit) {
  const total = db.prepare('SELECT COUNT(*) AS c FROM entries').get().c
  const items = db.prepare(
    'SELECT * FROM entries ORDER BY datetime(created_at) DESC, id DESC LIMIT ? OFFSET ?'
  ).all(limit, offset)
  return { items, total }
}

export function listPublic() {
  return db.prepare('SELECT * FROM entries WHERE is_public = 1 ORDER BY datetime(created_at) DESC, id DESC').all()
}

export function listByMonth(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = `${year}-${String(month).padStart(2, '0')}-31`
  return db.prepare(
    'SELECT * FROM entries WHERE date(created_at) BETWEEN ? AND ? ORDER BY datetime(created_at) DESC, id DESC'
  ).all(start, end)
}

export function create({ title, weatherCode, timeColorHex, media }) {
  const id = 'e_' + randomUUID().slice(0, 12)
  db.prepare(
    "INSERT INTO entries (id, type, title, weather_code, time_color_hex, media) VALUES (?, 'solo', ?, ?, ?, ?)"
  ).run(id, title || null, weatherCode || null, timeColorHex || null, JSON.stringify(media || []))
  return findById(id)
}

export function createContent({ entryId, userId, content, typingSpeed, deleteCount, pauseDuration }) {
  const id = 'c_' + randomUUID().slice(0, 12)
  db.prepare(
    `INSERT INTO entry_contents (id, entry_id, user_id, content, typing_speed, delete_count, pause_duration, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted')`
  ).run(id, entryId, userId, content, typingSpeed || 0, deleteCount || 0, pauseDuration || 0)
  return db.prepare('SELECT * FROM entry_contents WHERE id = ?').get(id)
}

// 正文作者列表：供评论模块做情侣空间归属校验
export function listContentUserIds(entryId) {
  return db.prepare('SELECT user_id FROM entry_contents WHERE entry_id = ?').all(entryId).map((r) => r.user_id)
}

export function findContentByUser(entryId, userId) {
  return db.prepare(
    'SELECT * FROM entry_contents WHERE entry_id = ? AND user_id = ? ORDER BY rowid ASC LIMIT 1'
  ).get(entryId, userId)
}

export function update(id, { title, weatherCode, timeColorHex, media }) {
  db.prepare(
    'UPDATE entries SET title = ?, weather_code = ?, time_color_hex = ?, media = ? WHERE id = ?'
  ).run(title ? String(title).trim() : null, weatherCode ?? null, timeColorHex ?? null, JSON.stringify(media || []), id)
  return findById(id)
}

export function updateContent(id, { content, typingSpeed, deleteCount, pauseDuration }) {
  db.prepare(
    `UPDATE entry_contents
     SET content = ?,
         typing_speed = COALESCE(?, typing_speed),
         delete_count = COALESCE(?, delete_count),
         pause_duration = COALESCE(?, pause_duration)
     WHERE id = ?`
  ).run(content, typingSpeed ?? null, deleteCount ?? null, pauseDuration ?? null, id)
  return db.prepare('SELECT * FROM entry_contents WHERE id = ?').get(id)
}

export function setVisibility(id, isPublic) {
  db.prepare('UPDATE entries SET is_public = ? WHERE id = ?').run(isPublic ? 1 : 0, id)
}

export function remove(id) {
  db.prepare('DELETE FROM entry_contents WHERE entry_id = ?').run(id)
  db.prepare('DELETE FROM entries WHERE id = ?').run(id)
}
