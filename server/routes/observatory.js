import { Router } from 'express'
import { listPublicEntries, listMoments, listAnniversaries, getShareTokenByToken, incrementViewCount, stats, daysSincePaired, listUsers } from '../db.js'

const router = Router()

// 对外展示页数据：仅公开的日记（观测台不校验登录）
router.get('/observatory', (req, res) => {
  res.json({ ok: true, data: { entries: listPublicEntries() } })
})

// 分享链接：token 只读访问（可选密码、有效期、浏览计数）
router.get('/share/:token', (req, res) => {
  const st = getShareTokenByToken(String(req.params.token))
  if (!st || st.status !== 1) return res.status(404).json({ ok: false, error: '分享链接不存在或已停用' })
  if (st.expires_at && new Date(st.expires_at) < new Date()) return res.status(410).json({ ok: false, error: '分享链接已过期' })
  if (st.password && req.query.password !== st.password) return res.status(401).json({ ok: false, error: '需要密码', needPassword: true })

  incrementViewCount(st.token)
  res.json({
    ok: true,
    data: {
      users: listUsers().map((u) => ({ nickname: u.nickname, avatarUrl: u.avatar_url })),
      daysTogether: daysSincePaired(),
      stats: stats(),
      moments: listMoments({}),
      entries: listPublicEntries(),
      anniversaries: listAnniversaries(),
    },
  })
})

export default router
