import { request } from '../../api/request.js'

export function getMailSettings() { return request('GET', '/api/notifications/mail') }
export function updateMailSettings(data) { return request('PUT', '/api/notifications/mail', data) }
export function sendTestMail(idempotencyKey) { return request('POST', '/api/notifications/mail/test', null, false, { idempotencyKey }) }
export function previewNotifications(type) { return request('GET', `/api/notifications/preview?type=${type}`) }
