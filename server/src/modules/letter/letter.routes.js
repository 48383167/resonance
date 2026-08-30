import express from 'express'
import * as letterController from './letter.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { idempotency } from '../../middleware/idempotency.middleware.js'

const router = express.Router()

router.get('/', requireAuth, letterController.list)
router.post('/', requireAuth, idempotency, letterController.create)
router.get('/:id', requireAuth, letterController.detail)
router.put('/:id', requireAuth, letterController.update)
router.delete('/:id', requireAuth, letterController.remove)

export default router
