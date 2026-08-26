import express from 'express'
import * as themeController from './theme.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth, themeController.getTheme)
router.put('/', requireAuth, themeController.updateTheme)

export default router
