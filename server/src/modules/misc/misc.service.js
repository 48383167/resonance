import * as statsRepository from '../stats/stats.repository.js'
import * as coupleRepository from '../couple/couple.repository.js'
import * as coupleService from '../couple/couple.service.js'
import * as authRepository from '../auth/auth.repository.js'
import * as anniversaryRepository from '../anniversary/anniversary.repository.js'
import * as careService from '../care/care.service.js'
import * as miscSchema from './misc.schema.js'
import { emitProfileUpdated } from '../../infrastructure/socket/profile.socket.js'

export function getDashboard(user) {
  const s = statsRepository.stats()
  const partner = user.pair_code ? authRepository.findPartnerOf(user.id, user.pair_code) : null
  const anniversaries = anniversaryRepository.list()
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = anniversaries
    .filter((a) => a.date >= today)
    .sort((x, y) => x.date.localeCompare(y.date))[0] || null
  return {
    me: user,
    partner,
    inviteCode: partner ? null : user.pair_code,
    firstMeetAt: coupleRepository.getFirstMeetAt(),
    daysTogether: coupleRepository.daysTogether(),
    stats: s,
    upcomingAnniversary: upcoming,
    careSummary: careService.dashboardSummary(user.id),
  }
}

export function getTreeState() {
  const s = statsRepository.stats()
  const total = s.moments + s.letters + s.entries + s.wishesDone + s.photos
  const stages = [
    { stage: 'seed', label: '种子', at: 0 },
    { stage: 'sprout', label: '嫩芽', at: 5 },
    { stage: 'sapling', label: '小树', at: 20 },
    { stage: 'blossom', label: '开花', at: 60 },
    { stage: 'lush', label: '繁茂', at: 150 },
  ]
  let current = stages[0]
  let next = stages[1]
  for (let i = 0; i < stages.length; i++) {
    if (total >= stages[i].at) {
      current = stages[i]
      next = stages[i + 1] || stages[i]
    }
  }
  const span = next.at - current.at
  const progress = span > 0 ? Math.min(1, (total - current.at) / span) : 1
  return { stage: current.stage, stageLabel: current.label, progress, total, nextAt: next.at, counts: s }
}

export function updateProfile(userId, raw) {
  const profile = miscSchema.validateProfile(raw)
  const me = authRepository.updateUser(userId, profile)

  // 情侣必为一男一女：一方填写性别后，对方自动同步为相反性别
  const couple = coupleService.getUserCouple(userId)
  if (couple?.partner && (profile.gender === 'male' || profile.gender === 'female')) {
    const opposite = profile.gender === 'male' ? 'female' : 'male'
    const partner = authRepository.updateUser(couple.partner.id, { gender: opposite })
    emitProfileUpdated(couple.pairCode, {
      actorId: userId,
      gender: me.gender,
      partnerId: partner.id,
      partnerGender: partner.gender,
    })
  }
  return me
}
