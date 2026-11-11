// Servidor estático para desarrollo. Entrega index.html en cualquier ruta sin
// extensión, igual que la configuración de producción (ver README).
//   node server.mjs [puerto]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('.', import.meta.url));
const PUERTO = Number(process.argv[2] || process.env.PORT || 8080);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const limpia = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const ext = extname(limpia);
  const archivo = ext ? join(RAIZ, limpia) : join(RAIZ, 'index.html');

  try {
    const datos = await readFile(archivo);
    res.writeHead(200, {
      'Content-Type': TIPOS[ext || '.html'] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(datos);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
}).listen(PUERTO, () => console.log(`http://localhost:${PUERTO}`));
