# プッシュ通知の送信サーバー（無料・カード登録なし）

Render の無料Webサービスで動かします。外部ライブラリは使いません（Node.js 18 以上）。
UptimeRobot（無料）で5分おきに `/health` を見に行き、サーバーがスリープしないようにします。

## 1. Firebase（サービスアカウントの鍵）
※ この JSON は、GitHub（公開されるページ）に入れないでください。Render の環境変数にだけ入れます。
1. Firebase コンソール →（歯車）プロジェクトの設定 → **サービスアカウント**
2. **新しい秘密鍵を生成** → JSON ファイルがダウンロードされます（外に出さないでください）
3. この JSON の中身を、そのまま 4 の `FIREBASE_SA` に入れます

## 2. Firestore のルール
Firebase コンソール → Firestore Database → **ルール** に、リポジトリの `firestore.rules` の中身を貼って「公開」します。（17.78 でルールが変わったので、貼り直してください。）

## 3. VAPID の鍵（一度だけ）

### iPad・ブラウザで作る場合（おすすめ）
1. このアプリを GitHub Pages で公開している場合は、アドレスの末尾を `push-server/vapid-generator.html` に変えて、Safari で開きます（例：`https://（ユーザー名）.github.io/（リポジトリ名）/push-server/vapid-generator.html`）。公開していない場合は、先にリポジトリを GitHub Pages に公開してください。
2. **鍵を作る** を押します。鍵は、この端末の中だけで作られます。
3. **VAPID_PUBLIC** の「コピー」を押して、次の (a) に貼ります。
4. **VAPID_PRIVATE** の「コピー」を押して、(b) の Render の環境変数に貼ります。

(a) GitHub で `firebase-config.js` を開き、鉛筆のマーク（編集）→ `window.VAPID_PUBLIC_KEY = "";` の「 " 」の中に貼る → 「Commit changes」を押す。

(b) Render の環境変数（4 で設定）に、VAPID_PUBLIC と VAPID_PRIVATE を入れる。

### パソコンがある場合
```
node push-server/gen-vapid.js
```
表示された VAPID_PUBLIC を、`firebase-config.js` の `window.VAPID_PUBLIC_KEY` に貼り、VAPID_PUBLIC と VAPID_PRIVATE を Render に入れます。

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
   `plans`（通知を有効にしている人の数）、`sent`（送った数）、`gone`（無効になった端末の数）、`lastErr`（直近のエラー。空が正常）も出ます。

## 5. UptimeRobot（スリープ防止）
1. UptimeRobot（無料・カード不要）→ **New monitor**
2. Monitor Type: **HTTP(s)**、URL: `https://（サービス名）.onrender.com/health`、Monitoring Interval: **5 minutes**

## 6. アプリ側
- 更新したファイル（index.html・sw.js・firebase-config.js・firestore.rules）を、今までどおり公開（GitHub Pages）します。
- ホーム画面のアプリは、開くと自動で更新されます。**ホーム画面に入れ直す必要はありません。**

## 7. 各端末で（1回だけ）
1. ホーム画面のアプリを開き、Google でログイン
2. 通知（ベルのマーク）→ 「プッシュ通知」→ **この端末でオンにする** → 許可
3. **テスト通知** を押すと、30秒ほどで届きます。その下の「前回の送信」に結果が出ます（送信1・失敗0 なら成功）
- 同じ Google アカウントでログインした端末すべてに届きます（端末ごとに一度ずつ「オンにする」を押します）。
- iPhone は、iOS 16.4 以上で、ホーム画面に追加したアプリから開く必要があります。

## 動き
- 今日・明日の提出や予定の内容が **増えた・変わった** ときに、30秒ほどで届きます（時刻の指定はありません）。
- 30秒ごとに、変わったものがないかを確かめます。初めて登録したときは、今ある内容は通知せず覚えるだけです。
- 届かなくなった端末（通知をオフにした、端末を消した）は、自動で登録を消します。

## 注意
- Render の無料枠は、月の通信量を使い切ると、月末まで止まります。
- 無料枠は、アクセスがないと15分ほどでスリープしますが、UptimeRobot が防ぎます。UptimeRobot が止まると、通知も止まります。
- 届く時刻は、30秒ほど遅れることがあります。
- 「今日になった」（期限が日付の変わり目で近づいた）だけでは、アプリを開くまで変化を検知できません。
- 通知を有効にしている人が増えると、Firestore の読み取り回数が増えます（目安：10人程度までは無料枠で足ります）。
- 通知の内容は、その人の端末にだけ届きます（ほかの人には見えません）。

## 17.78.1：通知の診断

届かないときは、アプリの「通知」→「プッシュ通知」の欄にある **「通知の診断」** を開いてください。

- 通知の許可、端末の登録、鍵が一致しているか、サーバーの状態、前回の送信の結果を、上から順に点検します。
- 「×」と「△」が、届かない原因の候補です。
- 下の「送信の記録」には、サーバーが端末ごとに送った結果（送れた、拒否された、登録が無効 など）が新しい順に出ます。
- 「今すぐ送って確かめる」を押すと、約30秒後に結果が更新されます。
- 「コピー」で、診断の内容をそのまま貼って送れます。

この版で必要な作業：

1. Firebase コンソール → Firestore Database → **ルール** に、`firestore.rules` の中身を貼り直して「公開」します（`pushDiag` と、端末の `vk` を許可します）。
2. `firebase-config.js` に `PUSH_SERVER_URL`（送信サーバーのアドレス）が入っていることを確認します。
3. Render で、`push-server` フォルダの `index.js` が更新されるので、再デプロイされたことを確認します（GitHub に反映されると自動で行われます）。
4. アプリで、「この端末でオンにする」を一度押し直します（古い鍵の登録を、新しい鍵に入れ替えるためです）。
