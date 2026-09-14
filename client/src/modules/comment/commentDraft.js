// 评论草稿：按评论对象（targetType + targetId）缓存在 localStorage，发送成功后清除，超过 30 天自动清理
const PREFIX = 'resonance.comment.draft.'
const MAX_AGE = 30 * 24 * 60 * 60 * 1000

// 过期清理每次页面加载只执行一次，避免每次输入都全量扫描 localStorage
let pruned = false

function draftKey(targetType, targetId) {
  return `${PREFIX}${targetType}.${targetId}`
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

function parse(raw) {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value.content === 'string' ? value : null
  } catch {
    return null
  }
}

function pruneExpired() {
  if (pruned) return
  pruned = true
  const now = Date.now()
  for (const key of allKeys()) {
    const value = parse(localStorage.getItem(key))
    if (!value || now - (Number(value.at) || 0) > MAX_AGE) localStorage.removeItem(key)
  }
}

export function loadCommentDraft(targetType, targetId) {
  if (!targetType || !targetId) return null
  try {
    pruneExpired()
    const value = parse(localStorage.getItem(draftKey(targetType, targetId)))
    if (!value) return null
    return {
      content: value.content,
      parentId: typeof value.parentId === 'string' ? value.parentId : '',
      replyToUserId: typeof value.replyToUserId === 'string' ? value.replyToUserId : '',
    }
  } catch {
    return null
  }
}

export function saveCommentDraft(targetType, targetId, { content = '', parentId = '', replyToUserId = '' } = {}) {
  if (!targetType || !targetId) return
  if (!String(content).trim()) {
    clearCommentDraft(targetType, targetId)
    return
  }
  try {
    pruneExpired()
    localStorage.setItem(draftKey(targetType, targetId), JSON.stringify({
      content,
      parentId: parentId || null,
      replyToUserId: replyToUserId || null,
      at: Date.now(),
    }))
  } catch { /* 存储写入失败时草稿仅存在于当前组件内 */ }
}

export function clearCommentDraft(targetType, targetId) {
  try { localStorage.removeItem(draftKey(targetType, targetId)) } catch { /* 忽略 */ }
}

export function clearAllCommentDrafts() {
  try {
    for (const key of allKeys()) localStorage.removeItem(key)
  } catch { /* 忽略 */ }
}
