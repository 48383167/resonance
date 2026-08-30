import { request } from '../../api/request.js'

export function getCurrentShare() { return request('GET', '/api/share/current') }
export function createShare(data, idempotencyKey) { return request('POST', '/api/share/create', data, false, { idempotencyKey }) }
export function updateCurrentShare(data) { return request('PATCH', '/api/share/current', data) }
export function disableShare() { return request('DELETE', '/api/share/current') }
