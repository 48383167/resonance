import express from 'express'
import * as shareController from './share.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { idempotency } from '../../middleware/idempotency.middleware.js'

const router = express.Router()

router.post('/create', requireAuth, idempotency, shareController.createShare)
router.get('/current', requireAuth, shareController.getCurrent)
router.patch('/current', requireAuth, shareController.updateCurrent)
router.delete('/current', requireAuth, shareController.disableShare)

export default router
