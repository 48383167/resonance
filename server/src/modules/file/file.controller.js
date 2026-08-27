import multer from 'multer'
import path from 'node:path'
import { BadRequestError } from '../../common/errors/BadRequestError.js'
import * as fileService from './file.service.js'

// 上传：destination 阶段生成雪花 ID（含扩展名码）并创建 yyyy/MM/dd 分级目录
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const plan = fileService.planUpload(file.originalname)
      fileService.ensureDir(path.dirname(plan.abs))
      req.filePlan = plan
      cb(null, path.dirname(plan.abs))
    } catch (e) {
      cb(e)
    }
  },
  filename: (req, file, cb) => cb(null, path.basename(req.filePlan.relPath)),
})

export const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

export function uploadFile(req, res) {
  if (!req.file || !req.filePlan) throw new BadRequestError('未收到文件')
  const item = fileService.registerUpload({
    id: req.filePlan.id,
    userId: req.user.id,
    relPath: req.filePlan.relPath,
    size: req.file.size,
    mime: req.file.mimetype,
    originalName: req.file.originalname,
  })
  res.success(item)
}

export function removeFile(req, res) {
  res.success(fileService.softDelete(req.params.id, req.user.id))
}
