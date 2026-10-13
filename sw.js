// Service Worker de DistriRepuesto JYG
// - Archivos de la app (mismo origen): red primero, caché si no hay internet.
// - Fotos de Supabase Storage: caché primero (nombres únicos + 1 año), así cada
//   foto se descarga una sola vez por equipo => casi cero egress de Storage.
// - Consultas a la API de Supabase (REST/realtime): NUNCA se tocan ni se guardan.

const CACHE_NAME = 'distrijyg-v3';
const IMG_CACHE = 'distrijyg-img-v1';
const MAX_IMGS = 1500;
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS).catch(function () {});
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME && k !== IMG_CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

function trimImgCache(cache) {
  return cache.keys().then(function (keys) {
    var extra = keys.length - MAX_IMGS;
    if (extra <= 0) return;
    return Promise.all(keys.slice(0, extra).map(function (k) { return cache.delete(k); }));
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Fotos públicas de Storage
  if (url.pathname.indexOf('/storage/v1/object/public/') > -1 && url.hostname.indexOf('supabase.co') > -1) {
    event.respondWith(
      caches.open(IMG_CACHE).then(function (cache) {
        return cache.match(url.href).then(function (hit) {
          if (hit) return hit;
          // Se vuelve a pedir en modo cors para guardar una respuesta legible (no opaca)
          return fetch(url.href, { mode: 'cors', credentials: 'omit' }).then(function (res) {
            if (res && res.ok) {
              cache.put(url.href, res.clone()).then(function () { return trimImgCache(cache); });
            }
            return res;
          });
        });
      }).catch(function () { return fetch(req); })
    );
    return;
  }

  // Cualquier otro origen (API de Supabase, CDN, etc.): no intervenir
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      })
      .catch(function () { return caches.match(req); })
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
