import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { MEDIA_DIR } from '../../config/database.js'
import { generateFileId, encryptId, datePathOf } from '../../common/utils/snowflake.js'
import { NotFoundError } from '../../common/errors/NotFoundError.js'
import { ForbiddenError } from '../../common/errors/ForbiddenError.js'
import * as coupleService from '../couple/couple.service.js'
import * as fileRepository from './file.repository.js'

// 软删除墓碑目录（物理文件移入此处，原 URL 立即失效；磁盘兜底暂不清理）
export const TRASH_DIR = path.join(MEDIA_DIR, '.trash')

export function mediaUrlOf(relPath) {
  return `/media/${String(relPath).replace(/[\\/]+/g, '/')}`
}

export function typeOfMime(mime) {
  if (mime && mime.startsWith('image/')) return 'image'
  if (mime && mime.startsWith('video/')) return 'video'
  return 'file'
}

// mime 兜底：客户端未带 Content-Type 时按扩展名推断（保证 type 判定可靠）
const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp',
  webp: 'image/webp', tiff: 'image/tiff', svg: 'image/svg+xml',
  mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv',
  mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4',
}

export function normalizeMime(mime, originalName) {
  if (mime && mime !== 'application/octet-stream') return mime
  const ext = String(originalName || '').split('.').pop()?.toLowerCase() || ''
  return MIME_BY_EXT[ext] || mime || ''
}

// 文件对象（读侧统一形状）：{ id, url, type, name, size }
export function toItem(row) {
  if (!row) return null
  return {
    id: row.id,
    url: mediaUrlOf(row.path),
    type: typeOfMime(row.mime),
    name: row.original_name || '',
    size: row.size || 0,
  }
}

// 按 fileId 批量解析文件对象（status=1 才可见；已删除的 ID 不返回）
export function resolveItems(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))]
  if (!uniq.length) return []
  const byId = new Map(fileRepository.findActiveByIds(uniq).map((r) => [r.id, r]))
  return uniq.map((id) => toItem(byId.get(id))).filter(Boolean)
}

// 单个 fileId → 访问 URL（已删除/不存在返回空串）
export function resolveUrl(fileId) {
  const row = fileId ? fileRepository.findById(fileId) : null
  if (!row || row.status !== 1) return ''
  return mediaUrlOf(row.path)
}

// 落盘规划：生成唯一文件 ID 与相对路径；路径已存在则重新生成（防哈希碰撞兜底）
export function planUpload(originalName) {
  for (;;) {
    const { id, ext } = generateFileId(originalName)
    const relPath = `${datePathOf(id)}/${encryptId(id)}.${ext}`
    const abs = path.join(MEDIA_DIR, relPath)
    if (!fs.existsSync(abs)) return { id, ext, relPath, abs }
  }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// 上传完成后登记文件表；入库失败则回收物理文件
export function registerUpload({ id, userId, relPath, size, mime, originalName }) {
  const finalMime = normalizeMime(mime, originalName)
  try {
    fileRepository.create({ id, userId, path: relPath, size, mime: finalMime, originalName })
  } catch (e) {
    fs.rmSync(path.join(MEDIA_DIR, relPath), { force: true })
    throw e
  }
  return toItem(fileRepository.findById(id))
}

// 校验文件属于当前用户或同一情侣空间（双人空间权限）
function assertRemovable(userId, row) {
  if (!row || row.status !== 1) throw new NotFoundError('文件不存在')
  if (row.user_id === userId) return
  if (!row.user_id) throw new ForbiddenError('无权删除该文件')
  const ownerCouple = coupleService.getUserCouple(row.user_id)
  const myCouple = coupleService.getUserCouple(userId)
  if (!ownerCouple || !myCouple || ownerCouple.pairCode !== myCouple.pairCode) {
    throw new ForbiddenError('无权删除该文件')
  }
}

// 软删除 + 墓碑迁移：文件移入 .trash，status=0；不物理删除、可恢复
export function softDelete(fileId, userId) {
  const row = fileRepository.findById(fileId)
  assertRemovable(userId, row)
  const abs = path.join(MEDIA_DIR, row.path)
  if (fs.existsSync(abs)) {
    const trashRel = `${row.path.replace(/[\\/]+/g, '/')}.${Date.now()}.${crypto.randomUUID().slice(0, 6)}`
    const trashAbs = path.join(TRASH_DIR, trashRel)
    ensureDir(path.dirname(trashAbs))
    fs.renameSync(abs, trashAbs)
    fileRepository.markTombstoned(fileId, trashRel)
  } else {
    fileRepository.markTombstoned(fileId, '')
  }
  return null
}

// 级联软删除（业务行删除时回收文件）：失败静默，不阻断主流程
export function softDeleteQuietly(fileId, userId) {
  try {
    if (fileId) softDelete(fileId, userId)
  } catch {
    /* 忽略：业务删除不应因文件回收失败而中断 */
  }
}
