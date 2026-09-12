import express from 'express'
import * as commentController from './comment.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { idempotency } from '../../middleware/idempotency.middleware.js'

const router = express.Router()

router.get('/', requireAuth, commentController.list)
router.get('/unread', requireAuth, commentController.unread)
router.post('/', requireAuth, idempotency, commentController.create)
router.post('/read', requireAuth, commentController.markRead)
router.delete('/:id', requireAuth, commentController.remove)

export default router
