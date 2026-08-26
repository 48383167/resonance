import { verifyToken } from '../config/jwt.js'
import { findById } from '../modules/auth/auth.repository.js'
import { UnauthorizedError } from '../common/errors/UnauthorizedError.js'

// 认证中间件：Authorization: Bearer <token>
export function requireAuth(req, res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const userId = token && verifyToken(token)
  const user = userId ? findById(userId) : null
  if (!user) {
    return res.fail(new UnauthorizedError('未登录或登录已过期'))
  }
  req.user = user
  next()
}
