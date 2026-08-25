import { Router } from 'express'
import { auth, badRequest, notFound } from '../middleware.js'
import { createAnniversary, listAnniversaries, getAnniversary, updateAnniversary, deleteAnniversary, localDateStr } from '../db.js'

const router = Router()
router.use(auth)

// 纪念日计算：距今天数 / 已在一起天数 / 是否今天（统一本地时区）
function toVO(a) {
  const today = new Date()
  const todayStr = localDateStr()
  const date = new Date(a.date)
  const daysSince = Math.floor((new Date(todayStr) - date) / 86400000)
  let daysUntil = -1
  let isToday = false
  const thisYear = new Date(today.getFullYear(), date.getMonth(), date.getDate())
  const diff = Math.round((thisYear - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
  if (diff === 0) { daysUntil = 0; isToday = true }
  else if (diff < 0) {
    const nextYear = new Date(today.getFullYear() + 1, date.getMonth(), date.getDate())
    daysUntil = Math.round((nextYear - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)
  } else daysUntil = diff
  return { ...a, daysUntil, daysSince: Math.max(0, daysSince), isToday }
}

router.post('/', (req, res) => {
  const { title, type, date, description } = req.body || {}
  if (!title || !String(title).trim()) return badRequest(res, '名称不能为空')
  if (!date) return badRequest(res, '请选择日期')
  res.json({ ok: true, data: toVO(createAnniversary({ title, type, date, description })) })
})

router.get('/', (req, res) => {
  res.json({ ok: true, data: listAnniversaries().map(toVO) })
})

router.get('/:id', (req, res) => {
  const a = getAnniversary(req.params.id)
  if (!a) return notFound(res, '纪念日不存在')
  res.json({ ok: true, data: toVO(a) })
})

router.put('/:id', (req, res) => {
  const a = getAnniversary(req.params.id)
  if (!a) return notFound(res, '纪念日不存在')
  const { title, type, date, description } = req.body || {}
  res.json({ ok: true, data: toVO(updateAnniversary(a.id, { title, type, date, description })) })
})

router.delete('/:id', (req, res) => {
  deleteAnniversary(req.params.id)
  res.json({ ok: true, data: null })
})

export default router
