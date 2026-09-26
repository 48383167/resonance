import { commentUnread } from '../stores/commentUnread'
import { contentUnread } from '../stores/contentUnread'
import { notebookUnread } from '../stores/notebookUnread'

// 未读角标的唯一汇总口径：底部导航、首页模块卡、更多面板都走这里，
// 避免同一个入口在三处算出三个数。
//
// 内容模块键 ↔ 导航项名（导航项名沿用 navigation.js / Home 模块卡的既有命名）
export const MODULE_BY_NAV = {
  'diary-list': 'entry',
  moments: 'moment',
  letters: 'letter',
  albums: 'album',
  wishes: 'wish',
  capsules: 'capsule',
  anniversaries: 'anniversary',
  foods: 'food',
}

// 导航项未读合计 = 内容未读 + 评论未读（小本本额外加「待我认同的规矩」）
export function navUnread(name) {
  const module = MODULE_BY_NAV[name]
  let total = module ? contentUnread[module] || 0 : 0
  if (name === 'diary-list') total += commentUnread.entry
  else if (name === 'moments') total += commentUnread.moment
  else if (name === 'foods') total += commentUnread.food
  else if (name === 'notebook') total += contentUnread.care + contentUnread.rule + notebookUnread.pendingRules
  // 日记日历与日记列表是同一批数据，共用一个未读数
  else if (name === 'diary') total += contentUnread.entry
  return total
}

// 角标文案：超过 99 收口，避免四位数撑破导航
export function badgeText(count) {
  return count > 99 ? '99+' : String(count)
}
