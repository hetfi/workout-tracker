// Service Worker for Workout Tracker PWA
// Caches static assets and provides basic offline support.

const CACHE_NAME = "workout-tracker-v2";

// 静的アセットのみキャッシュ（動的ページは含めない）
const STATIC_ASSETS = [
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip Supabase API calls and Next.js internal requests
  const url = new URL(event.request.url);
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // ナビゲーションリクエスト（HTMLページ）はネットワークファースト
  // → 常に最新データを取得し、オフライン時のみキャッシュにフォールバック
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) =>
          cached ??
          new Response(
            "<html><body><h1>オフライン</h1><p>インターネット接続がありません。接続後に再読み込みしてください。</p></body></html>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          )
        )
      )
    );
    return;
  }

  // 静的アセットはキャッシュファースト
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => new Response("", { status: 503 }));
    })
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow("/home")
  );
});
