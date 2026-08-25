import { Router } from 'express'
import { auth } from '../middleware.js'

const router = Router()
router.use(auth)

// Jamendo 官方音乐 API（免费、正规授权、长期稳定）
// 优先读环境变量 JAMENDO_CLIENT_ID，否则用默认 key（个人只读 key，可到 devportal.jamendo.com 更换）
const CLIENT_ID = process.env.JAMENDO_CLIENT_ID || '70a1004b'

// 甜蜜曲风标签（已验证有效：romantic/acoustic/ballad，love 为无效标签）
const TAGS = ['romantic', 'acoustic', 'ballad']
const PER_TAG = 30
const CACHE_TTL = 60 * 60 * 1000 // 曲单缓存 1 小时

let cache = { at: 0, tracks: [] }

async function fetchTag(tag) {
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${CLIENT_ID}&format=json&limit=${PER_TAG}&tags=${tag}&audioformat=mp32`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Jamendo 返回 ${resp.status}`)
  const json = await resp.json()
  return json.results || []
}

router.get('/tracks', async (req, res) => {
  if (cache.tracks.length && Date.now() - cache.at < CACHE_TTL) {
    return res.json({ ok: true, data: cache.tracks })
  }
  try {
    // 合并多个甜蜜标签（Jamendo 的 tags 为 AND，需分别请求再合并去重）
    const all = []
    for (const tag of TAGS) {
      try {
        all.push(...(await fetchTag(tag)))
      } catch { /* 单个标签失败不影响整体 */ }
    }
    if (!all.length) return res.json({ ok: false, error: '获取音乐失败：曲库暂时不可用' })

    const seen = new Set()
    const tracks = all
      .filter((t) => !seen.has(t.id) && seen.add(t.id))
      .map((t) => ({
        id: String(t.id),
        name: t.name,
        artist: t.artist_name,
        audio: t.audio,
        image: t.image,
        duration: t.duration,
      }))

    // 随机打乱，保证每次播放不单调
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[tracks[i], tracks[j]] = [tracks[j], tracks[i]]
    }

    cache = { at: Date.now(), tracks }
    res.json({ ok: true, data: tracks })
  } catch (e) {
    res.json({ ok: false, error: `获取音乐失败：${e.message}` })
  }
})

export default router
