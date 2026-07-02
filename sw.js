// Service Worker untuk SpeakOut PWA
const CACHE_NAME = 'speakout-v5'; // ⬅️ dinaikkan dari v4, supaya cache lama otomatis dibersihkan
const API_CACHE_NAME = 'speakout-api-v1'; // ⬅️ cache terpisah khusus response API
const API_ORIGINS = ['http://127.0.0.1:8000', 'http://10.0.2.2:8000']

// File statis yang boleh di-cache (aset saja, BUKAN html)
const STATIC_ASSETS = [
  'manifest.json',
  'offline.html',
  'images/icon-192.png',
  'images/icon-512.png',
  'css/main.css',
  'css/courses.css',
  'css/teachers.css',
  'js/app.js',
  'js/splash.js',
  'js/favorites.js',
  'js/notification.js'
];

// Install
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(error => {
        console.log('[SW] Cache failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate - hapus cache lama (termasuk cache API versi lama)
self.addEventListener('activate', event => {
  console.log('[SW] Activated!');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch - strategy berbeda untuk HTML vs API vs aset
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isApiRequest = API_ORIGINS.includes(url.origin) || url.pathname.startsWith('/api/');

  // ✅ Request ke API
  if (isApiRequest) {
    // Non-GET (login, submit quiz, enroll, payment, dll) → network-only, TIDAK PERNAH di-cache
    if (event.request.method !== 'GET') {
      return; // biarkan browser fetch normal, tanpa campur tangan SW
    }

    // GET ke API → network-first, fallback ke cache kalau offline
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(API_CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          console.log('[SW] API offline, coba ambil dari cache:', url.pathname);
          return caches.match(event.request, { cacheName: API_CACHE_NAME });
        })
    );
    return;
  }

  // ✅ HTML pages: SELALU ambil dari network (fresh)
  if (event.request.mode === 'navigate' || 
      (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => cached || caches.match('offline.html'));
        })
    );
    return;
  }

  if (url.pathname.endsWith('/js/api.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Aset statis: cache-first, dan HANYA untuk GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
  );
});