import { getUser } from './db.js'
import { verifyToken } from './security.js'

// 认证中间件：Authorization: Bearer <token>
export function auth(req, res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const userId = token && verifyToken(token)
  const user = userId ? getUser(userId) : null
  if (!user) return res.status(401).json({ ok: false, error: '未登录或登录已过期' })
  req.user = user
  next()
}

export const badRequest = (res, msg) => res.status(400).json({ ok: false, error: msg })
export const notFound = (res, msg) => res.status(404).json({ ok: false, error: msg })
export const forbidden = (res, msg) => res.status(403).json({ ok: false, error: msg })
