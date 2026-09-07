const CACHE='triela-pwa-v12';
const SHELL=['/Check-list/','/Check-list/index.html','/Check-list/app.css','/Check-list/app.js','/Check-list/app14.css','/Check-list/app15.css','/Check-list/app16.css','/Check-list/app17.css','/Check-list/app18.css','/Check-list/app19.css','/Check-list/app20.css','/Check-list/app21.css','/Check-list/app26.js','/Check-list/app30.js','/Check-list/app31.js','/Check-list/app32.js','/Check-list/app33.js','/Check-list/app34.js','/Check-list/app35.js','/Check-list/app36.js','/Check-list/triela-mark.svg','/Check-list/pwa-install.js','/Check-list/manifest.webmanifest','/Check-list/icon-192.svg','/Check-list/icon-512.svg','/Check-list/pwa-offline.html'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==location.origin||!url.pathname.startsWith('/Check-list/'))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{if(res&&res.ok)caches.open(CACHE).then(c=>c.put('/Check-list/index.html',res.clone()));return res;}).catch(()=>caches.match('/Check-list/index.html').then(r=>r||caches.match('/Check-list/pwa-offline.html'))));return;
  }
  const freshAsset=/\.(?:js|css|svg|webmanifest)$/.test(url.pathname);
  if(freshAsset){event.respondWith(fetch(req).then(res=>{if(res&&res.ok)caches.open(CACHE).then(c=>c.put(req,res.clone()));return res;}).catch(()=>caches.match(req)));return;}
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res&&res.ok)caches.open(CACHE).then(c=>c.put(req,res.clone()));return res;})));
});
