// バージョン番号：大きな更新は +1（例 3.1 → 4.0）、小さな更新は +0.1（例 3.1 → 3.2）。index.html の APP_VERSION も同じ値にする
const APP_VERSION = '17.3';
const V = 'kosa-v' + APP_VERSION;
// フォント用のキャッシュは、バージョンが変わっても消さない（更新のあと最初に開くときも、すぐに表示できるように）
const FC = 'kosa-fonts';
const CORE = ['./', 'index.html', 'firebase-config.js'];
const EXTRA = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const FONT = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];
// 取り込むときは、ブラウザのキャッシュ（GitHub Pages は10分間キャッシュさせる）を使わず、必ずサーバーから取る。
// そうしないと、新しいバージョンのキャッシュに「古い index.html」が入ってしまい、更新しても反映されない。
const FRESH = { cache: 'no-cache' };
const limit = (p, ms) => new Promise((ok, ng) => { const t = setTimeout(() => ng(new Error('timeout')), ms); p.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); ng(e); }); });
// リダイレクトされた応答は、画面の読み込みに使うと、Safariで表示に失敗することがあるので、作り直す
const clean = res => (res && res.redirected) ? res.blob().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers })) : res;
const grab = (c, u) => fetch(new Request(u, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(u); return c.put(u, r); });
// 古いバージョンのキャッシュに入っているフォントを、フォント用のキャッシュに引き継ぐ
// index.html は、'./' と 'index.html' の2つの名前で使うので、1回だけダウンロードして、両方に入れる（更新のダウンロード量が、半分になる）
const grabHtml = c => fetch(new Request('index.html', { cache: 'reload' })).then(r => { if (!r.ok) throw new Error('index.html'); return c.put('index.html', r.clone()).then(() => c.put('./', r)); });
const keepFonts = async () => {
  try {
    const fc = await caches.open(FC);
    for (const k of await caches.keys()) {
      if (!k.startsWith('kosa-v') || k === V) continue;
      const old = await caches.open(k);
      for (const r of await old.keys()) { if (FONT.includes(new URL(r.url).hostname)) { const res = await old.match(r); if (res) await fc.put(r, res); } }
    }
  } catch (e) { }
};
self.addEventListener('install', e => e.waitUntil(
  caches.open(V).then(c => Promise.all([grabHtml(c), grab(c, 'firebase-config.js'), ...EXTRA.map(u => grab(c, u).catch(() => { }))])).then(keepFonts)
));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== FC).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); else if (e.data === 'ver' && e.ports[0]) e.ports[0].postMessage(APP_VERSION); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (FONT.includes(u.hostname)) {
    e.respondWith(caches.open(FC).then(c => c.match(r).then(h => h || fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone()); return res; }))));
  } else if (u.origin === location.origin) {
    // 保存してある版を、すぐに返す（通信を待たない）。新しい版の確認は、起動が落ちついたあと（数秒後）に、裏で行う
    const nav = r.mode === 'navigate', cfg = u.pathname.endsWith('firebase-config.js');
    const fresh = () => fetch(nav ? r.url : r, FRESH).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; });
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(h => {
      if (h) { e.waitUntil(new Promise(ok => setTimeout(ok, cfg ? 6000 : 5000)).then(() => fresh().catch(() => { }))); return nav ? clean(h) : h; }
      const net = fresh().then(res => nav ? clean(res) : res);
      return (nav ? limit(net, 8000) : cfg ? limit(net, 4000) : net).catch(() => nav ? caches.match('index.html').then(x => x && clean(x)) : undefined);
    }));
  }
});
