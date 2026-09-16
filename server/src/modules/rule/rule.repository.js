import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { findById as findUserById } from '../auth/auth.repository.js'

function newId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 12)}`
}

function attachAuthor(rule) {
  if (!rule) return rule
  rule.author = findUserById(rule.author_id)
  return rule
}

// 过滤条件构造：type / status / pending（待我认同），list 与 count 共用
function buildWhere({ type, status = 'active', pending, userId } = {}) {
  const conds = []
  const args = []
  if (type) { conds.push('r.type = ?'); args.push(type) }
  if (status && status !== 'all') { conds.push('r.status = ?'); args.push(status) }
  if (pending) {
    if (!userId) return { where: 'WHERE 1 = 0', args: [] }
    conds.push('r.author_id != ?')
    args.push(userId)
    conds.push('NOT EXISTS (SELECT 1 FROM json_each(r.agreed_ids) WHERE json_each.value = ?)')
    args.push(userId)
  }
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', args }
}

// 排序：global > list 置顶 > effective 降序 > 更新时间倒序；id 兜底保证翻页稳定
const LIST_SELECT = `
  SELECT r.*, p.pin_scope
  FROM couple_rules r
  LEFT JOIN pinned_items p ON p.target_type = 'rule' AND p.target_id = r.id`
const LIST_ORDER = `
  ORDER BY
    CASE p.pin_scope WHEN 'global' THEN 0 WHEN 'list' THEN 1 ELSE 2 END,
    CASE WHEN json_array_length(r.agreed_ids) >= 2 THEN 0 ELSE 1 END,
    datetime(r.updated_at) DESC,
    r.id DESC`

export function findById(id) {
  const row = db.prepare(`
    SELECT r.*, p.pin_scope
    FROM couple_rules r
    LEFT JOIN pinned_items p ON p.target_type = 'rule' AND p.target_id = r.id
    WHERE r.id = ?
  `).get(id)
  return attachAuthor(row)
}

export function list(opts = {}) {
  const { where, args } = buildWhere(opts)
  return db.prepare(`${LIST_SELECT}\n${where}\n${LIST_ORDER}`).all(...args).map(attachAuthor)
}

// 分页列表：与 list 同筛选/排序，附总数
export function listPage(opts = {}) {
  const { where, args } = buildWhere(opts)
  const total = db.prepare(`SELECT COUNT(*) AS c FROM couple_rules r ${where}`).get(...args).c
  const items = db.prepare(`${LIST_SELECT}\n${where}\n${LIST_ORDER}\nLIMIT ? OFFSET ?`)
    .all(...args, opts.limit, opts.offset)
    .map(attachAuthor)
  return { items, total }
}

export function create({ authorId, type, title, content, status, agreedIds }) {
  const id = newId('rule')
  db.prepare(`
    INSERT INTO couple_rules (id, author_id, type, title, content, status, agreed_ids, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run(id, authorId, type, title, content, status, JSON.stringify(agreedIds))
  return findById(id)
}

export function update(id, changes) {
  const sets = []
  const args = []
  if (changes.type !== undefined) { sets.push('type = ?'); args.push(changes.type) }
  if (changes.title !== undefined) { sets.push('title = ?'); args.push(changes.title) }
  if (changes.content !== undefined) { sets.push('content = ?'); args.push(changes.content) }
  if (changes.status !== undefined) { sets.push('status = ?'); args.push(changes.status) }
  if (changes.agreedIds !== undefined) { sets.push('agreed_ids = ?'); args.push(JSON.stringify(changes.agreedIds)) }
  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')")
  args.push(id)
  db.prepare(`UPDATE couple_rules SET ${sets.join(', ')} WHERE id = ?`).run(...args)
  return findById(id)
}

export function remove(id) {
  db.prepare('DELETE FROM couple_rules WHERE id = ?').run(id)
}

// 待认同数：active、author_id != 我、agreed_ids 不含我。
// 注意 node:sqlite 的 json_each.value 返回的是「去引号」的字符串，直接用 = ? 比对原始 userId 即可。
export function pendingCount(userId) {
  return db.prepare(`
    SELECT COUNT(*) AS count
    FROM couple_rules
    WHERE status = 'active'
      AND author_id != ?
      AND NOT EXISTS (
        SELECT 1 FROM json_each(couple_rules.agreed_ids)
        WHERE json_each.value = ?
      )
  `).get(userId, userId).count
}
