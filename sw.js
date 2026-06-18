// Service Worker untuk SpeakOut PWA
const CACHE_NAME = 'speakout-v3';
const API_ORIGINS = ['http://127.0.0.1:8000', 'http://10.0.2.2:8000']

// File statis yang boleh di-cache (aset saja, BUKAN html)
const STATIC_ASSETS = [
  '/manifest.json',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/css/main.css',
  '/css/courses.css',
  '/css/teachers.css',
  '/js/app.js',
  '/js/splash.js'
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
  // Langsung aktif tanpa tunggu tab lama ditutup
  self.skipWaiting();
});

// Activate - hapus cache lama
self.addEventListener('activate', event => {
  console.log('[SW] Activated!');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Langsung kontrol semua tab
      return self.clients.claim();
    })
  );
});

// Fetch - strategy berbeda untuk HTML vs aset
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ✅ Request ke API: selalu langsung ke network, SW tidak ikut campur sama sekali
  if (API_ORIGINS.includes(url.origin) || url.pathname.startsWith('/api/')) {
    return; // tidak panggil respondWith() → browser lanjut fetch normal ke network
  }

  // ✅ HTML pages: SELALU ambil dari network (fresh)
  // Splash screen butuh ini agar tidak di-cache dalam state hidden
  if (event.request.mode === 'navigate' || 
      (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          return response;
        })
        .catch(() => {
          // Offline fallback: sajikan dari cache kalau network mati
          return caches.match(event.request);
        })
    );
    return;
  }

  // Aset statis: cache-first, dan HANYA untuk GET
  if (event.request.method !== 'GET') return;

  // ✅ Aset statis (CSS, JS, images): cache-first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(networkResponse => {
          // Simpan ke cache untuk next time
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