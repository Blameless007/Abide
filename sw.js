
const CACHE = "abide-shell-v15";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./redesign.css",
  "./prayer-controls.css",
  "./audio.css",
  "./records.css",
  "./db.js",
  "./daily-content.js",
  "./app.js",
  "./audio.js",
  "./records.js",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(
        ASSETS.map(path =>
          new Request(path, { cache: "reload" })
        )
      )
    )
  );
});

self.addEventListener("message", event => {
  if(event.data?.type==="ABIDE_SKIP_WAITING"){
    self.skipWaiting();
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("abide-shell-") &&
              key!==CACHE
            )
            .map(key=>caches.delete(key))
        )
      )
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const prayerId=event.notification.data?.prayerId;

  event.waitUntil(
    self.clients.matchAll({
      type:"window",
      includeUncontrolled:true
    }).then(clientList=>{
      for(const client of clientList){
        if("focus" in client){
          client.postMessage({
            type:"ABIDE_OPEN_PRAYER",
            prayerId
          });

          return client.focus();
        }
      }

      return self.clients.openWindow("./");
    })
  );
});

self.addEventListener("fetch", event => {
  const request=event.request;

  if(request.method!=="GET")return;

  const url=new URL(request.url);

  if(url.origin!==self.location.origin)return;

  if(url.searchParams.has("abide-check")){
    event.respondWith(
      fetch(request,{cache:"no-store"})
    );
    return;
  }

  event.respondWith(
    fetch(request,{cache:"no-store"})
      .then(response=>{
        if(response.ok){
          const copy=response.clone();

          caches.open(CACHE).then(cache=>
            cache.put(request,copy)
          );
        }

        return response;
      })
      .catch(async()=>{
        const cached=await caches.match(request);

        if(cached)return cached;

        if(request.mode==="navigate"){
          return caches.match("./index.html");
        }

        return Response.error();
      })
  );
});
