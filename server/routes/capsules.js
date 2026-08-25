import { Router } from 'express'
import { auth, badRequest, notFound } from '../middleware.js'
import { createCapsule, listCapsules, getCapsule, deleteCapsule, localDateStr } from '../db.js'

const router = Router()
router.use(auth)

function toVO(c) {
  const todayStr = localDateStr()
  const unlocked = c.unlock_date <= todayStr
  const daysUntil = Math.ceil((new Date(c.unlock_date) - new Date(todayStr)) / 86400000)
  return {
    ...c,
    isUnlocked: unlocked ? 1 : 0,
    daysUntilUnlock: Math.max(0, daysUntil),
    // 未解锁时遮蔽内容（服务端保密，防止 API 直接偷看）
    content: unlocked ? c.content : '***内容尚未解锁***',
    photoUrl: unlocked ? c.photo_url : null,
    hasPhoto: Boolean(c.photo_url),
  }
}

router.post('/', (req, res) => {
  const { title, content, photoUrl, unlockDate } = req.body || {}
  if (!content || !String(content).trim()) return badRequest(res, '内容不能为空')
  if (!unlockDate) return badRequest(res, '请选择解锁日期')
  res.json({ ok: true, data: toVO(createCapsule({ authorId: req.user.id, title, content, photoUrl, unlockDate })) })
})

router.get('/', (req, res) => {
  res.json({ ok: true, data: listCapsules().map(toVO) })
})

router.get('/:id', (req, res) => {
  const c = getCapsule(req.params.id)
  if (!c) return notFound(res, '胶囊不存在')
  res.json({ ok: true, data: toVO(c) })
})

router.delete('/:id', (req, res) => {
  deleteCapsule(req.params.id)
  res.json({ ok: true, data: null })
})

export default router
