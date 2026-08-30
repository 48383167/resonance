import express from 'express'
import * as wishController from './wish.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { idempotency } from '../../middleware/idempotency.middleware.js'

const router = express.Router()

router.get('/', requireAuth, wishController.list)
router.post('/', requireAuth, idempotency, wishController.create)
router.get('/:id', requireAuth, wishController.detail)
router.put('/:id/status', requireAuth, wishController.setStatus)
router.put('/:id', requireAuth, wishController.update)
router.delete('/:id', requireAuth, wishController.remove)

export default router
