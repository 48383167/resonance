import express from 'express'
import * as notificationController from './notification.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { idempotency } from '../../middleware/idempotency.middleware.js'

const router = express.Router()

router.get('/mail', requireAuth, notificationController.getMail)
router.put('/mail', requireAuth, notificationController.updateMail)
router.post('/mail/test', requireAuth, idempotency, notificationController.sendTest)
router.get('/preview', requireAuth, notificationController.preview)
router.post('/run', requireAuth, idempotency, notificationController.run)

export default router
