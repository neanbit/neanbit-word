import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// La marca de la cabecera es un solo SVG en línea. Se fija el contrato para que
// no vuelva a partirse en dos piezas (un <img> por tinta) ni se separe del
// wordmark oficial que vive en assets/.
function leer(ruta) {
  return readFileSync(new URL(ruta, import.meta.url), 'utf8');
}

const html = leer('../index.html');
const css = leer('../css/app.css');
const oficial = leer('../assets/marca-ondark.svg');

// Compara dibujos ignorando saltos de línea e indentación.
function normalizar(texto) {
  return texto.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
}

function dibujo(svg) {
  return {
    grupo: svg.match(/<g[^>]*>/)?.[0] ?? null,
    piezas: (svg.match(/<(path|rect)\b[^>]*\/?>/g) ?? []).map(normalizar),
  };
}

test('la cabecera muestra una sola marca', () => {
  const marcas = html.match(/<svg class="marca__logo"[\s\S]*?<\/svg>/g) ?? [];
  assert.equal(marcas.length, 1, 'index.html debe tener un único .marca__logo');
  assert.doesNotMatch(html, /marca__logo--/, 'no quedan variantes por tinta');
  assert.doesNotMatch(html, /<img[^>]+assets\/marca-/, 'la cabecera no carga los SVG como <img>');
});

test('el dibujo de la cabecera es el wordmark oficial', () => {
  const enLinea = dibujo(html.match(/<svg class="marca__logo"[\s\S]*?<\/svg>/)[0]);
  const enArchivo = dibujo(
    oficial
      .replace(/^[\s\S]*?<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '')
      .replace('<title>neanbit</title>', '')
      .replace(/fill="#F1F5F9"/g, 'fill="currentColor"'),
  );
  assert.deepEqual(enLinea, enArchivo);
  assert.ok(enLinea.piezas.length >= 3, 'el wordmark tiene al menos tres piezas');
  assert.ok(
    enLinea.piezas.some((p) => p.includes('fill="currentColor"')),
    'las letras toman la tinta del tema',
  );
  assert.ok(
    enLinea.piezas.some((p) => p.includes('fill="#FCA311"')),
    'el cuadradito conserva el ámbar de la marca',
  );
});

test('la tinta de la marca sigue el tema', () => {
  assert.match(css, /:root \{[^}]*--tinta-marca: #14213d/, 'tema claro: tinta oscura');
  assert.match(css, /:root\[data-tema='oscuro'\] \{[^}]*--tinta-marca: #f1f5f9/, 'tema oscuro: tinta clara');
  assert.match(
    css,
    /@media \(prefers-color-scheme: dark\) \{[\s\S]*?:root\[data-tema='auto'\] \{[^}]*?--tinta-marca: #f1f5f9/,
    'automático en sistema oscuro: tinta clara',
  );
  assert.match(css, /\.marca__logo \{[^}]*color: var\(--tinta-marca\)/, 'el SVG hereda la tinta');
});
