import { randomUUID } from 'node:crypto'
import { AppError } from '../../common/errors/AppError.js'
import { BadRequestError } from '../../common/errors/BadRequestError.js'

// 规矩条目：一条规矩由若干「条目」组成，但录入仍是一整段文本（习惯不变，一行一条）。
// items 存 JSON 数组 [{ id, text, state, agreedIds }]：
//   - state: active 生效 / archived 停用
//   - 认同按条目记录：agreedIds 含双方 id 时该条生效；文本被改动的那条重置为操作者
// content 是 active 条目的纯文本镜像，供置顶横幅、旧客户端与兜底展示使用。
// 未条目化的老数据读取时按行拆分，并继承整条 agreed_ids 的认同。
export const MAX_ITEMS = 50
export const MAX_ITEM_TEXT = 200
export const MAX_CONTENT = 2000
export const ITEM_STATES = ['active', 'archived']

// 行首列表标记：- • · * — / 1. 1、 1) / (1) （1） / ①~⑳
const LIST_MARKER = /^\s*(?:[-•·*—–]|\d+\s*[.、)）]|[（(]\s*\d+\s*[)）]|[①-⑳])\s*/

export function newItemId() {
  return `ri_${randomUUID().slice(0, 12)}`
}

// 宽容解析认同者数组：接受数组或 JSON 字符串，过滤非字符串
export function parseAgreedIds(raw) {
  let arr = raw
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw || '[]') } catch { return [] }
  }
  if (!Array.isArray(arr)) return []
  return arr.filter((id) => typeof id === 'string' && id)
}

// 整段文本 → 条目文本数组：按行拆、剥列表标记、trim、去空行
export function parseContentToTexts(content) {
  return String(content ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(LIST_MARKER, '').trim())
    .filter(Boolean)
}

// active 条目的纯文本镜像
export function itemsToContent(items) {
  return (items || [])
    .filter((it) => it.state !== 'archived')
    .map((it) => it.text)
    .join('\n')
}

// 文本集合指纹：判断条目文本是否实质变化（纯排序不算）
export function itemsTextKey(items) {
  return (items || []).map((it) => it.text).sort().join('\u0000')
}

// 宽容解析数据库 items 列；坏数据回退空数组
export function parseItems(raw) {
  try {
    const arr = JSON.parse(raw || '[]')
    if (!Array.isArray(arr)) return []
    return arr
      .filter((it) => it && typeof it.text === 'string' && it.text.trim())
      .map((it) => ({
        id: typeof it.id === 'string' && it.id ? it.id : newItemId(),
        text: it.text.trim(),
        state: it.state === 'archived' ? 'archived' : 'active',
        agreedIds: parseAgreedIds(it.agreedIds),
      }))
  } catch {
    return []
  }
}

// 数据库行 → 条目数组：
//   1) 已条目化：解析 items；个别条目缺 agreedIds 时继承整条 agreed_ids
//      （兼容首版条目化、认同还挂在整条上的旧数据）
//   2) 未条目化：按行拆分 content，并继承整条 agreed_ids 的认同
export function itemsFromRow(row) {
  const stored = parseItems(row?.items)
  if (stored.length) {
    const fallback = parseAgreedIds(row?.agreed_ids)
    if (!fallback.length) return stored
    return stored.map((it) => (it.agreedIds.length ? it : { ...it, agreedIds: [...fallback] }))
  }
  const legacyAgreedIds = parseAgreedIds(row?.agreed_ids)
  return parseContentToTexts(row?.content).map((text, i) => ({
    id: `ri_legacy_${i}`,
    text,
    state: 'active',
    agreedIds: [...legacyAgreedIds],
  }))
}

// 整条的认同者 = 所有 active 条目都认同的人（双方交集）
export function intersectAgreedIds(items) {
  const active = (items || []).filter((it) => it.state !== 'archived')
  if (!active.length) return []
  const sets = active.map((it) => new Set(it.agreedIds || []))
  return [...sets[0]].filter((id) => sets.every((s) => s.has(id)))
}

// 与已有条目合并（PUT 全量替换时用）：
//   - id 命中且文本未变 → 保留原认同（含停用/恢复、排序）
//   - 文本变化 / 新条目   → 认同重置为操作者
// 服务端不信任客户端传来的 agreedIds，一律以这里的结果为准。
export function mergeItems(existing, incoming, userId) {
  const byId = new Map((existing || []).map((it) => [it.id, it]))
  return (incoming || []).map((it) => {
    const prev = it.id ? byId.get(it.id) : null
    if (!prev) return { id: it.id || newItemId(), text: it.text, state: it.state, agreedIds: [userId] }
    const textChanged = prev.text !== it.text
    return {
      id: prev.id,
      text: it.text,
      state: it.state,
      agreedIds: textChanged ? [userId] : [...prev.agreedIds],
    }
  })
}

export function normalizeItemText(text) {
  if (typeof text !== 'string' || !text.trim()) throw new BadRequestError('条目内容不能为空')
  const t = text.trim()
  if (t.length > MAX_ITEM_TEXT) {
    throw new AppError(`单条最多 ${MAX_ITEM_TEXT} 字`, 400, 'RULE_ITEM_TEXT_TOO_LONG')
  }
  return t
}

export function normalizeItemState(state) {
  if (!ITEM_STATES.includes(state)) throw new AppError('条目状态不合法', 400, 'INVALID_RULE_ITEM_STATE')
  return state
}

function assertItemsLimit(items) {
  if (items.length > MAX_ITEMS) {
    throw new AppError(`一条规矩最多 ${MAX_ITEMS} 条`, 400, 'TOO_MANY_RULE_ITEMS')
  }
  if (itemsToContent(items).length > MAX_CONTENT) {
    throw new BadRequestError(`内容最多 ${MAX_CONTENT} 字`)
  }
}

// 校验并规整请求里的 items：保持顺序，空文本条目丢弃，缺 id 自动补，重复 id 重新生成。
// 注意：不接收客户端的 agreedIds，认同由 service 依据已有条目合并。
export function normalizeItems(raw) {
  if (!Array.isArray(raw)) throw new BadRequestError('条目格式不合法')
  const items = []
  const seen = new Set()
  for (const entry of raw) {
    const text = String(entry?.text ?? '').trim()
    if (!text) continue
    if (text.length > MAX_ITEM_TEXT) {
      throw new AppError(`单条最多 ${MAX_ITEM_TEXT} 字`, 400, 'RULE_ITEM_TEXT_TOO_LONG')
    }
    let id = typeof entry?.id === 'string' && entry.id ? entry.id : newItemId()
    if (seen.has(id)) id = newItemId()
    seen.add(id)
    items.push({ id, text, state: entry?.state === 'archived' ? 'archived' : 'active' })
  }
  assertItemsLimit(items)
  return items
}

// 整段文本 → 常规条目（新建或仅传 content 的旧契约走这里）
export function itemsFromContent(content) {
  const items = parseContentToTexts(content).map((text) => {
    if (text.length > MAX_ITEM_TEXT) {
      throw new AppError(`单条最多 ${MAX_ITEM_TEXT} 字`, 400, 'RULE_ITEM_TEXT_TOO_LONG')
    }
    return { id: newItemId(), text, state: 'active' }
  })
  assertItemsLimit(items)
  return items
}
