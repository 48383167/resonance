import express from 'express'
import * as ruleController from './rule.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { idempotency } from '../../middleware/idempotency.middleware.js'

const router = express.Router()

router.get('/', requireAuth, ruleController.list)
// 必须注册在 GET /:id 之前，避免被 :id 参数路由吞掉
router.get('/pending/count', requireAuth, ruleController.pendingCount)
router.post('/', requireAuth, idempotency, ruleController.create)
router.get('/:id', requireAuth, ruleController.detail)
router.put('/:id/agree', requireAuth, ruleController.toggleAgree)
router.put('/:id', requireAuth, ruleController.update)
router.delete('/:id', requireAuth, ruleController.remove)

export default router
