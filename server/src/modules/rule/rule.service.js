import { AppError } from '../../common/errors/AppError.js'
import { BadRequestError } from '../../common/errors/BadRequestError.js'
import { transaction } from '../../config/database.js'
import { parsePage } from '../../common/utils/paging.js'
import { getUserCouple } from '../couple/couple.service.js'
import * as ruleRepository from './rule.repository.js'
import * as ruleSchema from './rule.schema.js'
import * as ruleItems from './rule.items.js'
import * as pinRepository from '../pin/pin.repository.js'
import {
  emitRuleCreated,
  emitRuleUpdated,
  emitRuleDeleted,
  emitRuleAgreed,
  emitRuleItemAdded,
  emitRuleItemAgreed,
} from '../../infrastructure/socket/rule.socket.js'

// 输出形态：
//   - 认同按条目返回（item.agreedIds / item.effective），整条 agreedIds = 所有 active 条目的交集
//   - effective = 有 active 条目且全部生效
//   - items 解析自 JSON（老数据按行推导并继承整条认同）
function serialize(rule) {
  if (!rule) return null
  const items = ruleItems.itemsFromRow(rule)
  const activeItems = items.filter((it) => it.state !== 'archived')
  const decorated = items.map((it) => ({ ...it, effective: it.agreedIds.length >= 2 }))
  const rest = { ...rule }
  delete rest.agreed_ids
  delete rest.items
  return {
    ...rest,
    agreedIds: ruleItems.intersectAgreedIds(items),
    items: decorated,
    itemStats: {
      total: items.length,
      active: activeItems.length,
      archived: items.length - activeItems.length,
      effective: activeItems.filter((it) => it.agreedIds.length >= 2).length,
    },
    effective: activeItems.length > 0 && activeItems.every((it) => it.agreedIds.length >= 2),
  }
}

function broadcast(couple, fn) {
  if (couple) fn(couple.pairCode)
}

function findExisting(id) {
  const existing = ruleRepository.findById(id)
  if (!existing) throw new AppError('规矩不存在', 404, 'RULE_NOT_FOUND')
  return existing
}

// 条目落库时的统一写入口：同步 content 镜像与整条 agreed_ids（交集），便于排序与旧契约
function itemChanges(items) {
  return {
    items,
    content: ruleItems.itemsToContent(items),
    agreedIds: ruleItems.intersectAgreedIds(items),
  }
}

// 列表：带 limit/offset 时返回 { items, total }（新分页契约）；否则保持旧数组形态
// pending=1 走服务端过滤（有待我认同的条目），保证翻页后筛选结果完整
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
  return serialize(findExisting(id))
}

export function create(userId, raw) {
  const couple = getUserCouple(userId)
  const data = ruleSchema.validateCreate(raw)
  const items = data.items.map((it) => ({ ...it, agreedIds: [userId] }))
  const rule = ruleRepository.create({
    authorId: userId,
    type: data.type,
    title: data.title,
    ...itemChanges(items),
    status: data.status,
  })
  const result = serialize(rule)
  broadcast(couple, (pairCode) => emitRuleCreated(pairCode, result))
  return result
}

export function update(id, userId, raw) {
  const couple = getUserCouple(userId)
  const existing = findExisting(id)
  const changes = ruleSchema.validateUpdate(raw)
  // 条目全量替换：文本未变的条目保留原认同，文本变化/新增的条目重置为操作者。
  // 标题/类型/状态变化不影响条目认同（认同对象是条目本身）。
  if (changes.items !== undefined) {
    changes.items = ruleItems.mergeItems(ruleItems.itemsFromRow(existing), changes.items, userId)
    changes.content = ruleItems.itemsToContent(changes.items)
    changes.agreedIds = ruleItems.intersectAgreedIds(changes.items)
  }
  const rule = ruleRepository.update(id, changes)
  const result = serialize(rule)
  broadcast(couple, (pairCode) => emitRuleUpdated(pairCode, result))
  return result
}

export function remove(id, userId) {
  const couple = getUserCouple(userId)
  findExisting(id)
  transaction(() => {
    ruleRepository.remove(id)
    pinRepository.removeByTarget('rule', id)
  })
  broadcast(couple, (pairCode) => emitRuleDeleted(pairCode, { id }))
  return null
}

// —— 整条认同：一键全部 ——
// 已全部认同 → 全部撤回；否则把未认同的 active 条目全部认同
export function toggleAgree(id, userId) {
  const couple = getUserCouple(userId)
  const existing = findExisting(id)
  const items = ruleItems.itemsFromRow(existing)
  const active = items.filter((it) => it.state !== 'archived')
  if (!active.length) throw new BadRequestError('这条规矩还没有条目')
  const withdraw = active.every((it) => it.agreedIds.includes(userId))
  const next = items.map((it) => {
    if (it.state === 'archived') return it
    const agreed = new Set(it.agreedIds)
    if (withdraw) agreed.delete(userId)
    else agreed.add(userId)
    return { ...it, agreedIds: [...agreed] }
  })
  const rule = ruleRepository.update(id, itemChanges(next))
  const result = serialize(rule)
  broadcast(couple, (pairCode) => {
    emitRuleUpdated(pairCode, result)
    emitRuleAgreed(pairCode, { rule: result, actorId: userId, action: withdraw ? 'withdraw_all' : 'agree_all' })
  })
  return result
}

// —— 单条认同：切换某条目的认同状态（停用条目不需要认同）——
export function toggleItemAgree(id, userId, itemId) {
  const couple = getUserCouple(userId)
  const { rule, item, agreed } = transaction(() => {
    const existing = findExisting(id)
    const items = ruleItems.itemsFromRow(existing)
    const idx = items.findIndex((it) => it.id === itemId)
    if (idx < 0) throw new AppError('条目不存在', 404, 'RULE_ITEM_NOT_FOUND')
    if (items[idx].state === 'archived') throw new BadRequestError('停用的条目无需认同')
    const agreedSet = new Set(items[idx].agreedIds)
    const wasAgreed = agreedSet.has(userId)
    if (wasAgreed) agreedSet.delete(userId)
    else agreedSet.add(userId)
    items[idx] = { ...items[idx], agreedIds: [...agreedSet] }
    const updated = ruleRepository.update(id, itemChanges(items))
    return { rule: updated, item: items[idx], agreed: !wasAgreed }
  })
  const result = serialize(rule)
  broadcast(couple, (pairCode) => {
    emitRuleUpdated(pairCode, result)
    if (agreed) emitRuleItemAgreed(pairCode, { rule: result, actorId: userId, item: { id: item.id, text: item.text } })
  })
  return result
}

// —— 条目级操作：追加 / 修改（含停用、恢复、清空即删除）/ 删除 ——
// 读改写包在同步事务里，避免两人同时操作互相覆盖。
// 文本变化（增、删、改字）把该条认同重置为操作者；仅停用/恢复不重置。

export function appendItem(id, userId, raw = {}) {
  const couple = getUserCouple(userId)
  const text = ruleItems.normalizeItemText(raw.text)
  const { rule, item } = transaction(() => {
    const existing = findExisting(id)
    const items = ruleItems.itemsFromRow(existing)
    if (items.length >= ruleItems.MAX_ITEMS) {
      throw new AppError(`一条规矩最多 ${ruleItems.MAX_ITEMS} 条`, 400, 'TOO_MANY_RULE_ITEMS')
    }
    const item = { id: ruleItems.newItemId(), text, state: 'active', agreedIds: [userId] }
    const next = [...items, item]
    const updated = ruleRepository.update(id, itemChanges(next))
    return { rule: updated, item }
  })
  const result = serialize(rule)
  broadcast(couple, (pairCode) => {
    emitRuleUpdated(pairCode, result)
    emitRuleItemAdded(pairCode, { rule: result, actorId: userId, item })
  })
  return result
}

export function patchItem(id, userId, itemId, raw = {}) {
  const couple = getUserCouple(userId)
  const rule = transaction(() => {
    const existing = findExisting(id)
    const items = ruleItems.itemsFromRow(existing)
    const idx = items.findIndex((it) => it.id === itemId)
    if (idx < 0) throw new AppError('条目不存在', 404, 'RULE_ITEM_NOT_FOUND')
    let removed = false
    if (raw.text !== undefined) {
      const text = String(raw.text ?? '').trim()
      if (!text) {
        items.splice(idx, 1)
        removed = true
      } else {
        const normalized = ruleItems.normalizeItemText(raw.text)
        if (normalized !== items[idx].text) {
          // 文本变化：仅该条认同重置为操作者，其他条目不受影响
          items[idx] = { ...items[idx], text: normalized, agreedIds: [userId] }
        }
      }
    }
    if (!removed && raw.state !== undefined) {
      // 停用/恢复不影响认同
      items[idx] = { ...items[idx], state: ruleItems.normalizeItemState(raw.state) }
    }
    return ruleRepository.update(id, itemChanges(items))
  })
  const result = serialize(rule)
  broadcast(couple, (pairCode) => emitRuleUpdated(pairCode, result))
  return result
}

export function removeItem(id, userId, itemId) {
  const couple = getUserCouple(userId)
  const rule = transaction(() => {
    const existing = findExisting(id)
    const items = ruleItems.itemsFromRow(existing)
    const idx = items.findIndex((it) => it.id === itemId)
    if (idx < 0) throw new AppError('条目不存在', 404, 'RULE_ITEM_NOT_FOUND')
    items.splice(idx, 1)
    return ruleRepository.update(id, itemChanges(items))
  })
  const result = serialize(rule)
  broadcast(couple, (pairCode) => emitRuleUpdated(pairCode, result))
  return result
}

export function pendingCount(userId) {
  return { count: ruleRepository.pendingCount(userId) }
}
