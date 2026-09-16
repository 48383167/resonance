import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'

function newId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 12)}`
}

export function findMailSettings(userId) {
  return db.prepare('SELECT * FROM user_mail_settings WHERE user_id = ?').get(userId) || null
}

export function upsertMailSettings(userId, { email, periodRemind, anniversaryRemind, aiContent }) {
  db.prepare(`
    INSERT INTO user_mail_settings (user_id, email, period_remind, anniversary_remind, ai_content, updated_at)
    VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(user_id) DO UPDATE SET
      email = excluded.email,
      period_remind = excluded.period_remind,
      anniversary_remind = excluded.anniversary_remind,
      ai_content = excluded.ai_content,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).run(userId, email, periodRemind ? 1 : 0, anniversaryRemind ? 1 : 0, aiContent ? 1 : 0)
  return findMailSettings(userId)
}

// 提醒引擎用：全部用户 + 各自邮件设置（无设置行时给默认值）
export function listUsersWithMailSettings() {
  return db.prepare(`
    SELECT u.id, u.nickname, u.gender, u.pair_code,
           COALESCE(m.email, '') AS email,
           COALESCE(m.period_remind, 0) AS period_remind,
           COALESCE(m.anniversary_remind, 0) AS anniversary_remind,
           COALESCE(m.ai_content, 1) AS ai_content
    FROM users u
    LEFT JOIN user_mail_settings m ON m.user_id = u.id
  `).all()
}

export function findLog(dedupeKey) {
  return db.prepare('SELECT * FROM notification_logs WHERE dedupe_key = ?').get(dedupeKey)
}

export function hasSent(dedupeKey) {
  const row = db.prepare('SELECT status FROM notification_logs WHERE dedupe_key = ?').get(dedupeKey)
  return row?.status === 'sent'
}

export function markSent(dedupeKey, { userId, email }) {
  db.prepare(`
    INSERT INTO notification_logs (id, dedupe_key, user_id, email, status, error, updated_at)
    VALUES (?, ?, ?, ?, 'sent', NULL, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(dedupe_key) DO UPDATE SET
      status = 'sent', error = NULL, email = excluded.email,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).run(newId('nlog'), dedupeKey, userId, email)
}

export function markFailed(dedupeKey, { userId, email, error }) {
  db.prepare(`
    INSERT INTO notification_logs (id, dedupe_key, user_id, email, status, error, updated_at)
    VALUES (?, ?, ?, ?, 'failed', ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(dedupe_key) DO UPDATE SET
      status = 'failed', error = excluded.error, email = excluded.email,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `).run(newId('nlog'), dedupeKey, userId, email, String(error).slice(0, 300))
}
