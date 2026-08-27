import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { resolveUrl, mediaUrlOf, typeOfMime } from '../file/file.service.js'

function newId(prefix) {
  return prefix + '_' + randomUUID().slice(0, 12)
}

// 照片行 → 视图：file_id 联 files 出 url（迁移前旧行仅有 url 时兜底直出）
function toPhoto(row) {
  const p = { ...row }
  if (p.file_id) {
    p.url = p.file_status === 1 ? `/media/${p.file_path}` : ''
  } else {
    p.url = p.url || ''
  }
  return p
}

// 相册行 → 视图：封面 file_id 解析（保留 cover_url 兼容迁移前旧行）
function toAlbum(row) {
  const a = { ...row }
  if (a.cover_file_id) {
    a.cover_url = a.cover_status === 1 ? resolveUrl(a.cover_file_id) : ''
  } else {
    a.cover_url = a.cover_url || ''
  }
  return a
}

function albumRow(id) {
  return db.prepare(
    `SELECT a.*, f.path AS cover_path, f.status AS cover_status
     FROM albums a LEFT JOIN files f ON f.id = a.cover_file_id
     WHERE a.id = ?`
  ).get(id)
}

export function listPhotos(albumId) {
  return db.prepare(
    `SELECT ap.*, f.path AS file_path, f.status AS file_status
     FROM album_photos ap LEFT JOIN files f ON f.id = ap.file_id
     WHERE ap.album_id = ? AND COALESCE(f.status, 1) = 1
     ORDER BY datetime(ap.created_at) DESC, ap.id DESC`
  ).all(albumId).map(toPhoto)
}

export function findById(id) {
  const a = albumRow(id)
  if (!a) return null
  const result = toAlbum(a)
  result.photos = listPhotos(id)
  return result
}

export function list() {
  return db.prepare(
    `SELECT a.*, f.path AS cover_path, f.status AS cover_status
     FROM albums a LEFT JOIN files f ON f.id = a.cover_file_id
     ORDER BY datetime(a.created_at) DESC`
  ).all()
    .map((a) => {
      const album = toAlbum(a)
      const photos = listPhotos(album.id)
      return { ...album, photoCount: photos.length, firstPhotoUrl: photos[0]?.url || '' }
    })
}

export function create({ name, coverFileId, description }) {
  const id = newId('a')
  db.prepare('INSERT INTO albums (id, name, cover_file_id, description) VALUES (?, ?, ?, ?)')
    .run(id, name, coverFileId || null, description || '')
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

export function addPhoto(albumId, { fileId, caption }) {
  const id = newId('ap')
  db.prepare('INSERT INTO album_photos (id, album_id, file_id, caption) VALUES (?, ?, ?, ?)')
    .run(id, albumId, fileId, caption || '')
  return findById(albumId)
}

// 删除照片：返回 { albumId, fileId } 供级联回收文件
export function removePhoto(photoId) {
  const photo = db.prepare('SELECT * FROM album_photos WHERE id = ?').get(photoId)
  if (!photo) return null
  db.prepare('DELETE FROM album_photos WHERE id = ?').run(photoId)
  // 封面与图片集独立：仅当被删的恰好是封面时清空
  const album = db.prepare('SELECT cover_file_id FROM albums WHERE id = ?').get(photo.album_id)
  if (album && album.cover_file_id && album.cover_file_id === photo.file_id) {
    db.prepare('UPDATE albums SET cover_file_id = NULL WHERE id = ?').run(photo.album_id)
  }
  return { albumId: photo.album_id, fileId: photo.file_id || null }
}

export function setCover(albumId, fileId) {
  db.prepare('UPDATE albums SET cover_file_id = ? WHERE id = ?').run(fileId, albumId)
  return findById(albumId)
}

export function photosPage(albumId, offset, limit) {
  const total = db.prepare(
    `SELECT COUNT(*) AS c FROM album_photos ap LEFT JOIN files f ON f.id = ap.file_id
     WHERE ap.album_id = ? AND COALESCE(f.status, 1) = 1`
  ).get(albumId).c
  const items = db.prepare(
    `SELECT ap.*, f.path AS file_path, f.status AS file_status
     FROM album_photos ap LEFT JOIN files f ON f.id = ap.file_id
     WHERE ap.album_id = ? AND COALESCE(f.status, 1) = 1
     ORDER BY datetime(ap.created_at) DESC, ap.id DESC LIMIT ? OFFSET ?`
  ).all(albumId, limit, offset).map(toPhoto)
  return { items, total }
}

export function updatePhotoCaption(photoId, caption) {
  db.prepare('UPDATE album_photos SET caption = ? WHERE id = ?').run(caption ?? '', photoId)
  const row = db.prepare(
    `SELECT ap.*, f.path AS file_path, f.status AS file_status
     FROM album_photos ap LEFT JOIN files f ON f.id = ap.file_id
     WHERE ap.id = ? AND COALESCE(f.status, 1) = 1`
  ).get(photoId)
  return row ? toPhoto(row) : null
}

// —— 观测台公开照片 ——

// 照片行（含文件联查）→ 观测台安全视图：不泄露 file_path/file_status 等内部字段
function toObservatoryPhoto(row) {
  const active = row.file_status === 1
  return {
    id: row.id,
    album_id: row.album_id,
    file_id: row.file_id,
    url: row.file_id ? (active ? mediaUrlOf(row.file_path) : '') : (row.url || ''),
    type: row.file_id ? (active ? typeOfMime(row.file_mime) : 'file') : (row.type || 'file'),
    show_in_observatory: row.show_in_observatory,
  }
}

function photoRow(photoId) {
  return db.prepare(
    `SELECT ap.*, f.path AS file_path, f.status AS file_status, f.mime AS file_mime, f.user_id AS file_user_id
     FROM album_photos ap LEFT JOIN files f ON f.id = ap.file_id
     WHERE ap.id = ?`
  ).get(photoId)
}

// 按 photoId 查询照片行（含文件联查，供 service 校验归属）
export function findPhotoById(photoId) {
  return photoRow(photoId) || null
}

// 更新展示开关并返回观测台安全视图
export function setPhotoObservatory(photoId, show) {
  db.prepare('UPDATE album_photos SET show_in_observatory = ? WHERE id = ?').run(show ? 1 : 0, photoId)
  const row = photoRow(photoId)
  return row ? toObservatoryPhoto(row) : null
}

// 观测台公开图片：仅展示已勾选、文件有效且为图片的照片（按创建时间倒序）
export function listObservatoryPhotos() {
  const rows = db.prepare(
    `SELECT ap.id, ap.file_id, f.path AS file_path, f.status AS file_status, f.mime AS file_mime
     FROM album_photos ap
     JOIN files f ON f.id = ap.file_id
     WHERE ap.show_in_observatory = 1 AND f.status = 1 AND f.mime LIKE 'image/%'
     ORDER BY datetime(ap.created_at) DESC, ap.id DESC`
  ).all()
  return rows.map((r) => ({
    id: r.id,
    url: mediaUrlOf(r.file_path),
    type: 'image',
  }))
}
