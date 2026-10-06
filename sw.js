// Service worker.
// Strategy (v33): app shell (HTML/JS/CSS) = CACHE-FIRST + silent background refresh (stale-while-revalidate).
// The app therefore opens instantly even on a weak network. When the background refresh finds that a file
// really changed on the server, the page is told (postMessage) and shows an "Update" button - the app never
// reloads by itself in the middle of typing. No version to bump for normal uploads.
// photos & icons = cache-first (their file names are content hashes); fonts = stale-while-revalidate;
// /api/* is NEVER cached (login and member data must always come live from the server).
const VERSION = "v36";
const SHELL_CACHE = "meleri-shell-" + VERSION;
const IMG_CACHE = "meleri-img-" + VERSION;
const FONT_CACHE = "meleri-fonts-v1";
const KEEP = [SHELL_CACHE, IMG_CACHE, FONT_CACHE];

const SHELL = [
  "/style.css", "/manifest.json", "/maharishi.jpg",
  "/js/main.js", "/js/util.js", "/js/i18n.js", "/js/api.js", "/js/auth.js", "/js/views.js", "/js/stats.js", "/js/seva.js",
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

const sig = (r) => r.headers.get("etag") || r.headers.get("content-length") || "";
async function tellClients() {
  const all = await self.clients.matchAll({ type: "window" });
  all.forEach((c) => c.postMessage({ type: "updated" }));
}

// cached copy at once; refresh in the background; tell the page only when the file really changed
async function staleWhileRevalidate(event, cacheName, key, notify) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(key);
  const network = fetch(event.request)
    .then(async (res) => {
      if (res && (res.status === 200 || res.type === "opaque")) {
        if (cached && notify && res.status === 200 && sig(cached) && sig(res) && sig(cached) !== sig(res)) tellClients();
        await cache.put(key, res.clone()); // never cache errors
      }
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
      event.respondWith(staleWhileRevalidate(event, SHELL_CACHE, "/index.html", true));
      return;
    }
    event.respondWith(staleWhileRevalidate(event, SHELL_CACHE, req, true));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(event, FONT_CACHE, req, false));
  }
  // anything else (accounts.google.com ...) is left to the browser
});
