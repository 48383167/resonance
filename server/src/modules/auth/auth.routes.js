import express from 'express'
import * as authController from './auth.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/state', authController.state)
router.post('/register', authController.register)
router.post('/login', authController.login)
router.get('/me', requireAuth, authController.me)
router.post('/change-password', requireAuth, authController.changePassword)

export default router
