import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'

function newId(prefix) {
  return prefix + '_' + randomUUID().slice(0, 12)
}

export function findById(id) {
  return db.prepare('SELECT * FROM anniversaries WHERE id = ?').get(id)
}

export function list() {
  return db.prepare('SELECT * FROM anniversaries ORDER BY date ASC').all()
}

// 分享链接公开列表：仅展示 show_in_share = 1 的纪念日（条目级可见性）
export function listPublic() {
  return db.prepare('SELECT * FROM anniversaries WHERE show_in_share = 1 ORDER BY date ASC').all()
}

export function create({ title, type, date, description }) {
  const id = newId('ann')
  db.prepare('INSERT INTO anniversaries (id, title, type, date, description) VALUES (?, ?, ?, ?, ?)')
    .run(id, title, type || 'custom', date, description || '')
  return findById(id)
}

export function update(id, { title, type, date, description }) {
  db.prepare(
    'UPDATE anniversaries SET title = COALESCE(?, title), type = COALESCE(?, type), date = COALESCE(?, date), description = COALESCE(?, description) WHERE id = ?'
  ).run(title ?? null, type ?? null, date ?? null, description ?? null, id)
  return findById(id)
}

// 条目级分享可见性：仅更新 show_in_share 一列
export function updateShowInShare(id, showInShare) {
  db.prepare('UPDATE anniversaries SET show_in_share = ? WHERE id = ?').run(showInShare ? 1 : 0, id)
  return findById(id)
}

export function remove(id) {
  db.prepare('DELETE FROM anniversaries WHERE id = ?').run(id)
}
