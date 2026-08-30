import express from 'express'
import * as momentController from './moment.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { idempotency } from '../../middleware/idempotency.middleware.js'

const router = express.Router()

router.get('/', requireAuth, momentController.list)
// 地图需在 /:id 之前注册
router.get('/map', requireAuth, momentController.listMap)
router.get('/:id', requireAuth, momentController.detail)
router.post('/', requireAuth, idempotency, momentController.create)
router.put('/:id', requireAuth, momentController.update)
router.patch('/:id/share-visibility', requireAuth, momentController.updateShareVisibility)
router.delete('/:id', requireAuth, momentController.remove)

export default router
