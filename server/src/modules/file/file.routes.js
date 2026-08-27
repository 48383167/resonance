import express from 'express'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { upload, uploadFile, removeFile } from './file.controller.js'

const router = express.Router()

router.post('/upload', requireAuth, upload.single('file'), uploadFile)
router.delete('/files/:id', requireAuth, removeFile)

export default router
