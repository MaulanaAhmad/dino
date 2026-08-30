/* ==========================================================================
   Tempat Impian Kita — Service Worker
   Cache-first untuk app shell (HTML/CSS/JS/icon), network-first untuk data
   (misalnya request ke Supabase). Semua path relatif terhadap lokasi sw.js,
   supaya aman di subfolder GitHub Pages (/repo/).
   ========================================================================== */

const CACHE_VERSION = 'v33';
const CACHE_NAME = `impian-kita-shell-${CACHE_VERSION}`;

// Path relatif terhadap sw.js (di root situs/subfolder).
const APP_SHELL = [
  './',
  './index.html',
  './wishlist.html',
  './cerita.html',
  './nikah.html',
  './kalender.html',
  './manifest.json',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/wishlist.js',
  './assets/js/kalender.js',
  './assets/js/cerita.js',
  './assets/js/beranda.js',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/icon-192-maskable.png',
  './assets/img/icon-512-maskable.png',
  './assets/img/couple.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // `cache: 'reload'` memaksa ambil dari jaringan, melewati HTTP cache browser.
      // Tanpa ini, menaikkan CACHE_VERSION bisa tetap menyimpan file versi LAMA
      // (browser/Apache masih menyajikan salinan lamanya) — persis penyebab
      // "sudah hard refresh tapi tampilan tidak berubah".
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(new Request(url, { cache: 'reload' })).then((res) => {
            if (!res.ok) throw new Error(`Gagal cache ${url}: ${res.status}`);
            return cache.put(url, res);
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Data dinamis (Supabase & API eksternal lain) -> network-first, tidak dicache.
  if (!isSameOrigin(url)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // App shell statis (sama origin) -> cache-first, fallback ke network.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
