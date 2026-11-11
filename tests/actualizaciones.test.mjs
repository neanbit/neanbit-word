// El sello que compara `js/actualizador.js` para saber si hay algo publicado
// nuevo. Lo genera `npm run sello`; acá se comprueba que esté al día.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const correr = promisify(execFile);
const SELLO = fileURLToPath(new URL('../tools/sello.mjs', import.meta.url));
const VERSION = fileURLToPath(new URL('../version.json', import.meta.url));

test('version.json tiene la forma que espera el actualizador', async () => {
  const { version, archivos } = JSON.parse(await readFile(VERSION, 'utf8'));
  assert.match(version, /^[0-9a-f]{12}$/);
  assert.equal(typeof archivos, 'number');
  assert.ok(archivos > 0);
});

test('version.json está al día con los archivos publicados', async () => {
  const { stdout } = await correr(process.execPath, [SELLO, '--check']);
  assert.match(stdout, /al día/);
});
