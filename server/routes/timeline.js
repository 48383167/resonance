import { Router } from 'express'
import { auth } from '../middleware.js'
import {
  listEntries, listMoments, listLetters, listWishes, listCapsules,
  listAnniversaries, listAlbums, getAlbumPhotos, pairStartedAt, localDateStr,
} from '../db.js'

const router = Router()
router.use(auth)

// 时光时间线：把两人的全部点滴（日记/瞬间/情书/心愿/胶囊/纪念日/照片）按时间合并
router.get('/', (req, res) => {
  const events = []

  for (const e of listEntries()) {
    events.push({
      kind: 'entry', ts: e.created_at, entryId: e.id,
      title: e.title || '无题日记', text: e.contents[0]?.content || '',
    })
  }

  for (const m of listMoments({})) {
    events.push({
      kind: 'moment', ts: m.moment_date ? `${m.moment_date}T12:00:00.000Z` : m.created_at,
      text: m.content, mood: m.mood, location: m.location,
      photos: m.photos || [], author: m.author?.nickname,
    })
  }

  for (const l of listLetters()) {
    events.push({
      kind: 'letter', ts: l.created_at, title: l.title || '无题情书', text: l.content,
      sender: l.sender?.nickname, isSecret: l.is_secret,
    })
  }

  for (const w of listWishes().filter((w) => w.status === 'done')) {
    events.push({
      kind: 'wish', ts: w.created_at, title: w.title, text: w.description,
      proposer: w.proposer?.nickname, category: w.category,
    })
  }

  const today = localDateStr()
  for (const c of listCapsules()) {
    const unlocked = c.unlock_date <= today
    events.push({
      kind: 'capsule', ts: c.created_at, title: c.title || '无题胶囊',
      text: unlocked ? c.content : '***内容尚未解锁***',
      unlocked, unlockDate: c.unlock_date, author: c.author?.nickname,
    })
  }

  for (const a of listAnniversaries()) {
    events.push({
      kind: 'anniversary', ts: `${a.date}T00:00:00.000Z`,
      title: a.title, text: a.description, anniversaryType: a.type,
    })
  }

  for (const album of listAlbums()) {
    for (const p of getAlbumPhotos(album.id)) {
      events.push({
        kind: 'photo', ts: p.created_at, url: p.url, text: p.caption || '',
        album: album.name,
      })
    }
  }

  events.sort((x, y) => (x.ts < y.ts ? 1 : -1))
  res.json({ ok: true, data: { events, pairStart: pairStartedAt() } })
})

export default router
