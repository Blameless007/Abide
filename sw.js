const CACHE = "abide-shell-v10";

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
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

// Install the latest app files.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => {
        return cache.addAll(
          ASSETS.map(path =>
            new Request(path, { cache: "reload" })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate the new version immediately.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("abide-shell-") &&
              key !== CACHE
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Prefer internet; use cached files when offline.
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request, { cache: "no-cache" })
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
