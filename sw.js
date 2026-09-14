const CACHE='english-alanly-20260914-learning-v15';
const CORE_ASSETS=[
  './','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png',
  './shell-nav.js',
  './vocab.html','./vocab.css','./vocab-directory.css','./vocab-data-1.js','./vocab-data-2.js','./vocab-e02.js','./vocab-e03.js','./vocab-lessons.json','./vocab-app-v2.js','./vocab-app-extend.js',
  './visit.html','./visit.css','./visit-data-1.js','./visit-data-2.js','./visit-app.js'
];
const INDEX_URL=new URL('./index.html',self.location.href).href;
const NETWORK_FIRST_ASSETS=new Set([
  'shell-nav.js','vocab.html','vocab.css','vocab-directory.css','vocab-app-v2.js','vocab-app-extend.js',
  'visit.html','visit.css','visit-app.js'
]);
function injectIndex(html){if(html.includes('shell-nav.js'))return html;return html.replace('</body>','<script src="./shell-nav.js"></script></body>')}
async function networkFirst(request,url){
  const cache=await caches.open(CACHE);
  const canonical=new URL(url.pathname,url.origin).href;
  let response;
  try{
    response=await fetch(request,{cache:'no-store'});
    if(response.ok){await cache.put(canonical,response.clone());return response}
  }catch{}
  return (await cache.match(canonical))||(await caches.match(request,{ignoreSearch:true}))||response;
}
async function cacheCoreAssets(cache){
  const assets=await Promise.all(CORE_ASSETS.map(async url=>{
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw new Error(`Core asset failed: ${url}`);
    return[url,response];
  }));
  await Promise.all(assets.map(([url,response])=>cache.put(url,response)));
}
async function cacheLessonFiles(cache){
  try{
    const response=await fetch('./vocab-lessons.json',{cache:'no-store'});
    if(!response.ok)return;
    const manifest=await response.clone().json();
    await cache.put('./vocab-lessons.json',response);
    const dynamicFiles=[...new Set((Array.isArray(manifest)?manifest:[]).flatMap(x=>[x&&x.file,x&&x.patch]).filter(Boolean))];
    await Promise.all(dynamicFiles.map(async file=>{
      try{const url='./'+file;const r=await fetch(url,{cache:'no-store'});if(r.ok)await cache.put(url,r)}catch{}
    }));
  }catch{}
}
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cacheCoreAssets(cache);await cacheLessonFiles(cache)})());
});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
  const keys=await caches.keys();
  const oldKeys=keys.filter(key=>key!==CACHE);
  await Promise.all(oldKeys.map(key=>caches.delete(key)));
  await self.clients.claim();
  if(oldKeys.length){
    const windows=await self.clients.matchAll({type:'window'});
    await Promise.all(windows.map(client=>client.navigate(client.url).catch(()=>{})));
  }
})())});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const isSameOrigin=url.origin===self.location.origin;
  const isNavigation=isSameOrigin&&event.request.mode==='navigate';
  if(isNavigation){
    event.respondWith((async()=>{
      const isIndex=url.pathname.endsWith('/')||url.pathname.endsWith('/index.html');
      const fallbackUrl=isIndex?INDEX_URL:new URL(url.pathname,url.origin).href;
      const response=await networkFirst(event.request,url)||await caches.match(fallbackUrl);
      if(!response)return new Response('Offline',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
      if(!isIndex)return response;
      const headers=new Headers(response.headers);headers.set('content-type','text/html; charset=utf-8');headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');
      return new Response(injectIndex(await response.text()),{status:response.status,statusText:response.statusText,headers});
    })());return;
  }
  const isManifest=isSameOrigin&&url.pathname.endsWith('/vocab-lessons.json');
  if(isManifest){
    event.respondWith((async()=>{
      try{const response=await fetch(event.request,{cache:'no-store'});if(response.ok){const cache=await caches.open(CACHE);cache.put(event.request,response.clone()).catch(()=>{});cacheLessonFiles(cache).catch(()=>{});return response}}catch{}
      return (await caches.match(event.request))||new Response('[]',{headers:{'content-type':'application/json; charset=utf-8'}});
    })());return;
  }
  const assetName=url.pathname.split('/').pop();
  if(isSameOrigin&&NETWORK_FIRST_ASSETS.has(assetName)){
    event.respondWith(networkFirst(event.request,url));return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response&&response.ok&&isSameOrigin){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{})}
    return response;
  })));
});
