import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
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

export function create({ proposerId, title, description, category, priority, status }) {
  const id = newId('w')
  db.prepare('INSERT INTO wish_items (id, proposer_id, title, description, category, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, proposerId, title, description || '', category || 'other', priority || 0, status || 'todo')
  return findById(id)
}

export function update(id, { title, description, category, priority, status }) {
  // 阶段流转时间节点：done 记完成时间，doing 记开始时间，回退则清空
  if (status !== undefined) {
    const prev = db.prepare('SELECT status FROM wish_items WHERE id = ?').get(id)
    if (prev && status !== prev.status) {
      const stamp = status === 'done' ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : 'NULL'
      const startStamp = status === 'doing' ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : 'NULL'
      db.prepare(`UPDATE wish_items SET completed_at = ${stamp}, started_at = ${startStamp} WHERE id = ?`).run(id)
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
