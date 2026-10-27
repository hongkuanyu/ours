const CACHE_NAME = 'ours-supper-v26';
const APP_SHELL = [
  './', './index.html', './styles.css', './third-pass.css', './life-tools.css', './app-shell.css', './liquid-dock.css', './together-plus.css', './cloud-sync.css', './app.js', './config.js', './cloud-config.js',
  './manifest.webmanifest', './menu-extra.js', './store.js', './profile.js', './features.js', './second-pass.js', './third-pass.js', './life-tools.js', './liquid-dock.js', './app-shell.js', './together-plus.js', './cloud-sync.js', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
  './assets/dish-scallop.svg', './assets/dish-pasta.svg', './assets/dish-beef.svg',
  './assets/dish-soup.svg', './assets/dish-dessert.svg', './assets/dish-drink.svg', './assets/dish-custom.svg',
  './assets/photo-01.svg', './assets/photo-02.svg', './assets/photo-03.svg', './assets/photo-04.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  const networkFirst = event.request.mode === 'navigate' || ['script', 'style'].includes(event.request.destination);
  if (networkFirst) {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html'))));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});