// public/sw.js

const CACHE_NAME = 'attendance-app-cache-v1';

// ここで、ビルド直後の build/static フォルダにあるファイル名を
// 正確にコピーしてきて貼り付けています。
// ────────────────────────────────────────────────────
// build/
const URLS_TO_CACHE = [
  '/',                   // ルート（index.html を返す）
  '/index.html',         // React アプリのエントリーファイル
  '/favicon.ico',        // アイコン類
  '/logo192.png',
  '/logo512.png',
  '/attendance-icon-192.png',
  '/attendance-icon-512.png',

  // ↓↓ ここから下を、実際に build/static 配下にある名前に置き換え ↓↓

  // build/static/css フォルダ内のファイル名をコピー
  '/static/css/main.29473361.css',      // ← "main.29473361.css" を正確に貼り付け

  // build/static/js フォルダ内のファイル名をコピー
  '/static/js/453.563f0429.chunk.js',   // ← "453.563f0429.chunk.js"
  '/static/js/main.93595463.js'         // ← "main.93595463.js"
  // ※ 今回のキャプチャ上では runtime-main.*.js は見当たりませんでした。
  //    もし build/static/js 配下に "runtime-main.xxxxxxx.js" がある場合は、
  //    下記のように必ず追加してください：
  //    '/static/js/runtime-main.xxxxxxx.js'
];

// 1) インストール時にキャッシュを開き、必要なリソースを登録する
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  // インストール後すぐにアクティブ化
  self.skipWaiting();
});

// 2) アクティベート時に古いキャッシュがあれば削除する
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  // クライアントをコントロール下におく
  self.clients.claim();
});

// 3) フェッチ時には「キャッシュ優先」で返す。キャッシュになければネットワーク取得してキャッシュに追加
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // キャッシュが見つかった → キャッシュを返す
        return cachedResponse;
      }
      // キャッシュにない → ネットワークから取得して返しつつキャッシュに追加
      return fetch(event.request).then((networkResponse) => {
        // GET メソッドかつ正常なレスポンス（200）かつ同一オリジンのリクエストだけキャッシュに保存
        if (
          event.request.method === 'GET' &&
          networkResponse &&
          networkResponse.status === 200 &&
          event.request.url.startsWith(self.location.origin)
        ) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      });
    })
  );
});
