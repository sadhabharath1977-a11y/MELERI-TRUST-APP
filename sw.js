const CACHE='meleri-trust-v16';
const ASSETS=['./','./index.html','./style.css','./app.js','./manifest.json','./icon-192.png','./icon-512.png','./maharishi.jpg'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  const isCore = req.destination==='document' || req.url.endsWith('.css') || req.url.endsWith('.js');
  if(isCore){
    e.respondWith(
      fetch(req).then(res=>{
        caches.open(CACHE).then(c=>c.put(req,res.clone()));
        return res;
      }).catch(()=>caches.match(req))
    );
  } else {
    e.respondWith(caches.match(req).then(r=>r||fetch(req)));
  }
});
