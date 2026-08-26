import { request } from '../../api/request.js'

export function getDashboard() { return request('GET', '/api/dashboard') }
export function getTreeState() { return request('GET', '/api/tree/state') }
export function updateProfile(data) { return request('PUT', '/api/users/me', data) }
