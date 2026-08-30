import * as diaryRepository from '../diary/diary.repository.js'
import * as momentRepository from '../moment/moment.repository.js'
import * as anniversaryRepository from '../anniversary/anniversary.repository.js'
import * as shareRepository from '../share/share.repository.js'
import * as statsRepository from '../stats/stats.repository.js'
import * as coupleRepository from '../couple/couple.repository.js'
import * as albumRepository from '../album/album.repository.js'
import * as observatoryRepository from './observatory.repository.js'
import * as observatorySchema from './observatory.schema.js'

// 观测台总展示是否开启（默认开启，缺省 enabled=1 已在 database.js 初始化）
function isEnabled() {
  return observatoryRepository.getSettings().enabled !== 0
}

// 公开观测台：enabled=false 时不下发照片，避免泄露
export function getObservatory() {
  const enabled = isEnabled()
  return {
    enabled,
    photos: enabled ? albumRepository.listObservatoryPhotos() : [],
  }
}

// 内部观测台（登录用户）：无论开关状态，均可看到已勾选照片（供预览/管理）
export function getInternalObservatory() {
  return {
    enabled: isEnabled(),
    photos: albumRepository.listObservatoryPhotos(),
  }
}

// 更新观测台总展示开关，返回最新状态与内部照片
export function setVisibility(raw) {
  const { enabled } = observatorySchema.validateVisibility(raw)
  observatoryRepository.setEnabled(enabled)
  return {
    enabled,
    photos: albumRepository.listObservatoryPhotos(),
  }
}

// 分享链接：token 只读访问（可选密码、有效期、浏览计数）
export function getShare(token, password) {
  const st = shareRepository.findByToken(token)
  if (!st || st.status !== 1) return { status: 'not_found' }
  if (st.expires_at && new Date(st.expires_at) < new Date()) return { status: 'expired' }
  if (st.password && password !== st.password) return { status: 'need_password' }

  shareRepository.incrementViewCount(st.token)

  // 内容范围开关：关闭的类别不查询、不下发对应内容
  const includeMoments = st.include_moments !== 0
  const includeEntries = st.include_entries !== 0
  const includeAnniversaries = st.include_anniversaries !== 0

  const moments = includeMoments ? momentRepository.listPublic() : []
  const entries = includeEntries ? diaryRepository.listPublic() : []
  const anniversaries = includeAnniversaries ? anniversaryRepository.listPublic() : []

  const stats = statsRepository.stats({ includeMoments, includeEntries, includeAnniversaries })
  // 三类计数与实际下发数组长度保持一致；其余统计字段保留
  stats.moments = moments.length
  stats.entries = entries.length
  stats.anniversaries = anniversaries.length

  return {
    status: 'ok',
    data: {
      users: statsRepository.listUsers().map((u) => ({ nickname: u.nickname, avatarUrl: u.avatar_url })),
      daysTogether: coupleRepository.daysTogether(),
      stats,
      moments,
      entries,
      anniversaries,
    },
  }
}
