// 规矩条目解析：与服务端 rule.items.js 保持一致 —— 一行一条，自动剥离列表标记。
// 录入页用它做「粘贴一整段 → 实时预览几条」。
export const MAX_ITEMS = 50
export const MAX_ITEM_TEXT = 200
export const MAX_CONTENT = 2000

// 行首列表标记：- • · * — / 1. 1、 1) / (1) （1） / ①~⑳
const LIST_MARKER = /^\s*(?:[-•·*—–]|\d+\s*[.、)）]|[（(]\s*\d+\s*[)）]|[①-⑳])\s*/

// 单行 → 条目文本（去标记、trim）
export function parseItemText(line) {
  return String(line ?? '').replace(LIST_MARKER, '').trim()
}

// 整段文本 → 条目文本数组（去标记、trim、去空行）
export function parseContentToItems(content) {
  return String(content ?? '')
    .split(/\r?\n/)
    .map(parseItemText)
    .filter(Boolean)
}

// 按状态拆分已有条目
export function splitItemsByState(items) {
  const active = []
  const archived = []
  for (const item of items || []) {
    if (item.state === 'archived') archived.push(item)
    else active.push(item)
  }
  return { active, archived }
}

// 文本行与已有条目对齐：文本相同保留 id（和服务端比对，避免无谓重置认同），新行不带 id
export function alignItems(texts, existingActive) {
  const pool = [...(existingActive || [])]
  return texts.map((text) => {
    const idx = pool.findIndex((it) => it.text === text)
    if (idx >= 0) {
      const [hit] = pool.splice(idx, 1)
      return { id: hit.id, text, state: 'active' }
    }
    return { text, state: 'active' }
  })
}

// 文本集合指纹：纯排序不算变化（与服务端判「实质变化」一致）
export function itemsTextKey(items) {
  return (items || []).map((it) => it.text).sort().join('\u0000')
}
