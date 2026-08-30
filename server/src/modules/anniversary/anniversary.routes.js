import express from 'express'
import * as anniversaryController from './anniversary.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { idempotency } from '../../middleware/idempotency.middleware.js'

const router = express.Router()

router.get('/', requireAuth, anniversaryController.list)
router.post('/', requireAuth, idempotency, anniversaryController.create)
router.get('/:id', requireAuth, anniversaryController.detail)
router.put('/:id', requireAuth, anniversaryController.update)
router.patch('/:id/share-visibility', requireAuth, anniversaryController.updateShareVisibility)
router.delete('/:id', requireAuth, anniversaryController.remove)

export default router
