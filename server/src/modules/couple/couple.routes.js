import express from 'express'
import * as coupleController from './couple.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth, coupleController.getCouple)

export default router
