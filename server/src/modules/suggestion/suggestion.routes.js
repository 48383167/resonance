import express from 'express'
import * as suggestionController from './suggestion.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/latest', requireAuth, suggestionController.latest)
router.post('/analyze', requireAuth, suggestionController.analyze)

export default router
