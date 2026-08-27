import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { findById as findUserById } from '../auth/auth.repository.js'

function newId(prefix) {
  return prefix + '_' + randomUUID().slice(0, 12)
}

function attachAuthor(capsule) {
  capsule.author = findUserById(capsule.author_id)
  return capsule
}

// 配图解析：photo_file_id 联 files 出 URL（迁移前旧行仅有 photo_url 时兜底直出）
function resolvePhoto(c) {
  if (c.photo_file_id) {
    c.photo_url = c.photo_status === 1 ? `/media/${c.photo_path}` : ''
  } else {
    c.photo_url = c.photo_url || ''
  }
  return c
}

export function findById(id) {
  const c = db.prepare(
    `SELECT c.*, f.path AS photo_path, f.status AS photo_status
     FROM time_capsules c LEFT JOIN files f ON f.id = c.photo_file_id
     WHERE c.id = ?`
  ).get(id)
  return c ? attachAuthor(resolvePhoto(c)) : c
}

export function list() {
  return db.prepare(
    `SELECT c.*, f.path AS photo_path, f.status AS photo_status
     FROM time_capsules c LEFT JOIN files f ON f.id = c.photo_file_id
     ORDER BY c.unlock_date ASC, datetime(c.created_at) DESC`
  ).all()
    .map((c) => attachAuthor(resolvePhoto(c)))
}

export function create({ authorId, title, content, photoFileId, unlockDate }) {
  const id = newId('tc')
  db.prepare('INSERT INTO time_capsules (id, author_id, title, content, photo_file_id, unlock_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, authorId, title || '', content, photoFileId || null, unlockDate)
  return findById(id)
}

export function remove(id) {
  db.prepare('DELETE FROM time_capsules WHERE id = ?').run(id)
}
