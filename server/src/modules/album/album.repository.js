import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'

function newId(prefix) {
  return prefix + '_' + randomUUID().slice(0, 12)
}

export function listPhotos(albumId) {
  return db.prepare('SELECT * FROM album_photos WHERE album_id = ? ORDER BY datetime(created_at) DESC').all(albumId)
}

export function findById(id) {
  const a = db.prepare('SELECT * FROM albums WHERE id = ?').get(id)
  if (a) a.photos = listPhotos(id)
  return a
}

export function list() {
  return db.prepare('SELECT * FROM albums ORDER BY datetime(created_at) DESC').all()
    .map((a) => {
      const photos = listPhotos(a.id)
      return { ...a, photoCount: photos.length, firstPhotoUrl: photos[0]?.url || '' }
    })
}

export function create({ name, coverUrl, description }) {
  const id = newId('a')
  db.prepare('INSERT INTO albums (id, name, cover_url, description) VALUES (?, ?, ?, ?)')
    .run(id, name, coverUrl || '', description || '')
  return findById(id)
}

export function update(id, { name, description }) {
  db.prepare('UPDATE albums SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?')
    .run(name ?? null, description ?? null, id)
  return findById(id)
}

export function remove(id) {
  db.prepare('DELETE FROM album_photos WHERE album_id = ?').run(id)
  db.prepare('DELETE FROM albums WHERE id = ?').run(id)
}

export function addPhoto(albumId, { url, caption }) {
  const id = newId('ap')
  db.prepare('INSERT INTO album_photos (id, album_id, url, caption) VALUES (?, ?, ?, ?)')
    .run(id, albumId, url, caption || '')
  return findById(albumId)
}

export function removePhoto(photoId) {
  const photo = db.prepare('SELECT * FROM album_photos WHERE id = ?').get(photoId)
  if (!photo) return null
  db.prepare('DELETE FROM album_photos WHERE id = ?').run(photoId)
  // 封面与图片集独立：仅当被删的恰好是封面时清空
  const album = db.prepare('SELECT cover_url FROM albums WHERE id = ?').get(photo.album_id)
  if (album && album.cover_url === photo.url) {
    db.prepare("UPDATE albums SET cover_url = '' WHERE id = ?").run(photo.album_id)
  }
  return photo.album_id
}

export function setCover(albumId, url) {
  db.prepare('UPDATE albums SET cover_url = ? WHERE id = ?').run(url, albumId)
  return findById(albumId)
}

export function photosPage(albumId, offset, limit) {
  const total = db.prepare('SELECT COUNT(*) AS c FROM album_photos WHERE album_id = ?').get(albumId).c
  const items = db.prepare(
    'SELECT * FROM album_photos WHERE album_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT ? OFFSET ?'
  ).all(albumId, limit, offset)
  return { items, total }
}

export function updatePhotoCaption(photoId, caption) {
  db.prepare('UPDATE album_photos SET caption = ? WHERE id = ?').run(caption ?? '', photoId)
  return db.prepare('SELECT * FROM album_photos WHERE id = ?').get(photoId) || null
}
