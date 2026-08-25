import { Router } from 'express'
import { auth, badRequest, notFound } from '../middleware.js'
import { createWish, listWishes, getWish, updateWish, deleteWish } from '../db.js'

const router = Router()
router.use(auth)

router.post('/', (req, res) => {
  const { title, description, category, priority, status } = req.body || {}
  if (!title || !String(title).trim()) return badRequest(res, '心愿内容不能为空')
  res.json({ ok: true, data: createWish({ proposerId: req.user.id, title, description, category, priority, status }) })
})

router.get('/', (req, res) => {
  res.json({ ok: true, data: listWishes() })
})

router.get('/:id', (req, res) => {
  const w = getWish(req.params.id)
  if (!w) return notFound(res, '心愿不存在')
  res.json({ ok: true, data: w })
})

router.put('/:id', (req, res) => {
  const w = getWish(req.params.id)
  if (!w) return notFound(res, '心愿不存在')
  const { title, description, category, priority, status } = req.body || {}
  res.json({ ok: true, data: updateWish(w.id, { title, description, category, priority, status }) })
})

// 快捷看板流转：todo -> doing -> done
router.put('/:id/status', (req, res) => {
  const { status } = req.body || {}
  if (!['todo', 'doing', 'done'].includes(status)) return badRequest(res, '状态不合法')
  const w = getWish(req.params.id)
  if (!w) return notFound(res, '心愿不存在')
  res.json({ ok: true, data: updateWish(w.id, { status }) })
})

router.delete('/:id', (req, res) => {
  deleteWish(req.params.id)
  res.json({ ok: true, data: null })
})

export default router
