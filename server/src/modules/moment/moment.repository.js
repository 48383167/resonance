import { randomUUID } from 'node:crypto'
import { db, transaction } from '../../config/database.js'
import { findById as findUserById } from '../auth/auth.repository.js'
import { typeOfMime } from '../file/file.service.js'

function newId(prefix) {
  return prefix + '_' + randomUUID().slice(0, 12)
}

// 照片组装：file_id 联 files 表出 {id,url,type,name}；迁移前旧行（仅有 url）兼容直出
function getPhotos(momentId) {
  const rows = db.prepare(
    `SELECT mp.id AS photo_id, mp.file_id, mp.url AS legacy_url,
            f.path, f.mime, f.original_name, f.status AS file_status
     FROM moment_photos mp
     LEFT JOIN files f ON f.id = mp.file_id
     WHERE mp.moment_id = ? AND COALESCE(f.status, 1) = 1
     ORDER BY datetime(mp.created_at) ASC, mp.id ASC`
  ).all(momentId)
  return rows.map((r) => {
    if (r.file_id && r.file_status === 1) {
      return { id: r.file_id, url: `/media/${r.path}`, type: typeOfMime(r.mime), name: r.original_name || '' }
    }
    return { id: '', url: r.file_id ? '' : (r.legacy_url || ''), type: 'file', name: '' }
  })
}

function attachAuthor(moment) {
  moment.author = findUserById(moment.user_id)
  return moment
}

function setPhotos(momentId, fileIds) {
  db.prepare('DELETE FROM moment_photos WHERE moment_id = ?').run(momentId)
  for (const fileId of fileIds || []) {
    // 旧库的 url 可能仍是 NOT NULL；新文件 ID 模式下保留空旧值，由 files 表提供真实 URL。
    db.prepare('INSERT INTO moment_photos (id, moment_id, url, file_id) VALUES (?, ?, ?, ?)')
      .run(newId('mp'), momentId, '', fileId)
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

// 分享链接公开列表：仅展示 show_in_share = 1 的瞬间（条目级可见性）
export function listPublic() {
  const rows = db.prepare(
    'SELECT * FROM moments WHERE show_in_share = 1 ORDER BY COALESCE(moment_date, date(created_at)) DESC, datetime(created_at) DESC'
  ).all()
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
  // moments + moment_photos 两写原子化：照片写入失败时回滚主记录
  transaction(() => {
    db.prepare(
      'INSERT INTO moments (id, user_id, content, mood, location, longitude, latitude, moment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, userId, content, mood || 'normal', location || '', longitude ?? null, latitude ?? null, momentDate || null)
    setPhotos(id, photos || [])
  })
  return findById(id)
}

export function update(id, { content, mood, location, longitude, latitude, momentDate, photos }) {
  db.prepare(
    'UPDATE moments SET content = COALESCE(?, content), mood = COALESCE(?, mood), location = COALESCE(?, location), longitude = COALESCE(?, longitude), latitude = COALESCE(?, latitude), moment_date = COALESCE(?, moment_date) WHERE id = ?'
  ).run(content ?? null, mood ?? null, location ?? null, longitude ?? null, latitude ?? null, momentDate ?? null, id)
  if (photos) setPhotos(id, photos)
  return findById(id)
}

// 条目级分享可见性：仅更新 show_in_share 一列
export function updateShowInShare(id, showInShare) {
  db.prepare('UPDATE moments SET show_in_share = ? WHERE id = ?').run(showInShare ? 1 : 0, id)
  return findById(id)
}

export function remove(id) {
  db.prepare('DELETE FROM moment_photos WHERE moment_id = ?').run(id)
  db.prepare('DELETE FROM moments WHERE id = ?').run(id)
}
