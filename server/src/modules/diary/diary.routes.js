import express from 'express'
import * as diaryController from './diary.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth, diaryController.list)
// 日历需在 /:id 之前注册
router.get('/calendar', requireAuth, diaryController.calendar)
router.get('/:id', requireAuth, diaryController.detail)
router.post('/solo', requireAuth, diaryController.create)
router.put('/:id', requireAuth, diaryController.update)
router.patch('/:id/visibility', requireAuth, diaryController.setVisibility)
router.delete('/:id', requireAuth, diaryController.remove)

export default router
