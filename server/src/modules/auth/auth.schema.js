import { BadRequestError } from '../../common/errors/BadRequestError.js'

// 请求参数校验（后续可替换为 Zod Schema，见重构计划 §10）
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export function validateRegister(body = {}) {
  const { username, password, nickname, inviteCode } = body
  if (!username || !USERNAME_RE.test(username)) {
    throw new BadRequestError('用户名需 3-20 位字母/数字/下划线')
  }
  if (!password || String(password).length < 6) {
    throw new BadRequestError('密码至少 6 位')
  }
  if (!nickname || !String(nickname).trim()) {
    throw new BadRequestError('昵称不能为空')
  }
  return { username, password: String(password), nickname: String(nickname).trim(), inviteCode }
}

export function validateLogin(body = {}) {
  return { username: String(body.username || ''), password: String(body.password || '') }
}

export function validateChangePassword(body = {}) {
  const { oldPassword, newPassword } = body
  if (!newPassword || String(newPassword).length < 6) {
    throw new BadRequestError('新密码至少 6 位')
  }
  return { oldPassword: String(oldPassword || ''), newPassword: String(newPassword) }
}
