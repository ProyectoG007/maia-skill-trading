// Service worker (SPEC F6): cachea el "app shell" completo para que la PWA
// abra sin conexión. Sin bundler no hay hash de contenido para invalidar el
// cache automáticamente, así que se versiona a mano: subir CACHE_VERSION cada
// vez que cambie alguno de los archivos precacheados fuerza un cache nuevo
// (el viejo se borra en `activate`).
const CACHE_VERSION = 'v1';
const CACHE_NAME = `radar-shell-${CACHE_VERSION}`;

const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon.svg',
  './src/main.js',
  './src/core/blobs.js',
  './src/core/calibration.js',
  './src/core/crossing.js',
  './src/core/diff.js',
  './src/core/flow.js',
  './src/core/frameLoop.js',
  './src/core/homography.js',
  './src/core/kalman.js',
  './src/core/log.js',
  './src/ui/camera.js',
  './src/ui/controls.js',
  './src/ui/history.js',
  './src/ui/installBanner.js',
  './src/ui/overlay.js',
  './src/ui/readout.js',
  './src/ui/storage.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Cache-first: sirve del cache si está, y si no, va a red y guarda la
// respuesta para la próxima vez (así páginas nuevas visitadas online quedan
// disponibles offline después). Solo intercepta GET del mismo origen — la
// cámara (getUserMedia) no pasa por fetch, así que no la afecta.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok){
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
