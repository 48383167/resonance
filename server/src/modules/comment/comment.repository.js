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
