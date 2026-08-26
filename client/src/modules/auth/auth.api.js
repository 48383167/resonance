import { request } from '../../api/request.js'

export function getState() { return request('GET', '/api/auth/state') }
export function register(data) { return request('POST', '/api/auth/register', data) }
export function login(data) { return request('POST', '/api/auth/login', data) }
export function getMe() { return request('GET', '/api/auth/me') }
export function changePassword(data) { return request('POST', '/api/auth/change-password', data) }
