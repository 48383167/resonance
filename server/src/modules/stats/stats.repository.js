import { db } from '../../config/database.js'
import { resolveUrl } from '../file/file.service.js'

// 跨模块聚合查询：Dashboard / 恋爱树 / 分享页 / 时间线共用
export function stats() {
  const one = (sql, ...args) => db.prepare(sql).get(...args).c
  return {
    moments: one('SELECT COUNT(*) AS c FROM moments'),
    photos: one('SELECT COUNT(*) AS c FROM moment_photos') + one('SELECT COUNT(*) AS c FROM album_photos'),
    letters: one('SELECT COUNT(*) AS c FROM love_letters'),
    unreadLetters: one('SELECT COUNT(*) AS c FROM love_letters WHERE is_read = 0'),
    entries: one('SELECT COUNT(*) AS c FROM entries'),
    wishesTodo: one("SELECT COUNT(*) AS c FROM wish_items WHERE status = 'todo'"),
    wishesDoing: one("SELECT COUNT(*) AS c FROM wish_items WHERE status = 'doing'"),
    wishesDone: one("SELECT COUNT(*) AS c FROM wish_items WHERE status = 'done'"),
    capsules: one('SELECT COUNT(*) AS c FROM time_capsules'),
    anniversaries: one('SELECT COUNT(*) AS c FROM anniversaries'),
  }
}

export function listUsers() {
  return db.prepare('SELECT id, username, nickname, avatar_url, avatar_file_id, pair_code, paired_at FROM users ORDER BY paired_at ASC').all()
    .map((u) => {
      u.avatar_url = u.avatar_file_id ? resolveUrl(u.avatar_file_id) : (u.avatar_url || '')
      return u
    })
}
