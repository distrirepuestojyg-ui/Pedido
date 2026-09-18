// Service Worker de DistriRepuesto JYG
// Necesario para que el navegador considere la app "instalable" (PWA)

const CACHE_NAME = 'distrijyg-v1';
const ASSETS = [
  './index.html',
  './manifest.json'
];

// Instalación: guarda en caché los archivos básicos
self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS).catch(function () {
        // Si algún archivo falla, no bloquea la instalación
      });
    })
  );
});

// Activación: limpia cachés viejos de versiones anteriores
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: intenta red primero, si falla usa caché (para que funcione offline básico)
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(function (res) {
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, resClone);
        });
        return res;
      })
      .catch(function () {
        return caches.match(event.request);
      })
  );
});

// ── Notificaciones push ──────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  var title = data.title || 'DistriRepuesto JYG';
  var options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-128.png',
    data: data.url || './index.html'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || './index.html')
  );
});
