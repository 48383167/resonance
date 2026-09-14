import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const code = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')

function worker() {
  const handlers = {}
  const stores = new Map()
  let offline = false
  let failWrite = false
  let response = new Response('asset', { headers: { 'content-type': 'text/javascript' } })
  const keyOf = (request) => typeof request === 'string' ? request : request.url
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (key) => stores.delete(key),
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)
      return {
        add: async (url) => store.set(url, new Response('offline shell')),
        match: async (request) => store.get(keyOf(request))?.clone(),
        put: async (request, value) => {
          if (failWrite) throw new Error('quota exceeded')
          store.set(keyOf(request), value)
        },
      }
    },
  }
  vm.runInNewContext(code, {
    self: { addEventListener: (name, callback) => { handlers[name] = callback }, location: { origin: 'https://example.test' }, clients: { claim: async () => {} } },
    caches, URL, Response,
    fetch: async () => { if (offline) throw new Error('offline'); return response.clone() },
  })
  return {
    stores, caches,
    setOffline: () => { offline = true },
    failWrites: () => { failWrite = true },
    setResponse: (value) => { response = value },
    async dispatch(name, path = '/', mode = 'cors') {
      const pending = []
      let result
      handlers[name]({ request: { url: `https://example.test${path}`, method: 'GET', mode }, waitUntil: (promise) => pending.push(promise), respondWith: (promise) => { result = promise } })
      const value = await result
      await Promise.all(pending)
      return value
    },
  }
}

test('offline navigation works immediately after install, including unvisited URLs', async () => {
  const sw = worker()
  await sw.dispatch('install')
  sw.setOffline()
  const response = await sw.dispatch('fetch', '/share/private-token', 'navigate')
  assert.equal(await response.text(), 'offline shell')
  assert.deepEqual([...sw.stores.values()].flatMap((store) => [...store.keys()]), ['/offline.html'])
})

test('activation removes only Resonance caches', async () => {
  const sw = worker()
  await sw.caches.open('resonance-shell-v1')
  await sw.caches.open('another-app-cache')
  await sw.dispatch('install')
  await sw.dispatch('activate')
  assert.deepEqual(await sw.caches.keys(), ['another-app-cache', 'resonance-shell-v2'])
})

test('media, API and socket requests bypass the service worker', async () => {
  const sw = worker()
  for (const path of ['/api', '/api/me', '/media/private.jpg', '/socket.io/']) {
    assert.equal(await sw.dispatch('fetch', path, 'navigate'), undefined)
  }
})

test('quota errors do not break online assets and HTML fallbacks are not cached as chunks', async () => {
  const sw = worker()
  sw.failWrites()
  assert.equal(await (await sw.dispatch('fetch', '/assets/main.js')).text(), 'asset')
  sw.setResponse(new Response('<html></html>', { headers: { 'content-type': 'text/html' } }))
  await sw.dispatch('fetch', '/assets/old-chunk.js')
  assert.equal([...sw.stores.values()].some((store) => store.has('https://example.test/assets/old-chunk.js')), false)
})
