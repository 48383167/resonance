import { db } from '../../config/database.js'

// 观测台总展示开关（singleton：id 固定为 1）
// 仅负责读写数据库，不含业务规则；默认行已在 database.js 初始化。

export function getSettings() {
  return db.prepare(
    `SELECT id, enabled, updated_at
     FROM observatory_settings
     WHERE id = 1`
  ).get()
}

export function setEnabled(enabled) {
  db.prepare(
    `UPDATE observatory_settings
     SET enabled = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = 1`
  ).run(enabled ? 1 : 0)
  return getSettings()
}
