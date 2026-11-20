self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Pass-through fetch untuk aplikasi berbasis Supabase real-time
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});