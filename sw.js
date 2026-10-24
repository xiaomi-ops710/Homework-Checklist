// バージョン番号：大きな更新は +1（例 3.1 → 4.0）、小さな更新は +0.1（例 3.1 → 3.2）。index.html の APP_VERSION も同じ値にする
const APP_VERSION = '11.2';
const V = 'kosa-v' + APP_VERSION;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'firebase-config.js', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const FONT = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];
// 取り込むときは、ブラウザのキャッシュ（GitHub Pages は10分間キャッシュさせる）を使わず、必ずサーバーから取る。
// そうしないと、新しいバージョンのキャッシュに「古い index.html」が入ってしまい、更新しても反映されない。
const FRESH = { cache: 'no-cache' };
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(u); return c.put(u, r); }))))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); else if (e.data === 'ver' && e.ports[0]) e.ports[0].postMessage(APP_VERSION); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (FONT.includes(u.hostname)) {
    e.respondWith(caches.match(r).then(h => h || fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); return res; })));
  } else if (u.origin === location.origin && u.pathname.endsWith('firebase-config.js')) {
    e.respondWith(fetch(r, FRESH).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r, { ignoreSearch: true })));
  } else if (u.origin === location.origin) {
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(h => {
      const net = fetch(r, FRESH).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => h || (r.mode === 'navigate' ? caches.match('index.html') : undefined));
      return h || net;
    }));
  }
});
