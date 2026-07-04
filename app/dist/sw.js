const CACHE_NAME = "fuelpro-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/logo-main.png",
  "/logo-small.png",
  "/manifest.json",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  // Cache-first strategy for assets
  if (event.request.method === "GET") {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(response => {
            if (response.status === 200 && response.type === "basic") {
              const clone = response.clone();
              caches
                .open(CACHE_NAME)
                .then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Return offline fallback for HTML
            if (event.request.headers.get("accept")?.includes("text/html")) {
              return caches.match("/index.html");
            }
          });
      })
    );
  }
});
