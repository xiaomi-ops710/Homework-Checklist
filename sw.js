// バージョン番号：index.html の STABLE_VER / BETA_VER と同じ値にする（ベータ版は /beta/ の中で、BETA_VER を使う）
const STABLE_VER = '18.5.3';
const BETA_VER = '18.5.3';
const APP_VERSION = self.location.pathname.includes('/beta/') ? BETA_VER : STABLE_VER;
// ベータ版（beta/ の中）と正式版（いちばん上）は、別々のキャッシュを使う（互いに消し合わないように）
const BETA = self.location.pathname.includes('/beta/');
const PFX = BETA ? 'kosa-beta-v' : 'kosa-v';
const V = PFX + APP_VERSION;
// フォント用のキャッシュは、バージョンが変わっても消さない（更新のあと最初に開くときも、すぐに表示できるように）
const FC = 'kosa-fonts';
const CORE = ['./', 'index.html', 'firebase-config.js'];
const EXTRA = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'kanji-db.js', 'games/invader.html', 'games/merge.html', 'assets/volcano-bg.jpg', 'assets/lava-tile.jpg'];
const FONT = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];
// 取り込むときは、ブラウザのキャッシュ（GitHub Pages は10分間キャッシュさせる）を使わず、必ずサーバーから取る。
// そうしないと、新しいバージョンのキャッシュに「古い index.html」が入ってしまい、更新しても反映されない。
const FRESH = { cache: 'no-cache' };
const limit = (p, ms) => new Promise((ok, ng) => { const t = setTimeout(() => ng(new Error('timeout')), ms); p.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); ng(e); }); });
// リダイレクトされた応答は、画面の読み込みに使うと、Safariで表示に失敗することがあるので、作り直す
const clean = res => (res && res.redirected) ? res.blob().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers })) : res;
// 取り込みの記録：失敗したときの理由を、画面（更新の表示）で見せるために残す
const LOG = [];
let LAST = null;
const logAdd = s => { LOG.push(new Date().toLocaleTimeString('ja-JP') + '  ' + s); if (LOG.length > 80) LOG.shift(); };
const errText = e => { if (!e) return '不明なエラー'; if (e.status) return `サーバーから HTTP ${e.status} が返りました`; return `${e.name || 'Error'}：${String(e.message || '').slice(0, 160)}`; };
// 1つのファイルを取る。「データが届かない時間」が続いたら止めて、取り直す（ゆっくりでも届いているなら、待ち続ける）。
// 失敗したら少し待って取り直す（一時的に通信が切れても、更新を最後まで終えられるように）。404などは取り直しても同じなので、すぐにやめる。
const fetchTry = async (u, tries, stall) => {
  let last = null;
  for (let i = 1; i <= tries; i++) {
    const ac = new AbortController(), t0 = Date.now();
    let timer = setTimeout(() => ac.abort(), stall);
    const kick = () => { clearTimeout(timer); timer = setTimeout(() => ac.abort(), stall); };
    try {
      const r = await fetch(new Request(u, { cache: 'reload' }), { signal: ac.signal });
      kick();
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      let blob;
      if (r.body && r.body.getReader) {
        const reader = r.body.getReader(), parts = [];
        for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); kick(); }
        blob = new Blob(parts, { type: r.headers.get('content-type') || '' });
      } else blob = await r.blob();
      clearTimeout(timer);
      logAdd(`取得 ${u}：成功（${i}回目、${Date.now() - t0}ミリ秒、${Math.round(blob.size / 1024)}KB）`);
      return { blob, headers: r.headers };
    } catch (e) {
      clearTimeout(timer);
      last = e.name === 'AbortError' ? Object.assign(new Error(`${Math.round(stall / 1000)}秒のあいだ、データが届きませんでした`), { name: 'Timeout' }) : e;
      logAdd(`取得 ${u}：失敗（${i}回目）${errText(last)}`);
      if (last.status && last.status < 500 && last.status !== 408 && last.status !== 429) break;
      if (i < tries) await new Promise(res => setTimeout(res, 1500 * i));
    }
  }
  const err = new Error(`${u}：${errText(last)}`); err.step = u; throw err;
};
const mkRes = f => new Response(f.blob, { status: 200, headers: f.headers });
// 古い版の保存を消す（保存できる容量が足りないときだけ使う）
const clearOld = async () => { for (const k of await caches.keys()) if (k.startsWith(PFX) && k !== V && k !== FC) await caches.delete(k); };
const putSafe = async (c, u, f) => {
  try { await c.put(u, mkRes(f)); }
  catch (e) {
    logAdd(`保存 ${u}：失敗（${errText(e)}）。古い版の保存を消して、もう一度試します`);
    await clearOld();
    try { await c.put(u, mkRes(f)); }
    catch (e2) { const x = new Error(`${u} を保存できませんでした：${errText(e2)}`); x.step = u; throw x; }
  }
};
// 古いバージョンのキャッシュに入っているフォントを、フォント用のキャッシュに引き継ぐ
const keepFonts = async () => {
  try {
    const fc = await caches.open(FC);
    for (const k of await caches.keys()) {
      if (!(k.startsWith('kosa-v') || k.startsWith('kosa-beta-v')) || k === V) continue;
      const old = await caches.open(k);
      for (const r of await old.keys()) { if (FONT.includes(new URL(r.url).hostname)) { const res = await old.match(r); if (res) await fc.put(r, res); } }
    }
  } catch (e) { }
};
// 取り込みの進み具合を、画面（更新の表示）に知らせる（実際に取れたファイルの数で、%を出す）
const TOTAL = EXTRA.length + 2;
let got = 0;
const tick = () => { got++; self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(cs => cs.forEach(c => c.postMessage({ type: 'prog', done: got, total: TOTAL }))).catch(() => { }); };
// 取り込みの結果（失敗した理由を含む）を、画面に知らせる
const report = (ok, err) => {
  LAST = { ok, ver: APP_VERSION, t: Date.now(), err: err ? (err.step ? err.message : errText(err)) : '', step: (err && err.step) || '', log: LOG.slice() };
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(cs => cs.forEach(c => c.postMessage(Object.assign({ type: 'instres' }, LAST)))).catch(() => { });
};
self.addEventListener('install', e => {
  got = 0; LOG.length = 0; const t0 = Date.now();
  logAdd(`版 ${APP_VERSION} の取り込みを始めます`);
  e.waitUntil((async () => {
    try {
      const c = await caches.open(V);
      // 欠けると動かないファイル（画面の本体・設定）は、取り直しをしながら、必ず取る
      const core = (async () => {
        const h = await fetchTry('index.html', 3, 30000); tick();
        await putSafe(c, 'index.html', h); await putSafe(c, './', h);
        const f = await fetchTry('firebase-config.js', 3, 30000); tick();
        await putSafe(c, 'firebase-config.js', f);
      })();
      // あとからでもよいファイルは、取れなくても更新は止めない（理由だけ記録する）
      const extra = Promise.all(EXTRA.map(u => fetchTry(u, 2, 20000).then(f => putSafe(c, u, f)).catch(x => logAdd(`任意のファイル ${u} は取れませんでした（${errText(x)}）`)).then(tick)));
      await Promise.all([core, extra]);
      await keepFonts();
      logAdd(`取り込みが終わりました（${Math.round((Date.now() - t0) / 1000)}秒）`);
      report(true);
    } catch (err) {
      logAdd('取り込みに失敗しました：' + (err.message || errText(err)));
      report(false, err);
      throw err;
    }
  })());
});
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PFX) && k !== V && k !== FC).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// プッシュ通知の受け取りと、通知を押したときの処理（アプリを開く）
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '考査課題マネージャー', { body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'kosa-push', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(x => 'focus' in x); return c ? c.focus() : self.clients.openWindow(url); }));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); else if (e.data === 'ver' && e.ports[0]) e.ports[0].postMessage(APP_VERSION); else if (e.data === 'log' && e.ports[0]) e.ports[0].postMessage(LAST || { ok: null, ver: APP_VERSION, log: LOG.slice() }); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  // 音（<audio>）の範囲取得（Range）は、キャッシュを使わず通信で返す（Safariで音が出なくなるのを防ぐ）
  if (r.headers.has('range')) return;
  // 正式版は beta/ の中を、ベータ版は beta/ の中だけを扱う（同じ場所を両方が取り合わないように）
  if (u.origin === location.origin && u.pathname.includes('/beta/') !== BETA) return;
  if (FONT.includes(u.hostname)) {
    e.respondWith(caches.open(FC).then(c => c.match(r).then(h => h || fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone()); return res; }))));
  } else if (u.origin === location.origin) {
    // 保存してある版を、すぐに返す（通信を待たない）。新しい版の確認は、起動が落ちついたあと（数秒後）に、裏で行う
    const nav = r.mode === 'navigate', cfg = u.pathname.endsWith('firebase-config.js');
    const fresh = () => fetch(nav ? r.url : r, FRESH).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; });
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(h => {
      // 保存してある版をそのまま返す。画面の本体（index.html）は、新しい版のサービスワーカーが入るときに取り直すので、開くたびに2.6MBを取り直さない
      if (h) { if (cfg) e.waitUntil(new Promise(ok => setTimeout(ok, 6000)).then(() => fresh().catch(() => { }))); return nav ? clean(h) : h; }
      const net = fresh().then(res => nav ? clean(res) : res);
      return (nav ? limit(net, 8000) : cfg ? limit(net, 4000) : net).catch(() => nav ? caches.match('index.html').then(x => x && clean(x)) : undefined);
    }));
  }
});
