import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { findById as findUserById } from '../auth/auth.repository.js'

// 评论对象组装：挂载作者公开信息（与 moment 的 author 结构一致）
function attachAuthor(comment) {
  if (comment) comment.author = findUserById(comment.user_id)
  return comment
}

export function list(targetType, targetId) {
  return db.prepare(
    `SELECT * FROM comments
     WHERE target_type = ? AND target_id = ?
     ORDER BY datetime(created_at) ASC, rowid ASC`
  ).all(targetType, targetId).map(attachAuthor)
}

export function findById(id) {
  return attachAuthor(db.prepare('SELECT * FROM comments WHERE id = ?').get(id))
}

export function create({ targetType, targetId, userId, content, parentId, replyToUserId, replyToCommentId }) {
  const id = 'cm_' + randomUUID().slice(0, 12)
  db.prepare(
    `INSERT INTO comments
       (id, target_type, target_id, user_id, content, parent_id, reply_to_user_id, reply_to_comment_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, targetType, targetId, userId, content, parentId || null, replyToUserId || null, replyToCommentId || null)
  return findById(id)
}

// 是否存在回复 / 被引用（有下级或被人引用的评论删除时墓碑化，避免对方引用的内容消失）
export function hasChildren(id) {
  return Boolean(db.prepare(
    'SELECT 1 FROM comments WHERE parent_id = ? OR reply_to_comment_id = ? LIMIT 1'
  ).get(id, id))
}

// 墓碑化：清空正文、记录删除时间，保留行以承载其下回复
export function tombstone(id) {
  db.prepare(
    "UPDATE comments SET content = '', deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
  ).run(id)
}

export function remove(id) {
  db.prepare('DELETE FROM comments WHERE id = ?').run(id)
}

// 级联清理：目标资源（日记/瞬间）删除时移除其全部评论，避免孤儿数据
export function removeByTarget(targetType, targetId) {
  db.prepare('DELETE FROM comments WHERE target_type = ? AND target_id = ?').run(targetType, targetId)
}

// 已读时间点：同一用户重复查看只更新时间
export function markRead(userId, targetType, targetId) {
  const now = db.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now') AS now").get().now
  db.prepare(
    `INSERT OR REPLACE INTO comment_reads (user_id, target_type, target_id, last_read_at)
     VALUES (?, ?, ?, ?)`
  ).run(userId, targetType, targetId, now)
  return now
}

// 目标删除时清理已读记录
export function removeReadsByTarget(targetType, targetId) {
  db.prepare('DELETE FROM comment_reads WHERE target_type = ? AND target_id = ?').run(targetType, targetId)
}

// 批量挂载计数：comment_count=未删除评论数（含回复）；
// unread_comment_count=对方在本人上次查看之后发表的未删除评论数（无已读记录 = 全部未读）
export function attachCounts(targetType, targets, userId) {
  if (!targets.length) return targets
  const placeholders = targets.map(() => '?').join(', ')
  const rows = db.prepare(
    `SELECT c.target_id,
            COUNT(*) AS comment_count,
            SUM(CASE WHEN c.user_id != ?
                      AND (r.last_read_at IS NULL OR c.created_at > r.last_read_at)
                     THEN 1 ELSE 0 END) AS unread_comment_count
       FROM comments c
       LEFT JOIN comment_reads r
         ON r.user_id = ? AND r.target_type = c.target_type AND r.target_id = c.target_id
      WHERE c.target_type = ? AND c.target_id IN (${placeholders})
        AND c.deleted_at IS NULL
      GROUP BY c.target_id`
  ).all(userId, userId, targetType, ...targets.map((target) => target.id))
  const byTarget = new Map(rows.map((row) => [row.target_id, row]))
  for (const target of targets) {
    const row = byTarget.get(target.id)
    target.comment_count = row?.comment_count || 0
    target.unread_comment_count = row?.unread_comment_count || 0
  }
  return targets
}

// 全局未读总览：只统计当前情侣空间内、对方发表的未删除评论
export function countUnread(userId, memberIds) {
  if (!memberIds.length) return { entry: 0, moment: 0, food: 0, total: 0 }
  const placeholders = memberIds.map(() => '?').join(', ')
  const row = db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN c.target_type = 'entry' THEN 1 ELSE 0 END), 0) AS entry,
       COALESCE(SUM(CASE WHEN c.target_type = 'moment' THEN 1 ELSE 0 END), 0) AS moment,
       COALESCE(SUM(CASE WHEN c.target_type = 'food' THEN 1 ELSE 0 END), 0) AS food
     FROM comments c
     LEFT JOIN comment_reads r
       ON r.user_id = ? AND r.target_type = c.target_type AND r.target_id = c.target_id
     WHERE c.deleted_at IS NULL
       AND c.user_id != ?
       AND (r.last_read_at IS NULL OR c.created_at > r.last_read_at)
       AND (
         (c.target_type = 'entry' AND c.target_id IN (
            SELECT DISTINCT ec.entry_id FROM entry_contents ec WHERE ec.user_id IN (${placeholders})
         ))
         OR (c.target_type = 'moment' AND c.target_id IN (
            SELECT m.id FROM moments m WHERE m.user_id IN (${placeholders})
         ))
         OR (c.target_type = 'food' AND c.target_id IN (
            SELECT f.id FROM food_places f WHERE f.author_id IN (${placeholders})
         ))
       )`
  ).get(userId, userId, ...memberIds, ...memberIds, ...memberIds)
  return { entry: row.entry, moment: row.moment, food: row.food, total: row.entry + row.moment + row.food }
}
