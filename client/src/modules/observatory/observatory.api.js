import { request } from '../../api/request.js'

export function getObservatory() { return request('GET', '/api/public/observatory') }
export function getPublicShare(token, password) {
  const q = password ? `?password=${encodeURIComponent(password)}` : ''
  return request('GET', `/api/public/share/${token}${q}`)
}
