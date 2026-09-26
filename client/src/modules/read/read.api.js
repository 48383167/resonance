import { request } from '../../api/request.js'

// 读取内容未读 API：汇总 + 打开列表即已读
export function getContentUnreadSummary() {
  return request('GET', '/api/reads/summary')
}

export function markModuleRead(module) {
  return request('POST', `/api/reads/${module}`)
}
