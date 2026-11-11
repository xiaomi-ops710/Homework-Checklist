// Firebaseコンソール「プロジェクトの設定」→「マイアプリ」→ firebaseConfig の値をそのまま貼り付けてください。
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyArdU2rAlH6iOUhEZ7Dfmpw48Pt9Ctb6Os",
  authDomain: "homework-database-23658.firebaseapp.com",
  projectId: "homework-database-23658",
  storageBucket: "homework-database-23658.firebasestorage.app",
  messagingSenderId: "909288674254",
  appId: "1:909288674254:web:ab13a39428e7479b74d19f"
};

// PWA（ホーム画面から開いたとき）のGoogleログインで使う「ウェブクライアントID」。
window.GOOGLE_CLIENT_ID = "909288674254-rdn22g4s7vnnrpaeo95295tjf92cb92q.apps.googleusercontent.com";

// ---- AI質問機能（Firebase AI Logic）----
// 使うモデル名（Firebase AI Logic の対応モデル一覧に載っている名前）。「404」や「not found」が出たら、一覧に合わせて書き換えてください。
window.AI_MODEL = "gemini-3.5-flash-lite";
// 1日にAIへ質問できる回数（この端末）。0 にすると、回数の制限をしません。
window.AI_DAILY_LIMIT = 0;
// App Check（Google Cloud Fraud Defense / reCAPTCHA Enterprise のスコアベースのWebキー）。
// AIへの不正な利用を防ぐために使います。空にすると、App Check は動きません。
window.APPCHECK_SITE_KEY = "6LdUXhEuAAAAAEMIfHe4bVjqNkvFoDRTZ3Ra6vI0";

// ---- プッシュ通知（push-server の gen-vapid.js で作った VAPID_PUBLIC を貼ります。空のままなら、通知の設定は「準備中」になります）----
window.VAPID_PUBLIC_KEY = "";
