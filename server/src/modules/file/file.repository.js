import { db } from '../../config/database.js'

export function create({ id, userId, path, size, mime, originalName, createdAt }) {
  db.prepare(
    `INSERT INTO files (id, user_id, path, size, mime, original_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ','now')))`
  ).run(id, userId || null, path, size || 0, mime || '', originalName || '', createdAt || null)
  return findById(id)
}

export function findById(id) {
  if (!id) return null
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id)
}

export function findActiveByIds(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))]
  if (!uniq.length) return []
  const marks = uniq.map(() => '?').join(',')
  return db.prepare(`SELECT * FROM files WHERE id IN (${marks}) AND status = 1`).all(...uniq)
}

export function markTombstoned(id, trashPath) {
  db.prepare(
    `UPDATE files SET status = 0, trash_path = ?,
       deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
  ).run(trashPath, id)
}

export function findByPath(path) {
  return db.prepare('SELECT * FROM files WHERE path = ?').get(path)
}
