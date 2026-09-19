import express from 'express'
import * as foodController from './food.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { idempotency } from '../../middleware/idempotency.middleware.js'

const router = express.Router()

router.get('/', requireAuth, foodController.list)
// 必须注册在 GET /:id 之前，避免被 :id 参数路由吞掉
router.get('/map', requireAuth, foodController.map)
router.post('/parse', requireAuth, foodController.parseDraft)
router.post('/', requireAuth, idempotency, foodController.create)
router.get('/:id', requireAuth, foodController.detail)
router.get('/:id/moments', requireAuth, foodController.listMoments)
router.put('/:id/status', requireAuth, foodController.setStatus)
router.put('/:id', requireAuth, foodController.update)
router.delete('/:id', requireAuth, foodController.remove)

export default router
