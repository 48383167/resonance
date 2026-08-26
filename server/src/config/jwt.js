import jwt from 'jsonwebtoken'

export const JWT_SECRET = process.env.JWT_SECRET || 'resonance-local-dev-secret'
const TOKEN_TTL = '7d'

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
