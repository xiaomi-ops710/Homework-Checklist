// 一度だけ実行して、VAPID の鍵を作ります（Node.js 18 以上。パソコンでも Render のシェルでも可）。
//   node gen-vapid.js
// 表示された VAPID_PUBLIC は、firebase-config.js の VAPID_PUBLIC_KEY と、Render の環境変数の両方に入れます。
// VAPID_PRIVATE は、Render の環境変数にだけ入れて、ほかには貼らないでください。
const crypto = require('crypto');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' }), prv = privateKey.export({ format: 'jwk' });
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);
console.log('VAPID_PUBLIC（firebase-config.js と Render の両方に入れる）:\n' + raw.toString('base64url') + '\n');
console.log('VAPID_PRIVATE（Render の環境変数だけに入れる）:\n' + prv.d + '\n');
