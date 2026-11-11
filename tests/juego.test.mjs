import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MODOS } from '../js/modes/index.js';

// La partida ocupa la pantalla: sin selector Del día/Libre en el juego (vive en
// ajustes), sin el enunciado del clásico y con salida directa a libre al
// terminar la del día. Se fija el contrato para no volver a llenar la vista.
function leer(ruta) {
  return readFileSync(new URL(ruta, import.meta.url), 'utf8');
}

const html = leer('../index.html');
const app = leer('../js/app.js');
const css = leer('../css/app.css');

test('el tipo de partida se elige solo en ajustes', () => {
  const juego = html.match(/<section class="juego"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(juego, 'index.html debe tener la vista de juego');
  assert.doesNotMatch(juego, /segmentos/, 'la barra del juego no lleva Del día/Libre');

  const ajustes = html.match(/<dialog id="dlg-ajustes"[\s\S]*?<\/dialog>/)?.[0] ?? '';
  assert.match(ajustes, /id="seg-partida-aj"/, 'el selector sigue en ajustes');
  assert.doesNotMatch(app, /'#seg-partida'/, 'app.js no busca el selector retirado');
});

test('el clásico no repite el enunciado en partida', () => {
  const cl = MODOS.find((m) => m.id === 'clasico');
  assert.equal(cl.enunciado, false, 'el clásico no muestra la descripción bajo el título');
  assert.ok(
    MODOS.filter((m) => m.id !== 'clasico').every((m) => m.enunciado),
    'los demás modos conservan su enunciado',
  );
  assert.match(app, /el\.pista\.hidden = !hayTexto/, 'la pista se oculta sin texto');
  assert.match(css, /\[data-sin-pista='true'\] \.tablero/, 'el tablero toma el alto libre');
});

test('al terminar la del día se puede seguir en libre desde el cartel', () => {
  assert.match(app, /'Continuar jugando libre'/, 'el fin de partida ofrece seguir en libre');
  assert.match(app, /cambiarAjuste\('partida', 'libre'\)/, 'y arranca la partida libre');
});
