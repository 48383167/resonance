import { NotFoundError } from '../../common/errors/NotFoundError.js'
import * as albumRepository from './album.repository.js'
import * as albumSchema from './album.schema.js'

export function list() {
  return albumRepository.list()
}

export function getDetail(id) {
  const album = albumRepository.findById(id)
  if (!album) throw new NotFoundError('相册不存在')
  return album
}

export function create(raw) {
  const data = albumSchema.validateCreate(raw)
  return albumRepository.create(data)
}

export function update(id, raw) {
  const album = albumRepository.findById(id)
  if (!album) throw new NotFoundError('相册不存在')
  return albumRepository.update(id, albumSchema.validateUpdate(raw))
}

export function remove(id) {
  albumRepository.remove(id)
  return null
}

export function addPhoto(id, raw) {
  const album = albumRepository.findById(id)
  if (!album) throw new NotFoundError('相册不存在')
  return albumRepository.addPhoto(album.id, albumSchema.validatePhotoUrl(raw))
}

export function removePhoto(photoId) {
  const albumId = albumRepository.removePhoto(photoId)
  if (!albumId) throw new NotFoundError('照片不存在')
  return albumRepository.findById(albumId)
}

export function setCover(id, raw) {
  const album = albumRepository.findById(id)
  if (!album) throw new NotFoundError('相册不存在')
  return albumRepository.setCover(album.id, albumSchema.validateCoverUrl(raw).url)
}

export function photosPage(id, query) {
  const album = albumRepository.findById(id)
  if (!album) throw new NotFoundError('相册不存在')
  const offset = Math.max(0, Number(query.offset) || 0)
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20))
  return albumRepository.photosPage(album.id, offset, limit)
}

export function updatePhotoCaption(photoId, raw) {
  const caption = raw?.caption ?? ''
  const photo = albumRepository.updatePhotoCaption(photoId, caption)
  if (!photo) throw new NotFoundError('照片不存在')
  return photo
}
