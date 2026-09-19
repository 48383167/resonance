import { randomUUID } from 'node:crypto'
import { db } from '../../config/database.js'
import { findById as findUserById } from '../auth/auth.repository.js'
import { resolveItems } from '../file/file.service.js'

function newId() {
  return `food_${randomUUID().slice(0, 12)}`
}

function parseDishes(raw) {
  try {
    const arr = JSON.parse(raw || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function parsePhotoIds(raw) {
  try {
    const arr = JSON.parse(raw || '[]')
    return Array.isArray(arr) ? arr.filter((id) => typeof id === 'string' && id) : []
  } catch {
    return []
  }
}

// 输出形态：dishes 解析为数组；photos 解析成文件对象（photoIds 保留原始 fileId，供更新时回收旧图）
function toVO(row) {
  if (!row) return null
  const photoIds = parsePhotoIds(row.photos)
  row.photoIds = photoIds
  row.photos = resolveItems(photoIds)
  row.dishes = parseDishes(row.dishes)
  row.author = findUserById(row.author_id)
  return row
}

function buildWhere({ status, category, keyword, authorIds } = {}) {
  const conds = []
  const args = []
  if (status) { conds.push('status = ?'); args.push(status) }
  if (category) { conds.push('category = ?'); args.push(category) }
  if (keyword) {
    conds.push('(name LIKE ? OR note LIKE ? OR location LIKE ? OR dishes LIKE ?)')
    const like = `%${keyword}%`
    args.push(like, like, like, like)
  }
  if (authorIds) {
    conds.push(`author_id IN (${authorIds.map(() => '?').join(', ')})`)
    args.push(...authorIds)
  }
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', args }
}

// 列表 / 详情：LEFT JOIN 置顶表取 pin_scope，排序 global > list > 常去 > 最近更新
const LIST_SELECT = `
  SELECT f.*, p.pin_scope
  FROM food_places f
  LEFT JOIN pinned_items p ON p.target_type = 'food' AND p.target_id = f.id`
const LIST_ORDER = `
  ORDER BY
    CASE p.pin_scope WHEN 'global' THEN 0 WHEN 'list' THEN 1 ELSE 2 END,
    CASE f.status WHEN 'favorite' THEN 0 ELSE 1 END,
    datetime(f.updated_at) DESC,
    f.id DESC`

export function findById(id) {
  return toVO(db.prepare(`${LIST_SELECT} WHERE f.id = ?`).get(id))
}

export function list(opts = {}) {
  const { where, args } = buildWhere(opts)
  const paging = opts.limit !== undefined ? 'LIMIT ? OFFSET ?' : ''
  const queryArgs = opts.limit !== undefined ? [...args, opts.limit, opts.offset ?? 0] : args
  return db.prepare(`${LIST_SELECT} ${where} ${LIST_ORDER} ${paging}`)
    .all(...queryArgs)
    .map(toVO)
}

export function count(opts = {}) {
  const { where, args } = buildWhere(opts)
  return db.prepare(`SELECT COUNT(*) AS c FROM food_places ${where}`).get(...args).c
}

// 地图用：只取有坐标的店，附带菜品（轻量，不解析图片/作者）
export function listWithCoords() {
  return db.prepare(`
    SELECT id, author_id, name, category, status, rating, location, longitude, latitude, dishes
    FROM food_places
    WHERE longitude IS NOT NULL AND latitude IS NOT NULL
    ORDER BY datetime(updated_at) ASC
  `).all().map((row) => ({ ...row, dishes: parseDishes(row.dishes) }))
}

// 时间线/分享用：去过与常去的店
export function listVisited() {
  return db.prepare(`
    SELECT * FROM food_places
    WHERE status IN ('visited', 'favorite')
    ORDER BY datetime(COALESCE(visited_at, created_at)) ASC
  `).all().map(toVO)
}

// 时间线专用：不解析图片与作者，避免每店一次文件查询
export function listVisitedLite() {
  return db.prepare(`
    SELECT id, name, category, status, rating, location, visited_at, created_at, dishes, note
    FROM food_places
    WHERE status IN ('visited', 'favorite')
    ORDER BY datetime(COALESCE(visited_at, created_at)) ASC
  `).all().map((row) => ({ ...row, dishes: parseDishes(row.dishes) }))
}

export function create({ authorId, data }) {
  const id = newId()
  db.prepare(`
    INSERT INTO food_places
      (id, author_id, name, category, status, rating, location, longitude, latitude,
       hours, phone, avg_price, note, dishes, photos, visited_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  `).run(
    id, authorId, data.name, data.category, data.status, data.rating, data.location,
    data.longitude, data.latitude, data.hours, data.phone, data.avgPrice, data.note,
    JSON.stringify(data.dishes), JSON.stringify(data.photos), data.visitedAt,
  )
  return findById(id)
}

export function update(id, fields) {
  const sets = []
  const args = []
  const push = (column, value) => { sets.push(`${column} = ?`); args.push(value) }
  if (fields.name !== undefined) push('name', fields.name)
  if (fields.category !== undefined) push('category', fields.category)
  if (fields.status !== undefined) push('status', fields.status)
  if (fields.rating !== undefined) push('rating', fields.rating)
  if (fields.location !== undefined) push('location', fields.location)
  if (fields.longitude !== undefined) push('longitude', fields.longitude)
  if (fields.latitude !== undefined) push('latitude', fields.latitude)
  if (fields.hours !== undefined) push('hours', fields.hours)
  if (fields.phone !== undefined) push('phone', fields.phone)
  if (fields.avgPrice !== undefined) push('avg_price', fields.avgPrice)
  if (fields.note !== undefined) push('note', fields.note)
  if (fields.dishes !== undefined) push('dishes', JSON.stringify(fields.dishes))
  if (fields.photos !== undefined) push('photos', JSON.stringify(fields.photos))
  if (fields.visitedAt !== undefined) push('visited_at', fields.visitedAt)
  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')")
  args.push(id)
  db.prepare(`UPDATE food_places SET ${sets.join(', ')} WHERE id = ?`).run(...args)
  return findById(id)
}

export function setStatus(id, status) {
  db.prepare(`
    UPDATE food_places
    SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `).run(status, id)
  return findById(id)
}

// 约会打卡联动：仅「想去」的店自动变「去过」并记录到访日期
export function markVisited(id, date) {
  db.prepare(`
    UPDATE food_places
    SET status = 'visited', visited_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ? AND status = 'want'
  `).run(date, id)
  return findById(id)
}

// 瞬间↔美食关联：删除店时清理关联行
export function removeMomentLinks(placeId) {
  db.prepare('DELETE FROM moment_places WHERE place_id = ?').run(placeId)
}

export function remove(id) {
  db.prepare('DELETE FROM food_places WHERE id = ?').run(id)
}
