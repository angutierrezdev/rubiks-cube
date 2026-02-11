const VERSION = '1.0.0';
const CACHE_NAME = `rubiks-cube-v${VERSION}`;
// Derive base path from SW location (e.g. '' for user site, '/rubiks-cube' for project site)
const BASE = self.location.pathname.replace(/\/sw\.js$/i, '') || '';
const urlsToCache = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/src/styles.css',
  BASE + '/src/app.js',
  BASE + '/src/core/cube.js',
  BASE + '/src/rendering/cubeRenderer.js',
  BASE + '/src/rendering/highlightManager.js',
  BASE + '/src/strategies/rotationStrategy.js',
  BASE + '/src/controllers/uiController.js',
  BASE + '/src/controllers/cameraController.js',
  BASE + '/src/controllers/touchHandler.js',
  // Icon files
  BASE + '/images/favicon.ico',
  BASE + '/images/favicon.png',
  BASE + '/images/apple-touch-icon.png',
  BASE + '/images/icon-192x192.png',
  BASE + '/images/icon-384x384.png',
  BASE + '/images/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install event, version:', VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate event, version:', VERSION);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Notify all clients about the update
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: VERSION
          });
        });
      });
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Listen for messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Send current version to client
    event.ports[0].postMessage({
      type: 'CURRENT_VERSION',
      version: VERSION
    });
  }
});
