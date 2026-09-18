import { request } from '../../api/request.js'
const query = (params = {}) => { const q = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v) }); return q.toString() }
export function listRules(params) { const q = query(params); return request('GET', `/api/rules${q ? `?${q}` : ''}`) }
export function getRule(id) { return request('GET', `/api/rules/${id}`) }
export function createRule(data, key) { return request('POST', '/api/rules', data, false, { idempotencyKey: key }) }
export function updateRule(id, data) { return request('PUT', `/api/rules/${id}`, data) }
export function removeRule(id) { return request('DELETE', `/api/rules/${id}`) }
export function agreeRule(id) { return request('PUT', `/api/rules/${id}/agree`) }
export function agreeRuleItem(id, itemId) { return request('PUT', `/api/rules/${id}/items/${itemId}/agree`) }
export function appendRuleItem(id, text) { return request('POST', `/api/rules/${id}/items`, { text }) }
export function patchRuleItem(id, itemId, data) { return request('PATCH', `/api/rules/${id}/items/${itemId}`, data) }
export function removeRuleItem(id, itemId) { return request('DELETE', `/api/rules/${id}/items/${itemId}`) }
export function getPendingRuleCount() { return request('GET', '/api/rules/pending/count') }
