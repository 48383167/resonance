import express from 'express'
import * as observatoryController from './observatory.controller.js'

const router = express.Router()

router.get('/observatory', observatoryController.getObservatory)
router.get('/share/:token', observatoryController.getShare)

export default router
