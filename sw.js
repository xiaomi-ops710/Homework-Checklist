/* Service Worker：オフラインでも起動できるように、アプリ本体（HTML / CSS / JS / アイコン）をキャッシュする。
 * 更新を配信するときは VERSION を上げる（古いキャッシュは activate 時に消える）。
 * ・同じオリジンの GET だけを扱い、翻訳 API や Gemini などの外部リクエストには一切触れない。
 * ・アプリ本体は「ネットワーク優先 → 失敗したらキャッシュ」。オンラインなら常に最新が表示され、古い版に固まらない。 */
const VERSION = 'v16';
const CACHE = 'xlate-' + VERSION;
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'icons.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'img/wallpaper-light.jpg', 'img/wallpaper-dark.jpg', 'img/park.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))   // 1 つ取れなくても全体は失敗させない
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('xlate-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // 外部 API などは素通し
  e.respondWith(
    fetch(req, { cache: 'no-cache' })   // HTTP キャッシュを通さず、必ずサーバーに問い合わせる
      .then((res) => {
        if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') || caches.match('./') : Response.error())))
  );
});
