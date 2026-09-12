import { request } from '../../api/request.js'

export function listComments(targetType, targetId) {
  const query = new URLSearchParams({ targetType, targetId })
  return request('GET', `/api/comments?${query}`)
}
export function createComment(data, idempotencyKey) {
  return request('POST', '/api/comments', data, false, { idempotencyKey })
}
export function removeComment(id) { return request('DELETE', `/api/comments/${id}`) }

export function markCommentsRead(data) { return request('POST', '/api/comments/read', data) }

export function getCommentUnread() { return request('GET', '/api/comments/unread') }
