import { request } from '../../api/request.js'

export function listTracks() { return request('GET', '/api/music/tracks') }
