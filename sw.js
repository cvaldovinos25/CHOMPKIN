/* Chompkin: funcionamiento sin conexión (primero la red; si falla, la copia guardada). Sube CACHE al publicar cambios grandes. */
const CACHE = 'chompkin-v3';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(['./', 'index.html', 'manifest.webmanifest', 'js/audio.js', 'js/vision.js', 'js/tracker.js', 'js/game.js', 'js/main.js', 'fonts/ARCADE_N.TTF', 'img/icon-192.png'].map((u) => c.add(u)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); return res; }).catch(() => caches.match(r).then((hit) => hit || caches.match('index.html'))));
});
