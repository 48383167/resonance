import express from 'express'
import * as navigationController from './navigation.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth, navigationController.getSettings)
router.put('/', requireAuth, navigationController.updateSettings)

export default router
