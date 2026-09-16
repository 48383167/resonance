import express from 'express'
import * as careController from './care.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { idempotency } from '../../middleware/idempotency.middleware.js'

const router = express.Router()

router.get('/items', requireAuth, careController.list)
router.post('/items', requireAuth, idempotency, careController.create)
router.get('/period/summary', requireAuth, careController.periodSummary)
router.get('/items/:id', requireAuth, careController.detail)
router.put('/items/:id', requireAuth, careController.update)
router.delete('/items/:id', requireAuth, careController.remove)

export default router
