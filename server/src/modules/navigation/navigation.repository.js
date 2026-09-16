import { db } from '../../config/database.js'

// 默认底部导航（与前端 shared/navigation.js 的默认保持一致）
export const DEFAULT_NAV_ITEMS = ['home', 'timeline', 'diary-list', 'companion']

export function getItems() {
  const row = db.prepare('SELECT items FROM navigation_settings WHERE id = 1').get()
  if (!row?.items) return null
  try {
    const items = JSON.parse(row.items)
    return Array.isArray(items) && items.length ? items : null
  } catch {
    return null
  }
}

export function saveItems(items) {
  db.prepare(`
    INSERT INTO navigation_settings (id, items, updated_at)
    VALUES (1, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(id) DO UPDATE SET
      items = excluded.items,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).run(JSON.stringify(items))
}
