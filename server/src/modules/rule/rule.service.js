import { AppError } from '../../common/errors/AppError.js'
import { transaction } from '../../config/database.js'
import { parsePage } from '../../common/utils/paging.js'
import { getUserCouple } from '../couple/couple.service.js'
import * as ruleRepository from './rule.repository.js'
import * as ruleSchema from './rule.schema.js'
import * as pinRepository from '../pin/pin.repository.js'
import { emitRuleCreated, emitRuleUpdated, emitRuleDeleted, emitRuleAgreed } from '../../infrastructure/socket/rule.socket.js'

function parseAgreedIds(raw) {
  try {
    const arr = JSON.parse(raw || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// 输出形态：agreed_ids 解析为 agreedIds 数组，effective = 两人都在
function serialize(rule) {
  if (!rule) return null
  const agreedIds = parseAgreedIds(rule.agreed_ids)
  const { agreed_ids, ...rest } = rule
  return { ...rest, agreedIds, effective: agreedIds.length >= 2 }
}

function broadcast(couple, fn) {
  if (couple) fn(couple.pairCode)
}

// 列表：带 limit/offset 时返回 { items, total }（新分页契约）；否则保持旧数组形态
// pending=1 走服务端过滤（待我认同），保证翻页后筛选结果完整
export function list(query = {}, userId) {
  const { offset, limit, paginated } = parsePage(query)
  const opts = {
    type: query.type || undefined,
    status: query.status || 'active',
    pending: query.pending === '1' || query.pending === 'true' || query.pending === true,
    userId,
  }
  if (!paginated) return ruleRepository.list(opts).map(serialize)
  const { items, total } = ruleRepository.listPage({ ...opts, offset, limit })
  return { items: items.map(serialize), total }
}

export function getDetail(id) {
  const rule = ruleRepository.findById(id)
  if (!rule) throw new AppError('规矩不存在', 404, 'RULE_NOT_FOUND')
  return serialize(rule)
}

export function create(userId, raw) {
  const couple = getUserCouple(userId)
  const data = ruleSchema.validateCreate(raw)
  const rule = ruleRepository.create({ authorId: userId, ...data, agreedIds: [userId] })
  const result = serialize(rule)
  broadcast(couple, (pairCode) => emitRuleCreated(pairCode, result))
  return result
}

export function update(id, userId, raw) {
  const couple = getUserCouple(userId)
  const existing = ruleRepository.findById(id)
  if (!existing) throw new AppError('规矩不存在', 404, 'RULE_NOT_FOUND')
  const changes = ruleSchema.validateUpdate(raw)
  // 仅 type/title/content 实际变化才重置认同；仅 status 变化不重置
  const substantive = ['type', 'title', 'content'].some(
    (k) => changes[k] !== undefined && String(changes[k]) !== String(existing[k] ?? '')
  )
  if (substantive) changes.agreedIds = [userId]
  const rule = ruleRepository.update(id, changes)
  const result = serialize(rule)
  broadcast(couple, (pairCode) => emitRuleUpdated(pairCode, result))
  return result
}

export function remove(id, userId) {
  const couple = getUserCouple(userId)
  const existing = ruleRepository.findById(id)
  if (!existing) throw new AppError('规矩不存在', 404, 'RULE_NOT_FOUND')
  transaction(() => {
    ruleRepository.remove(id)
    pinRepository.removeByTarget('rule', id)
  })
  broadcast(couple, (pairCode) => emitRuleDeleted(pairCode, { id }))
  return null
}

export function toggleAgree(id, userId) {
  const couple = getUserCouple(userId)
  const existing = ruleRepository.findById(id)
  if (!existing) throw new AppError('规矩不存在', 404, 'RULE_NOT_FOUND')
  const agreedIds = parseAgreedIds(existing.agreed_ids)
  const idx = agreedIds.indexOf(userId)
  if (idx >= 0) agreedIds.splice(idx, 1)
  else agreedIds.push(userId)
  const rule = ruleRepository.update(id, { agreedIds })
  const result = serialize(rule)
  broadcast(couple, (pairCode) => {
    emitRuleUpdated(pairCode, result)
    emitRuleAgreed(pairCode, { rule: result, actorId: userId })
  })
  return result
}

export function pendingCount(userId) {
  return { count: ruleRepository.pendingCount(userId) }
}
