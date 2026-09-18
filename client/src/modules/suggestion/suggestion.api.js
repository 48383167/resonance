import { request } from '../../api/request.js'

// AI 整理建议：结果按情侣空间共享；内容未变时服务端直接返回缓存
export function analyzeSuggestions(target) { return request('POST', '/api/suggestions/analyze', { target }) }
export function getLatestSuggestions(target) { return request('GET', `/api/suggestions/latest?target=${target}`) }
