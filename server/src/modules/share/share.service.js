import crypto from 'node:crypto'
import * as shareRepository from './share.repository.js'

export function createShare(raw = {}) {
  const days = raw.expireDays != null ? Number(raw.expireDays) : 30
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const expiresAt = days <= 0 ? null : new Date(Date.now() + days * 86400000).toISOString()
  shareRepository.create({ token, password: raw.password || '', expiresAt })
  return { token, shareUrl: `/share/${token}`, expiresAt }
}

export function getCurrent() {
  const st = shareRepository.getActive()
  if (!st) return null
  return {
    token: st.token,
    shareUrl: `/share/${st.token}`,
    expiresAt: st.expires_at,
    viewCount: st.view_count,
    hasPassword: Boolean(st.password),
  }
}

export function disableShare() {
  shareRepository.disable()
  return null
}
