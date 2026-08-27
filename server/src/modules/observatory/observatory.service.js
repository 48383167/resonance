import * as diaryRepository from '../diary/diary.repository.js'
import * as momentRepository from '../moment/moment.repository.js'
import * as anniversaryRepository from '../anniversary/anniversary.repository.js'
import * as shareRepository from '../share/share.repository.js'
import * as statsRepository from '../stats/stats.repository.js'
import * as coupleRepository from '../couple/couple.repository.js'
import * as albumRepository from '../album/album.repository.js'

export function getObservatory() {
  return { photos: albumRepository.listObservatoryPhotos() }
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

  const moments = includeMoments ? momentRepository.list({}) : []
  const entries = includeEntries ? diaryRepository.listPublic() : []
  const anniversaries = includeAnniversaries ? anniversaryRepository.list() : []

  const stats = statsRepository.stats({ includeMoments, includeEntries, includeAnniversaries })
  // 三类计数与实际下发数组长度保持一致；其余统计字段保留
  stats.moments = moments.length
  stats.entries = entries.length
  stats.anniversaries = anniversaries.length

  return {
    status: 'ok',
    data: {
      users: statsRepository.listUsers().map((u) => ({ nickname: u.nickname, avatarUrl: u.avatar_url })),
      daysTogether: coupleRepository.daysSincePaired(),
      stats,
      moments,
      entries,
      anniversaries,
    },
  }
}
