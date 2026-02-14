// ============================================
// Service Worker for Moonwave ToDoList PWA
// ============================================

const CACHE_VERSION = '__SW_VERSION__';
const CACHE_NAME = `todolist-v${CACHE_VERSION}`;
const MAX_CACHE_ITEMS = 100;
const FETCH_TIMEOUT = 5000;

// Core assets that should always be cached
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.svg',
    '/icons/icon-192.png',
    'https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css',
];

// Timeout wrapper for fetch
function fetchWithTimeout(request, timeout = FETCH_TIMEOUT) {
    return Promise.race([
        fetch(request),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Fetch timeout')), timeout)
        )
    ]);
}

// LRU cache eviction
async function trimCache(cacheName, maxItems) {
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        if (keys.length > maxItems) {
            const toDelete = keys.slice(0, keys.length - maxItems);
            await Promise.all(toDelete.map(key => cache.delete(key)));
        }
    } catch (e) {
        // Silent - cache trim is best-effort
    }
}

// Silent error logger
function logError(context, error) {
    if (typeof console !== 'undefined') {
        console.warn(`[SW:${context}]`, error?.message || error);
    }
}

// Install: Cache core assets (skipWaiting is NOT called here — only on user consent via message)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .catch((err) => logError('install', err))
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key.startsWith('todolist-') && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: Smart caching strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip cross-origin requests (except CDN fonts/libraries)
    if (url.origin !== location.origin && !url.hostname.includes('cdn.jsdelivr.net')) {
        return;
    }

    // API requests - network only (no cache)
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/yahoo-api')) {
        return;
    }

    // HTML/Navigation requests - Network first, cache fallback
    if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetchWithTimeout(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, clone);
                            trimCache(CACHE_NAME, MAX_CACHE_ITEMS);
                        });
                    }
                    return response;
                })
                .catch(() => caches.match(request).then((response) => response || caches.match('/')))
        );
        return;
    }

    // JS/CSS assets with hash - Cache first (immutable)
    if (url.pathname.match(/\/assets\/.*\.[a-f0-9]+\.(js|css)$/)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;

                return fetchWithTimeout(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, clone);
                            trimCache(CACHE_NAME, MAX_CACHE_ITEMS);
                        });
                    }
                    return response;
                }).catch((err) => {
                    logError('asset-fetch', err);
                    return new Response('', { status: 408 });
                });
            })
        );
        return;
    }

    // Other assets - Stale while revalidate
    event.respondWith(
        caches.match(request).then((cached) => {
            const fetchPromise = fetchWithTimeout(request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, clone);
                            trimCache(CACHE_NAME, MAX_CACHE_ITEMS);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Offline fallback for images
                    if (request.destination === 'image') {
                        return new Response(
                            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#18181b" width="200" height="200"/><text fill="#666" x="100" y="100" text-anchor="middle" dy=".3em" font-family="system-ui">Offline</text></svg>',
                            { headers: { 'Content-Type': 'image/svg+xml' } }
                        );
                    }
                    return cached;
                });

            return cached || fetchPromise;
        })
    );
});

// Handle messages from client
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If there's already an open window, focus it and navigate
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.focus();
                        client.navigate(urlToOpen);
                        return;
                    }
                }
                // Otherwise open a new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
