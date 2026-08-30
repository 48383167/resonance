import express from 'express'
import * as observatoryController from './observatory.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

// 观测台内部接口（认证）：登录用户管理/预览观测台，挂载于 /api/observatory
const router = express.Router()

router.get('/', requireAuth, observatoryController.getInternalObservatory)
router.patch('/visibility', requireAuth, observatoryController.setVisibility)

export default router
