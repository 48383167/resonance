import { NotFoundError } from '../../common/errors/NotFoundError.js'
import { ForbiddenError } from '../../common/errors/ForbiddenError.js'
import * as coupleService from '../couple/couple.service.js'
import { emitLetterReceived } from '../../infrastructure/socket/letter.socket.js'
import * as letterRepository from './letter.repository.js'
import * as letterSchema from './letter.schema.js'

function coupleIdOf(userId) {
  return coupleService.getUserCouple(userId)?.pairCode || null
}

export function list() {
  return letterRepository.list()
}

// 查看即标记已读（除写信人自己外）
export function getDetail(userId, id) {
  const letter = letterRepository.findById(id)
  if (!letter) throw new NotFoundError('信件不存在')
  if (letter.sender_id !== userId) letterRepository.markRead(id)
  return letterRepository.findById(id)
}

export function create(userId, raw) {
  const data = letterSchema.validateCreate(raw)
  const letter = letterRepository.create({ senderId: userId, ...data })
  const coupleId = coupleIdOf(userId)
  if (coupleId) emitLetterReceived(coupleId, letter)
  return letter
}

// 仅写信人本人可编辑
export function update(userId, id, raw) {
  const letter = letterRepository.findById(id)
  if (!letter) throw new NotFoundError('信件不存在')
  if (letter.sender_id !== userId) throw new ForbiddenError('只能编辑自己写的情书')
  return letterRepository.update(id, letterSchema.validateUpdate(raw))
}

export function remove(id) {
  letterRepository.remove(id)
  return null
}
