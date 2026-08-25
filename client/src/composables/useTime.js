import { computed } from 'vue'

export function timeAgo(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diff = now - date
  const min = 60 * 1000
  const hr = 60 * min
  const day = 24 * hr
  
  if (diff < 2 * min) return '刚刚'
  if (diff < hr) return Math.floor(diff / min) + ' 分钟前'
  
  const isToday = now.getDate() === date.getDate() && now.getMonth() === date.getMonth() && now.getFullYear() === date.getFullYear()
  if (isToday) return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = yesterday.getDate() === date.getDate() && yesterday.getMonth() === date.getMonth() && yesterday.getFullYear() === date.getFullYear()
  if (isYesterday) return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  
  if (now.getFullYear() === date.getFullYear()) {
    return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }) + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function useGreeting() {
  const hr = new Date().getHours()
  if (hr < 5) return '夜深了，注意休息'
  if (hr < 10) return '早安，新的一天'
  if (hr < 14) return '午安，吃过饭了吗'
  if (hr < 18) return '下午的时光很美'
  if (hr < 22) return '晚上好'
  return '夜深了，记录一下今天吧'
}
