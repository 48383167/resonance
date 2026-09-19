import { AppError } from '../../common/errors/AppError.js'
import { parsePage } from '../../common/utils/paging.js'
import { transaction } from '../../config/database.js'
import { assertSamePair, getUserCouple } from '../couple/couple.service.js'
import { softDeleteQuietly } from '../file/file.service.js'
import * as momentRepository from '../moment/moment.repository.js'
import * as commentService from '../comment/comment.service.js'
import * as foodRepository from './food.repository.js'
import * as foodSchema from './food.schema.js'
import { emitFoodCreated, emitFoodUpdated, emitFoodDeleted } from '../../infrastructure/socket/food.socket.js'

// 美食探店：双人空间共享；读取永远限定在本情侣空间内（AGENTS.md 权限要求）

function memberIdsOf(userId) {
  const couple = getUserCouple(userId)
  return couple ? couple.members.map((m) => m.id) : [userId]
}

function broadcast(userId, fn) {
  const couple = getUserCouple(userId)
  if (couple) fn(couple.pairCode)
}

function findOrThrow(id) {
  const place = foodRepository.findById(id)
  if (!place) throw new AppError('这家店不存在', 404, 'FOOD_NOT_FOUND')
  return place
}

// 本人或同一情侣空间成员可访问（未配对时只有本人）
function assertAccessible(userId, authorId) {
  if (userId === authorId) return
  assertSamePair(userId, authorId)
}

export function list(query = {}, userId) {
  const { offset, limit, paginated } = parsePage(query)
  const opts = {
    status: query.status || undefined,
    category: query.category || undefined,
    keyword: (query.keyword || '').trim() || undefined,
    authorIds: memberIdsOf(userId),
  }
  if (!paginated) return commentService.attachCounts('food', foodRepository.list(opts), userId)
  const items = commentService.attachCounts('food', foodRepository.list({ ...opts, offset, limit }), userId)
  return { items, total: foodRepository.count(opts) }
}

export function getDetail(id, userId) {
  const place = findOrThrow(id)
  assertAccessible(userId, place.author_id)
  return place
}

// 店详情「去过的约会」：关联瞬间摘要（含照片与作者）
export function listMoments(id, userId) {
  const place = findOrThrow(id)
  assertAccessible(userId, place.author_id)
  return momentRepository.listByPlaceId(id)
}

// 地图：只返回本情侣空间、且有坐标的店
export function mapPoints(userId) {
  const members = new Set(memberIdsOf(userId))
  return foodRepository.listWithCoords().filter((place) => members.has(place.author_id))
}

export function create(userId, raw) {
  const place = foodRepository.create({ authorId: userId, data: foodSchema.validateCreate(raw) })
  broadcast(userId, (pairCode) => emitFoodCreated(pairCode, place))
  return place
}

export function update(id, userId, raw) {
  const existing = findOrThrow(id)
  assertAccessible(userId, existing.author_id)
  const fields = foodSchema.validateUpdate(raw, existing)
  // 图片被替换时回收旧文件（墓碑软删，不阻断主流程）
  if (fields.photos !== undefined) {
    const keep = new Set(fields.photos)
    for (const fileId of existing.photoIds) {
      if (!keep.has(fileId)) softDeleteQuietly(fileId, userId)
    }
  }
  const place = foodRepository.update(id, fields)
  broadcast(userId, (pairCode) => emitFoodUpdated(pairCode, place))
  return place
}

export function setStatus(id, userId, raw) {
  const existing = findOrThrow(id)
  assertAccessible(userId, existing.author_id)
  const { status } = foodSchema.validateStatus(raw)
  const place = foodRepository.setStatus(id, status)
  broadcast(userId, (pairCode) => emitFoodUpdated(pairCode, place))
  return place
}

export function remove(id, userId) {
  const existing = findOrThrow(id)
  assertAccessible(userId, existing.author_id)
  for (const fileId of existing.photoIds) softDeleteQuietly(fileId, userId)
  transaction(() => {
    foodRepository.removeMomentLinks(id)
    commentService.removeByTarget('food', id)
    foodRepository.remove(id)
  })
  broadcast(userId, (pairCode) => emitFoodDeleted(pairCode, { id }))
  return null
}
