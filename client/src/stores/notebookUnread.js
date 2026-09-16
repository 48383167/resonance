import { reactive } from 'vue'
import { getPendingRuleCount } from '../modules/rule/rule.api.js'

// 待我认同的规矩数：底部导航角标用
export const notebookUnread = reactive({ pendingRules: 0 })

export function setNotebookUnread(n) {
  notebookUnread.pendingRules = Math.max(0, Number(n) || 0)
}

export async function loadNotebookUnread() {
  try {
    setNotebookUnread((await getPendingRuleCount())?.count || 0)
  } catch { /* 角标加载失败不打扰用户 */ }
}

export function bumpNotebookUnread() {
  notebookUnread.pendingRules += 1
}

export function resetNotebookUnread() {
  setNotebookUnread(0)
}
