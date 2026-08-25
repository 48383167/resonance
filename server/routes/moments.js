import { Router } from 'express'
import { auth, badRequest, notFound } from '../middleware.js'
import {
  createMoment, getMoment, listMoments, listMomentsWithCoords, updateMoment, deleteMoment,
} from '../db.js'

const router = Router()
router.use(auth)

// 创建恋爱瞬间
router.post('/', (req, res) => {
  const { content, mood, location, longitude, latitude, momentDate, photos } = req.body || {}
  if (!content || !String(content).trim()) return badRequest(res, '内容不能为空')
  res.json({ ok: true, data: createMoment({ userId: req.user.id, content, mood, location, longitude, latitude, momentDate, photos }) })
})

// 列表：心情 / 关键词 / 日期区间筛选
router.get('/', (req, res) => {
  const { mood, keyword, startDate, endDate } = req.query
  res.json({ ok: true, data: listMoments({ mood, keyword, startDate, endDate }) })
})

// 恋爱地图：所有带坐标的瞬间（按时间升序，用于足迹连线）
router.get('/map', (req, res) => {
  res.json({ ok: true, data: listMomentsWithCoords() })
})

router.get('/:id', (req, res) => {
  const m = getMoment(req.params.id)
  if (!m) return notFound(res, '瞬间不存在')
  res.json({ ok: true, data: m })
})

router.put('/:id', (req, res) => {
  const m = getMoment(req.params.id)
  if (!m) return notFound(res, '瞬间不存在')
  const { content, mood, location, longitude, latitude, momentDate, photos } = req.body || {}
  res.json({ ok: true, data: updateMoment(m.id, { content, mood, location, longitude, latitude, momentDate, photos }) })
})

router.delete('/:id', (req, res) => {
  deleteMoment(req.params.id)
  res.json({ ok: true, data: null })
})

export default router
