import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { localDateStr } from '../../common/utils/date.js'
import { findById as findUserById } from '../auth/auth.repository.js'

function newId(prefix) {
  return prefix + '_' + randomUUID().slice(0, 12)
}

function attachProposer(wish) {
  wish.proposer = findUserById(wish.proposer_id)
  return wish
}

export function findById(id) {
  const w = db.prepare('SELECT * FROM wish_items WHERE id = ?').get(id)
  return w ? attachProposer(w) : w
}

export function list() {
  return db.prepare('SELECT * FROM wish_items ORDER BY priority DESC, datetime(created_at) ASC').all()
    .map(attachProposer)
}

export function create({ proposerId, title, description, category, priority, status, startedAt, completedAt }) {
  const id = newId('w')
  db.prepare(`
    INSERT INTO wish_items (id, proposer_id, title, description, category, priority, status, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, proposerId, title, description || '', category || 'other', priority || 0, status || 'todo', startedAt ?? null, completedAt ?? null)
  return findById(id)
}

// 阶段流转时间节点：
//   - 进入 doing：开始日期 = 所选日期，缺省今天
//   - 进入 done：完成日期 = 所选日期，缺省今天；已记录的开始日期保留
//   - 回退：离开的阶段时间戳清空
// 显式传入 startedAt / completedAt（可为 null）时用于补记/修正；两者都不传则保持原值。
export function update(id, { title, description, category, priority, status, startedAt, completedAt }) {
  const prev = db.prepare('SELECT status, started_at, completed_at FROM wish_items WHERE id = ?').get(id)

  if (status !== undefined && prev && status !== prev.status) {
    const completedDate = status === 'done' ? (completedAt || localDateStr()) : null
    const startedDate = status === 'doing'
      ? (startedAt || localDateStr())
      : status === 'done' ? prev.started_at : null
    db.prepare('UPDATE wish_items SET completed_at = ?, started_at = ? WHERE id = ?')
      .run(completedDate, startedDate, id)
  } else {
    if (startedAt !== undefined) {
      db.prepare('UPDATE wish_items SET started_at = ? WHERE id = ?').run(startedAt, id)
    }
    if (completedAt !== undefined) {
      db.prepare('UPDATE wish_items SET completed_at = ? WHERE id = ?').run(completedAt, id)
    }
  }

  db.prepare(
    'UPDATE wish_items SET title = COALESCE(?, title), description = COALESCE(?, description), category = COALESCE(?, category), priority = COALESCE(?, priority), status = COALESCE(?, status) WHERE id = ?'
  ).run(title ?? null, description ?? null, category ?? null, priority ?? null, status ?? null, id)
  return findById(id)
}

export function remove(id) {
  db.prepare('DELETE FROM wish_items WHERE id = ?').run(id)
}
