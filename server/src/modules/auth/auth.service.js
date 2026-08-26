import { hashPassword, verifyPassword } from '../../common/utils/password.js'
import { signToken } from '../../config/jwt.js'
import { BadRequestError } from '../../common/errors/BadRequestError.js'
import { ForbiddenError } from '../../common/errors/ForbiddenError.js'
import { UnauthorizedError } from '../../common/errors/UnauthorizedError.js'
import * as authRepository from './auth.repository.js'
import * as authSchema from './auth.schema.js'

const PAIR_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function genPairCode() {
  let code
  do {
    code = Array.from({ length: 6 }, () => PAIR_CODE_CHARS[Math.floor(Math.random() * PAIR_CODE_CHARS.length)]).join('')
  } while (authRepository.findByPairCode(code))
  return code
}

export function getState() {
  return { userCount: authRepository.countUsers() }
}

export function register(raw) {
  const { username, password, nickname, inviteCode } = authSchema.validateRegister(raw)

  if (authRepository.findByUsername(username)) {
    throw new BadRequestError('用户名已被使用')
  }

  const count = authRepository.countUsers()
  if (count >= 2) {
    throw new ForbiddenError('这里只属于两个人，无法再注册新账号')
  }

  const passwordHash = hashPassword(password)

  // 第一人：直接注册并生成配对码
  if (count === 0) {
    const pairCode = genPairCode()
    const me = authRepository.create({ username, passwordHash, nickname, pairCode })
    return { token: signToken(me.id), me, partner: null, inviteCode: pairCode }
  }

  // 第二人：必须凭配对码加入
  const code = String(inviteCode || '').toUpperCase().trim()
  const first = authRepository.findByPairCode(code)
  if (!first) {
    throw new BadRequestError('配对码无效')
  }
  const me = authRepository.create({ username, passwordHash, nickname, pairCode: code })
  authRepository.markPaired(code)
  return { token: signToken(me.id), me, partner: first }
}

export function login(raw) {
  const { username, password } = authSchema.validateLogin(raw)
  const user = authRepository.findByUsername(username)
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new UnauthorizedError('用户名或密码错误')
  }
  const { password_hash, ...me } = user
  const partner = me.pair_code ? authRepository.findPartnerOf(me.id, me.pair_code) : null
  return { token: signToken(me.id), me, partner }
}

export function getMe(user) {
  const partner = user.pair_code ? authRepository.findPartnerOf(user.id, user.pair_code) : null
  return { me: user, partner, inviteCode: partner ? null : user.pair_code }
}

export function changePassword(user, raw) {
  const { oldPassword, newPassword } = authSchema.validateChangePassword(raw)
  const found = authRepository.findByUsername(user.username)
  if (!verifyPassword(oldPassword, found.password_hash)) {
    throw new BadRequestError('原密码错误')
  }
  authRepository.setPassword(user.id, hashPassword(newPassword))
  return null
}
