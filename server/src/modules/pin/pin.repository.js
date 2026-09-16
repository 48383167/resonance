import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'

function newId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 12)}`
}

export function findByTarget(targetType, targetId) {
  return db.prepare('SELECT * FROM pinned_items WHERE target_type = ? AND target_id = ?').get(targetType, targetId)
}

export function upsert({ targetType, targetId, scope, pinnedBy }) {
  const existing = findByTarget(targetType, targetId)
  if (existing) {
    db.prepare(`
      UPDATE pinned_items
      SET pin_scope = ?, pinned_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE target_type = ? AND target_id = ?
    `).run(scope, pinnedBy, targetType, targetId)
  } else {
    db.prepare(`
      INSERT INTO pinned_items (id, target_type, target_id, pin_scope, pinned_by, updated_at)
      VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).run(newId('pin'), targetType, targetId, scope, pinnedBy)
  }
  return findByTarget(targetType, targetId)
}

export function removeByTarget(targetType, targetId) {
  db.prepare('DELETE FROM pinned_items WHERE target_type = ? AND target_id = ?').run(targetType, targetId)
}

export function listGlobal() {
  return db.prepare(`
    SELECT * FROM pinned_items
    WHERE pin_scope = 'global'
    ORDER BY datetime(updated_at) DESC
  `).all()
}
