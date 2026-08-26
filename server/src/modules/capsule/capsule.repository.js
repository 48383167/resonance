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

export function findById(id) {
  const c = db.prepare('SELECT * FROM time_capsules WHERE id = ?').get(id)
  return c ? attachAuthor(c) : c
}

export function list() {
  return db.prepare('SELECT * FROM time_capsules ORDER BY unlock_date ASC, datetime(created_at) DESC').all()
    .map(attachAuthor)
}

export function create({ authorId, title, content, photoUrl, unlockDate }) {
  const id = newId('tc')
  db.prepare('INSERT INTO time_capsules (id, author_id, title, content, photo_url, unlock_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, authorId, title || '', content, photoUrl || '', unlockDate)
  return findById(id)
}

export function remove(id) {
  db.prepare('DELETE FROM time_capsules WHERE id = ?').run(id)
}
