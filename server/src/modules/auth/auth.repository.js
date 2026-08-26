import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'

// 不含 password_hash 的公开用户字段（登录态用户对象）
const PUBLIC_USER = 'id, username, nickname, avatar_url, pair_code, paired_at'

export function countUsers() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c
}

export function findById(id) {
  return db.prepare(`SELECT ${PUBLIC_USER} FROM users WHERE id = ?`).get(id)
}

export function findByUsername(username) {
  return db.prepare(
    'SELECT id, username, password_hash, nickname, avatar_url, pair_code, paired_at FROM users WHERE username = ?'
  ).get(username)
}

export function findByPairCode(code) {
  return db.prepare(`SELECT ${PUBLIC_USER} FROM users WHERE pair_code = ?`).get(code)
}

export function findPartnerOf(userId, pairCode) {
  const rows = db.prepare(`SELECT ${PUBLIC_USER} FROM users WHERE pair_code = ?`).all(pairCode)
  return rows.find((r) => r.id !== userId) || null
}

export function create({ username, passwordHash, nickname, pairCode }) {
  const id = 'u_' + randomUUID().slice(0, 12)
  db.prepare(
    'INSERT INTO users (id, username, password_hash, nickname, pair_code) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, passwordHash, nickname, pairCode)
  return findById(id)
}

export function markPaired(pairCode) {
  db.prepare("UPDATE users SET paired_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE pair_code = ?").run(pairCode)
}

export function setPassword(id, passwordHash) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id)
}

export function updateUser(id, { nickname, avatarUrl }) {
  db.prepare('UPDATE users SET nickname = COALESCE(?, nickname), avatar_url = COALESCE(?, avatar_url) WHERE id = ?')
    .run(nickname || null, avatarUrl || null, id)
  return findById(id)
}
