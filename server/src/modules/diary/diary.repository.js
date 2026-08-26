import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'

function getContents(entryId) {
  return db.prepare('SELECT * FROM entry_contents WHERE entry_id = ?').all(entryId)
}

// 组装日记：挂载内容分片 + 解析附件 JSON（就地修改并返回）
export function attachContents(entry) {
  entry.contents = getContents(entry.id)
  try {
    entry.media = JSON.parse(entry.media || '[]')
  } catch {
    entry.media = []
  }
  return entry
}

export function findById(id) {
  return db.prepare('SELECT * FROM entries WHERE id = ?').get(id)
}

export function listAll() {
  return db.prepare('SELECT * FROM entries ORDER BY created_at DESC').all().map(attachContents)
}

export function listPublic() {
  return db.prepare('SELECT * FROM entries WHERE is_public = 1 ORDER BY created_at DESC').all().map(attachContents)
}

export function listByMonth(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = `${year}-${String(month).padStart(2, '0')}-31`
  return db.prepare(
    'SELECT * FROM entries WHERE date(created_at) BETWEEN ? AND ? ORDER BY datetime(created_at) DESC'
  ).all(start, end).map(attachContents)
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

export function setVisibility(id, isPublic) {
  db.prepare('UPDATE entries SET is_public = ? WHERE id = ?').run(isPublic ? 1 : 0, id)
}

export function remove(id) {
  db.prepare('DELETE FROM entry_contents WHERE entry_id = ?').run(id)
  db.prepare('DELETE FROM entries WHERE id = ?').run(id)
}
