const C = 'fce-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/app.js', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || /api\.(anthropic|github)\.com/.test(u.host)) return;
  // network first for app files (so updates show), cache fallback offline
  e.respondWith(fetch(e.request).then(r => { if (r.ok && (u.origin === location.origin || /cdnjs|fonts\.(googleapis|gstatic)/.test(u.host))) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request)));
});
