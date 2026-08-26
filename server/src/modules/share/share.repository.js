import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'

function newId(prefix) {
  return prefix + '_' + randomUUID().slice(0, 12)
}

export function create({ token, password, expiresAt }) {
  db.prepare('DELETE FROM share_tokens WHERE status = 1') // 同时仅一个有效分享
  const id = newId('st')
  db.prepare('INSERT INTO share_tokens (id, token, password, expires_at, view_count, status) VALUES (?, ?, ?, ?, 0, 1)')
    .run(id, token, password || '', expiresAt || null)
  return db.prepare('SELECT * FROM share_tokens WHERE id = ?').get(id)
}

export function getActive() {
  return db.prepare('SELECT * FROM share_tokens WHERE status = 1').get() || null
}

export function findByToken(token) {
  return db.prepare('SELECT * FROM share_tokens WHERE token = ?').get(token) || null
}

export function disable() {
  db.prepare('UPDATE share_tokens SET status = 0 WHERE status = 1').run()
}

export function incrementViewCount(token) {
  db.prepare('UPDATE share_tokens SET view_count = view_count + 1 WHERE token = ?').run(token)
}
