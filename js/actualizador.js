/**
 * actualizador.js: service worker y versiones.
 *
 * Cloudflare Pages ya devuelve los archivos con revalidación (`_headers`), así
 * que una recarga normal trae lo último. Lo que no cubre es la pestaña que quedó
 * abierta: acá se consulta `version.json` —el sello de `npm run sello`— y, cuando
 * cambia, se ofrece recargar o se recarga sola al salir de la pestaña.
 *
 * Nada de esto borra datos: la partida vive en `localStorage`.
 */

const RUTA_VERSION = '/version.json';
const CONSULTA_MS = 15 * 60 * 1000; // revisión periódica con la pestaña visible
const MINIMO_MS = 20 * 1000;        // entre revisiones seguidas (foco, red, visibilidad)

async function leerVersion() {
  try {
    // El parámetro evita cualquier caché intermedia; el servidor no lo mira.
    const resp = await fetch(`${RUTA_VERSION}?t=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) return null;
    const { version } = await resp.json().catch(() => ({}));
    return typeof version === 'string' && version ? version : null;
  } catch {
    return null; // sin red: se reintenta en la próxima revisión
  }
}

/**
 * @param {object} opciones
 * @param {(version: string) => void} [opciones.alCambiar] se llama una sola vez,
 *   cuando hay una versión nueva y la pestaña está a la vista.
 */
export function vigilarActualizaciones({ alCambiar } = {}) {
  let enUso = null;      // versión con la que se cargó esta página
  let pendiente = false; // hay versión nueva sin aplicar
  let avisado = false;
  let ultima = 0;
  let registro = null;

  // Instalable y con arranque sin conexión. `updateViaCache: 'none'` hace que el
  // navegador nunca reutilice una copia guardada de sw.js.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((r) => { registro = r; })
      .catch(() => {});
  }

  async function revisar({ forzar = false } = {}) {
    if (document.visibilityState !== 'visible') return; // oculta: no se consulta

    const ahora = Date.now();
    if (!enUso) forzar = true; // primera vuelta: hay que fijar la versión de base
    if (!forzar && ahora - ultima < MINIMO_MS) return;
    ultima = ahora;

    registro?.update().catch(() => {}); // el service worker se actualiza aparte

    const publicada = await leerVersion();
    if (!publicada) return; // sin red o sin version.json: se reintenta después
    if (!enUso) { enUso = publicada; return; }
    if (publicada === enUso || avisado) return;

    avisado = true;
    pendiente = true;
    alCambiar?.(publicada);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Al salir de la pestaña no se interrumpe nada: se recarga y vuelve nueva.
      if (pendiente) location.reload();
      return;
    }
    revisar();
  });

  window.addEventListener('online', () => revisar());
  setInterval(() => revisar(), CONSULTA_MS);

  revisar({ forzar: true });
}
