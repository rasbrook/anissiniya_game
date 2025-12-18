const CACHE_NAME = 'abyssinia-shell-v1';
const AUDIO_CACHE = 'abyssinia-audio-v1';
const CORE = [
    '/',
    '/index.html'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CORE).catch(() => {
                // ignore individual failures
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            // clean up old caches
            const keys = await caches.keys();
            await Promise.all(
                keys.map(k => {
                    if (k !== CACHE_NAME && k !== AUDIO_CACHE) return caches.delete(k);
                })
            );
            try { await self.clients.claim(); } catch (e) { }
        })()
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;

    // Prioritize caching strategy for audio files (cache-first)
    if (request.destination === 'audio' || request.url.endsWith('.mp3') || request.url.includes('/ball_audio/')) {
        event.respondWith(
            caches.open(AUDIO_CACHE).then(async (cache) => {
                const cached = await cache.match(request);
                if (cached) return cached;
                try {
                    const networkResp = await fetch(request);
                    if (networkResp && networkResp.ok) {
                        cache.put(request, networkResp.clone()).catch(() => { });
                    }
                    return networkResp;
                } catch (e) {
                    return cached || Response.error();
                }
            })
        );
        return;
    }

    // Navigation requests -> network-first, fallback to cache (app shell)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).then((resp) => {
                // optionally update shell cache
                const copy = resp.clone();
                caches.open(CACHE_NAME).then(c => c.put(request, copy)).catch(() => { });
                return resp;
            }).catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Other requests: serve from cache first, else network and cache when same-origin
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((networkResp) => {
                // cache same-origin static assets for faster subsequent loads
                if (isSameOrigin && networkResp && networkResp.ok) {
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResp.clone())).catch(() => { });
                }
                return networkResp;
            }).catch(() => {
                return cached || Response.error();
            });
        })
    );
});
