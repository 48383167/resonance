import { Router } from 'express'
import crypto from 'node:crypto'
import multer from 'multer'
import path from 'node:path'
import { auth, badRequest } from '../middleware.js'
import {
  MEDIA_DIR, stats, daysSincePaired, updateUser, getPartnerOf, listAnniversaries,
} from '../db.js'

const router = Router()

// —— 附件上传（照片/视频/任意文件）——
// 文件名保留原始名称（净化后），便于前端展示与辨认
const safeBase = (name) => {
  const ext = path.extname(name || '')
  const base = path.basename(name || 'file', ext).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40)
  return { base: base || 'file', ext }
}
const storage = multer.diskStorage({
  destination: MEDIA_DIR,
  filename: (req, file, cb) => {
    const { base, ext } = safeBase(file.originalname)
    cb(null, `${Date.now()}-${base}-${crypto.randomUUID().slice(0, 6)}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
})

router.post('/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return badRequest(res, '未收到文件')
  const isImage = Boolean(req.file.mimetype?.startsWith('image/'))
  const isVideo = Boolean(req.file.mimetype?.startsWith('video/'))
  res.json({ ok: true, data: { url: `/media/${req.file.filename}`, type: isImage ? 'image' : isVideo ? 'video' : 'file' } })
})

// —— 首页聚合 ——
router.get('/dashboard', auth, (req, res) => {
  const s = stats()
  const partner = req.user.pair_code ? getPartnerOf(req.user.id, req.user.pair_code) : null
  const anniversaries = listAnniversaries()
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = anniversaries
    .filter((a) => a.date >= today)
    .sort((x, y) => x.date.localeCompare(y.date))[0] || null
  res.json({ ok: true, data: { me: req.user, partner, inviteCode: partner ? null : req.user.pair_code, daysTogether: daysSincePaired(), stats: s, upcomingAnniversary: upcoming } })
})

// —— 恋爱树状态 ——
router.get('/tree/state', auth, (req, res) => {
  const s = stats()
  const total = s.moments + s.letters + s.entries + s.wishesDone + s.photos
  const stages = [
    { stage: 'seed', label: '种子', at: 0 },
    { stage: 'sprout', label: '嫩芽', at: 5 },
    { stage: 'sapling', label: '小树', at: 20 },
    { stage: 'blossom', label: '开花', at: 60 },
    { stage: 'lush', label: '繁茂', at: 150 },
  ]
  let current = stages[0]
  let next = stages[1]
  for (let i = 0; i < stages.length; i++) {
    if (total >= stages[i].at) {
      current = stages[i]
      next = stages[i + 1] || stages[i]
    }
  }
  const span = next.at - current.at
  const progress = span > 0 ? Math.min(1, (total - current.at) / span) : 1
  res.json({ ok: true, data: { stage: current.stage, stageLabel: current.label, progress, total, nextAt: next.at, counts: s } })
})

// —— 个人资料 ——
router.put('/users/me', auth, (req, res) => {
  const { nickname, avatarUrl } = req.body || {}
  if (nickname != null && !String(nickname).trim()) return badRequest(res, '昵称不能为空')
  res.json({ ok: true, data: updateUser(req.user.id, { nickname, avatarUrl }) })
})

export default router
