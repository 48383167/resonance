import { request } from '../../api/request.js'

export function listWishes() { return request('GET', '/api/wishes') }
export function getWish(id) { return request('GET', `/api/wishes/${id}`) }
export function createWish(data, idempotencyKey) { return request('POST', '/api/wishes', data, false, { idempotencyKey }) }
export function updateWish(id, data) { return request('PUT', `/api/wishes/${id}`, data) }
export function setWishStatus(id, status) { return request('PUT', `/api/wishes/${id}/status`, { status }) }
export function removeWish(id) { return request('DELETE', `/api/wishes/${id}`) }
