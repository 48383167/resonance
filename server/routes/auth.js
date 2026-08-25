import { Router } from 'express'
import {
  userCount, getUserByUsername, getUserByPairCode, getPartnerOf, registerUser,
  markPaired, setUserPassword,
} from '../db.js'
import { hashPassword, verifyPassword, signToken } from '../security.js'
import { auth, badRequest, forbidden } from '../middleware.js'

const router = Router()

function genPairCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  } while (getUserByPairCode(code))
  return code
}

// 状态：0/1/2 人，决定注册页是否要求邀请码
router.get('/state', (req, res) => {
  res.json({ ok: true, data: { userCount: userCount() } })
})

// 注册：第一个人直接注册并生成配对码；第二个人凭配对码注册后完成配对
router.post('/register', (req, res) => {
  const { username, password, nickname, inviteCode } = req.body || {}
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) return badRequest(res, '用户名需 3-20 位字母/数字/下划线')
  if (!password || String(password).length < 6) return badRequest(res, '密码至少 6 位')
  if (!nickname || !String(nickname).trim()) return badRequest(res, '昵称不能为空')
  if (getUserByUsername(username)) return badRequest(res, '用户名已被使用')

  const count = userCount()
  if (count >= 2) return forbidden(res, '这里只属于两个人，无法再注册新账号')
  const passwordHash = hashPassword(String(password))

  let pairCode
  if (count === 0) {
    pairCode = genPairCode()
    const me = registerUser({ username, passwordHash, nickname: nickname.trim(), pairCode })
    return res.json({ ok: true, data: { token: signToken(me.id), me, partner: null, inviteCode: pairCode } })
  }
  // 第二人：必须凭配对码加入
  const code = String(inviteCode || '').toUpperCase().trim()
  const first = getUserByPairCode(code)
  if (!first) return badRequest(res, '配对码无效')
  pairCode = code
  const me = registerUser({ username, passwordHash, nickname: nickname.trim(), pairCode })
  markPaired(pairCode)
  res.json({ ok: true, data: { token: signToken(me.id), me, partner: first } })
})

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  const user = getUserByUsername(String(username || ''))
  if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
    return res.status(401).json({ ok: false, error: '用户名或密码错误' })
  }
  const { password_hash, ...me } = user
  const partner = me.pair_code ? getPartnerOf(me.id, me.pair_code) : null
  res.json({ ok: true, data: { token: signToken(me.id), me, partner } })
})

// 当前用户与伴侣
router.get('/me', auth, (req, res) => {
  const partner = req.user.pair_code ? getPartnerOf(req.user.id, req.user.pair_code) : null
  res.json({ ok: true, data: { me: req.user, partner, inviteCode: partner ? null : req.user.pair_code } })
})

// 修改密码
router.post('/change-password', auth, (req, res) => {
  const { oldPassword, newPassword } = req.body || {}
  const user = getUserByUsername(req.user.username)
  if (!verifyPassword(String(oldPassword || ''), user.password_hash)) return badRequest(res, '原密码错误')
  if (!newPassword || String(newPassword).length < 6) return badRequest(res, '新密码至少 6 位')
  setUserPassword(req.user.id, hashPassword(String(newPassword)))
  res.json({ ok: true, data: null })
})

export default router
