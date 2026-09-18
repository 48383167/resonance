import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'

// AI 整理建议：结果按 scope（情侣空间）共享；内容哈希未变时复用，不重新调用模型。
export function findLatest(scope, target) {
  return db.prepare(
    'SELECT * FROM notebook_suggestions WHERE scope = ? AND target = ?'
  ).get(scope, target) || null
}

export function upsert(scope, target, contentHash, result) {
  db.prepare(`
    INSERT INTO notebook_suggestions (id, scope, target, content_hash, result_json, updated_at)
    VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(scope, target) DO UPDATE SET
      content_hash = excluded.content_hash,
      result_json = excluded.result_json,
      updated_at = excluded.updated_at
  `).run(`sug_${randomUUID().slice(0, 12)}`, scope, target, contentHash, JSON.stringify(result))
}
