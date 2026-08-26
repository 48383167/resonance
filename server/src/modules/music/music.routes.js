import express from 'express'
import * as musicController from './music.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/tracks', requireAuth, musicController.getTracks)

export default router
