import { AppError } from '../../common/errors/AppError.js'
import { assertSamePair, getUserCouple } from '../couple/couple.service.js'
import * as careRepository from '../care/care.repository.js'
import * as ruleRepository from '../rule/rule.repository.js'
import * as foodRepository from '../food/food.repository.js'
import * as pinRepository from './pin.repository.js'
import * as pinSchema from './pin.schema.js'
import { emitPinUpdated } from '../../infrastructure/socket/pin.socket.js'

// 目标存在性校验注册表：care / rule / food 三类资源
const resolvers = {
  care: careRepository.findById,
  rule: ruleRepository.findById,
  food: foodRepository.findById,
}

// 置顶是情侣空间内的私有操作：目标必须属于本人或同一空间的伴侣
function assertTargetAccessible(userId, target) {
  const authorId = target.author_id
  if (!authorId || userId === authorId) return
  assertSamePair(userId, authorId)
}

export function setPin(userId, raw) {
  const { targetType, targetId, scope } = pinSchema.validateSetPin(raw)
  const resolver = resolvers[targetType]
  const target = resolver ? resolver(targetId) : null
  if (!target) throw new AppError('置顶目标不存在', 404, 'PIN_TARGET_NOT_FOUND')
  assertTargetAccessible(userId, target)

  const couple = getUserCouple(userId)
  if (scope === 'none') {
    pinRepository.removeByTarget(targetType, targetId)
  } else {
    pinRepository.upsert({ targetType, targetId, scope, pinnedBy: userId })
  }
  if (couple) emitPinUpdated(couple.pairCode, { targetType, targetId, scope })
  return { targetType, targetId, scope }
}

function toItem(pin, target) {
  const base = {
    targetType: pin.target_type,
    targetId: pin.target_id,
    title: target.title,
    content: target.content ?? '',
    type: null,
    category: null,
    severity: null,
    subject_id: null,
    status: null,
    rating: null,
    pin_scope: pin.pin_scope,
    pinnedAt: pin.created_at,
    updatedAt: pin.updated_at,
  }
  if (pin.target_type === 'rule') {
    base.type = target.type
  } else if (pin.target_type === 'food') {
    base.title = target.name
    base.content = target.note ?? ''
    base.category = target.category
    base.status = target.status
    base.rating = target.rating ?? null
  } else {
    base.category = target.category
    base.severity = target.severity ?? null
    base.subject_id = target.subject_id
  }
  return base
}

// 只返回当前用户所属情侣空间的置顶（未登录/无空间时不返回任何内容）
export function listGlobal(userId) {
  const couple = userId ? getUserCouple(userId) : null
  const members = new Set(couple ? couple.members.map((member) => member.id) : userId ? [userId] : [])

  const items = []
  for (const pin of pinRepository.listGlobal()) {
    const resolver = resolvers[pin.target_type]
    const target = resolver ? resolver(pin.target_id) : null
    if (!target) continue // 目标已删除的孤儿置顶行跳过
    if (!members.has(target.author_id)) continue // 跨空间置顶不下发
    items.push(toItem(pin, target))
  }
  return { items }
}
