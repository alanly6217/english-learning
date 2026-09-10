const CACHE='english-alanly-20260910-learning-v12';
const ASSETS=[
  './','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png',
  './shell-nav.js',
  './vocab.html','./vocab.css','./vocab-directory.css','./vocab-data-1.js','./vocab-data-2.js','./vocab-e02.js','./vocab-e03.js','./vocab-e04.js','./vocab-e05.js','./vocab-e06.js','./vocab-e07.js','./vocab-e08.js','./vocab-e09.js','./vocab-e10.js','./vocab-e11.js','./vocab-e12.js','./vocab-e13.js','./vocab-e14.js','./vocab-e15.js','./vocab-e16.js','./vocab-e17.js','./vocab-e18.js','./vocab-e19.js','./vocab-e20.js','./vocab-e21.js','./vocab-e22.js','./vocab-e23.js','./vocab-e24.js','./vocab-e25.js','./vocab-e26.js','./vocab-e27.js','./vocab-lessons.json','./vocab-app-v2.js','./vocab-app-extend.js',
  './visit.html','./visit.css','./visit-data-1.js','./visit-data-2.js','./visit-app.js'
];
const INDEX_URL=new URL('./index.html',self.location.href).href;
function injectIndex(html){if(html.includes('shell-nav.js'))return html;return html.replace('</body>','<script src="./shell-nav.js"></script></body>')}
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const isIndex=event.request.mode==='navigate'&&(url.pathname.endsWith('/')||url.pathname.endsWith('/index.html'));
  if(isIndex){event.respondWith((async()=>{let response;try{response=await fetch(event.request);if(response.ok){const cache=await caches.open(CACHE);cache.put(INDEX_URL,response.clone()).catch(()=>{})}}catch{}if(!response||!response.ok)response=await caches.match(INDEX_URL);if(!response)return new Response('Offline',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});const headers=new Headers(response.headers);headers.set('content-type','text/html; charset=utf-8');headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');return new Response(injectIndex(await response.text()),{status:response.status,statusText:response.statusText,headers})})());return}
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response&&response.ok&&url.origin===self.location.origin){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{})}return response})))
});
