import { randomUUID } from 'node:crypto'
import { BadRequestError } from '../../common/errors/BadRequestError.js'
import { FOOD_EXTRACT_MAX_LENGTH } from './food.policy.js'

export const FOOD_CATEGORIES = ['snack', 'meal', 'hotpot', 'bbq', 'dessert', 'drink', 'other']
export const FOOD_STATUSES = ['want', 'visited', 'favorite']
export const MAX_DISHES = 20
export const MAX_PHOTOS = 9

function normalizeName(name) {
  if (typeof name !== 'string' || !name.trim()) throw new BadRequestError('店名不能为空')
  const t = name.trim()
  if (t.length > 40) throw new BadRequestError('店名最多 40 字')
  return t
}

function normalizeText(value, max, label) {
  const s = value == null ? '' : String(value).trim()
  if (s.length > max) throw new BadRequestError(`${label}最多 ${max} 字`)
  return s
}

function normalizeRating(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new BadRequestError('评分需为 1~5 星')
  return n
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 9999) throw new BadRequestError('人均需在 0~9999 元')
  return n
}

function normalizeDate(value) {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestError('日期格式应为 YYYY-MM-DD')
  return s
}

function normalizeCoords(longitude, latitude) {
  const missing = longitude === null || longitude === undefined || longitude === '' || latitude === null || latitude === undefined || latitude === ''
  if (missing) return { longitude: null, latitude: null }
  const lng = Number(longitude)
  const lat = Number(latitude)
  if (!Number.isFinite(lng) || lng < -180 || lng > 180 || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new BadRequestError('坐标不合法')
  }
  return { longitude: lng, latitude: lat }
}

function normalizeDishes(raw) {
  if (!Array.isArray(raw)) throw new BadRequestError('菜品格式不合法')
  if (raw.length > MAX_DISHES) throw new BadRequestError(`最多记录 ${MAX_DISHES} 道菜`)
  const dishes = []
  for (const entry of raw) {
    const name = String(entry?.name ?? '').trim()
    if (!name) continue
    if (name.length > 20) throw new BadRequestError('菜名最多 20 字')
    dishes.push({
      id: typeof entry?.id === 'string' && entry.id ? entry.id : `fd_${randomUUID().slice(0, 12)}`,
      name,
      rating: normalizeRating(entry?.rating),
      note: normalizeText(entry?.note, 50, '菜品备注'),
      price: normalizePrice(entry?.price),
    })
  }
  return dishes
}

function normalizePhotos(raw) {
  if (!Array.isArray(raw)) throw new BadRequestError('图片格式不合法')
  const photos = raw.filter((id) => typeof id === 'string' && id)
  if (photos.length > MAX_PHOTOS) throw new BadRequestError(`最多上传 ${MAX_PHOTOS} 张图片`)
  return photos
}

function normalizeCategory(value) {
  const v = value == null || value === '' ? 'other' : value
  if (!FOOD_CATEGORIES.includes(v)) throw new BadRequestError('分类不合法')
  return v
}

function normalizeStatus(value) {
  const v = value == null || value === '' ? 'want' : value
  if (!FOOD_STATUSES.includes(v)) throw new BadRequestError('状态不合法')
  return v
}

export function validateCreate(body = {}) {
  return {
    name: normalizeName(body.name),
    category: normalizeCategory(body.category),
    status: normalizeStatus(body.status),
    rating: normalizeRating(body.rating),
    location: normalizeText(body.location, 80, '地点'),
    ...normalizeCoords(body.longitude, body.latitude),
    hours: normalizeText(body.hours, 80, '营业时间'),
    phone: normalizeText(body.phone, 30, '电话'),
    avgPrice: normalizePrice(body.avgPrice),
    note: normalizeText(body.note, 1000, '笔记'),
    dishes: normalizeDishes(body.dishes ?? []),
    photos: normalizePhotos(body.photos ?? []),
    visitedAt: normalizeDate(body.visitedAt),
  }
}

// 局部更新：未提交的字段沿用已有值（existing 为数据库行，snake_case）
export function validateUpdate(body = {}, existing = {}) {
  const fields = {
    name: body.name !== undefined ? normalizeName(body.name) : existing.name,
    category: body.category !== undefined ? normalizeCategory(body.category) : existing.category,
    status: body.status !== undefined ? normalizeStatus(body.status) : existing.status,
    rating: body.rating !== undefined ? normalizeRating(body.rating) : existing.rating,
    location: body.location !== undefined ? normalizeText(body.location, 80, '地点') : (existing.location ?? ''),
    hours: body.hours !== undefined ? normalizeText(body.hours, 80, '营业时间') : (existing.hours ?? ''),
    phone: body.phone !== undefined ? normalizeText(body.phone, 30, '电话') : (existing.phone ?? ''),
    avgPrice: body.avgPrice !== undefined ? normalizePrice(body.avgPrice) : existing.avg_price,
    note: body.note !== undefined ? normalizeText(body.note, 1000, '笔记') : (existing.note ?? ''),
    dishes: body.dishes !== undefined ? normalizeDishes(body.dishes) : undefined,
    photos: body.photos !== undefined ? normalizePhotos(body.photos) : undefined,
    visitedAt: body.visitedAt !== undefined ? normalizeDate(body.visitedAt) : existing.visited_at,
  }
  if (body.longitude !== undefined || body.latitude !== undefined) {
    const lng = body.longitude !== undefined ? body.longitude : existing.longitude
    const lat = body.latitude !== undefined ? body.latitude : existing.latitude
    Object.assign(fields, normalizeCoords(lng, lat))
  } else {
    fields.longitude = existing.longitude
    fields.latitude = existing.latitude
  }
  return fields
}

export function validateStatus(body = {}) {
  if (!FOOD_STATUSES.includes(body.status)) throw new BadRequestError('状态不合法')
  return { status: body.status }
}

// AI 粘贴成店：输入一段探店笔记，仅用于生成表单草稿
export function validateParse(body = {}) {
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) throw new BadRequestError('请先粘贴一段笔记')
  if (text.length > FOOD_EXTRACT_MAX_LENGTH) {
    throw new BadRequestError(`笔记最多 ${FOOD_EXTRACT_MAX_LENGTH} 字`)
  }
  return { text }
}
