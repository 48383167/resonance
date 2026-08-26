import { request } from '../../api/request.js'

export function listLetters() { return request('GET', '/api/letters') }
export function getLetter(id) { return request('GET', `/api/letters/${id}`) }
export function createLetter(data) { return request('POST', '/api/letters', data) }
export function updateLetter(id, data) { return request('PUT', `/api/letters/${id}`, data) }
export function removeLetter(id) { return request('DELETE', `/api/letters/${id}`) }
