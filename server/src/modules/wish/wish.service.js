import { NotFoundError } from '../../common/errors/NotFoundError.js'
import * as wishRepository from './wish.repository.js'
import * as wishSchema from './wish.schema.js'

export function list() {
  return wishRepository.list()
}

export function getDetail(id) {
  const wish = wishRepository.findById(id)
  if (!wish) throw new NotFoundError('心愿不存在')
  return wish
}

export function create(userId, raw) {
  const data = wishSchema.validateCreate(raw)
  return wishRepository.create({ proposerId: userId, ...data })
}

export function update(id, raw) {
  const wish = wishRepository.findById(id)
  if (!wish) throw new NotFoundError('心愿不存在')
  return wishRepository.update(id, raw)
}

// 快捷看板流转：todo -> doing -> done
export function setStatus(id, raw) {
  const wish = wishRepository.findById(id)
  if (!wish) throw new NotFoundError('心愿不存在')
  const { status } = wishSchema.validateStatus(raw)
  return wishRepository.update(id, { status })
}

export function remove(id) {
  wishRepository.remove(id)
  return null
}
