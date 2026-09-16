import { request } from '../../api/request.js'
export function setPin({ targetType, targetId, scope }) { return request('PUT', '/api/pins', { targetType, targetId, scope }) }
export function getGlobalPins() { return request('GET', '/api/pins/global') }
