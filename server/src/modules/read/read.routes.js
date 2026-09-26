import express from 'express'
import * as readController from './read.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

// 内容未读：summary 供底部导航 / 首页 / 列表页共享；POST /:module 表示"打开列表即已读"
const router = express.Router()

router.get('/summary', requireAuth, readController.summary)
router.post('/:module', requireAuth, readController.markRead)

export default router
