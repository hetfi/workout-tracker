// Service Worker for Workout Tracker PWA
// Caches static assets and provides basic offline support.

const CACHE_NAME = "workout-tracker-v1";

const STATIC_ASSETS = [
  "/",
  "/home",
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

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        // Return a minimal offline page for navigation requests
        if (event.request.mode === "navigate") {
          return new Response(
            "<html><body><h1>オフライン</h1><p>インターネット接続がありません。接続後に再読み込みしてください。</p></body></html>",
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }
        return new Response("", { status: 503 });
      });
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
