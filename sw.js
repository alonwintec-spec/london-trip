// london-trip service worker — offline shell + map tiles
const SHELL_CACHE = 'ldn-shell-v1';
const TILE_CACHE = 'ldn-tiles-v1';
const ASSET_CACHE = 'ldn-assets-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(c => c.addAll(['./', './index.html', './apple-touch-icon.png'])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => ![SHELL_CACHE, TILE_CACHE, ASSET_CACHE].includes(k)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // map tiles: cache-first, fill cache on the fly
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(e.request).then(hit => hit || fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // fonts + leaflet CDN: cache-first
  if (['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) {
    e.respondWith(
      caches.open(ASSET_CACHE).then(cache =>
        cache.match(e.request).then(hit => hit || fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // live APIs (weather / fx): network only — the page handles failures
  if (url.hostname.includes('open-meteo.com') || url.hostname.includes('frankfurter.dev')) return;

  // app shell: network-first so updates arrive, cache fallback offline
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then(hit => hit || caches.match('./index.html'))
      )
    );
  }
});
