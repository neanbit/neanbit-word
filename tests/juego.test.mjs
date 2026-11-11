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

  // El botón no pisa el ajuste elegido a mano: cerrar el cartel deja el modo en
  // libre por el resto del día y arranca la palabra nueva.
  assert.doesNotMatch(app, /cambiarAjuste\('partida', 'libre'\)/, 'seguir en libre no cambia el ajuste');
  assert.match(app, /libreAuto\.guardar\(ui\.modo\.id, diaLocal\(\)\)/, 'el modo queda en libre hasta el día siguiente');
  assert.match(app, /continuarAlCerrarResultado/, 'cerrar el cartel de la diaria arranca la libre');
  assert.match(
    app,
    /addEventListener\('close', \(\) => \{[\s\S]*continuarAlCerrarResultado\(\)/,
    'se dispara al cerrar la ventana de fin, sin tocar ningún botón',
  );

  // La salida automática vence al cambiar el día: la diaria vuelve a estar
  // disponible y el modo abre en "Del día".
  assert.match(app, /libreAuto\.cargar\(modoId\) === diaLocal\(\)/, 'el libre automático caduca al día siguiente');
});

test('el fin de partida pone la acción de seguir jugando arriba y ancha', () => {
  const acciones = html.match(/<div class="fin__acciones"[\s\S]*?<\/div>/)?.[0] ?? '';
  const otra = acciones.indexOf('id="btn-otra"');
  const compartir = acciones.indexOf('id="btn-compartir"');
  assert.ok(otra > -1 && compartir > -1, 'el cartel tiene las dos acciones');
  assert.ok(otra < compartir, 'Continuar jugando libre va antes que Compartir');
  assert.match(css, /\.fin__acciones \.boton \{[^}]*width: 100%/, 'los botones ocupan el ancho del cartel');
  assert.match(css, /\.fin__acciones \.boton \{[^}]*min-height: 48px/, 'y tienen alto de toque cómodo');
});
