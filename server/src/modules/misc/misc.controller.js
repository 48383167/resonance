import crypto from 'node:crypto'
import multer from 'multer'
import path from 'node:path'
import { MEDIA_DIR } from '../../config/database.js'
import { BadRequestError } from '../../common/errors/BadRequestError.js'
import * as miscService from './misc.service.js'

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
export const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

export function uploadFile(req, res) {
  if (!req.file) throw new BadRequestError('未收到文件')
  const isImage = Boolean(req.file.mimetype?.startsWith('image/'))
  const isVideo = Boolean(req.file.mimetype?.startsWith('video/'))
  res.success({ url: `/media/${req.file.filename}`, type: isImage ? 'image' : isVideo ? 'video' : 'file' })
}

export function dashboard(req, res) {
  res.success(miscService.getDashboard(req.user))
}

export function treeState(req, res) {
  res.success(miscService.getTreeState())
}

export function updateProfile(req, res) {
  res.success(miscService.updateProfile(req.user.id, req.body))
}
