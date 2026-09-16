import { request } from '../../api/request.js'

export function getNavigation() { return request('GET', '/api/navigation') }
export function updateNavigation(items) { return request('PUT', '/api/navigation', { items }) }
