/* Offline support: caches the app so every core feature works without internet.
   AI requests (POST) are never cached. Bump VERSION when you change files. */
const VERSION = 'pause-v3.2.1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-192.png',
  'assets/css/styles.css',
  'data/articles.js', 'data/articles-extra.js',
  'assets/js/config.js', 'assets/js/core.js', 'assets/js/storage.js', 'assets/js/catalog.js', 'assets/js/safety.js',
  'assets/js/ai.js', 'assets/js/recommend.js', 'assets/js/charts.js', 'assets/js/audio/engine.js', 'assets/js/audio/soundscapes.js', 'assets/js/audio/mixer.js', 'assets/js/games.js',
  'assets/js/pages/welcome.js', 'assets/js/pages/companion.js', 'assets/js/pages/today.js', 'assets/js/pages/mood.js',
  'assets/js/pages/journal.js', 'assets/js/pages/breathe.js', 'assets/js/pages/play.js', 'assets/js/pages/read.js',
  'assets/js/pages/affirmations.js', 'assets/js/pages/notes.js', 'assets/js/pages/settings.js', 'assets/js/pages/sounds.js', 'assets/js/app.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // never touch AI calls
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  /* Stale-while-revalidate: answer from cache instantly, refresh in the background. */
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });
    const network = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => cached || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
    return cached || network;
  }));
});
