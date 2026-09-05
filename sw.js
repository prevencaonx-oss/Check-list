const CACHE='triela-pwa-v1';
const SHELL=['/Check-list/','/Check-list/index.html','/Check-list/app.css','/Check-list/app.js','/Check-list/manifest.webmanifest','/Check-list/icon-192.svg','/Check-list/icon-512.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;
  if(url.pathname.startsWith('/Check-list/') && !url.pathname.includes('/rest/') && !url.pathname.includes('/auth/')){
    event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res;}).catch(()=>caches.match(req).then(r=>r||caches.match('/Check-list/'))));
  }
});
