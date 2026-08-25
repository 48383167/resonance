import { Router } from 'express'
import { auth, badRequest } from '../middleware.js'
import {
  getEntry, listEntries, entriesByMonth, createEntry, createContent,
  setEntryVisibility, attachContents, deleteEntry,
} from '../db.js'

const router = Router()

router.use(auth)

// 获取日记列表
router.get('/', (req, res) => {
  res.json({ ok: true, data: listEntries() })
})

// 日记日历：按月份聚合（注意需在 /:id 之前注册）
router.get('/calendar', (req, res) => {
  const year = Number(req.query.year)
  const month = Number(req.query.month)
  if (!year || !month || month < 1 || month > 12) return badRequest(res, '年份或月份不合法')
  res.json({ ok: true, data: entriesByMonth(year, month) })
})

// 获取单篇日记
router.get('/:id', (req, res) => {
  const entry = getEntry(req.params.id)
  if (!entry) return res.status(404).json({ ok: false, error: '日记不存在' })
  res.json({ ok: true, data: attachContents(entry) })
})

// 写日记（含情绪墨水与环境底片采集结果，支持照片/视频/附件）
router.post('/solo', (req, res) => {
  const { title, content, typingSpeed, deleteCount, pauseDuration, weatherCode, timeColorHex, media } = req.body || {}
  if (!content || !String(content).trim()) return badRequest(res, '内容不能为空')
  const entry = createEntry({ title, weatherCode, timeColorHex, media })
  createContent({ entryId: entry.id, userId: req.user.id, content, typingSpeed, deleteCount, pauseDuration })
  res.json({ ok: true, data: attachContents(getEntry(entry.id)) })
})

// 切换隐私状态 (私密/公开)
router.patch('/:id/visibility', (req, res) => {
  const entry = getEntry(req.params.id)
  if (!entry) return res.status(404).json({ ok: false, error: '日记不存在' })
  const { isPublic } = req.body || {}
  setEntryVisibility(entry.id, Boolean(isPublic))
  res.json({ ok: true, data: attachContents(getEntry(entry.id)) })
})

// 删除日记（含内容分片）
router.delete('/:id', (req, res) => {
  const entry = getEntry(req.params.id)
  if (!entry) return res.status(404).json({ ok: false, error: '日记不存在' })
  deleteEntry(entry.id)
  res.json({ ok: true, data: null })
})

export default router
