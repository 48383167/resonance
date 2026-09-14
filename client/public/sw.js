// 只缓存应用资源；离线时展示预缓存提示页，不保存带分享令牌的导航 URL。
const CACHE_PREFIX = 'resonance-shell-'
const CACHE = `${CACHE_PREFIX}v2`
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (/^\/(api|media|socket\.io)(\/|$)/.test(url.pathname)) return

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, event))
    return
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE)
      return await cache.match(OFFLINE_URL) || Response.error()
    }))
  }
})

async function cacheFirst(request, event) {
  const cache = await caches.open(CACHE).catch(() => null)
  const cached = await cache?.match(request).catch(() => null)
  if (cached) return cached
  const response = await fetch(request)
  // 旧 chunk 可能被 SPA 回退成 HTML；缓存失败也不能阻断在线资源加载。
  if (cache && response.ok && !response.headers.get('content-type')?.includes('text/html')) {
    event.waitUntil(cache.put(request, response.clone()).catch(() => {}))
  }
  return response
}
