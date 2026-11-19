# 翻訳（iPad「翻訳」アプリ風 PWA）

ビルド不要の静的ファイルだけで動く PWA です（HTML / CSS / JavaScript のみ）。

## 機能
- **AI翻訳（Gemini）**: API キーを設定すると Gemini でストリーミング翻訳（結果が届いた分から順次表示）。思考レベル最小・温度0・入力に追従する 140ms デバウンス・前の通信の自動中断・結果キャッシュで高速化。右下に使用エンジンと所要時間を表示
  - 既定モデル `gemini-3.6-flash`（設定で `gemini-3.8-flash` / `gemini-3.5-flash-lite` などに変更可）
  - 失敗（上限・通信エラー）時は自動で標準翻訳（MyMemory）へ切り替え
- **翻訳**: 21言語、入れ替え、音声入力、読み上げ、拡大表示、お気に入り、コピー、性別の選択
- **カメラ**: AI設定時は Gemini の画像理解で「文字検出＋翻訳＋位置」を1回で取得して映像に重ねて表示（画面が変わらない間は再解析しません）。未設定時は Tesseract.js。シャッターで一時停止、写真読み込み、ライト
- **会話**: 上下分割（上は180°回転）の対面会話
- **お気に入り**: 言語ペアごとの一覧と「最近の項目」
- **Liquid Glass デザイン**: SF Symbols の実測寸法に合わせたアイコン（icons.js：translate / mic は参照画像との一致率 約93%）、ブラー＋彩度のガラス素材、縁のスペキュラハイライト、押下時の弾むスプリング、ライト/ダーク自動追従
- **タブバーのレンズ**: 上部タブバーで選択中のタブを長押しすると、拡大表示のガラスの楕円が現れ、横にスライドして離した位置のタブへ切り替え。レンズは縁で内容を屈折（SVG displacement＋色収差）、速度に応じて液体のように伸縮・傾き、離すとバネで収束。選択ハイライトも水滴のように伸びて移動
- **アニメーション**: 左上のアイコンでサイドバー ⇄ 上部タブバーが滑らかに切り替わる（サイドバーは幅・透明度・ブラーで畳まれ、タブバーが上から降りてくる）。選択ハイライトのスライド、画面切替、カード追加、お気に入りの星、ポップオーバーなど。「視差効果を減らす」設定を尊重
- オフライン起動（Service Worker）

## AI翻訳の設定
1. [Google AI Studio](https://aistudio.google.com/apikey) で API キーを作成
2. アプリ右上「…」→「AI翻訳の設定…」にキーを貼り付けて「接続テスト」→「完了」

> **重要**: 静的サイトのためキーは端末の localStorage に保存され、ブラウザから Google の API へ直接送信されます。公開サイトで使う場合は、AI Studio / Google Cloud のキー設定で **HTTPリファラーを公開URLに制限**してください。キーをリポジトリにコミットしないでください。

## GitHub Pages への公開
1. このフォルダの中身をリポジトリのルートに置いて `main` に push
2. **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする（`.github/workflows/pages.yml` 同梱）。Actions を使わない場合は「Deploy from a branch」→ `main` / `(root)` でも動きます
3. `https://<ユーザー名>.github.io/<リポジトリ名>/` を iPad の Safari で開き、共有ボタン → **ホーム画面に追加**

パスはすべて相対指定なので、サブパス配下でもそのまま動作します。更新を配信するときは `sw.js` の `VERSION` を上げてください。

## Android（APK）
`main` に push（または Actions の「Run workflow」）すると、`.github/workflows/build-apk.yml` が Capacitor で APK を作ります。成果物は Actions の Artifacts（`app-apk`）です。

- **アイコン**: `assets/icon-only.png`（1024×1024）を差し替えるだけで反映されます。`tools/make_android_icons.py` が Android 8 以降のアダプティブアイコン／旧端末用アイコン／起動画面の色を生成します（角が白い角丸正方形の画像でもそのまま使えます）。`@capacitor/assets` は使いません（`icon-only.png` だけだとアダプティブアイコンが Capacitor 既定のまま残るため）。
- **権限**: カメラ・マイクの権限を `tools/patch_android_manifest.py` でマニフェストに追加します。初回のカメラ表示時に許可ダイアログが出ます。拒否した場合は、端末の設定で許可してからシャッターボタンで再試行できます。
- **戻るボタン**: 開いているメニュー／シート／設定 → 会話 → Siri の階層 → 翻訳画面 の順に戻り、最後にアプリを終了します（`@capacitor/app`）。
- **Capacitor はメジャー 8 に固定**しています（9 以降は Node 24 以上などが必要なため、勝手に上がらないようにしています）。上げるときは Node／JDK も合わせて確認してください。
- **端末のデータを残したまま更新するには（推奨）**: デバッグ署名はビルドごとに変わるため、上書きインストールできず、アンインストールすると API キー・履歴・お気に入りも消えます。固定の署名キーを一度だけ作り、GitHub の Secrets に登録してください。
  1. `keytool -genkeypair -v -keystore release.jks -alias translate -keyalg RSA -keysize 2048 -validity 36500`
  2. `base64 -w0 release.jks`（macOS は `base64 -i release.jks`）の出力を Secret `ANDROID_KEYSTORE_BASE64` に登録
  3. Secret `ANDROID_KEYSTORE_PASSWORD`（キーストアのパスワード）と `ANDROID_KEY_ALIAS`（上の例では `translate`）を登録。キーのパスワードを別にした場合のみ `ANDROID_KEY_PASSWORD` も登録
  4. `release.jks` は紛失・流出に注意して保管し、リポジトリにはコミットしないでください。紛失すると同じ署名で更新できなくなります。
  
  Secrets が無い場合は従来どおりデバッグ署名でビルドします。署名を切り替える最初の1回だけ、既存のアプリのアンインストールが必要です。
- `versionCode` はビルド番号（`github.run_number`）で自動的に増えます。

## 注意
- 実際の Gemini API・実機カメラ・音声入力/読み上げはこの環境では未検証です（API 通信はモックで検証）。
- iOS のホーム画面アプリでは Web Speech の音声入力が使えない場合があります（キー入力は可）。
- Apple 公式アプリのオンデバイス翻訳などは Web では再現できないため、見た目と操作を近づけた実装です。
- 履歴・お気に入り・設定は端末の localStorage に保存されます。
