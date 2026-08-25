import { Router } from 'express'
import crypto from 'node:crypto'
import { auth } from '../middleware.js'
import {
  createShareToken, getActiveShareToken, disableShareToken,
} from '../db.js'

const router = Router()
router.use(auth)

// 创建/刷新分享链接（可设密码与有效期，同时仅一个有效）
router.post('/create', (req, res) => {
  const { password, expireDays } = req.body || {}
  const days = expireDays != null ? Number(expireDays) : 30
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const expiresAt = days <= 0 ? null : new Date(Date.now() + days * 86400000).toISOString()
  createShareToken({ token, password: password || '', expiresAt })
  res.json({ ok: true, data: { token, shareUrl: `/share/${token}`, expiresAt } })
})

// 当前有效分享
router.get('/current', (req, res) => {
  const st = getActiveShareToken()
  if (!st) return res.json({ ok: true, data: null })
  res.json({ ok: true, data: {
    token: st.token,
    shareUrl: `/share/${st.token}`,
    expiresAt: st.expires_at,
    viewCount: st.view_count,
    hasPassword: Boolean(st.password),
  } })
})

// 停用分享
router.delete('/current', (req, res) => {
  disableShareToken()
  res.json({ ok: true, data: null })
})

export default router
