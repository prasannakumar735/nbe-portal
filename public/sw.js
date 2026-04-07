/* eslint-disable no-restricted-globals */

const VERSION = 'v2'
const CACHE_NAME = `nbe-portal-${VERSION}`

const PRECACHE_URLS = [
  '/',
  '/maintenance',
  '/maintenance/new',
  '/maintenance/new?fresh=1',
  '/offline.html',
  '/Logo_black.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => (k.startsWith('nbe-portal-') && k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
      await self.clients.claim()
    })()
  )
})

function isNextStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/')
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

function isPublicAsset(url) {
  return /\.(png|jpg|jpeg|webp|gif|svg|ico)$/.test(url.pathname)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Only handle same-origin
  if (url.origin !== self.location.origin) return

  // Cache-first for Next static assets
  if (req.method === 'GET' && isNextStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(req)
        if (cached) return cached
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      })()
    )
    return
  }

  // Cache-first for same-origin public assets (logos/icons/images)
  if (req.method === 'GET' && isPublicAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(req)
        if (cached) return cached
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      })()
    )
    return
  }

  // Network-first for navigations; fallback to cached page/offline
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        try {
          const res = await fetch(req)
          if (res && res.ok) {
            cache.put(req, res.clone())
          }
          return res
        } catch {
          // Try full URL (including query) first, then try path-only.
          const cached = await cache.match(req) || await cache.match(url.pathname)
          if (cached) return cached
          const maintenance =
            (await cache.match('/maintenance/new')) ||
            (await cache.match('/maintenance/new?fresh=1'))
          if (maintenance) return maintenance
          return (await cache.match('/offline.html')) || new Response('Offline', { status: 503 })
        }
      })()
    )
    return
  }
})

