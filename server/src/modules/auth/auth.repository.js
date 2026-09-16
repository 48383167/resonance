import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { resolveUrl } from '../file/file.service.js'

// 不含 password_hash 的公开用户字段（登录态用户对象）
const PUBLIC_USER = 'id, username, nickname, gender, avatar_url, avatar_file_id, pair_code, paired_at'

// 进程内公开用户缓存：只有两名用户，公开字段仅在 create/updateUser/markPaired 变更，
// 这三个写入点统一失效，可消除列表接口逐行查用户的 N+1（调用方只读，勿修改返回对象）。
const userCache = new Map()

function invalidateUserCache() {
  userCache.clear()
}

// 头像 URL 解析：优先 avatar_file_id → files 表；迁移前旧行兜底 avatar_url
function resolveAvatar(u) {
  if (!u) return u
  u.avatar_url = u.avatar_file_id ? resolveUrl(u.avatar_file_id) : (u.avatar_url || '')
  return u
}

export function countUsers() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c
}

export function findById(id) {
  if (!id) return null
  if (userCache.has(id)) return userCache.get(id)
  const user = resolveAvatar(db.prepare(`SELECT ${PUBLIC_USER} FROM users WHERE id = ?`).get(id))
  if (user) userCache.set(id, user)
  return user
}

export function findByUsername(username) {
  return resolveAvatar(db.prepare(
    'SELECT id, username, password_hash, nickname, gender, avatar_url, avatar_file_id, pair_code, paired_at FROM users WHERE username = ?'
  ).get(username))
}

export function findByPairCode(code) {
  return resolveAvatar(db.prepare(`SELECT ${PUBLIC_USER} FROM users WHERE pair_code = ?`).get(code))
}

export function findPartnerOf(userId, pairCode) {
  const rows = db.prepare(`SELECT ${PUBLIC_USER} FROM users WHERE pair_code = ?`).all(pairCode)
  return resolveAvatar(rows.find((r) => r.id !== userId) || null)
}

export function create({ username, passwordHash, nickname, pairCode }) {
  const id = 'u_' + randomUUID().slice(0, 12)
  db.prepare(
    'INSERT INTO users (id, username, password_hash, nickname, pair_code) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, passwordHash, nickname, pairCode)
  invalidateUserCache()
  return findById(id)
}

export function markPaired(pairCode) {
  db.prepare("UPDATE users SET paired_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE pair_code = ?").run(pairCode)
  invalidateUserCache()
}

export function setPassword(id, passwordHash) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id)
}

export function updateUser(id, { nickname, avatarFileId, gender }) {
  db.prepare('UPDATE users SET nickname = COALESCE(?, nickname), avatar_file_id = COALESCE(?, avatar_file_id), gender = COALESCE(?, gender) WHERE id = ?')
    .run(nickname || null, avatarFileId || null, gender ?? null, id)
  invalidateUserCache()
  return findById(id)
}
