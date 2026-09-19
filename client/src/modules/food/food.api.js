import { request } from '../../api/request.js'

const query = (params = {}) => {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value) q.set(key, value) })
  return q.toString()
}

export function listFoods(params) { const q = query(params); return request('GET', `/api/foods${q ? `?${q}` : ''}`) }
export function getFoodMap() { return request('GET', '/api/foods/map') }
export function getFood(id) { return request('GET', `/api/foods/${id}`) }
export function listFoodMoments(id) { return request('GET', `/api/foods/${id}/moments`) }
export function createFood(data, key) { return request('POST', '/api/foods', data, false, { idempotencyKey: key }) }
export function updateFood(id, data) { return request('PUT', `/api/foods/${id}`, data) }
export function setFoodStatus(id, status) { return request('PUT', `/api/foods/${id}/status`, { status }) }
export function removeFood(id) { return request('DELETE', `/api/foods/${id}`) }
