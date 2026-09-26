import { db } from '../../config/database.js'
import { MODULES, EPOCH } from './read.registry.js'

// 内容未读水位读写：module_reads 每（用户 × 模块）一行，只存最后一次打开列表的时间点。

export function getLastReadAt(userId, module) {
  const row = db.prepare(
    'SELECT last_read_at FROM module_reads WHERE user_id = ? AND module = ?'
  ).get(userId, module)
  return row?.last_read_at || null
}

// 本次请求统一取一次"现在"，保证同一批数据用同一个水位
export function now() {
  return db.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now') AS now").get().now
}

export function markRead(userId, module) {
  const at = now()
  db.prepare(
    `INSERT INTO module_reads (user_id, module, last_read_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id, module) DO UPDATE SET last_read_at = excluded.last_read_at`
  ).run(userId, module, at)
  return at
}

// 某模块中"对方在我上次打开列表之后新增"的条数
export function countUnread(module, userId) {
  const meta = MODULES[module]
  if (!meta) return 0
  if (meta.perItemRead) {
    return db.prepare(
      'SELECT COUNT(*) AS c FROM love_letters WHERE is_read = 0 AND sender_id != ?'
    ).get(userId).c
  }
  const since = getLastReadAt(userId, module) || EPOCH
  if (meta.viaContents) {
    // 日记：我在 entry_contents 里没有任何分片 → 这篇是 Ta 写的（无正文的孤儿行不计）
    return db.prepare(
      `SELECT COUNT(*) AS c FROM entries e
        WHERE e.created_at > ?
          AND EXISTS (SELECT 1 FROM entry_contents ec0 WHERE ec0.entry_id = e.id)
          AND NOT EXISTS (
            SELECT 1 FROM entry_contents ec WHERE ec.entry_id = e.id AND ec.user_id = ?
          )`
    ).get(since, userId).c
  }
  // authorColumn IS NOT NULL：旧数据可能没有作者，按"非未读"处理，避免历史内容集体弹角标
  const extra = meta.extraWhere ? ` AND ${meta.extraWhere}` : ''
  return db.prepare(
    `SELECT COUNT(*) AS c FROM ${meta.table}
      WHERE ${meta.authorColumn} IS NOT NULL
        AND ${meta.authorColumn} != ?
        AND ${meta.timeColumn} > ?${extra}`
  ).get(userId, since).c
}
