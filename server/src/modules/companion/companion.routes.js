import express from 'express'
import * as companionController from './companion.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { idempotency } from '../../middleware/idempotency.middleware.js'

const router = express.Router()

router.get('/consent', requireAuth, companionController.getConsent)
router.put('/consent', requireAuth, companionController.updateConsent)
router.get('/conversations', requireAuth, companionController.listConversations)
router.post('/conversations', requireAuth, idempotency, companionController.createConversation)
router.get('/conversations/:id', requireAuth, companionController.getConversation)
router.post('/conversations/:id/messages', requireAuth, idempotency, companionController.createMessage)
router.delete('/conversations/:id', requireAuth, companionController.removeConversation)

export default router
