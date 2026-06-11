// Service Worker untuk SpeakOut PWA
const CACHE_NAME = 'speakout-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/courses.html',
  '/login.html',
  '/register.html',
  '/teachers.html',
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// Install Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.log('[SW] Cache failed:', error);
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] Activated!');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch - Serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});