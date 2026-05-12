// ─── SERVICE WORKER — DistriRepuesto JYG ─────────────────────────────────────
const CACHE_NAME = 'distrij-v1';
const OFFLINE_URL = '/Pedido/';

// Archivos a cachear para funcionamiento offline
const PRECACHE = [
  '/Pedido/',
  '/Pedido/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// ── INSTALL: pre-cachear recursos esenciales ──────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cachear la app principal (ignora errores en recursos externos)
      return cache.addAll(PRECACHE).catch(function(e) {
        console.log('SW: algunos recursos no se pudieron cachear', e);
      });
    }).then(function() {
      // Activar inmediatamente sin esperar cierre de pestañas anteriores
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: limpiar caches viejos ──────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      // Controlar todas las pestañas abiertas inmediatamente
      return self.clients.claim();
    })
  );
});

// ── FETCH: Network first, cache fallback ─────────────────────────────────────
self.addEventListener('fetch', function(event) {
  var req = event.request;

  // Solo interceptar GET
  if (req.method !== 'GET') return;

  // Supabase API — siempre network, nunca caché (datos en tiempo real)
  if (req.url.includes('supabase.co')) return;

  // Para la app principal: network first, cache fallback
  event.respondWith(
    fetch(req).then(function(response) {
      // Si la red respondió bien, actualizar caché
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(req, clone);
        });
      }
      return response;
    }).catch(function() {
      // Sin red: servir desde caché
      return caches.match(req).then(function(cached) {
        if (cached) return cached;
        // Última opción: la página principal
        return caches.match(OFFLINE_URL);
      });
    })
  );
});

// ── PUSH NOTIFICATIONS (preparado para futuro) ───────────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;
  var data = event.data.json();
  self.registration.showNotification(data.title || 'DistriRepuesto JYG', {
    body: data.body || '',
    icon: '/Pedido/icons/icon-192.png',
    badge: '/Pedido/icons/icon-72.png'
  });
});
