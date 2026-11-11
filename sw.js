// Red primero, caché de respaldo: con conexión siempre se ve la última versión
// publicada y, sin conexión, se abre lo último que se cargó.
//
// No hace falta vaciar la caché en cada deploy: cada respuesta de red reemplaza
// la copia guardada y `_headers` fuerza la revalidación (si no, el navegador
// podría devolver JS de hasta 4 horas atrás). El nombre del caché solo cambia si
// cambia la estrategia; las versiones viejas se borran al activarse este worker.
const CACHE = 'nbw-v4';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  // `version.json` lo consulta el actualizador: se pide sin caché y no se guarda
  // (cada consulta lleva un parámetro distinto, así que llenaría el caché).
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname === '/sw.js' || url.pathname === '/version.json') return;

  e.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          // Las rutas (/clasico, /futbol...) comparten el mismo index.html.
          const clave = request.mode === 'navigate' ? '/index.html' : request;
          caches.open(CACHE).then((c) => c.put(clave, copia));
        }
        return resp;
      })
      .catch(async () => {
        const c = await caches.open(CACHE);
        return (await c.match(request.mode === 'navigate' ? '/index.html' : request)) || Response.error();
      }),
  );
});
