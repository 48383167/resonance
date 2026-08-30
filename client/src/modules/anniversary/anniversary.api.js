import { request } from '../../api/request.js'

export function listAnniversaries() { return request('GET', '/api/anniversaries') }
export function getAnniversary(id) { return request('GET', `/api/anniversaries/${id}`) }
export function createAnniversary(data, idempotencyKey) { return request('POST', '/api/anniversaries', data, false, { idempotencyKey }) }
export function updateAnniversary(id, data) { return request('PUT', `/api/anniversaries/${id}`, data) }
export function removeAnniversary(id) { return request('DELETE', `/api/anniversaries/${id}`) }
export function updateAnniversaryShareVisibility(id, showInShare) {
  return request('PATCH', `/api/anniversaries/${id}/share-visibility`, { showInShare })
}
