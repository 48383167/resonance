import { randomUUID } from 'node:crypto'
import { db, transaction } from '../../config/database.js'

function newId(prefix) {
  return prefix + '_' + randomUUID().slice(0, 12)
}

export function create({ token, password, expiresAt, includeMoments, includeEntries, includeAnniversaries }) {
  const id = newId('st')
  // 删除旧分享 + 插入新分享原子化：新分享插入失败时不至于误删旧分享
  transaction(() => {
    db.prepare('DELETE FROM share_tokens WHERE status = 1').run() // 同时仅一个有效分享
    db.prepare(
      `INSERT INTO share_tokens
         (id, token, password, expires_at, view_count, status, include_moments, include_entries, include_anniversaries)
       VALUES (?, ?, ?, ?, 0, 1, ?, ?, ?)`
    ).run(
      id,
      token,
      password || '',
      expiresAt || null,
      includeMoments ? 1 : 0,
      includeEntries ? 1 : 0,
      includeAnniversaries ? 1 : 0
    )
  })
  return db.prepare('SELECT * FROM share_tokens WHERE id = ?').get(id)
}

export function getActive() {
  return db.prepare('SELECT * FROM share_tokens WHERE status = 1').get() || null
}

// 更新当前有效分享的内容范围开关；null 表示保留当前值
export function updateActive({ includeMoments = null, includeEntries = null, includeAnniversaries = null }) {
  const st = getActive()
  if (!st) return null
  db.prepare(
    `UPDATE share_tokens SET
       include_moments = COALESCE(?, include_moments),
       include_entries = COALESCE(?, include_entries),
       include_anniversaries = COALESCE(?, include_anniversaries)
     WHERE id = ?`
  ).run(
    includeMoments == null ? null : (includeMoments ? 1 : 0),
    includeEntries == null ? null : (includeEntries ? 1 : 0),
    includeAnniversaries == null ? null : (includeAnniversaries ? 1 : 0),
    st.id
  )
  return db.prepare('SELECT * FROM share_tokens WHERE id = ?').get(st.id)
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
