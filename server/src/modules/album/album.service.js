import { NotFoundError } from '../../common/errors/NotFoundError.js'
import { softDeleteQuietly } from '../file/file.service.js'
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

export function remove(userId, id) {
  const album = albumRepository.findById(id)
  if (!album) throw new NotFoundError('相册不存在')
  albumRepository.remove(id)
  // 级联回收全部照片文件 + 封面文件（软删除墓碑）
  for (const p of album.photos || []) {
    if (p.file_id) softDeleteQuietly(p.file_id, userId)
  }
  if (album.cover_file_id && !(album.photos || []).some((p) => p.file_id === album.cover_file_id)) {
    softDeleteQuietly(album.cover_file_id, userId)
  }
  return null
}

export function addPhoto(id, raw) {
  const album = albumRepository.findById(id)
  if (!album) throw new NotFoundError('相册不存在')
  return albumRepository.addPhoto(album.id, albumSchema.validatePhoto(raw))
}

export function removePhoto(userId, photoId) {
  const result = albumRepository.removePhoto(photoId)
  if (!result) throw new NotFoundError('照片不存在')
  if (result.fileId) softDeleteQuietly(result.fileId, userId)
  return albumRepository.findById(result.albumId)
}

export function setCover(id, raw) {
  const album = albumRepository.findById(id)
  if (!album) throw new NotFoundError('相册不存在')
  return albumRepository.setCover(album.id, albumSchema.validateCover(raw).fileId)
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
