import { request } from '../../api/request.js'

export function getConsent() { return request('GET', '/api/companion/consent') }
export function updateConsent(accepted) { return request('PUT', '/api/companion/consent', { accepted }) }
export function listConversations() { return request('GET', '/api/companion/conversations') }
export function createConversation(data, idempotencyKey) {
  return request('POST', '/api/companion/conversations', data, { idempotencyKey })
}
export function getConversation(id) { return request('GET', `/api/companion/conversations/${id}`) }
export function createMessage(id, data, idempotencyKey) {
  return request('POST', `/api/companion/conversations/${id}/messages`, data, { idempotencyKey })
}
export function removeConversation(id) { return request('DELETE', `/api/companion/conversations/${id}`) }
