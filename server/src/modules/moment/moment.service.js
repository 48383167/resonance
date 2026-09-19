import { NotFoundError } from '../../common/errors/NotFoundError.js'
import { localDateStr } from '../../common/utils/date.js'
import * as coupleService from '../couple/couple.service.js'
import { emitMomentCreated, emitMomentUpdated, emitMomentDeleted } from '../../infrastructure/socket/moment.socket.js'
import { emitFoodUpdated } from '../../infrastructure/socket/food.socket.js'
import { softDeleteQuietly } from '../file/file.service.js'
import * as commentService from '../comment/comment.service.js'
import * as foodRepository from '../food/food.repository.js'
import * as momentRepository from './moment.repository.js'
import * as momentSchema from './moment.schema.js'

function coupleIdOf(userId) {
  return coupleService.getUserCouple(userId)?.pairCode || null
}

// 关联校验：只保留存在且属于本情侣空间的店（无效 id 静默忽略，不报错）
function accessiblePlaceIds(userId, placeIds) {
  if (!placeIds?.length) return []
  const couple = coupleService.getUserCouple(userId)
  const members = new Set(couple ? couple.members.map((m) => m.id) : [userId])
  return placeIds.filter((id) => {
    const place = foodRepository.findById(id)
    return Boolean(place && members.has(place.author_id))
  })
}

// 约会打卡联动：「想去」的店在关联瞬间后自动变「去过」，并广播给双方
function markPlacesVisited(userId, placeIds, momentDate, coupleId) {
  const visitDate = momentDate || localDateStr()
  for (const id of placeIds || []) {
    const place = foodRepository.findById(id)
    if (!place || place.status !== 'want') continue
    const updated = foodRepository.markVisited(id, visitDate)
    if (coupleId) emitFoodUpdated(coupleId, updated)
  }
}

export function list(query, userId) {
  return commentService.attachCounts('moment', momentRepository.list(query), userId)
}

export function listMap() {
  return momentRepository.listWithCoords()
}

export function getDetail(id) {
  const moment = momentRepository.findById(id)
  if (!moment) throw new NotFoundError('瞬间不存在')
  return moment
}

export function create(userId, raw) {
  const data = momentSchema.validateCreate(raw)
  const placeIds = accessiblePlaceIds(userId, data.placeIds)
  const moment = momentRepository.create({ userId, ...data, placeIds })
  const coupleId = coupleIdOf(userId)
  if (coupleId) {
    emitMomentCreated(coupleId, moment)
    markPlacesVisited(userId, placeIds, moment.moment_date, coupleId)
  }
  return moment
}

export function update(userId, id, raw) {
  const moment = momentRepository.findById(id)
  if (!moment) throw new NotFoundError('瞬间不存在')
  const data = momentSchema.validateCreate(raw)
  // 被替换掉的照片：级联软删除（墓碑）
  const nextIds = new Set((data.photos || []).filter(Boolean))
  for (const p of moment.photos || []) {
    if (p.id && !nextIds.has(p.id)) softDeleteQuietly(p.id, userId)
  }
  // placeIds 未提交时保持原关联；提交则全量替换并只对新关联的「想去」店做自动打卡
  const hasPlaceIds = Object.prototype.hasOwnProperty.call(raw || {}, 'placeIds')
  const placeIds = hasPlaceIds ? accessiblePlaceIds(userId, data.placeIds) : undefined
  const updated = momentRepository.update(id, { ...data, photos: data.photos || [], placeIds })
  const coupleId = coupleIdOf(userId)
  if (coupleId) {
    emitMomentUpdated(coupleId, updated)
    if (placeIds) {
      const before = new Set((moment.places || []).map((p) => p.id))
      markPlacesVisited(userId, placeIds.filter((pid) => !before.has(pid)), updated.moment_date, coupleId)
    }
  }
  return updated
}

export function updateShareVisibility(userId, id, raw) {
  const moment = momentRepository.findById(id)
  if (!moment) throw new NotFoundError('瞬间不存在')
  const showInShare = momentSchema.validateShowInShare(raw)
  const updated = momentRepository.updateShowInShare(id, showInShare)
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitMomentUpdated(coupleId, updated)
  return updated
}

export function remove(userId, id) {
  const moment = momentRepository.findById(id)
  if (!moment) throw new NotFoundError('瞬间不存在')
  for (const p of moment.photos || []) {
    if (p.id) softDeleteQuietly(p.id, userId)
  }
  momentRepository.remove(id)
  commentService.removeByTarget('moment', id)
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitMomentDeleted(coupleId, id)
  return null
}
