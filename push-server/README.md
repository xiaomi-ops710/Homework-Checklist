# プッシュ通知の送信サーバー（無料・カード登録なし）

Render の無料Webサービスで動かします。外部ライブラリは使いません（Node.js 18 以上）。
UptimeRobot（無料）で5分おきに `/health` を見に行き、サーバーがスリープしないようにします。

## 1. Firebase（サービスアカウントの鍵）
1. Firebase コンソール →（歯車）プロジェクトの設定 → **サービスアカウント**
2. **新しい秘密鍵を生成** → JSON ファイルがダウンロードされます（外に出さないでください）
3. この JSON の中身を、そのまま 4 の `FIREBASE_SA` に入れます

## 2. Firestore のルール
Firebase コンソール → Firestore Database → **ルール** に、リポジトリの `firestore.rules` の中身を貼って「公開」します。

## 3. VAPID の鍵（一度だけ）
```
node push-server/gen-vapid.js
```
- 表示された **VAPID_PUBLIC** を、`firebase-config.js` の `window.VAPID_PUBLIC_KEY` に貼ります（アプリ側）。
- **VAPID_PUBLIC** と **VAPID_PRIVATE** の両方を、4 の環境変数に入れます。
- 鍵を作り直すと、すべての端末の通知登録が無効になります（作り直したら、各端末で「オンにする」を押し直す）。

## 4. Render（送信サーバー）
1. Render にサインアップ（無料）→ **New +** → **Web Service** → このリポジトリ（GitHub）を接続
2. 設定：
   - Root Directory: `push-server`
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `node index.js`
   - Instance Type: **Free**
3. **Environment**（環境変数）：
   - `FIREBASE_SA` … 1 の JSON（改行なしの1行でもOK）
   - `VAPID_PUBLIC` … 3 の公開鍵
   - `VAPID_PRIVATE` … 3 の秘密の値
   - `VAPID_SUBJECT` … `mailto:あなたのメール`
4. デプロイ後、`https://（サービス名）.onrender.com/health` を開いて `{"ok":true,...}` が出れば成功です。

## 5. UptimeRobot（スリープ防止）
1. UptimeRobot（無料・カード不要）→ **New monitor**
2. Monitor Type: **HTTP(s)**、URL: `https://（サービス名）.onrender.com/health`、Monitoring Interval: **5 minutes**

## 6. アプリ側
- 更新したファイル（index.html・sw.js・firebase-config.js・firestore.rules）を、今までどおり公開（GitHub Pages）します。
- ホーム画面のアプリは、開くと自動で更新されます。**ホーム画面に入れ直す必要はありません。**

## 7. 各端末で（1回だけ）
1. ホーム画面のアプリを開き、Google でログイン
2. 通知（ベルのマーク）→ 「プッシュ通知」→ **この端末でオンにする** → 許可
3. **テスト通知** を押すと、1分以内に届きます
- 同じ Google アカウントでログインした端末すべてに届きます（端末ごとに一度ずつ「オンにする」を押します）。
- iPhone は、iOS 16.4 以上で、ホーム画面に追加したアプリから開く必要があります。

## 動き
- 設定した時刻（日本時間）に、「今日の確認」（今日・明日の提出、近いテスト、今日・明日の予定）が届きます。
- 1分ごとに、送る時刻が来た人がいないかを確かめます。
- 届かなくなった端末（通知をオフにした、端末を消した）は、自動で登録を消します。

## 注意
- Render の無料枠は、月の通信量を使い切ると、月末まで止まります。
- 無料枠は、アクセスがないと15分ほどでスリープしますが、UptimeRobot が防ぎます。UptimeRobot が止まると、通知も止まります。
- 届く時刻は、1分ほど遅れることがあります。
- 通知の内容は、その人の端末にだけ届きます（ほかの人には見えません）。
