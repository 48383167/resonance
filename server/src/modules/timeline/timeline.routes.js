import express from 'express'
import { getTimeline } from './timeline.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth, getTimeline)

export default router
