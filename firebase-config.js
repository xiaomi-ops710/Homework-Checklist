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
// 1日にAIへ質問できる回数（この端末）
window.AI_DAILY_LIMIT = 30;
// App Check を使わないので、空のままにします。
window.APPCHECK_SITE_KEY = "";
