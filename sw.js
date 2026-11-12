
const CACHE = "abide-shell-v13";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./redesign.css",
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

// Cache the current app files when a new worker is installed.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(
        ASSETS.map(path => new Request(path, { cache: "reload" }))
      ))
  );
});

// Activate only when the page approves it.
self.addEventListener("message", event => {
  if (event.data && event.data.type === "ABIDE_SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key =>
            key.startsWith("abide-shell-") && key !== CACHE
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first while online; use saved files offline.
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Version checks must bypass the app cache.
  if (url.searchParams.has("abide-check")) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
    );
    return;
  }

  event.respondWith(
    fetch(request, { cache: "no-store" })
      .then(response => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE).then(cache =>
            cache.put(request, copy)
          );
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);

        if (cached) return cached;

        if (request.mode === "navigate") {
          return caches.match("./index.html");
        }

        return Response.error();
      })
  );
});
