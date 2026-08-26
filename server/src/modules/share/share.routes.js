import express from 'express'
import * as shareController from './share.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.post('/create', requireAuth, shareController.createShare)
router.get('/current', requireAuth, shareController.getCurrent)
router.delete('/current', requireAuth, shareController.disableShare)

export default router
