self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/')||u.pathname.endsWith('.apk'))return;
 e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open('spark-v1').then(k=>k.put(r,c));return x}).catch(()=>caches.match(r).then(m=>m||caches.match('./index.html'))))});
