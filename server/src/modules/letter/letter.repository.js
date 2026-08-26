import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { findById as findUserById } from '../auth/auth.repository.js'

function newId(prefix) {
  return prefix + '_' + randomUUID().slice(0, 12)
}

function attachSender(letter) {
  letter.sender = findUserById(letter.sender_id)
  return letter
}

export function findById(id) {
  const l = db.prepare('SELECT * FROM love_letters WHERE id = ?').get(id)
  return l ? attachSender(l) : l
}

export function list() {
  const rows = db.prepare('SELECT * FROM love_letters ORDER BY datetime(created_at) DESC').all()
  return rows.map(attachSender)
}

export function create({ senderId, title, content, isSecret }) {
  const id = newId('l')
  db.prepare('INSERT INTO love_letters (id, sender_id, title, content, is_secret, is_read) VALUES (?, ?, ?, ?, ?, 0)')
    .run(id, senderId, title || '', content, isSecret ? 1 : 0)
  return findById(id)
}

export function markRead(id) {
  db.prepare("UPDATE love_letters SET is_read = 1, read_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = ? AND is_read = 0").run(id)
}

export function update(id, { title, content, isSecret }) {
  db.prepare(
    'UPDATE love_letters SET title = COALESCE(?, title), content = COALESCE(?, content), is_secret = COALESCE(?, is_secret) WHERE id = ?'
  ).run(title ?? null, content ?? null, isSecret == null ? null : (isSecret ? 1 : 0), id)
  return findById(id)
}

export function remove(id) {
  db.prepare('DELETE FROM love_letters WHERE id = ?').run(id)
}
