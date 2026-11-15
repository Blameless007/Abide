const CACHE = "abide-shell-v16";

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
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    await cache.addAll(
      ASSETS.map(path => new Request(path, { cache: "reload" }))
    );

    // Wait for the app's safe-update process before activating.
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();

    await Promise.all(
      names
        .filter(name =>
          name.startsWith("abide-shell-") && name !== CACHE
        )
        .map(name => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data === "ABIDE_SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Always fetch fresh files for the app's update checker.
  if (url.searchParams.has("abide-check")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(request);

      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }

      return response;

    } catch (error) {
      const cached = await caches.match(request, {
        ignoreSearch: true
      });

      if (cached) return cached;

      if (request.mode === "navigate") {
        const home = await caches.match("./index.html");
        if (home) return home;

        const root = await caches.match("./");
        if (root) return root;
      }

      return new Response(
        "You are offline. This file is not available in the saved app cache.",
        {
          status: 503,
          statusText: "Offline"
        }
      );
    }
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        client.postMessage({
          type: "ABIDE_OPEN_PRAYER"
        });
        return;
      }
    }

    const client = await self.clients.openWindow("./");

    if (client) {
      client.postMessage({
        type: "ABIDE_OPEN_PRAYER"
      });
    }
  })());
});
