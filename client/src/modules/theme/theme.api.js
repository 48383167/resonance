import { request } from '../../api/request.js'

export function getTheme() { return request('GET', '/api/users/me/theme') }
export function updateTheme(data) { return request('PUT', '/api/users/me/theme', data) }
