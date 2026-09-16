import express from 'express'
import * as pinController from './pin.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.put('/', requireAuth, pinController.setPin)
router.get('/global', requireAuth, pinController.listGlobal)

export default router
