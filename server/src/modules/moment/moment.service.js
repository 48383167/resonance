import { NotFoundError } from '../../common/errors/NotFoundError.js'
import * as coupleService from '../couple/couple.service.js'
import { emitMomentCreated, emitMomentUpdated, emitMomentDeleted } from '../../infrastructure/socket/moment.socket.js'
import * as momentRepository from './moment.repository.js'
import * as momentSchema from './moment.schema.js'

function coupleIdOf(userId) {
  return coupleService.getUserCouple(userId)?.pairCode || null
}

export function list(query) {
  return momentRepository.list(query)
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
  const moment = momentRepository.create({ userId, ...data })
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitMomentCreated(coupleId, moment)
  return moment
}

export function update(userId, id, raw) {
  const moment = momentRepository.findById(id)
  if (!moment) throw new NotFoundError('瞬间不存在')
  const updated = momentRepository.update(id, raw)
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitMomentUpdated(coupleId, updated)
  return updated
}

export function remove(userId, id) {
  const moment = momentRepository.findById(id)
  if (!moment) throw new NotFoundError('瞬间不存在')
  momentRepository.remove(id)
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitMomentDeleted(coupleId, id)
  return null
}
