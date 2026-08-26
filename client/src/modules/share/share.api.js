import { request } from '../../api/request.js'

export function getCurrentShare() { return request('GET', '/api/share/current') }
export function createShare(data) { return request('POST', '/api/share/create', data) }
export function disableShare() { return request('DELETE', '/api/share/current') }
