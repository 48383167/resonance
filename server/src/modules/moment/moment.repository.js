import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { findById as findUserById } from '../auth/auth.repository.js'

function newId(prefix) {
  return prefix + '_' + randomUUID().slice(0, 12)
}

function getPhotos(momentId) {
  return db.prepare('SELECT url FROM moment_photos WHERE moment_id = ?').all(momentId).map((r) => r.url)
}

function attachAuthor(moment) {
  moment.author = findUserById(moment.user_id)
  return moment
}

function setPhotos(momentId, photos) {
  db.prepare('DELETE FROM moment_photos WHERE moment_id = ?').run(momentId)
  for (const url of photos) {
    db.prepare('INSERT INTO moment_photos (id, moment_id, url) VALUES (?, ?, ?)').run(newId('mp'), momentId, url)
  }
}

export function findById(id) {
  const m = db.prepare('SELECT * FROM moments WHERE id = ?').get(id)
  if (!m) return null
  m.photos = getPhotos(id)
  return attachAuthor(m)
}

export function list({ mood, keyword, startDate, endDate } = {}) {
  const conds = []
  const args = []
  if (mood) { conds.push('mood = ?'); args.push(mood) }
  if (keyword) { conds.push('(content LIKE ? OR location LIKE ?)'); args.push(`%${keyword}%`, `%${keyword}%`) }
  if (startDate) { conds.push('COALESCE(moment_date, date(created_at)) >= ?'); args.push(startDate) }
  if (endDate) { conds.push('COALESCE(moment_date, date(created_at)) <= ?'); args.push(endDate) }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''
  const rows = db.prepare(
    `SELECT * FROM moments ${where} ORDER BY COALESCE(moment_date, date(created_at)) DESC, datetime(created_at) DESC`
  ).all(...args)
  return rows.map((m) => {
    m.photos = getPhotos(m.id)
    return attachAuthor(m)
  })
}

// 恋爱地图：所有带坐标的瞬间（按时间升序，原始字段，不挂 author/photos）
export function listWithCoords() {
  return db.prepare(
    'SELECT * FROM moments WHERE longitude IS NOT NULL AND latitude IS NOT NULL ORDER BY COALESCE(moment_date, date(created_at)) ASC'
  ).all()
}

export function create({ userId, content, mood, location, longitude, latitude, momentDate, photos }) {
  const id = newId('m')
  db.prepare(
    'INSERT INTO moments (id, user_id, content, mood, location, longitude, latitude, moment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, userId, content, mood || 'normal', location || '', longitude ?? null, latitude ?? null, momentDate || null)
  setPhotos(id, photos || [])
  return findById(id)
}

export function update(id, { content, mood, location, longitude, latitude, momentDate, photos }) {
  db.prepare(
    'UPDATE moments SET content = COALESCE(?, content), mood = COALESCE(?, mood), location = COALESCE(?, location), longitude = COALESCE(?, longitude), latitude = COALESCE(?, latitude), moment_date = COALESCE(?, moment_date) WHERE id = ?'
  ).run(content ?? null, mood ?? null, location ?? null, longitude ?? null, latitude ?? null, momentDate ?? null, id)
  if (photos) setPhotos(id, photos)
  return findById(id)
}

export function remove(id) {
  db.prepare('DELETE FROM moment_photos WHERE moment_id = ?').run(id)
  db.prepare('DELETE FROM moments WHERE id = ?').run(id)
}
