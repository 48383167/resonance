import express from 'express'
import * as anniversaryController from './anniversary.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth, anniversaryController.list)
router.post('/', requireAuth, anniversaryController.create)
router.get('/:id', requireAuth, anniversaryController.detail)
router.put('/:id', requireAuth, anniversaryController.update)
router.delete('/:id', requireAuth, anniversaryController.remove)

export default router
