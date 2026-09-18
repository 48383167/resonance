import { request } from '../../api/request.js'

const query = (params = {}) => {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value) q.set(key, value) })
  return q.toString()
}
export function listCareItems(params) { const q = query(params); return request('GET', `/api/care/items${q ? `?${q}` : ''}`) }
export function getCareItem(id) { return request('GET', `/api/care/items/${id}`) }
export function createCareItem(data, key) { return request('POST', '/api/care/items', data, false, { idempotencyKey: key }) }
export function createCareItemsBatch(data, key) { return request('POST', '/api/care/items/batch', data, false, { idempotencyKey: key }) }
export function updateCareItem(id, data) { return request('PUT', `/api/care/items/${id}`, data) }
export function removeCareItem(id) { return request('DELETE', `/api/care/items/${id}`) }
export function getPeriodSummary() { return request('GET', '/api/care/period/summary') }
