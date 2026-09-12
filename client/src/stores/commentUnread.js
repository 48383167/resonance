import { reactive } from 'vue'
import { getCommentUnread } from '../modules/comment/comment.api.js'

// 全局评论未读角标：底部导航 / 首页 / 列表页共享。
// 打开评论区后由 markRead 响应覆盖为服务端最新值；对方新评论由 socket 事件 +1。
export const commentUnread = reactive({ entry: 0, moment: 0, total: 0 })

export function applyCommentUnread(summary) {
  if (!summary) return
  commentUnread.entry = summary.entry || 0
  commentUnread.moment = summary.moment || 0
  commentUnread.total = summary.total ?? commentUnread.entry + commentUnread.moment
}

export async function loadCommentUnread() {
  try {
    applyCommentUnread(await getCommentUnread())
  } catch { /* 角标加载失败不打扰用户 */ }
}

export function bumpCommentUnread(targetType) {
  if (targetType !== 'entry' && targetType !== 'moment') return
  commentUnread[targetType] += 1
  commentUnread.total += 1
}

export function resetCommentUnread() {
  applyCommentUnread({ entry: 0, moment: 0, total: 0 })
}
