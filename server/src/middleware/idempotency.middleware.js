import crypto from 'node:crypto'
import { db } from '../config/database.js'
import { AppError } from '../common/errors/AppError.js'
import { ConflictError } from '../common/errors/ConflictError.js'

// 幂等中间件：读取 Idempotency-Key 请求头，为创建类 POST 接口提供防重复提交保护。
//
// 语义：
//   - 缺失 / 超长 key → 统一 400 错误（对象形态 error:{code,message}）
//   - 首次请求：写入 processing 占位 → 执行 controller/Socket → 成功则记录响应，失败则删除占位
//   - 同 key + 同 body + 已完成 → 直接重放首次成功响应（不再执行 controller/Socket）
//   - 同 key + 不同 body（已完成）→ 409 IDEMPOTENCY_KEY_REUSE
//   - 处理中（并发）→ 409 IDEMPOTENCY_KEY_IN_PROGRESS
//   - 过期 completed 记录定期清理；异常退出留下的 processing 占位超过短租期后回收
//
// 隔离维度：认证用户 ID + HTTP method + 路由作用域 + Idempotency-Key。

const MAX_KEY_LENGTH = 128
const RECORD_TTL_MS = 24 * 60 * 60 * 1000 // 已完成记录保留 24h
const PROCESSING_TTL_MS = 5 * 60 * 1000 // 同步接口异常退出后的占位最多保留 5min
const PURGE_INTERVAL_MS = 60 * 1000
let lastPurgeAt = 0

function hashBody(body) {
  const raw = body == null ? '' : JSON.stringify(body)
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// 路由作用域：HTTP method + 完整请求路径（去掉 query，规范化结尾斜杠）
// 使用实际路径（含 :id 等参数值）以确保不同资源（如不同相册）互不串扰。
function buildScope(req) {
  const path = (req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '') || '/'
  return `${req.method} ${path}`
}

function findRecord(userId, key, scope) {
  return db.prepare(
    'SELECT * FROM idempotency_records WHERE user_id = ? AND request_key = ? AND route_scope = ?'
  ).get(userId, key, scope)
}

function insertRecord(userId, key, scope, requestHash) {
  db.prepare(
    `INSERT INTO idempotency_records (user_id, request_key, route_scope, request_hash, status)
     VALUES (?, ?, ?, ?, 'processing')`
  ).run(userId, key, scope, requestHash)
}

function completeRecord(userId, key, scope, requestHash, statusCode, body) {
  db.prepare(
    `UPDATE idempotency_records
     SET status = 'completed',
         status_code = ?,
         response_body = ?,
         completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE user_id = ? AND request_key = ? AND route_scope = ?
        AND request_hash = ? AND status = 'processing'`
  ).run(statusCode, JSON.stringify(body), userId, key, scope, requestHash)
}

function removeRecord(userId, key, scope, requestHash) {
  db.prepare(
    "DELETE FROM idempotency_records WHERE user_id = ? AND request_key = ? AND route_scope = ? AND request_hash = ? AND status = 'processing'"
  ).run(userId, key, scope, requestHash)
}

// 清理已完成记录与异常退出留下的 processing 占位。
function purgeExpired() {
  const now = Date.now()
  if (now - lastPurgeAt < PURGE_INTERVAL_MS) return
  const completedCutoff = new Date(Date.now() - RECORD_TTL_MS).toISOString()
  const processingCutoff = new Date(Date.now() - PROCESSING_TTL_MS).toISOString()
  db.prepare(
    `DELETE FROM idempotency_records
     WHERE (status = 'completed' AND datetime(created_at) < datetime(?))
        OR (status = 'processing' AND datetime(created_at) < datetime(?))`
  ).run(completedCutoff, processingCutoff)
  lastPurgeAt = now
}

function replay(res, record) {
  const body = record.response_body
  if (!body) {
    return res.status(500).json({
      ok: false,
      error: { code: 'IDEMPOTENCY_REPLAY_MISSING', message: '幂等记录缺少响应内容' },
    })
  }
  res.status(record.status_code || 200)
  res.set('Content-Type', 'application/json; charset=utf-8')
  return res.send(body)
}

export function idempotency(req, res, next) {
  const key = (req.get('Idempotency-Key') || '').trim()
  if (!key) {
    return res.fail(new AppError('缺少 Idempotency-Key 请求头', 400, 'IDEMPOTENCY_KEY_REQUIRED'))
  }
  if (key.length > MAX_KEY_LENGTH) {
    return res.fail(new AppError('Idempotency-Key 长度超出限制', 400, 'IDEMPOTENCY_KEY_INVALID'))
  }

  const userId = req.user.id
  const scope = buildScope(req)
  const requestHash = hashBody(req.body)

  purgeExpired()

  const existing = findRecord(userId, key, scope)
  if (existing) {
    if (existing.request_hash !== requestHash) {
      return res.fail(new ConflictError('Idempotency-Key 已用于不同的请求内容', 'IDEMPOTENCY_KEY_REUSE'))
    }
    if (existing.status === 'processing') {
      return res.fail(new ConflictError('相同请求正在处理中，请勿重复提交', 'IDEMPOTENCY_KEY_IN_PROGRESS'))
    }
    return replay(res, existing)
  }

  try {
    insertRecord(userId, key, scope, requestHash)
  } catch (error) {
    // 多进程部署时，另一个进程可能刚刚抢到同一个 key；按正常幂等分支处理。
    const raced = findRecord(userId, key, scope)
    if (!raced) return next(error)
    if (raced.request_hash !== requestHash) {
      return res.fail(new ConflictError('Idempotency-Key 已用于不同的请求内容', 'IDEMPOTENCY_KEY_REUSE'))
    }
    if (raced.status === 'processing') {
      return res.fail(new ConflictError('相同请求正在处理中，请勿重复提交', 'IDEMPOTENCY_KEY_IN_PROGRESS'))
    }
    return replay(res, raced)
  }

  // 拦截响应：成功（<400）落库为 completed，失败（>=400）删除占位以便安全重试
  let settled = false
  const originalJson = res.json.bind(res)
  res.json = function (body) {
    if (settled) return originalJson(body)
    const status = this.statusCode || 200
    try {
      if (status >= 400) {
        removeRecord(userId, key, scope, requestHash)
      } else {
        completeRecord(userId, key, scope, requestHash, status, body)
      }
    } catch (error) {
      // 落库异常时保持 processing，宁可短暂阻止重试，也不放行潜在重复写入。
      console.error('[idempotency] failed to persist response', error)
      if (status >= 400) {
        try { removeRecord(userId, key, scope, requestHash) } catch { /* 尽力清理 */ }
      }
    }
    settled = true
    return originalJson(body)
  }

  next()
}
