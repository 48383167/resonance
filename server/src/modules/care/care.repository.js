import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { findById as findUserById } from '../auth/auth.repository.js'

function newId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 12)}`
}

// 组装 author / subject（与 wish 的 attachProposer 同风格，挂完整用户对象）
function attach(row) {
  if (!row) return row
  row.author = findUserById(row.author_id)
  row.subject = findUserById(row.subject_id)
  return row
}

// 列表 / 详情公共查询：LEFT JOIN 置顶表取 pin_scope，排序 global > list > 时间倒序
// 例假历史按开始日期倒序；其余分类按最近更新倒序；id 兜底保证翻页不重不漏
export function list({ category, subjectId, offset, limit } = {}) {
  const conds = []
  const args = []
  if (category) { conds.push('c.category = ?'); args.push(category) }
  if (subjectId) { conds.push('c.subject_id = ?'); args.push(subjectId) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const orderTail = category === 'period'
    ? 'datetime(c.start_date) DESC, c.id DESC'
    : 'datetime(c.updated_at) DESC, c.id DESC'
  const paging = limit !== undefined ? 'LIMIT ? OFFSET ?' : ''
  const query = `
    SELECT c.*, p.pin_scope
    FROM care_items c
    LEFT JOIN pinned_items p ON p.target_type = 'care' AND p.target_id = c.id
    ${where}
    ORDER BY
      CASE p.pin_scope WHEN 'global' THEN 0 WHEN 'list' THEN 1 ELSE 2 END,
      ${orderTail}
    ${paging}
  `
  const queryArgs = limit !== undefined ? [...args, limit, offset || 0] : args
  return db.prepare(query).all(...queryArgs).map(attach)
}

// 与 list 同筛选条件的总数（分页用）
export function count({ category, subjectId } = {}) {
  const conds = []
  const args = []
  if (category) { conds.push('c.category = ?'); args.push(category) }
  if (subjectId) { conds.push('c.subject_id = ?'); args.push(subjectId) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  return db.prepare(`SELECT COUNT(*) AS c FROM care_items c ${where}`).get(...args).c
}

export function findById(id) {
  const row = db.prepare(`
    SELECT c.*, p.pin_scope
    FROM care_items c
    LEFT JOIN pinned_items p ON p.target_type = 'care' AND p.target_id = c.id
    WHERE c.id = ?
  `).get(id)
  return attach(row)
}

export function create({ authorId, subjectId, category, title, content, severity, startDate, endDate, cycleDays }) {
  const id = newId('care')
  db.prepare(`
    INSERT INTO care_items (id, author_id, subject_id, category, title, content, severity, start_date, end_date, cycle_days, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run(id, authorId, subjectId, category, title, content ?? '', severity ?? null, startDate ?? null, endDate ?? null, cycleDays ?? null)
  return findById(id)
}

export function update(id, { category, title, content, severity, startDate, endDate, cycleDays, subjectId }) {
  db.prepare(`
    UPDATE care_items
    SET category = ?, title = ?, content = ?, severity = ?, start_date = ?, end_date = ?, cycle_days = ?, subject_id = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `).run(category, title, content, severity, startDate, endDate, cycleDays, subjectId, id)
  return findById(id)
}

export function remove(id) {
  db.prepare('DELETE FROM care_items WHERE id = ?').run(id)
}

// 例假预测原始记录：category=period 且 start_date 非空，按 start_date 升序
export function listPeriodRecords() {
  return db.prepare(`
    SELECT * FROM care_items
    WHERE category = 'period' AND start_date IS NOT NULL AND start_date != ''
    ORDER BY datetime(start_date) ASC
  `).all()
}

// 关怀提醒：allergy 且 severity 为 moderate/severe，severe 优先
export function listAllergyAlerts() {
  return db.prepare(`
    SELECT * FROM care_items
    WHERE category = 'allergy' AND severity IN ('moderate', 'severe')
    ORDER BY CASE severity WHEN 'severe' THEN 0 ELSE 1 END, datetime(updated_at) DESC
  `).all().map(attach)
}
