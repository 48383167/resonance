import express from 'express'
import * as albumController from './album.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth, albumController.list)
router.post('/', requireAuth, albumController.create)
router.get('/:id/photos', requireAuth, albumController.photosPage)
router.post('/:id/photos', requireAuth, albumController.addPhoto)
router.put('/:id/cover', requireAuth, albumController.setCover)
router.get('/:id', requireAuth, albumController.detail)
router.put('/:id', requireAuth, albumController.update)
router.delete('/:id', requireAuth, albumController.remove)
router.delete('/:id/photos/:photoId', requireAuth, albumController.removePhoto)
router.put('/:id/photos/:photoId', requireAuth, albumController.updatePhotoCaption)

export default router
