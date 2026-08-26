import { db } from '../../config/database.js'

// 双人配对模型：两个 users 行共享同一 pair_code，即一个「情侣空间」。
// 不含 password_hash 的公开字段。
const PUBLIC_USER = 'id, username, nickname, avatar_url, pair_code, paired_at'

export function findById(id) {
  return db.prepare(`SELECT ${PUBLIC_USER} FROM users WHERE id = ?`).get(id)
}

export function findMembersByPairCode(pairCode) {
  return db.prepare(`SELECT ${PUBLIC_USER} FROM users WHERE pair_code = ? ORDER BY paired_at ASC`).all(pairCode)
}

// 只有真正配对（两人都在）后才开始计算相识天数
export function daysSincePaired() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  if (count < 2) return 0
  const row = db.prepare('SELECT MIN(paired_at) AS t FROM users WHERE paired_at IS NOT NULL').get()
  if (!row?.t) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(row.t).getTime()) / 86400000))
}

export function pairStartedAt() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  if (count < 2) return null
  const row = db.prepare('SELECT MIN(paired_at) AS t FROM users WHERE paired_at IS NOT NULL').get()
  return row?.t || null
}
