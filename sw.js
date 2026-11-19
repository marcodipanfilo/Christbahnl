// Keeps a copy of the page so it opens without internet.
// Online: loads the latest version (so new prices show up) and saves it.
// Offline or very slow connection: shows the saved copy.

const CACHE = 'christbahnl-v1';
const PAGES = ['./', './index.html'];
const TIMEOUT_MS = 3000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PAGES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    const fromNetwork = fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    });

    const timeout = new Promise(resolve => setTimeout(resolve, TIMEOUT_MS));

    try {
      const response = await Promise.race([fromNetwork, timeout]);
      if (response) return response;
    } catch (error) {
      // Offline: fall through to the saved copy
    }

    const cached = await cache.match(request, { ignoreSearch: true });
    return cached || fromNetwork;
  })());
});
