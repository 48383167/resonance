import * as coupleRepository from './couple.repository.js'
import { ForbiddenError } from '../../common/errors/ForbiddenError.js'

// 情侣空间核心：提供数据隔离原语，供各业务模块（diary/moment/...）统一复用。
// 当前为严格双人配对，couple 标识即 pair_code。

// 获取某用户所属的情侣空间（含成员与伴侣）；未配对返回 null
export function getUserCouple(userId) {
  const me = coupleRepository.findById(userId)
  if (!me || !me.pair_code) return null
  const members = coupleRepository.findMembersByPairCode(me.pair_code)
  const partner = members.find((m) => m.id !== userId) || null
  return { pairCode: me.pair_code, me, partner, members }
}

// 校验 userId 属于指定情侣空间（coupleId 即 pair_code）；通过返回该用户，否则抛 403
export function assertUserInCouple(userId, coupleId) {
  const user = coupleRepository.findById(userId)
  if (!user || !user.pair_code || user.pair_code !== coupleId) {
    throw new ForbiddenError('无权访问该情侣空间的数据')
  }
  return user
}

// 校验两个用户是否同属一个情侣空间（用于按 user_id 归属的资源隔离）
export function assertSamePair(userId, targetUserId) {
  const a = coupleRepository.findById(userId)
  const b = coupleRepository.findById(targetUserId)
  if (!a || !b || !a.pair_code || a.pair_code !== b.pair_code) {
    throw new ForbiddenError('无权访问该情侣空间的数据')
  }
}
