const CACHE_NAME = "fuelpro-v3";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  
  // Network-first strategy for JS modules - always get fresh versions
  if (url.pathname.startsWith("/assets/") && url.pathname.endsWith(".js")) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh version
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Network-first for API calls with proper tRPC error format
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => 
        new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Network error / offline" },
          id: null
        }), { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }
  
  // Default: network first, fallback to cache
  if (event.request.method === "GET") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
