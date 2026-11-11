/**
 * sello.mjs: genera `version.json`, la marca que usa `js/actualizador.js` para
 * saber si hay una versión nueva publicada.
 *
 *   npm run sello                  escribe version.json
 *   node tools/sello.mjs --check   falla si version.json quedó viejo
 *
 * El número es el hash de los archivos que llegan al navegador: si cambia algo
 * publicado, cambia el sello. `npm test` lo verifica (script `pretest`), así que
 * no se puede pushear un cambio sin actualizarlo.
 *
 * Sin build: version.json se versiona en el repo y se publica tal cual.
 */
import { createHash } from 'node:crypto';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'version.json');

// Lo mismo que se publica: ver `.assetsignore`. Si se suma una carpeta o un
// archivo nuevo al despliegue, agregarlo acá.
const CARPETAS = ['assets', 'css', 'js'];
const ARCHIVOS = ['index.html', 'manifest.webmanifest', 'sw.js', '_headers'];

async function listar(carpeta) {
  const salida = [];
  for (const entrada of await readdir(join(RAIZ, carpeta), { withFileTypes: true })) {
    const ruta = `${carpeta}/${entrada.name}`;
    if (entrada.isDirectory()) salida.push(...(await listar(ruta)));
    else if (entrada.isFile()) salida.push(ruta);
  }
  return salida;
}

async function existe(ruta) {
  try {
    await access(join(RAIZ, ruta));
    return true;
  } catch {
    return false;
  }
}

async function calcular() {
  const rutas = [];
  for (const carpeta of CARPETAS) rutas.push(...(await listar(carpeta)));
  for (const archivo of ARCHIVOS) if (await existe(archivo)) rutas.push(archivo);

  // Orden fijo (por código, no por idioma): el mismo contenido da el mismo hash.
  rutas.sort();

  const hash = createHash('sha256');
  for (const ruta of rutas) {
    hash.update(ruta).update('\0');
    hash.update(await readFile(join(RAIZ, ruta))).update('\0');
  }

  return { version: hash.digest('hex').slice(0, 12), archivos: rutas.length };
}

async function leerSello() {
  try {
    const { version } = JSON.parse(await readFile(SALIDA, 'utf8'));
    return typeof version === 'string' ? version : null;
  } catch {
    return null;
  }
}

const { version, archivos } = await calcular();

if (process.argv.includes('--check')) {
  const actual = await leerSello();
  if (actual === version) {
    console.log(`version.json al día (${version}, ${archivos} archivos)`);
  } else {
    console.error(
      `version.json viejo: tiene ${actual ?? 'nada'} y corresponde ${version}.\n` +
        'Corré "npm run sello" y volvé a commitear: sin eso, las pestañas abiertas no se enteran del cambio.',
    );
    process.exit(1);
  }
} else {
  await writeFile(SALIDA, `${JSON.stringify({ version, archivos }, null, 2)}\n`);
  console.log(`version.json → ${version} (${archivos} archivos)`);
}
