import { request } from '../../api/request.js'

export function listDiary() { return request('GET', '/api/entries') }
export function calendarDiary(year, month) { return request('GET', `/api/entries/calendar?year=${year}&month=${month}`) }
export function getDiary(id) { return request('GET', `/api/entries/${id}`) }
export function createDiary(data) { return request('POST', '/api/entries/solo', data) }
export function updateDiary(id, data) { return request('PUT', `/api/entries/${id}`, data) }
export function setVisibility(id, isPublic) { return request('PATCH', `/api/entries/${id}/visibility`, { isPublic }) }
export function removeDiary(id) { return request('DELETE', `/api/entries/${id}`) }
