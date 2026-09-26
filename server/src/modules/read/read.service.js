import { BadRequestError } from '../../common/errors/BadRequestError.js'
import { MODULE_KEYS, MODULES, isModuleKey } from './read.registry.js'
import * as readRepository from './read.repository.js'

// 内容未读：统一算「不是我自己新增、且我还没打开过列表」的内容。
// 判定与计数共用 registry 与同一份水位，保证"角标有数、列表也一定有点"。

function assertModule(module) {
  if (!isModuleKey(module)) throw new BadRequestError('未知的内容模块')
  return MODULES[module]
}

function isAfter(createdAt, since) {
  // 没有已读记录 = 从未打开过该模块列表，对方新增的内容全部视为未读（与评论未读同语义）
  return !since || String(createdAt || '') > since
}

// 全局未读总览：{ entry: 2, moment: 1, ..., total: 6 }
export function summary(userId) {
  const counts = {}
  let total = 0
  for (const key of MODULE_KEYS) {
    const value = readRepository.countUnread(key, userId)
    counts[key] = value
    total += value
  }
  return { ...counts, total }
}

// 打开列表即已读：把该模块的水位推到当前时间，返回最新总览
export function markRead(userId, module) {
  assertModule(module)
  readRepository.markRead(userId, module)
  return summary(userId)
}

// 列表标注：给每条数据挂 is_unread，供列表页画未读小圆点
export function attachUnread(module, userId, items) {
  const meta = MODULES[module]
  if (!meta || !items?.length) return items
  const since = readRepository.getLastReadAt(userId, module)
  for (const item of items) {
    item.is_unread = isUnreadOf(meta, item, userId, since)
  }
  return items
}

function isUnreadOf(meta, item, userId, since) {
  if (meta.filter && !meta.filter(item)) return false
  if (meta.perItemRead) return item.sender_id !== userId && item.is_read === 0
  if (meta.viaContents) {
    // 日记：正文里有我写的分片就算"我参与的"，不算未读
    const authorIds = (item.contents || []).map((c) => c.user_id)
    if (!authorIds.length || authorIds.includes(userId)) return false
    return isAfter(item[meta.timeColumn], since)
  }
  const authorId = item[meta.authorColumn] || null
  if (!authorId || authorId === userId) return false
  return isAfter(item[meta.timeColumn], since)
}
