import { request } from '../../api/request.js'

export function listMoments(params) { return request('GET', `/api/moments?${params}`) }
export function mapMoments() { return request('GET', '/api/moments/map') }
export function getMoment(id) { return request('GET', `/api/moments/${id}`) }
export function createMoment(data) { return request('POST', '/api/moments', data) }
export function updateMoment(id, data) { return request('PUT', `/api/moments/${id}`, data) }
export function removeMoment(id) { return request('DELETE', `/api/moments/${id}`) }
export function updateMomentShareVisibility(id, showInShare) {
  return request('PATCH', `/api/moments/${id}/share-visibility`, { showInShare })
}
