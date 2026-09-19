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
  return wishRepository.update(id, wishSchema.validateUpdate(raw))
}

// 快捷看板流转：todo -> doing -> done；可带 date 补记本次流转的真实日期（缺省今天）
export function setStatus(id, raw) {
  const wish = wishRepository.findById(id)
  if (!wish) throw new NotFoundError('心愿不存在')
  const { status, date } = wishSchema.validateStatus(raw)
  if (!date) return wishRepository.update(id, { status })
  const changes = { status }
  if (status === 'doing') changes.startedAt = date
  if (status === 'done') changes.completedAt = date
  return wishRepository.update(id, changes)
}

export function remove(id) {
  wishRepository.remove(id)
  return null
}
