import { request } from '../../api/request.js'

export function listCapsules() { return request('GET', '/api/capsules') }
export function getCapsule(id) { return request('GET', `/api/capsules/${id}`) }
export function createCapsule(data) { return request('POST', '/api/capsules', data) }
export function removeCapsule(id) { return request('DELETE', `/api/capsules/${id}`) }
