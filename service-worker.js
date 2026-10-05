/**
 * Service Worker - Offline Support
 * Caches app assets and map tiles for offline functionality
 */

const CACHE_NAME = 'household-tracker-v3';
const TILE_CACHE = 'map-tiles-v2';

const urlsToCache = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/gps.js',
    '/js/map.js',
    '/js/database.js',
    '/js/households.js',
    '/js/waterMeterLocations.js',
    '/js/waterMeters.js',
    '/js/meterReading.js',
    '/js/billing.js',
    '/js/printer.js',
    '/js/routes.js',
    '/manifest.json',
    '/assets/icon-192.png',
    '/assets/icon-512.png'
];

/**
 * Install event - cache all static assets
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Installed');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== TILE_CACHE) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated');
                return self.clients.claim();
            })
    );
});

/**
 * Fetch event - serve from cache, fallback to network
 * Strategy: Cache First for app, Network First for tiles
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle map tiles (OpenStreetMap and Esri Satellite)
    const isTileRequest = url.hostname.includes('tile.openstreetmap.org') || 
                          url.hostname.includes('server.arcgisonline.com');
    
    if (isTileRequest) {
        event.respondWith(
            caches.open(TILE_CACHE).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    // Return cached tile if available
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // Fetch from network and cache
                    return fetch(request).then((response) => {
                        // Only cache successful responses
                        if (response && response.status === 200) {
                            cache.put(request, response.clone());
                        }
                        return response;
                    }).catch(() => {
                        // Return empty tile if offline and not cached
                        return new Response('', { status: 404 });
                    });
                });
            })
        );
        return;
    }

    // Skip other cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // For navigation requests, try network first, then cache
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    return caches.match(request);
                })
        );
        return;
    }

    // For other requests, try cache first, then network
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request)
                    .then((response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        console.log('Service Worker: Fetch failed for', request.url);
                    });
            })
    );
});

/**
 * Message event - handle messages from clients
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
