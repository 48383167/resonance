import { NotFoundError } from '../../common/errors/NotFoundError.js'
import { localDateStr } from '../../common/utils/date.js'
import * as capsuleRepository from './capsule.repository.js'
import * as capsuleSchema from './capsule.schema.js'

// 视图对象：未解锁时遮蔽内容（服务端保密，防止 API 直接偷看）
function toVO(c) {
  const todayStr = localDateStr()
  const unlocked = c.unlock_date <= todayStr
  const daysUntil = Math.ceil((new Date(c.unlock_date) - new Date(todayStr)) / 86400000)
  return {
    ...c,
    isUnlocked: unlocked ? 1 : 0,
    daysUntilUnlock: Math.max(0, daysUntil),
    content: unlocked ? c.content : '***内容尚未解锁***',
    photoUrl: unlocked ? c.photo_url : null,
    hasPhoto: Boolean(c.photo_url),
  }
}

export function list() {
  return capsuleRepository.list().map(toVO)
}

export function getDetail(id) {
  const capsule = capsuleRepository.findById(id)
  if (!capsule) throw new NotFoundError('胶囊不存在')
  return toVO(capsule)
}

export function create(userId, raw) {
  const data = capsuleSchema.validateCreate(raw)
  return toVO(capsuleRepository.create({ authorId: userId, ...data }))
}

export function remove(id) {
  capsuleRepository.remove(id)
  return null
}
