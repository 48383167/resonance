import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'

function conversation(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function message(row) {
  if (!row) return null
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }
}

export function getConsent(ownerId) {
  const row = db.prepare('SELECT consented_at FROM companion_consents WHERE owner_id = ?').get(ownerId)
  return { consented: Boolean(row?.consented_at), consentedAt: row?.consented_at || null }
}

export function setConsent(ownerId, accepted) {
  const consentedAt = accepted ? new Date().toISOString() : null
  db.prepare(
    `INSERT INTO companion_consents (owner_id, consented_at, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(owner_id) DO UPDATE SET
       consented_at = excluded.consented_at,
       updated_at = excluded.updated_at`
  ).run(ownerId, consentedAt)
  return getConsent(ownerId)
}

export function listConversations(ownerId) {
  return db.prepare(
    `SELECT id, title, created_at, updated_at
     FROM companion_conversations
     WHERE owner_id = ?
     ORDER BY datetime(updated_at) DESC, rowid DESC`
  ).all(ownerId).map(conversation)
}

export function findConversation(ownerId, id) {
  return conversation(db.prepare(
    `SELECT id, title, created_at, updated_at
     FROM companion_conversations WHERE id = ? AND owner_id = ?`
  ).get(id, ownerId))
}

export function createConversation(ownerId, title) {
  const id = 'ac_' + randomUUID().slice(0, 12)
  db.prepare(
    'INSERT INTO companion_conversations (id, owner_id, title) VALUES (?, ?, ?)'
  ).run(id, ownerId, title)
  return findConversation(ownerId, id)
}

export function listMessages(ownerId, conversationId) {
  return db.prepare(
    `SELECT m.id, m.role, m.content, m.created_at
     FROM companion_messages m
     INNER JOIN companion_conversations c ON c.id = m.conversation_id
     WHERE m.conversation_id = ? AND c.owner_id = ?
     ORDER BY datetime(m.created_at) ASC, m.rowid ASC`
  ).all(conversationId, ownerId).map(message)
}

// 为模型保留有限上下文，查询后翻转为自然会话顺序，避免把整段私密历史发送给第三方。
export function listRecentMessages(ownerId, conversationId, limit = 10) {
  return db.prepare(
    `SELECT m.id, m.role, m.content, m.created_at
     FROM companion_messages m
     INNER JOIN companion_conversations c ON c.id = m.conversation_id
     WHERE m.conversation_id = ? AND c.owner_id = ?
     ORDER BY datetime(m.created_at) DESC, m.rowid DESC
     LIMIT ?`
  ).all(conversationId, ownerId, limit).reverse().map(message)
}

export function createMessage({ conversationId, role, content, model = null, promptTokens = 0, completionTokens = 0 }) {
  const id = 'am_' + randomUUID().slice(0, 12)
  db.prepare(
    `INSERT INTO companion_messages
       (id, conversation_id, role, content, model, prompt_tokens, completion_tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, conversationId, role, content, model, promptTokens, completionTokens)
  return message(db.prepare(
    'SELECT id, role, content, created_at FROM companion_messages WHERE id = ?'
  ).get(id))
}

export function touchConversation(ownerId, conversationId) {
  db.prepare(
    "UPDATE companion_conversations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND owner_id = ?"
  ).run(conversationId, ownerId)
}

export function countModelRepliesToday(ownerId) {
  return db.prepare(
    `SELECT model_reply_count AS count
     FROM companion_daily_usage
     WHERE owner_id = ? AND usage_date = date('now')`
  ).get(ownerId)?.count || 0
}

function currentUsageDate() {
  return db.prepare("SELECT date('now') AS usage_date").get().usage_date
}

// 先原子预留一次供应商调用额度：即便用户删除对话也不会恢复额度，且并发请求不能突破上限。
export function reserveModelReply(ownerId, limit) {
  const usageDate = currentUsageDate()
  const result = db.prepare(
    `INSERT INTO companion_daily_usage (owner_id, usage_date, model_reply_count)
     VALUES (?, ?, 1)
     ON CONFLICT(owner_id, usage_date) DO UPDATE SET
       model_reply_count = model_reply_count + 1
     WHERE model_reply_count < ?`
  ).run(ownerId, usageDate, limit)
  return { reserved: result.changes === 1, usageDate }
}

// 仅在供应商尚未生成有效回复时归还预留额度；有效回复之后即使本地落库失败，也不能假定调用未发生。
export function releaseModelReply(ownerId, usageDate) {
  db.prepare(
    `UPDATE companion_daily_usage
     SET model_reply_count = model_reply_count - 1
     WHERE owner_id = ? AND usage_date = ? AND model_reply_count > 0`
  ).run(ownerId, usageDate)
}

export function removeConversation(ownerId, conversationId) {
  db.prepare(
    `DELETE FROM companion_messages
     WHERE conversation_id = ?
       AND EXISTS (
         SELECT 1 FROM companion_conversations
         WHERE id = ? AND owner_id = ?
       )`
  ).run(conversationId, conversationId, ownerId)
  db.prepare('DELETE FROM companion_conversations WHERE id = ? AND owner_id = ?').run(conversationId, ownerId)
}
