const CACHE_NAME = 'ours-supper-v42';
const APP_SHELL = [
  './', './index.html', './styles.css', './third-pass.css', './life-tools.css', './app-shell.css', './liquid-dock.css', './together-plus.css', './cloud-sync.css', './notification-center.css', './app.js', './config.js', './cloud-config.js',
  './manifest.webmanifest', './menu-extra.js', './store.js', './profile.js', './features.js', './second-pass.js', './third-pass.js', './life-tools.js', './liquid-dock.js', './app-shell.js', './together-plus.js', './cloud-sync.js', './notification-center.js', './assets/icon.svg', './assets/icon-maskable.svg', './assets/pig-icon.jpg', './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-512.png', './assets/apple-touch-icon.png', './assets/favicon-32.png',
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

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const eventId = String(payload.eventId || '').slice(0, 80);
  const category = String(payload.category || 'system').slice(0, 30);
  const targetRoute = String(payload.targetRoute || 'today').replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || 'today';
  const targetAnchor = String(payload.targetAnchor || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 80);
  const title = String(payload.title || 'OURS 有一条新动态').slice(0, 80);
  const body = String(payload.body || '打开 App 查看这次更新。').slice(0, 160);
  const params = new URLSearchParams({ push_event: eventId, push_route: targetRoute, push_anchor: targetAnchor });
  const url = `./?${params.toString()}#/${targetRoute}${targetAnchor ? `/${targetAnchor}` : ''}`;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: './assets/icon-192.png',
    badge: './assets/favicon-32.png',
    tag: eventId ? `ours-${eventId}` : `ours-${category}`,
    renotify: false,
    data: { eventId, route: targetRoute, anchor: targetAnchor, url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = new URL(data.url || './#/today', self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      client.postMessage({
        type: 'OURS_NOTIFICATION_CLICK',
        eventId: data.eventId || '',
        route: data.route || 'today',
        anchor: data.anchor || '',
      });
      if ('focus' in client) {
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach((client) => client.postMessage({ type: 'OURS_PUSH_SUBSCRIPTION_CHANGED' }));
  })());
});
