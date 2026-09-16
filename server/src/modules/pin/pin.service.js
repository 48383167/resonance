import { AppError } from '../../common/errors/AppError.js'
import { getUserCouple } from '../couple/couple.service.js'
import * as careRepository from '../care/care.repository.js'
import * as ruleRepository from '../rule/rule.repository.js'
import * as pinRepository from './pin.repository.js'
import * as pinSchema from './pin.schema.js'
import { emitPinUpdated } from '../../infrastructure/socket/pin.socket.js'

// 目标存在性校验注册表：v1 仅支持 care / rule
const resolvers = {
  care: careRepository.findById,
  rule: ruleRepository.findById,
}

export function setPin(userId, raw) {
  const { targetType, targetId, scope } = pinSchema.validateSetPin(raw)
  const resolver = resolvers[targetType]
  const target = resolver ? resolver(targetId) : null
  if (!target) throw new AppError('置顶目标不存在', 404, 'PIN_TARGET_NOT_FOUND')

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
    pin_scope: pin.pin_scope,
    pinnedAt: pin.created_at,
    updatedAt: pin.updated_at,
  }
  if (pin.target_type === 'rule') {
    base.type = target.type
  } else {
    base.category = target.category
    base.severity = target.severity ?? null
    base.subject_id = target.subject_id
  }
  return base
}

export function listGlobal() {
  const items = []
  for (const pin of pinRepository.listGlobal()) {
    const resolver = resolvers[pin.target_type]
    const target = resolver ? resolver(pin.target_id) : null
    if (!target) continue // 目标已删除的孤儿置顶行跳过
    items.push(toItem(pin, target))
  }
  return { items }
}
