import { reactive } from 'vue'
import { getContentUnreadSummary, markModuleRead } from '../modules/read/read.api.js'

// 全局内容未读：底部导航 / 首页模块卡 / 各列表页共享。
// 语义 = 「Ta 新增、我还没打开过该模块列表」的内容数（详情见 server/modules/read/read.registry.js）。
// 情书走逐封已读（is_read），其余模块走"打开列表即已读"的时间水位。
const EMPTY = {
  entry: 0,
  moment: 0,
  letter: 0,
  album: 0,
  wish: 0,
  capsule: 0,
  anniversary: 0,
  food: 0,
  care: 0,
  rule: 0,
  total: 0,
}

export const contentUnread = reactive({ ...EMPTY })

export function applyContentUnread(summary) {
  if (!summary) return
  for (const key of Object.keys(EMPTY)) {
    contentUnread[key] = Number(summary[key]) || 0
  }
}

export async function loadContentUnread() {
  try {
    applyContentUnread(await getContentUnreadSummary())
  } catch { /* 角标加载失败不打扰用户 */ }
}

export function resetContentUnread() {
  applyContentUnread(EMPTY)
}

// 打开列表即已读：服务端返回最新总览，直接覆盖本地角标
export async function markContentRead(module) {
  try {
    applyContentUnread(await markModuleRead(module))
  } catch { /* 标记失败不影响浏览，下次进入再标记 */ }
}
