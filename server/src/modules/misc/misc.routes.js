import express from 'express'
import { dashboard, treeState, updateProfile } from './misc.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/dashboard', requireAuth, dashboard)
router.get('/tree/state', requireAuth, treeState)
router.put('/users/me', requireAuth, updateProfile)

export default router
