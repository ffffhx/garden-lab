/* Garden Lab PWA Service Worker
 * 策略：
 *  - 页面导航：网络优先，失败回退缓存，再回退 offline.html
 *  - /_next/static（带内容哈希，不可变）：缓存优先
 *  - 图片 / 字体 / 文章资源：stale-while-revalidate
 * 所有路径基于 registration scope 解析，兼容 GitHub Pages 的 basePath。
 */

const VERSION = "v1";
const PAGE_CACHE = `gl-pages-${VERSION}`;
const STATIC_CACHE = `gl-static-${VERSION}`;
const ASSET_CACHE = `gl-assets-${VERSION}`;
const KNOWN_CACHES = [PAGE_CACHE, STATIC_CACHE, ASSET_CACHE];

const MAX_PAGE_ENTRIES = 80;
const MAX_ASSET_ENTRIES = 200;

const OFFLINE_URL = new URL("offline.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, self.registration.scope]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("gl-") && !KNOWN_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Cache keys 按插入顺序排列，删最旧的
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      trimCache(PAGE_CACHE, MAX_PAGE_ENTRIES);
    }
    return response;
  } catch (_err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    throw _err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        trimCache(cacheName, maxEntries);
      }
      return response;
    })
    .catch(() => undefined);
  return cached || refresh.then((r) => r || Promise.reject(new Error("offline")));
}

const ASSET_EXT_RE = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|mp3|mp4|webm|json)$/i;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (ASSET_EXT_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE, MAX_ASSET_ENTRIES));
  }
});
