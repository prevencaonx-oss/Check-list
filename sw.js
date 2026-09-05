const CACHE='triela-pwa-v2';
const SHELL=['/Check-list/','/Check-list/index.html','/Check-list/app.css','/Check-list/app.js','/Check-list/pwa-install.js','/Check-list/manifest.webmanifest','/Check-list/icon-192.svg','/Check-list/icon-512.svg','/Check-list/pwa-offline.html'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin||!url.pathname.startsWith('/Check-list/'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).catch(()=>caches.match('/Check-list/pwa-offline.html')));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;})));
});
