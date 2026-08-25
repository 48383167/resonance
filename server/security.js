import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

export const JWT_SECRET = process.env.JWT_SECRET || 'resonance-local-dev-secret'
const TOKEN_TTL = '7d'

// —— 密码哈希（Node 内置 scrypt，免原生依赖）——
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const calc = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calc, 'hex'))
}

// —— JWT ——
export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL })
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return payload.sub || null
  } catch {
    return null
  }
}
