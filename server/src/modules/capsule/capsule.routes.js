import express from 'express'
import * as capsuleController from './capsule.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth, capsuleController.list)
router.post('/', requireAuth, capsuleController.create)
router.get('/:id', requireAuth, capsuleController.detail)
router.delete('/:id', requireAuth, capsuleController.remove)

export default router
