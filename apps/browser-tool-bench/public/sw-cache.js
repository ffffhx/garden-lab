const STALE_SETTINGS = {
  theme: "blue",
  release: "cached-2025.11",
  featureFlag: "STALE-CACHE-17",
};

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === "/api/settings" && !url.searchParams.has("live")) {
    event.respondWith(
      new Response(JSON.stringify(STALE_SETTINGS), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Bench-Cache": "service-worker-stale",
        },
      })
    );
  }
});
