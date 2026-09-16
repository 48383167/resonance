// 表单草稿：按业务 key 缓存在 localStorage，保存成功后清除，超过 30 天自动清理
// 供小本本等「新建」表单复用（与日记/评论草稿同思路）
const PREFIX = 'resonance.draft.form.'
const MAX_AGE = 30 * 24 * 60 * 60 * 1000

// 过期清理每次页面加载只执行一次，避免每次输入都全量扫描 localStorage
let pruned = false

function keyOf(key) {
  return `${PREFIX}${key}`
}

function allKeys() {
  const keys = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
  } catch { /* 隐私模式下存储不可用 */ }
  return keys
}

function pruneExpired() {
  if (pruned) return
  pruned = true
  const now = Date.now()
  for (const key of allKeys()) {
    try {
      const value = JSON.parse(localStorage.getItem(key))
      if (!value || now - (Number(value.at) || 0) > MAX_AGE) localStorage.removeItem(key)
    } catch {
      localStorage.removeItem(key)
    }
  }
}

export function loadFormDraft(key) {
  try {
    pruneExpired()
    const raw = localStorage.getItem(keyOf(key))
    if (!raw) return null
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || !value.data || typeof value.data !== 'object') return null
    return value.data
  } catch {
    return null
  }
}

export function saveFormDraft(key, data) {
  try {
    localStorage.setItem(keyOf(key), JSON.stringify({ data, at: Date.now() }))
  } catch { /* 写入失败时草稿仅存在于当前页面内 */ }
}

export function clearFormDraft(key) {
  try { localStorage.removeItem(keyOf(key)) } catch { /* 忽略 */ }
}

export function clearAllFormDrafts() {
  try {
    for (const key of allKeys()) localStorage.removeItem(key)
  } catch { /* 忽略 */ }
}
