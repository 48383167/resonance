import express from 'express'
import { exportArchive } from './export.controller.js'

const router = express.Router()

router.get('/export', exportArchive)

export default router
