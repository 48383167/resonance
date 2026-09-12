import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { COMPANION_EXTERNAL_PROCESSING_CONSENT_VERSION, DEFAULT_CONVERSATION_TITLE } from './companion.policy.js'

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

function memory(row) {
  if (!row) return null
  return {
    id: row.id,
    content: row.content,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getConsent(ownerId) {
  const row = db.prepare(
    'SELECT consented_at, consent_version FROM companion_consents WHERE owner_id = ?'
  ).get(ownerId)
  const consented = Boolean(row?.consented_at)
    && Number(row.consent_version) >= COMPANION_EXTERNAL_PROCESSING_CONSENT_VERSION
  return { consented, consentedAt: consented ? row.consented_at : null }
}

export function setConsent(ownerId, accepted) {
  const consentedAt = accepted ? new Date().toISOString() : null
  const consentVersion = accepted ? COMPANION_EXTERNAL_PROCESSING_CONSENT_VERSION : 0
  db.prepare(
    `INSERT INTO companion_consents (owner_id, consented_at, consent_version, updated_at)
     VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(owner_id) DO UPDATE SET
       consented_at = excluded.consented_at,
       consent_version = excluded.consent_version,
       updated_at = excluded.updated_at`
  ).run(ownerId, consentedAt, consentVersion)
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

export function listMemories(ownerId) {
  return db.prepare(
    `SELECT id, content, enabled, created_at, updated_at
     FROM companion_memories
     WHERE owner_id = ?
     ORDER BY enabled DESC, datetime(updated_at) DESC, rowid DESC`
  ).all(ownerId).map(memory)
}

export function findMemory(ownerId, id) {
  return memory(db.prepare(
    `SELECT id, content, enabled, created_at, updated_at
     FROM companion_memories
     WHERE id = ? AND owner_id = ?`
  ).get(id, ownerId))
}

export function countEnabledMemories(ownerId) {
  return db.prepare(
    'SELECT COUNT(*) AS count FROM companion_memories WHERE owner_id = ? AND enabled = 1'
  ).get(ownerId).count
}

// 发给模型的记忆只取启用项，不携带 ID、时间或任何业务资源元数据。
export function listEnabledMemoryContents(ownerId, limit) {
  return db.prepare(
    `SELECT content
     FROM companion_memories
     WHERE owner_id = ? AND enabled = 1
     ORDER BY datetime(updated_at) DESC, rowid DESC
     LIMIT ?`
  ).all(ownerId, limit).map((row) => row.content)
}

export function createMemory(ownerId, content) {
  const id = 'cm_' + randomUUID().slice(0, 12)
  db.prepare(
    'INSERT INTO companion_memories (id, owner_id, content, enabled) VALUES (?, ?, ?, 1)'
  ).run(id, ownerId, content)
  return findMemory(ownerId, id)
}

export function updateMemory(ownerId, id, changes) {
  const current = findMemory(ownerId, id)
  if (!current) return null
  db.prepare(
    `UPDATE companion_memories
     SET content = ?, enabled = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ? AND owner_id = ?`
  ).run(changes.content ?? current.content, Number(changes.enabled ?? current.enabled), id, ownerId)
  return findMemory(ownerId, id)
}

export function removeMemory(ownerId, id) {
  db.prepare('DELETE FROM companion_memories WHERE id = ? AND owner_id = ?').run(id, ownerId)
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

// 是否存在任何消息：用于判断是否为本会话首条消息（首条才触发自动命名）
export function hasAnyMessage(ownerId, conversationId) {
  return Boolean(db.prepare(
    `SELECT 1 FROM companion_messages m
     INNER JOIN companion_conversations c ON c.id = m.conversation_id
     WHERE m.conversation_id = ? AND c.owner_id = ?
     LIMIT 1`
  ).get(conversationId, ownerId))
}

// 首条用户消息内容：自动命名的兜底来源（老会话重命名时同样适用）
export function firstUserMessageContent(ownerId, conversationId) {
  const row = db.prepare(
    `SELECT m.content FROM companion_messages m
     INNER JOIN companion_conversations c ON c.id = m.conversation_id
     WHERE m.conversation_id = ? AND c.owner_id = ? AND m.role = 'user'
     ORDER BY datetime(m.created_at) ASC, m.rowid ASC
     LIMIT 1`
  ).get(conversationId, ownerId)
  return row?.content ?? null
}

// 仅更新标题，不改变 updated_at（回填历史标题时不打乱会话排序）
export function setConversationTitle(ownerId, conversationId, title) {
  db.prepare(
    'UPDATE companion_conversations SET title = ? WHERE id = ? AND owner_id = ?'
  ).run(title, conversationId, ownerId)
}

// 回填候选：标题仍为默认值、且已有用户消息的历史会话
export function listDefaultTitledConversations() {
  return db.prepare(
    `SELECT c.owner_id, c.id,
            (SELECT m.content FROM companion_messages m
              WHERE m.conversation_id = c.id AND m.role = 'user'
              ORDER BY datetime(m.created_at) ASC, m.rowid ASC LIMIT 1) AS first_content
     FROM companion_conversations c
     WHERE TRIM(COALESCE(c.title, '')) = '' OR c.title = ?`
  ).all(DEFAULT_CONVERSATION_TITLE).filter((row) => row.first_content)
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
