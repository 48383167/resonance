import { db } from '../../config/database.js'
import { resolveUrl } from '../file/file.service.js'

// 跨模块聚合查询：Dashboard / 恋爱树 / 分享页 / 时间线共用
// 单条标量子查询一次取回所有计数（原先 10 次独立 COUNT）
// userId 可选：传入时「未读情书」只算别人寄给我的（自己写的信不该算自己未读）
export function stats({ includeMoments = true, includeEntries = true, includeAnniversaries = true, includeFoods = true, userId = null } = {}) {
  const unreadLettersSql = userId
    ? "(SELECT COUNT(*) FROM love_letters WHERE is_read = 0 AND sender_id != ?) AS unreadLetters"
    : "(SELECT COUNT(*) FROM love_letters WHERE is_read = 0) AS unreadLetters"
  const row = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM moments) AS moments,
       (SELECT COUNT(*) FROM moment_photos) + (SELECT COUNT(*) FROM album_photos) AS photos,
       (SELECT COUNT(*) FROM love_letters) AS letters,
       ${unreadLettersSql},
       (SELECT COUNT(*) FROM entries) AS entries,
       (SELECT COUNT(*) FROM wish_items WHERE status = 'todo') AS wishesTodo,
       (SELECT COUNT(*) FROM wish_items WHERE status = 'doing') AS wishesDoing,
       (SELECT COUNT(*) FROM wish_items WHERE status = 'done') AS wishesDone,
       (SELECT COUNT(*) FROM time_capsules) AS capsules,
       (SELECT COUNT(*) FROM anniversaries) AS anniversaries,
       (SELECT COUNT(*) FROM food_places) AS foods`
  ).get(...(userId ? [userId] : []))
  return {
    moments: includeMoments ? row.moments : 0,
    photos: row.photos,
    letters: row.letters,
    unreadLetters: row.unreadLetters,
    entries: includeEntries ? row.entries : 0,
    wishesTodo: row.wishesTodo,
    wishesDoing: row.wishesDoing,
    wishesDone: row.wishesDone,
    capsules: row.capsules,
    anniversaries: includeAnniversaries ? row.anniversaries : 0,
    foods: includeFoods ? row.foods : 0,
  }
}

export function listUsers() {
  return db.prepare('SELECT id, username, nickname, avatar_url, avatar_file_id, pair_code, paired_at FROM users ORDER BY paired_at ASC').all()
    .map((u) => {
      u.avatar_url = u.avatar_file_id ? resolveUrl(u.avatar_file_id) : (u.avatar_url || '')
      return u
    })
}
