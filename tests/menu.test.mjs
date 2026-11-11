import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// El menú de juegos dejó de ser una barra fija debajo de la cabecera: ahora es un
// desplegable que abre el botón de la izquierda del logo. Se fija el contrato para
// que no vuelvan las dos navegaciones a la vez ni un panel sin accesibilidad.
function leer(ruta) {
  return readFileSync(new URL(ruta, import.meta.url), 'utf8');
}

const html = leer('../index.html');
const css = leer('../css/app.css');
const app = leer('../js/app.js');

test('la cabecera tiene el botón del menú a la izquierda de la marca', () => {
  const cabecera = html.match(/<header class="cabecera">[\s\S]*?<\/header>/)?.[0] ?? '';
  assert.ok(cabecera, 'index.html debe tener la cabecera');
  assert.doesNotMatch(html, /<nav class="nav"/, 'no queda la barra de navegación vieja');

  const izq = cabecera.match(/<div class="cabecera__izq">([\s\S]*?)<\/div>/)?.[1] ?? '';
  const boton = izq.indexOf('id="btn-menu"');
  const marca = izq.indexOf('class="marca"');
  assert.ok(boton !== -1, 'el botón del menú vive en la cabecera');
  assert.ok(marca !== -1 && boton < marca, 'el botón va antes del logo');
});

test('el desplegable declara su estado y no recibe foco cerrado', () => {
  const boton = html.match(/<button[^>]*id="btn-menu"[^>]*>/)?.[0] ?? '';
  const panel = html.match(/<nav[^>]*id="menu-panel"[^>]*>/)?.[0] ?? '';
  assert.match(boton, /aria-expanded="false"/, 'arranca cerrado');
  assert.match(boton, /aria-controls="menu-panel"/, 'el botón apunta al panel');
  assert.match(panel, /\binert\b/, 'cerrado no se puede tabular dentro');
});

test('la interfaz arma los ítems del menú y lo abre y cierra', () => {
  assert.match(app, /className = 'menu__item'/, 'los ítems se generan con la clase del menú');
  assert.match(app, /el\.menu\.dataset\.abierto = 'true'/, 'abrir marca el panel como abierto');
  assert.match(app, /el\.menuPanel\.inert = false/, 'abrir habilita el foco');
  assert.match(app, /el\.menuPanel\.inert = true/, 'cerrar lo deshabilita');
  assert.match(css, /\.menu\[data-abierto='true'\] \.menu__panel/, 'el panel se anima al abrir');
  assert.match(css, /\.menu__item \{[\s\S]*?opacity: 0/, 'los ítems entran animados');
});
