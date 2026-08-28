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
// 起始日优先取手动设置的 first_meet_at，未设置时回退 paired_at
export function daysTogether() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  if (count < 2) return 0
  const row = db.prepare("SELECT MIN(COALESCE(NULLIF(first_meet_at, ''), paired_at)) AS t FROM users WHERE paired_at IS NOT NULL").get()
  if (!row?.t) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(row.t).getTime()) / 86400000))
}

export function pairStartedAt() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  if (count < 2) return null
  const row = db.prepare("SELECT MIN(COALESCE(NULLIF(first_meet_at, ''), paired_at)) AS t FROM users WHERE paired_at IS NOT NULL").get()
  return row?.t || null
}

// 手动设置的相识日期（双人空间共享，任一成员行有值即可）
export function getFirstMeetAt() {
  const row = db.prepare("SELECT first_meet_at FROM users WHERE first_meet_at IS NOT NULL AND first_meet_at != '' LIMIT 1").get()
  return row?.first_meet_at || null
}

// 双方任何一方设置后，按 pair_code 同步到两位成员
export function setFirstMeetAt(pairCode, date) {
  db.prepare('UPDATE users SET first_meet_at = ? WHERE pair_code = ?').run(date, pairCode)
}
