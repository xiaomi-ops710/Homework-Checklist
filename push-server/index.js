// 考査課題マネージャーの、プッシュ通知の送信サーバー（Render の無料Webサービス）。
// 外部のライブラリは使いません（Node.js 18 以上）。
// ・30秒ごとに、通知を有効にしている人の「通知の内容（items）」を見て、新しいものを全端末へ送る
// ・管理者のお知らせは、新しいものを全員へ送る（お知らせの時刻は pushState/main に覚える）
// ・予定（ev: / evm:）は、毎朝7時（日本時間）に、まとめて1回送る
// ・送れなかった理由は、その人の記録（pushDiag）に残し、アプリの「通知の診断」で見られる
// ・UptimeRobot が /health を5分ごとに見に来るので、無料枠のサーバーが眠らない
const http = require('http');
const crypto = require('crypto');

const ENV = process.env;
const PORT = Number(ENV.PORT) || 10000;
const clean = s => String(s || '').replace(/\s+/g, '');   // コピーの途中で入った空白・改行を取り除く
let SA = null, SA_ERR = '';
try { SA = ENV.FIREBASE_SA ? JSON.parse(ENV.FIREBASE_SA) : null; } catch (e) { SA_ERR = 'FIREBASE_SA の形式が正しくありません（JSONを、そのまま貼ってください）'; }
const PROJECT = ENV.FIREBASE_PROJECT_ID || (SA && SA.project_id) || '';
const FS_BASE = ENV.FIRESTORE_BASE || `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const TOKEN_URL = ENV.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const VAPID_PUB = clean(ENV.VAPID_PUBLIC);
const VAPID_PRIV = clean(ENV.VAPID_PRIVATE);
const VAPID_SUB = String(ENV.VAPID_SUBJECT || '').trim() || 'mailto:admin@example.com';
const VAPID_SUB_OK = /^(mailto:|https:)/.test(VAPID_SUB);
const TICK_MS = Number(ENV.TICK_MS) || 30000;
const SENT_MAX = 400, DIAG_MAX = 40, ITEMS_MAX = 80;

const log = (...a) => console.log(new Date().toISOString(), ...a);
const b64u = buf => Buffer.from(buf).toString('base64url');
const unb64u = s => Buffer.from(String(s), 'base64url');
const vapidPubCanon = () => (VAPID_PUB ? unb64u(VAPID_PUB).toString('base64url') : '');
const state = { lastTick: 0, sent: 0, gone: 0, plans: 0, lastErr: '' };

// ---------- Google の認証（サービスアカウントで、Firestore を読み書きします）----------
let tok = null, tokExp = 0;
async function accessToken() {
  if (ENV.FIRESTORE_BASE) return null;            // テスト用（認証なしの模擬サーバー）
  if (SA_ERR) throw new Error(SA_ERR);
  if (!SA) throw new Error('FIREBASE_SA が未設定です（Renderの環境変数に入れてください）');
  if (tok && Date.now() < tokExp - 60000) return tok;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: SA.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  let sig;
  try { sig = crypto.sign('sha256', Buffer.from(`${head}.${claim}`), SA.private_key); }
  catch (e) { throw new Error('FIREBASE_SA の秘密鍵を読めません（JSONを、そのまま貼ったか確認）'); }
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${b64u(sig)}` }) });
  const j = await r.json();
  if (!r.ok) throw new Error('Google の認証に失敗: ' + JSON.stringify(j).slice(0, 160));
  tok = j.access_token; tokExp = Date.now() + j.expires_in * 1000;
  return tok;
}
async function fsReq(method, path, body) {
  const t = await accessToken();
  const h = { 'Content-Type': 'application/json' };
  if (t) h.Authorization = 'Bearer ' + t;
  const r = await fetch(FS_BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`Firestore ${method} ${path.slice(0, 60)}：${r.status} ${(await r.text()).slice(0, 140)}`);
  return r.status === 204 ? null : r.json();
}
// 1件読む（無ければ null）
async function fsGetOpt(path) {
  const t = await accessToken();
  const h = {}; if (t) h.Authorization = 'Bearer ' + t;
  const r = await fetch(FS_BASE + path, { headers: h });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore GET ${path.slice(0, 60)}：${r.status}`);
  return fromF((await r.json()).fields);
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
async function enabledPlans() {
  const r = await fsReq('POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'pushPlan' }], where: { fieldFilter: { field: { fieldPath: 'enabled' }, op: 'EQUAL', value: { booleanValue: true } } }, limit: 200 } });
  return (r || []).filter(x => x.document).map(x => ({ uid: x.document.name.split('/documents/')[1].split('/')[1], data: fromF(x.document.fields) }));
}
// 管理者のお知らせ：前に見た時刻より新しいものだけを取る（全員に1回だけ送るため、時刻を覚える）
async function newAnnouncements() {
  const st = await fsGetOpt('/pushState/main');
  const cur = st && Number(st.annT);
  if (!cur) { await patchDoc('/pushState/main', { annT: Date.now() }); return { list: [], next: null }; }
  const r = await fsReq('POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'announcements' }], where: { fieldFilter: { field: { fieldPath: 't' }, op: 'GREATER_THAN', value: { integerValue: String(cur) } } }, orderBy: [{ field: { fieldPath: 't' }, direction: 'ASCENDING' }], limit: 20 } });
  const list = (r || []).filter(x => x.document).map(x => { const f = fromF(x.document.fields); return { id: x.document.name.split('/').pop(), text: String(f.text || '').slice(0, 300), t: Number(f.t) || 0 }; }).filter(a => a.text && a.t > cur);
  return { list, next: list.length ? Math.max(...list.map(a => a.t)) : null };
}
async function devicesOf(uid) {
  const r = await fsReq('GET', `/pushSubs/${uid}/devices?pageSize=100`);
  return ((r && r.documents) || []).map(d => { const f = fromF(d.fields); return { dev: d.name.split('/').pop(), sub: f.sub, vk: f.vk }; });
}
async function patchDoc(path, fields) {
  const mask = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  await fsReq('PATCH', `${path}?${mask}`, { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toV(v)])) });
}
const patchPlan = (uid, fields) => patchDoc(`/pushPlan/${uid}`, fields);

// ---------- 診断の記録（その人の pushDiag に残す。アプリの「通知の診断」で見られます）----------
const DIAG = {}, DIAG_DIRTY = new Set();
const jstStr = t => new Date(t + 9 * 3600000).toISOString().slice(5, 16).replace('T', ' ');
function dlog(uid, text) {
  log(uid ? uid.slice(0, 6) : '-', text);
  if (!uid) return;
  const a = DIAG[uid] || (DIAG[uid] = []);
  a.push(`${jstStr(Date.now())} ${text}`);
  if (a.length > DIAG_MAX) a.splice(0, a.length - DIAG_MAX);
  DIAG_DIRTY.add(uid);
}
async function flushDiag() {
  for (const uid of [...DIAG_DIRTY]) {
    DIAG_DIRTY.delete(uid);
    try { await patchDoc(`/pushDiag/${uid}`, { entries: DIAG[uid], updated: Date.now() }); }
    catch (e) { log('診断の保存に失敗', e.message); }
  }
}
const HINT = { 400: '形式が正しくありません（オンにし直してください）', 401: '鍵の認証が通りません（Renderの VAPID_PUBLIC・VAPID_PRIVATE・VAPID_SUBJECT を確認）', 403: '鍵の認証が通りません（Renderの VAPID_PUBLIC・VAPID_PRIVATE・VAPID_SUBJECT を確認）', 404: '登録が見つかりません（オンにし直してください）', 410: '登録が取り消されています（オンにし直してください）', 413: 'データが大きすぎます', 429: '送りすぎです（少し待ってください）' };
const hostOf = ep => { try { return new URL(ep).host; } catch (e) { return '不正なアドレス'; } };

// ---------- Web Push の暗号化（RFC 8291 / aes128gcm）と VAPID の署名（RFC 8292）----------
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
function vapidKeyObj() {
  const pub = unb64u(VAPID_PUB);
  return crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: VAPID_PRIV }, format: 'jwk' });
}
function vapidJwt(aud) {
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUB }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: vapidKeyObj(), dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64u(sig)}`;
}
// 1回の送信の結果（HTTPの番号・送った先・返ってきた理由）を返します。例外は投げません
async function pushTo(sub, msg) {
  const host = hostOf(sub.endpoint);
  let body, auth;
  try { body = encryptPayload(sub, JSON.stringify(msg)); } catch (e) { return { host, err: '暗号化に失敗：' + e.message }; }
  try { auth = `vapid t=${vapidJwt(new URL(sub.endpoint).origin)}, k=${vapidPubCanon()}`; } catch (e) { return { host, err: 'VAPIDの署名に失敗（Renderの VAPID_PRIVATE を確認）：' + e.message }; }
  try {
    const r = await fetch(sub.endpoint, { method: 'POST', headers: { TTL: '3600', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Urgency: 'high', Authorization: auth }, body });
    let text = '';
    if (r.status >= 300) { try { text = (await r.text()).replace(/\s+/g, ' ').slice(0, 120); } catch (e) { } }
    return { status: r.status, host, text };
  } catch (e) {
    return { host, err: '送り先に接続できません：' + ((e.cause && (e.cause.code || e.cause.message)) || e.message) };
  }
}

// ---------- 送る ----------
function newsBody(lines) {
  const txt = lines.slice(0, 5).join('\n') + (lines.length > 5 ? `\nほか${lines.length - 5}件` : '');
  return txt.slice(0, 300);
}
async function sendTo(uid, msg) {
  const r = { ok: 0, gone: 0, fail: 0, n: 0 };
  const devs = await devicesOf(uid);
  r.n = devs.length;
  if (!devs.length) { dlog(uid, '登録されている端末がありません。「この端末でオンにする」を押してください'); return r; }
  for (const [i, d] of devs.entries()) {
    const tag = `端末${i + 1}`;
    if (!d.sub || !d.sub.endpoint || !d.sub.keys || !d.sub.keys.p256dh || !d.sub.keys.auth) { r.fail++; dlog(uid, `${tag}：登録の中身が不完全です（オンにし直してください）`); continue; }
    if (typeof d.sub.expirationTime === 'number' && d.sub.expirationTime < Date.now()) {
      r.gone++; state.gone++; await fsReq('DELETE', `/pushSubs/${uid}/devices/${d.dev}`);
      dlog(uid, `${tag}（${hostOf(d.sub.endpoint)}）：登録の期限が切れていたので消しました（オンにし直してください）`); continue;
    }
    if (d.vk && d.vk !== VAPID_PUB) { r.fail++; dlog(uid, `${tag}（${hostOf(d.sub.endpoint)}）：別の鍵で登録されています。この端末で「この端末でオンにする」を押し直してください`); continue; }
    const res = await pushTo(d.sub, msg);
    if (res.err) { r.fail++; dlog(uid, `${tag}（${res.host}）：送れませんでした。${res.err}`); }
    else if (res.status >= 200 && res.status < 300) { r.ok++; state.sent++; dlog(uid, `${tag}（${res.host}）：送信OK（HTTP ${res.status}）`); }
    else if (res.status === 404 || res.status === 410) {
      r.gone++; state.gone++; await fsReq('DELETE', `/pushSubs/${uid}/devices/${d.dev}`);
      dlog(uid, `${tag}（${res.host}）：この端末の登録は無効（HTTP ${res.status}）。登録を消しました。${HINT[res.status] || ''}`);
    } else {
      r.fail++;
      dlog(uid, `${tag}（${res.host}）：送信が拒否されました（HTTP ${res.status}）${HINT[res.status] ? '。' + HINT[res.status] : (res.status >= 500 ? '。プッシュサービスの一時的な障害です' : '')}${res.text ? '：' + res.text : ''}`);
    }
  }
  return r;
}
const resText = (kind, r) => `${kind}：送信${r.ok}・失敗${r.fail}・無効${r.gone}${r.n === 0 ? '（登録端末なし）' : ''}`;
const isEv = k => k.startsWith('ev:') || k.startsWith('evm:');
const jstOf = now => { const j = new Date(now + 9 * 3600000); return { day: j.toISOString().slice(0, 10), hour: j.getUTCHours() }; };

// 1人分：テスト・お知らせ・通知の内容（新しいもの）・予定（朝7時にまとめて）を送る
async function runPlan(uid, data, now, annList) {
  const items = (Array.isArray(data.items) ? data.items : []).filter(x => x && typeof x.k === 'string' && x.k).slice(0, ITEMS_MAX);
  const patch = {}, sends = [];
  if (data.test === true) {
    dlog(uid, 'テスト通知を送ります');
    const r = await sendTo(uid, { title: '考査課題マネージャー（テスト）', body: 'テスト通知です。届いていれば、設定は正しくできています。', tag: 'kosa-test', url: './' });
    sends.push(resText('テスト', r));
    patch.test = false;
  }
  const silent = !Array.isArray(data.keysSent);            // 初めての確認：今ある通知は覚えるだけ（送らない）
  const jst = jstOf(now);
  const seen = new Set(silent ? [] : data.keysSent);
  let changed = silent;

  // お知らせ（管理者）：新しいものを、すぐ送る
  const annNew = annList.filter(a => !seen.has('ann:' + a.id));
  if (annNew.length) {
    annNew.forEach(a => seen.add('ann:' + a.id));
    dlog(uid, `お知らせ ${annNew.length}件を送ります：${annNew[0].text.slice(0, 60)}`);
    const r = await sendTo(uid, { title: '考査課題マネージャー・お知らせ', body: newsBody(annNew.map(a => a.text)), tag: 'kosa-ann', url: './' });
    sends.push(resText('お知らせ', r)); changed = true;
  }

  // 通知の内容：新しいものを、すぐ送る。予定（ev: / evm:）は、朝7時にまとめて送る
  const fresh = [], evs = [];
  for (const it of items) {
    if (it.k.startsWith('ann:') || seen.has(it.k)) continue;   // お知らせは上で送ったものを使う
    if (isEv(it.k)) { evs.push(it); continue; }
    seen.add(it.k); fresh.push(it);
  }
  if (silent) {
    evs.forEach(it => seen.add(it.k));                       // 初めての確認：予定も覚えるだけ
    if (jst.hour >= 7) patch.evDay = jst.day;               // 7時を過ぎていたら、今日の分は送らない
  } else if (fresh.length) {
    dlog(uid, `新しい通知 ${fresh.length}件を送ります：${fresh.slice(0, 3).map(i => i.t).join(' / ').slice(0, 100)}`);
    const r = await sendTo(uid, { title: '考査課題マネージャー', body: newsBody(fresh.map(i => i.t + (i.s ? '：' + i.s : ''))), tag: 'kosa-new', url: './' });
    sends.push(resText('新着', r)); changed = true;
  }
  const batch = !silent && jst.hour >= 7 && data.evDay !== jst.day;
  if (batch) {
    const pending = evs.filter(it => !seen.has(it.k));
    pending.forEach(it => seen.add(it.k));
    if (pending.length) {
      dlog(uid, `今日の予定 ${pending.length}件を、朝7時のまとめとして送ります`);
      const r = await sendTo(uid, { title: '考査課題マネージャー', body: newsBody(pending.map(i => i.t)), tag: 'kosa-day', url: './' });
      sends.push(resText('予定', r));
    }
    patch.evDay = jst.day; changed = true;
  }
  if (changed) patch.keysSent = [...seen].slice(-SENT_MAX);
  if (sends.length) { patch.lastResult = sends.join(' ／ '); patch.lastAt = now; }
  if (Object.keys(patch).length) await patchPlan(uid, patch);
}
let running = false;
async function tick() {
  if (running) return;
  running = true;
  state.lastErr = '';
  try {
    const now = Date.now();
    let ann = { list: [], next: null };
    try { ann = await newAnnouncements(); } catch (e) { state.lastErr = 'お知らせの確認：' + e.message; log('お知らせの確認に失敗', e.message); }
    const plans = await enabledPlans();
    state.plans = plans.length;
    for (const { uid, data } of plans) {
      try { await runPlan(uid, data, now, ann.list); }
      catch (e) { state.lastErr = e.message; dlog(uid, 'エラー：' + e.message); }
    }
    if (ann.next) await patchDoc('/pushState/main', { annT: ann.next });
    state.lastTick = now;
  } catch (e) { state.lastErr = e.message; log('確認に失敗', e.message); }
  finally { await flushDiag(); running = false; }
}

// ---------- 設定の点検（鍵が対になっているか、など。秘密の値そのものは出しません）----------
function vapidSelfOk() {
  const pub = unb64u(VAPID_PUB);
  const key = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
  const [h, b, sg] = vapidJwt('https://push.example').split('.');
  return crypto.verify('sha256', Buffer.from(`${h}.${b}`), { key, dsaEncoding: 'ieee-p1363' }, unb64u(sg));
}
function configCheck() {
  const c = { saOk: !!SA && !SA_ERR, saError: SA_ERR, vapidSet: !!(VAPID_PUB && VAPID_PRIV), vapidPairOk: false, vapidSelfOk: false, vapidSubOk: VAPID_SUB_OK, vapidKeyLen: VAPID_PUB.length };
  try {
    const pub = unb64u(VAPID_PUB);
    const derived = crypto.createPublicKey(vapidKeyObj()).export({ format: 'jwk' });
    c.vapidPairOk = derived.x === b64u(pub.subarray(1, 33)) && derived.y === b64u(pub.subarray(33, 65));
    c.vapidSelfOk = c.vapidPairOk && vapidSelfOk();
  } catch (e) { c.vapidError = e.message; }
  return c;
}

module.exports = { encryptWith, encryptPayload, vapidJwt, tick, configCheck, DIAG, _state: state };

if (require.main === module) {
  const c = configCheck();
  if (!c.saOk) log('注意：Firebase の鍵（FIREBASE_SA）に問題があります：', c.saError || '未設定');
  if (!c.vapidSet) log('注意：VAPID_PUBLIC / VAPID_PRIVATE が未設定です');
  else if (!c.vapidPairOk) log('注意：VAPID_PUBLIC と VAPID_PRIVATE が対になっていません。作り直して両方入れ直してください');
  http.createServer((req, res) => {
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
      return res.end(JSON.stringify({ ok: true, lastTick: state.lastTick, plans: state.plans, sent: state.sent, gone: state.gone, lastErr: state.lastErr, vapidFp: VAPID_PUB.slice(0, 8), vapidPub: vapidPubCanon(), config: configCheck() }));
    }
    res.writeHead(404, cors); res.end('not found');
  }).listen(PORT, () => log('起動しました。ポート', PORT));
  setTimeout(tick, 3000);
  setInterval(tick, TICK_MS);
}
