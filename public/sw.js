// ============================================
// Service Worker for Moonwave Memo PWA
// ============================================

const CACHE_VERSION = '__SW_VERSION__'
const CACHE_NAME = `memo-v${CACHE_VERSION}`
const MAX_CACHE_ITEMS = 100
const FETCH_TIMEOUT = 5000

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon-180.png',
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css',
]

// ── Helpers ──────────────────────────────────

function fetchWithTimeout(request, timeout = FETCH_TIMEOUT) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Fetch timeout')), timeout)
    ),
  ])
}

async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    if (keys.length > maxItems) {
      const toDelete = keys.slice(0, keys.length - maxItems)
      await Promise.allSettled(toDelete.map((key) => cache.delete(key)))
    }
  } catch (e) {
    // Cache trim is best-effort
  }
}

function logError(context, error) {
  if (typeof console !== 'undefined') {
    console.warn(`[SW:${context}]`, error?.message || error)
  }
}

// ── Install ──────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch((err) => logError('install', err))
  )
})

// ── Activate ─────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('memo-v') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

// ── Fetch ────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET
  if (request.method !== 'GET') return

  // Skip non-same-origin except CDN
  if (
    url.origin !== location.origin &&
    !url.hostname.includes('cdn.jsdelivr.net')
  ) return

  // Skip API / Firebase requests (network-only)
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) return

  // ── HTML / Navigation: Network-first ──
  if (
    request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html')
  ) {
    event.respondWith(
      fetchWithTimeout(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
              trimCache(CACHE_NAME, MAX_CACHE_ITEMS)
            })
          }
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/'))
        )
    )
    return
  }

  // ── Hashed assets: Cache-first (immutable) ──
  if (url.pathname.match(/\/assets\/.*\.[a-f0-9]+\.(js|css)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetchWithTimeout(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone)
                trimCache(CACHE_NAME, MAX_CACHE_ITEMS)
              })
            }
            return response
          })
          .catch((err) => {
            logError('asset-fetch', err)
            return new Response('', { status: 408 })
          })
      })
    )
    return
  }

  // ── Others: Stale-while-revalidate ──
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetchWithTimeout(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
              trimCache(CACHE_NAME, MAX_CACHE_ITEMS)
            })
          }
          return response
        })
        .catch(() => {
          // Offline image fallback
          if (request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#18181b" width="200" height="200"/><text fill="#71717a" x="100" y="100" text-anchor="middle" dy=".3em" font-family="system-ui" font-size="14">Offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            )
          }
          return cached
        })
      return cached || fetchPromise
    })
  )
})

// ── Message handling ─────────────────────────

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ── Background Sync ─────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-memos') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: 'SYNC_PENDING_MEMOS' })
        }
      })
    )
  }
})

// ── Push Notifications ──────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { notification: { title: 'Memo', body: event.data.text() } }
  }

  const { title, body, icon, data } = payload.notification || {}

  event.waitUntil(
    self.registration.showNotification(title || 'Memo', {
      body: body || '',
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data || { url: '/' },
      vibrate: [100, 50, 100],
      tag: data?.tag || 'default',
      renotify: true,
    })
  )
})

// ── Notification click ───────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus()
            client.navigate(urlToOpen)
            return
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})
