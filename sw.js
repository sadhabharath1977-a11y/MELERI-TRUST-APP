const CACHE="meleri-trust-offline-v1";
const OFFLINE_ASSETS=["./style.css","./manifest.json","./icon-192.png","./icon-512.png","./maharishi.jpg"];

// Keep authentication pages and JavaScript out of the service-worker cache.
// This prevents an old login bundle from surviving a new Vercel deployment.
self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(OFFLINE_ASSETS)));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET") return;
  const url=new URL(req.url);
  const isSameOrigin=url.origin===self.location.origin;
  const isAppCore=isSameOrigin && (req.mode==="navigate" || url.pathname.endsWith("/app.js") || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/style.css"));

  // Network-first for the app shell, with no cache fallback for auth code.
  if(isAppCore){
    event.respondWith(fetch(req,{cache:"no-store"}));
    return;
  }

  event.respondWith(
    caches.match(req).then(cached=>cached || fetch(req).then(response=>{
      if(isSameOrigin && response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(req,copy));
      }
      return response;
    }))
  );
});
