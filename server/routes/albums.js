import { Router } from 'express'
import { auth, badRequest, notFound } from '../middleware.js'
import {
  createAlbum, listAlbums, getAlbum, deleteAlbum, addAlbumPhoto, deleteAlbumPhoto, setAlbumCover,
  updateAlbum, albumPhotosPage, updateAlbumPhotoCaption,
} from '../db.js'

const router = Router()
router.use(auth)

router.post('/', (req, res) => {
  const { name, coverUrl, description } = req.body || {}
  if (!name || !String(name).trim()) return badRequest(res, '相册名不能为空')
  res.json({ ok: true, data: createAlbum({ name, coverUrl, description }) })
})

router.get('/', (req, res) => {
  res.json({ ok: true, data: listAlbums() })
})

router.get('/:id', (req, res) => {
  const album = getAlbum(req.params.id)
  if (!album) return notFound(res, '相册不存在')
  res.json({ ok: true, data: album })
})

// 添加照片（可带说明）
router.post('/:id/photos', (req, res) => {
  const album = getAlbum(req.params.id)
  if (!album) return notFound(res, '相册不存在')
  const { url, caption } = req.body || {}
  if (!url) return badRequest(res, '图片 URL 不能为空')
  res.json({ ok: true, data: addAlbumPhoto(album.id, { url, caption }) })
})

// 删除单张照片
router.delete('/:id/photos/:photoId', (req, res) => {
  const albumId = deleteAlbumPhoto(req.params.photoId)
  if (!albumId) return notFound(res, '照片不存在')
  res.json({ ok: true, data: getAlbum(albumId) })
})

// 设置相册封面
router.put('/:id/cover', (req, res) => {
  const album = getAlbum(req.params.id)
  if (!album) return notFound(res, '相册不存在')
  const { url } = req.body || {}
  if (!url) return badRequest(res, '封面 URL 不能为空')
  res.json({ ok: true, data: setAlbumCover(album.id, url) })
})

// 修改相册基本信息
router.put('/:id', (req, res) => {
  const album = getAlbum(req.params.id)
  if (!album) return notFound(res, '相册不存在')
  const { name, description } = req.body || {}
  if (name != null && !String(name).trim()) return badRequest(res, '相册名不能为空')
  res.json({ ok: true, data: updateAlbum(album.id, { name, description }) })
})

// 分页获取照片（按时间倒序，前端无限加载）
router.get('/:id/photos', (req, res) => {
  const album = getAlbum(req.params.id)
  if (!album) return notFound(res, '相册不存在')
  const offset = Math.max(0, Number(req.query.offset) || 0)
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20))
  res.json({ ok: true, data: albumPhotosPage(album.id, offset, limit) })
})

// 为照片写故事
router.put('/:id/photos/:photoId', (req, res) => {
  const { caption } = req.body || {}
  const photo = updateAlbumPhotoCaption(req.params.photoId, caption ?? '')
  if (!photo) return notFound(res, '照片不存在')
  res.json({ ok: true, data: photo })
})

router.delete('/:id', (req, res) => {
  deleteAlbum(req.params.id)
  res.json({ ok: true, data: null })
})

export default router
