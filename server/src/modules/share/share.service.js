import crypto from 'node:crypto'
import { NotFoundError } from '../../common/errors/NotFoundError.js'
import * as shareRepository from './share.repository.js'
import * as shareSchema from './share.schema.js'

// 数据库行（snake_case）→ API 响应（camelCase）
function presentShare(st) {
  return {
    token: st.token,
    shareUrl: `/share/${st.token}`,
    expiresAt: st.expires_at,
    viewCount: st.view_count,
    hasPassword: Boolean(st.password),
    includeMoments: Boolean(st.include_moments),
    includeEntries: Boolean(st.include_entries),
    includeAnniversaries: Boolean(st.include_anniversaries),
  }
}

export function createShare(raw = {}) {
  const flags = shareSchema.validateCreate(raw)
  const days = raw.expireDays != null ? Number(raw.expireDays) : 30
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const expiresAt = days <= 0 ? null : new Date(Date.now() + days * 86400000).toISOString()
  const st = shareRepository.create({
    token,
    password: raw.password || '',
    expiresAt,
    ...flags,
  })
  return presentShare(st)
}

export function getCurrent() {
  const st = shareRepository.getActive()
  if (!st) return null
  return presentShare(st)
}

export function updateCurrent(raw = {}) {
  const flags = shareSchema.validateUpdate(raw)
  const st = shareRepository.updateActive({
    includeMoments: flags.includeMoments ?? null,
    includeEntries: flags.includeEntries ?? null,
    includeAnniversaries: flags.includeAnniversaries ?? null,
  })
  if (!st) throw new NotFoundError('当前没有有效的分享链接')
  return presentShare(st)
}

export function disableShare() {
  shareRepository.disable()
  return null
}
