import { request } from '../../api/request.js'

export function getTimeline() { return request('GET', '/api/timeline') }
