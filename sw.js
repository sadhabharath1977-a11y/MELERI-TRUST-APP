// Service worker. BUMP `VERSION` ON EVERY DEPLOY that changes index.html / style.css / js/*.
// Strategy: app shell = stale-while-revalidate (instant start, refreshed in the background);
// photos & icons = cache-first (their file names are content hashes); fonts = stale-while-revalidate;
// /api/* is NEVER cached (login and member data must always come live from the server).
const VERSION = "v22";
const SHELL_CACHE = "meleri-shell-" + VERSION;
const IMG_CACHE = "meleri-img-" + VERSION;
const FONT_CACHE = "meleri-fonts-v1";
const KEEP = [SHELL_CACHE, IMG_CACHE, FONT_CACHE];

const SHELL = [
  "/style.css", "/manifest.json",
  "/js/main.js", "/js/util.js", "/js/i18n.js", "/js/api.js", "/js/auth.js", "/js/views.js", "/js/stats.js",
  "/icons/icon-192.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })));
      const page = await fetch("/", { cache: "reload" });
      if (page.ok) await cache.put("/index.html", page); // one key for every navigation
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

async function staleWhileRevalidate(event, cacheName, key) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(key);
  const network = fetch(event.request)
    .then((res) => {
      if (res && (res.status === 200 || res.type === "opaque")) cache.put(key, res.clone()); // never cache errors
      return res;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || Response.error();
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request, { cache: "reload" }); // never reuse a stale/failed copy from the HTTP cache
  if (res.status === 200) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/api/")) return; // private data: straight to the network
    if (url.pathname.startsWith("/img/") || url.pathname.startsWith("/icons/")) {
      event.respondWith(cacheFirst(IMG_CACHE, req));
      return;
    }
    if (req.mode === "navigate") {
      event.respondWith(staleWhileRevalidate(event, SHELL_CACHE, "/index.html"));
      return;
    }
    event.respondWith(staleWhileRevalidate(event, SHELL_CACHE, req));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(event, FONT_CACHE, req));
  }
  // anything else (accounts.google.com ...) is left to the browser
});
