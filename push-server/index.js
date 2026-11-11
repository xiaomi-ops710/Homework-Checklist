// 考査課題マネージャーの、プッシュ通知の送信サーバー（Render の無料Webサービスで動かします）。
// 外部のライブラリは使いません（Node.js 18 以上）。
// ・1分ごとに、送る時刻が来た人（pushPlan）を探す
// ・その人の、ログインしている全端末（pushSubs）へ、暗号化した通知を送る（Web Push）
// ・UptimeRobot が /health を5分ごとに見に来るので、無料枠のサーバーが眠らない
const http = require('http');
const crypto = require('crypto');

const ENV = process.env;
const PORT = Number(ENV.PORT) || 10000;
const SA = ENV.FIREBASE_SA ? JSON.parse(ENV.FIREBASE_SA) : null;
const PROJECT = ENV.FIREBASE_PROJECT_ID || (SA && SA.project_id) || '';
const FS_BASE = ENV.FIRESTORE_BASE || `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const TOKEN_URL = ENV.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const VAPID_PUB = ENV.VAPID_PUBLIC || '';
const VAPID_PRIV = ENV.VAPID_PRIVATE || '';
const VAPID_SUB = ENV.VAPID_SUBJECT || 'mailto:admin@example.com';
const TICK_MS = Number(ENV.TICK_MS) || 30000;   // 30秒ごとに、変わったものを確かめる
const DAY = 86400000;

const log = (...a) => console.log(new Date().toISOString(), ...a);
const b64u = buf => Buffer.from(buf).toString('base64url');
const unb64u = s => Buffer.from(String(s), 'base64url');
const state = { lastTick: 0, lastRun: 0, sent: 0, gone: 0, plans: 0, lastErr: '' };

// ---------- Google の認証（サービスアカウントで、Firestore を読み書きします）----------
let tok = null, tokExp = 0;
async function accessToken() {
  if (ENV.FIRESTORE_BASE) return null;            // テスト用（認証なしの模擬サーバー）
  if (tok && Date.now() < tokExp - 60000) return tok;
  if (!SA) throw new Error('FIREBASE_SA が未設定です');
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: SA.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${claim}`), SA.private_key);
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${b64u(sig)}` }) });
  const j = await r.json();
  if (!r.ok) throw new Error('認証に失敗: ' + JSON.stringify(j).slice(0, 200));
  tok = j.access_token; tokExp = Date.now() + j.expires_in * 1000;
  return tok;
}
async function fsReq(method, path, body) {
  const t = await accessToken();
  const h = { 'Content-Type': 'application/json' };
  if (t) h.Authorization = 'Bearer ' + t;
  const r = await fetch(FS_BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`Firestore ${method} ${path.slice(0, 80)}: ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.status === 204 ? null : r.json();
}

// ---------- Firestore の値の変換 ----------
function fromV(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('mapValue' in v) return fromF(v.mapValue.fields);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromV);
  return null;
}
const fromF = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, fromV(v)]));
function toV(x) {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'string') return { stringValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(toV) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, toV(v)])) } };
}

// ---------- Firestore の読み書き ----------
// 通知を有効にしている人（enabled が true）を全部読みます（人数が少ないので、1回で足ります）
async function enabledPlans() {
  const r = await fsReq('POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'pushPlan' }], where: { fieldFilter: { field: { fieldPath: 'enabled' }, op: 'EQUAL', value: { booleanValue: true } } }, limit: 200 } });
  return (r || []).filter(x => x.document).map(x => ({ uid: x.document.name.split('/documents/')[1].split('/')[1], data: fromF(x.document.fields) }));
}
async function devicesOf(uid) {
  const r = await fsReq('GET', `/pushSubs/${uid}/devices?pageSize=100`);
  return ((r && r.documents) || []).map(d => ({ dev: d.name.split('/').pop(), sub: fromF(d.fields).sub }))
    .filter(x => x.sub && x.sub.endpoint && x.sub.keys && x.sub.keys.p256dh && x.sub.keys.auth);
}
async function patchPlan(uid, fields) {
  const mask = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  await fsReq('PATCH', `/pushPlan/${uid}?${mask}`, { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toV(v)])) });
}

// ---------- Web Push の暗号化（RFC 8291 / aes128gcm）と VAPID の署名（RFC 8292）----------
// 鍵と塩を外から渡せるようにしてあるので、RFC 8291 の例と比べて確かめられます。
function encryptWith({ uaPub, auth, asPriv, salt, plaintext }) {
  const ecdh = crypto.createECDH('prime256v1');
  if (asPriv) ecdh.setPrivateKey(asPriv); else ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPub);
  const hk = (ikm, s, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, s, info, len));
  const ikm = hk(shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const cek = hk(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hk(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(plaintext, 'utf8'), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}
function encryptPayload(sub, plaintext) {
  return encryptWith({ uaPub: unb64u(sub.keys.p256dh), auth: unb64u(sub.keys.auth), salt: crypto.randomBytes(16), plaintext });
}
function vapidJwt(aud) {
  const pub = unb64u(VAPID_PUB);
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: VAPID_PRIV }, format: 'jwk' });
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUB }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64u(sig)}`;
}
async function pushTo(sub, msg) {
  const body = encryptPayload(sub, JSON.stringify(msg));
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { TTL: '3600', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Urgency: 'high', Authorization: `vapid t=${vapidJwt(new URL(sub.endpoint).origin)}, k=${VAPID_PUB}` },
    body,
  });
  return r.status;   // 201 = 届いた。404 / 410 = この端末の登録は、もう無効
}

// ---------- 送る（変わったものだけ、すぐ）----------
const SENT_MAX = 300;
function newsBody(items) {
  const txt = items.slice(0, 5).join('\n') + (items.length > 5 ? `\nほか${items.length - 5}件` : '');
  return txt.slice(0, 300);
}
async function sendTo(uid, msg) {
  const r = { ok: 0, gone: 0, fail: 0 };
  for (const { dev, sub } of await devicesOf(uid)) {
    try {
      const st = await pushTo(sub, msg);
      if (st === 404 || st === 410) { await fsReq('DELETE', `/pushSubs/${uid}/devices/${dev}`); r.gone++; state.gone++; }
      else if (st >= 300) { r.fail++; log('送信の応答が異常', st); }
      else { r.ok++; state.sent++; }
    } catch (e) { r.fail++; log('送信に失敗', e.message); }
  }
  return r;
}
const resText = (kind, r) => `${kind}：送信${r.ok}・失敗${r.fail}・無効${r.gone}`;
async function runPlan(uid, data, now) {
  const lines = Array.isArray(data.lines) ? data.lines.filter(x => typeof x === 'string') : [];
  const patch = {};
  if (data.test === true) {
    const r = await sendTo(uid, { title: '考査課題マネージャー（テスト）', body: 'テスト通知です。届いていれば、設定は正しくできています。', tag: 'kosa-test', url: './' });
    Object.assign(patch, { test: false, lastResult: resText('テスト', r), lastAt: now });
  }
  if (!Array.isArray(data.sent)) {
    patch.sent = lines.slice(0, SENT_MAX);   // 初めての登録：今ある内容は通知せず、覚えるだけ
  } else {
    const seen = new Set(data.sent), fresh = lines.filter(x => !seen.has(x));
    if (fresh.length) {
      const r = await sendTo(uid, { title: '考査課題マネージャー', body: newsBody(fresh), tag: 'kosa-new', url: './' });
      Object.assign(patch, { sent: [...data.sent, ...fresh].slice(-SENT_MAX), lastResult: resText('新着', r), lastAt: now });
    }
  }
  if (Object.keys(patch).length) await patchPlan(uid, patch);
}
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    const plans = await enabledPlans();
    state.plans = plans.length;
    for (const { uid, data } of plans) {
      try { await runPlan(uid, data, now); } catch (e) { state.lastErr = e.message; log('予定の処理に失敗', e.message); }
    }
    state.lastTick = now;
  } catch (e) { state.lastErr = e.message; log('確認に失敗', e.message); }
  finally { running = false; }
}

module.exports = { encryptWith, encryptPayload, vapidJwt, tick, _state: state };

if (require.main === module) {
  if (!VAPID_PUB || !VAPID_PRIV) log('注意：VAPID_PUBLIC / VAPID_PRIVATE が未設定です');
  if (!SA && !ENV.FIRESTORE_BASE) log('注意：FIREBASE_SA が未設定です');
  http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, lastTick: state.lastTick, plans: state.plans, sent: state.sent, gone: state.gone, lastErr: state.lastErr }));
    }
    res.writeHead(404); res.end('not found');
  }).listen(PORT, () => log('起動しました。ポート', PORT));
  setTimeout(tick, 3000);
  setInterval(tick, TICK_MS);
}
