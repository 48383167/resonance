import * as diaryRepository from '../diary/diary.repository.js'
import * as momentRepository from '../moment/moment.repository.js'
import * as anniversaryRepository from '../anniversary/anniversary.repository.js'
import * as shareRepository from '../share/share.repository.js'
import * as statsRepository from '../stats/stats.repository.js'
import * as coupleRepository from '../couple/couple.repository.js'

export function getObservatory() {
  return { entries: diaryRepository.listPublic() }
}

// 分享链接：token 只读访问（可选密码、有效期、浏览计数）
export function getShare(token, password) {
  const st = shareRepository.findByToken(token)
  if (!st || st.status !== 1) return { status: 'not_found' }
  if (st.expires_at && new Date(st.expires_at) < new Date()) return { status: 'expired' }
  if (st.password && password !== st.password) return { status: 'need_password' }

  shareRepository.incrementViewCount(st.token)
  return {
    status: 'ok',
    data: {
      users: statsRepository.listUsers().map((u) => ({ nickname: u.nickname, avatarUrl: u.avatar_url })),
      daysTogether: coupleRepository.daysSincePaired(),
      stats: statsRepository.stats(),
      moments: momentRepository.list({}),
      entries: diaryRepository.listPublic(),
      anniversaries: anniversaryRepository.list(),
    },
  }
}
