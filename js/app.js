/**
 * app.js: controlador de la interfaz.
 *
 * Una sola app, varios juegos. La ruta decide qué se ve:
 *   /            inicio, con el estado de hoy de cada juego
 *   /<id>        el juego con ese id (ver js/modes/index.js)
 */

import { MARCA, LANZAMIENTO } from './config.js';
import {
  ESTADO, normalizar, evaluar, estadosTeclado, diaLocal, indiceDelDia, numeroDelDia,
  validarDificil, actualizarConstancia, constanciaVigente, rachaVigente,
} from './engine.js';
import { ajustes as almacenAjustes, partidas, estadisticas, constancia, libreAuto, claveVisto } from './store.js';
import { MODOS, obtenerModo } from './modes/index.js';
import { PROXIMAMENTE } from './modes/proximamente.js';
import { vigilarActualizaciones } from './actualizador.js';

/* ---------- Utilidades ---------- */
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const DIA_INICIAL = diaLocal(new Date(LANZAMIENTO.anio, LANZAMIENTO.mes - 1, LANZAMIENTO.dia));
const MENSAJES_VICTORIA = ['De una', 'Impresionante', 'Muy bien', 'Bien', 'Justo', 'Por poco', 'Raspando'];

const ICONOS = {
  borrar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 5H9l-6 7 6 7h12z"/><path d="m13 9 4 6m0-6-4 6"/></svg>',
  inicio: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg>',
  ir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
};

const fechaLarga = (d = new Date()) =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);

/* ---------- Estado ---------- */
const ui = {
  ajustes: almacenAjustes.cargar(),
  modo: null,
  tipo: 'diaria',     // 'diaria' | 'libre'
  partida: null,      // { secreta, pista, intentos[], resultado, dia }
  actual: '',         // lo que se está escribiendo en la fila activa
  ocupado: false,     // true mientras se animan las fichas
  cuenta: null,       // intervalo de la cuenta regresiva
  vista: 'inicio',
  menuAbierto: false, // el desplegable de juegos
};

const el = {
  inicio: $('#vista-inicio'),
  juego: $('#vista-juego'),
  nav: $('#menu-lista'),
  menu: $('#menu'),
  menuPanel: $('#menu-panel'),
  fondo: $('#menu-fondo'),
  btnMenu: $('#btn-menu'),
  tablero: $('#tablero'),
  teclado: $('#teclado'),
  pista: $('#pista'),
  avisos: $('#avisos'),
  titulo: $('#juego-titulo'),
  sub: $('#juego-sub'),
};

/* ==========================================================================
   Ajustes
   ========================================================================== */
/* El tipo de partida sale del ajuste elegido a mano (Del día/Libre) y, además,
   de la salida automática a libre de ese modo: terminada la diaria y cerrado el
   cartel, el modo sigue en libre el resto del día. Al día siguiente el registro
   vence solo y la diaria vuelve a estar disponible. */
function tipoDePartida(modoId) {
  if (!modoId) return ui.ajustes.partida;
  if (ui.ajustes.partida === 'libre') return 'libre';
  return libreAuto.cargar(modoId) === diaLocal() ? 'libre' : 'diaria';
}

function refrescarTipo() {
  ui.tipo = tipoDePartida(ui.modo?.id);
  return ui.tipo;
}

function aplicarAjustes() {
  const raiz = document.documentElement;
  raiz.dataset.tema = ui.ajustes.tema;
  raiz.dataset.contraste = String(ui.ajustes.contraste);
  refrescarTipo();

  $('#aj-estricto').checked = ui.ajustes.estricto;
  $('#aj-contraste').checked = ui.ajustes.contraste;
  $('#aj-dificil').checked = ui.ajustes.dificil;
  marcarSegmento('#seg-tema', 'tema', ui.ajustes.tema);
  marcarSegmento('#seg-partida-aj', 'partida', ui.ajustes.partida);

  if (ui.modo) $('#nota-estricto').hidden = ui.modo.tieneValidacion;

  // El modo difícil solo se puede activar antes de la primera jugada.
  const empezada = ui.vista === 'juego' && ui.partida && ui.partida.resultado === 'jugando' && ui.partida.intentos.length > 0;
  const bloquear = empezada && !ui.ajustes.dificil;
  $('#aj-dificil').disabled = bloquear;
  $('#nota-dificil').hidden = !bloquear;
}

function marcarSegmento(selector, atributo, valor) {
  $$(`${selector} button`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[atributo] === valor)));
}

function cambiarAjuste(clave, valor) {
  ui.ajustes = { ...ui.ajustes, [clave]: valor };
  almacenAjustes.guardar(ui.ajustes);
  // Elegir Del día o Libre a mano manda sobre la salida automática de los modos.
  if (clave === 'partida') MODOS.forEach((m) => libreAuto.borrar(m.id));
  aplicarAjustes();
  if (clave === 'partida' && ui.vista === 'juego') iniciarPartida();
}

/* ==========================================================================
   Rutas
   ========================================================================== */
function idDeLaRuta() {
  return location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0].toLowerCase();
}

function mostrarRuta() {
  cerrarMenu();
  const id = idDeLaRuta();
  if (!id) return mostrarInicio();
  if (obtenerModo(id)) return activarModo(id);
  history.replaceState(null, '', '/');
  mostrarInicio();
}

function ir(destino) {
  if (destino === location.pathname) return;
  history.pushState(null, '', destino);
  mostrarRuta();
  window.scrollTo(0, 0);
}

function enlaceInterno(e) {
  const a = e.target.closest('a[data-link]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  ir(a.getAttribute('href'));
}

/* ==========================================================================
   Menú de juegos (desplegable de la cabecera)
   ========================================================================== */
function estadoDeHoy(modo) {
  const p = partidas.cargar(modo.id, 'diaria');
  if (!p || p.dia !== diaLocal()) return { estado: 'nueva', partida: null };
  if (p.resultado === 'jugando') return { estado: p.intentos.length ? 'jugando' : 'nueva', partida: p };
  return { estado: p.resultado, partida: p };
}

const ESTADO_EN_MENU = { nueva: 'Sin jugar', jugando: 'En curso', ganada: 'Resuelto', perdida: 'Sin suerte' };

function construirNav() {
  el.nav.innerHTML = '';
  const inicio = document.createElement('a');
  inicio.className = 'menu__item';
  inicio.href = '/';
  inicio.dataset.link = '';
  inicio.dataset.ruta = '';
  inicio.style.setProperty('--retraso', '0ms');
  inicio.innerHTML = `<span class="menu__icono">${ICONOS.inicio}</span>`
    + '<span class="menu__texto"><span class="menu__nombre">Inicio</span>'
    + '<span class="menu__nota">Los de hoy</span></span>';
  el.nav.append(inicio);

  MODOS.forEach((m, i) => {
    const a = document.createElement('a');
    a.className = 'menu__item';
    a.href = `/${m.id}`;
    a.dataset.link = '';
    a.dataset.ruta = m.id;
    a.style.setProperty('--retraso', `${(i + 1) * 26}ms`);
    a.innerHTML = '<span class="menu__icono"><i class="bit"></i></span>'
      + '<span class="menu__texto"><span class="menu__nombre"></span>'
      + '<span class="menu__nota"></span></span>'
      + '<span class="menu__estado"></span>';
    $('.menu__nombre', a).textContent = m.nombre;
    $('.menu__nota', a).textContent = m.seccion;
    el.nav.append(a);
  });
}

function renderNav() {
  const actual = ui.vista === 'inicio' ? '' : ui.modo.id;
  $$('.menu__item', el.nav).forEach((a) => {
    if (a.dataset.ruta === actual) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');

    const modo = obtenerModo(a.dataset.ruta);
    if (!modo) return;
    const estado = estadoDeHoy(modo).estado;
    $('.bit', a).dataset.estado = estado;
    const etiqueta = $('.menu__estado', a);
    etiqueta.textContent = ESTADO_EN_MENU[estado] || '';
    etiqueta.dataset.estado = estado;
  });
}

function abrirMenu({ foco = false } = {}) {
  if (ui.menuAbierto) return;
  ui.menuAbierto = true;
  renderNav();
  el.menu.dataset.abierto = 'true';
  el.menuPanel.inert = false;
  el.btnMenu.setAttribute('aria-expanded', 'true');
  el.btnMenu.setAttribute('aria-label', 'Cerrar menú');
  if (foco) requestAnimationFrame(() => $('.menu__item', el.nav)?.focus());
}

function cerrarMenu({ foco = false } = {}) {
  if (!ui.menuAbierto) return;
  ui.menuAbierto = false;
  el.menu.dataset.abierto = 'false';
  el.menuPanel.inert = true;
  el.btnMenu.setAttribute('aria-expanded', 'false');
  el.btnMenu.setAttribute('aria-label', 'Abrir menú');
  if (foco) el.btnMenu.focus();
}

// Con el menú abierto, Tab y Shift+Tab circulan por los ítems del panel.
function atraparFoco(e) {
  const items = $$('.menu__item', el.nav);
  if (!items.length) return;
  const i = items.indexOf(document.activeElement);
  if (i === -1) {
    e.preventDefault();
    items[0].focus();
  } else if (e.shiftKey && i === 0) {
    e.preventDefault();
    items[items.length - 1].focus();
  } else if (!e.shiftKey && i === items.length - 1) {
    e.preventDefault();
    items[0].focus();
  }
}

/* ==========================================================================
   Inicio
   ========================================================================== */
function mostrarInicio() {
  clearInterval(ui.cuenta);
  ui.vista = 'inicio';
  ui.modo = null;
  document.title = `${MARCA.nombre} ▪ word`;
  document.documentElement.style.setProperty('--acento', '#6c8cff');
  el.juego.hidden = true;
  el.inicio.hidden = false;
  renderInicio();
  renderNav();
}

function miniResultado(partida) {
  if (!partida || !partida.intentos.length) return '';
  const filas = partida.intentos
    .map((i) => `<div>${evaluar(i, partida.secreta).map((e) => `<i data-e="${e}"></i>`).join('')}</div>`)
    .join('');
  return `<div class="mini" aria-hidden="true">${filas}</div>`;
}

function textoEstado(modo, estado, partida) {
  if (estado === 'ganada') return `Resuelto en ${partida.intentos.length} de ${modo.intentos}`;
  if (estado === 'perdida') return 'No salió. Mañana hay otra';
  if (estado === 'jugando') return `En curso, ${partida.intentos.length} de ${modo.intentos}`;
  return 'Sin jugar';
}

function renderInicio() {
  const hoy = diaLocal();
  $('#inicio-fecha').textContent = fechaLarga();

  const estados = MODOS.map((m) => ({ modo: m, ...estadoDeHoy(m) }));
  const hechos = estados.filter((x) => x.estado === 'ganada' || x.estado === 'perdida').length;

  $('#inicio-bits').innerHTML = estados
    .map((x) => `<i data-hecho="${x.estado === 'ganada' || x.estado === 'perdida'}"></i>`)
    .join('');
  $('#inicio-progreso').textContent = hechos === MODOS.length
    ? 'Completaste todos los de hoy'
    : `${hechos} de ${MODOS.length} completados`;

  const dias = constanciaVigente(constancia.cargar(), hoy);
  $('#inicio-constancia').textContent = dias > 0
    ? `${dias} ${dias === 1 ? 'día seguido' : 'días seguidos'} jugando`
    : 'Terminá un juego del día para empezar tu constancia';

  $('#tarjetas').innerHTML = '';
  for (const { modo, estado, partida } of estados) {
    const a = document.createElement('a');
    a.className = 'tarjeta';
    a.href = `/${modo.id}`;
    a.dataset.link = '';
    a.style.setProperty('--acento', modo.acento);
    a.innerHTML = `
      <span class="tarjeta__tema"></span>
      <span class="tarjeta__nombre"></span>
      <span class="tarjeta__desc"></span>
      <span class="tarjeta__estado" data-estado="${estado}"></span>
      <span class="tarjeta__lado">${miniResultado(partida) || `<span class="tarjeta__ir">${ICONOS.ir}</span>`}</span>`;
    $('.tarjeta__tema', a).textContent = modo.seccion;
    $('.tarjeta__nombre', a).textContent = modo.nombre;
    $('.tarjeta__desc', a).textContent = modo.descripcion;
    $('.tarjeta__estado', a).textContent = textoEstado(modo, estado, partida);
    $('#tarjetas').append(a);
  }

  $('#lista-proximas').innerHTML = PROXIMAMENTE
    .map((x) => `<li><b>${x.nombre}</b><span>${x.nota}</span></li>`)
    .join('');
}

/* ==========================================================================
   Juego
   ========================================================================== */
function activarModo(id) {
  ui.vista = 'juego';
  ui.modo = obtenerModo(id);
  refrescarTipo();
  document.documentElement.style.setProperty('--acento', ui.modo.acento);
  document.title = `${ui.modo.nombre} · ${MARCA.nombre}`;
  el.inicio.hidden = true;
  el.juego.hidden = false;
  el.titulo.textContent = ui.modo.nombre;

  construirTeclado();
  $('#nota-estricto').hidden = ui.modo.tieneValidacion;
  iniciarPartida();
  mostrarAyudaUnaVez();
}

function mostrarAyudaUnaVez() {
  try {
    if (localStorage.getItem(claveVisto)) return;
    localStorage.setItem(claveVisto, '1');
    abrir('#dlg-ayuda');
  } catch { /* sin storage */ }
}

function elegirRespuesta(dia) {
  const { respuestas, id } = ui.modo;
  if (ui.tipo === 'diaria') return respuestas[indiceDelDia(id, respuestas.length, dia, DIA_INICIAL)];
  return respuestas[Math.floor(Math.random() * respuestas.length)];
}

function iniciarPartida({ forzarNueva = false } = {}) {
  clearInterval(ui.cuenta);
  const hoy = diaLocal();
  let p = forzarNueva ? null : partidas.cargar(ui.modo.id, ui.tipo);

  // La del día vence con el día; la libre, al terminarse y pedir otra.
  if (p && ui.tipo === 'diaria' && p.dia !== hoy) p = null;
  // Si la lista del modo cambió y la respuesta ya no existe, se descarta.
  if (p && !ui.modo.respuestas.some((r) => r.palabra === p.secreta)) p = null;
  // Partidas guardadas antes de este cambio no tienen la forma con tilde.
  if (p && !p.original) {
    p.original = ui.modo.respuestas.find((r) => r.palabra === p.secreta)?.original || p.secreta;
  }

  if (!p) {
    const r = elegirRespuesta(hoy);
    p = {
      secreta: r.palabra,
      original: r.original || r.palabra,
      pista: r.pista,
      intentos: [],
      resultado: 'jugando',
      dia: hoy,
    };
    partidas.guardar(ui.modo.id, ui.tipo, p);
  }

  ui.partida = p;
  ui.actual = '';
  ui.ocupado = false;
  renderTodo();
}

function guardar() {
  partidas.guardar(ui.modo.id, ui.tipo, ui.partida);
}

/* ---------- Render ---------- */
function renderTodo() {
  renderEncabezado();
  renderPista();
  renderTablero();
  renderTeclado();
  renderNav();
  aplicarAjustes();
}

function renderEncabezado() {
  const terminadaLibre = ui.tipo === 'libre' && ui.partida.resultado !== 'jugando';
  if (terminadaLibre) {
    el.sub.innerHTML = '<button class="enlace" type="button" data-otra>Otra palabra</button>';
  } else if (ui.tipo === 'diaria') {
    el.sub.textContent = `Nº ${numeroDelDia(diaLocal(), DIA_INICIAL)} · ${fechaLarga()}`;
  } else {
    el.sub.textContent = 'Práctica libre';
  }
}

function renderPista() {
  const { pista, secreta } = ui.partida;
  const largo = Array.from(secreta).length;

  // Sin pista ni enunciado (el clásico) el bloque se saca de la vista y el
  // tablero ocupa ese alto.
  const hayTexto = Boolean(pista) || ui.modo.enunciado;
  el.pista.hidden = !hayTexto;
  el.juego.dataset.sinPista = String(!hayTexto);
  if (!hayTexto) {
    el.pista.textContent = '';
    el.pista.title = '';
    return;
  }

  if (pista) {
    el.pista.innerHTML = '<b>Pista</b><span></span>';
    $('span', el.pista).textContent = pista;
  } else {
    el.pista.textContent = ui.modo.descripcion;
  }
  el.pista.title = `${largo} ${ui.modo.teclado.unidad.plural}`;
}

function renderTablero() {
  const { secreta, intentos } = ui.partida;
  const cols = Array.from(secreta).length;
  const filas = ui.modo.intentos;

  el.tablero.style.setProperty('--cols', cols);
  el.tablero.style.setProperty('--filas', filas);
  el.tablero.innerHTML = '';

  for (let f = 0; f < filas; f++) {
    const fila = document.createElement('div');
    fila.className = 'fila';
    fila.setAttribute('role', 'row');
    const estados = f < intentos.length ? evaluar(intentos[f], secreta) : null;
    const letras = f < intentos.length ? Array.from(intentos[f]) : [];
    for (let c = 0; c < cols; c++) {
      const ficha = document.createElement('div');
      ficha.className = 'ficha';
      ficha.setAttribute('role', 'gridcell');
      if (estados) {
        ficha.textContent = letras[c];
        ficha.dataset.letra = letras[c];
        ficha.dataset.estado = estados[c];
        ficha.setAttribute('aria-label', `${letras[c]}, ${estados[c]}`);
      }
      fila.append(ficha);
    }
    el.tablero.append(fila);
  }
  pintarFilaActual();
}

function filaDom(indice) {
  return el.tablero.children[indice];
}

function pintarFilaActual() {
  if (ui.partida.resultado !== 'jugando') return;
  const fila = filaDom(ui.partida.intentos.length);
  if (!fila) return;
  const letras = Array.from(ui.actual);
  [...fila.children].forEach((ficha, i) => {
    const l = letras[i] || '';
    ficha.textContent = l;
    if (l) ficha.dataset.letra = l;
    else delete ficha.dataset.letra;
  });
}

/* ---------- Teclado en pantalla ---------- */
function construirTeclado() {
  const { filas } = ui.modo.teclado;
  el.teclado.innerHTML = '';
  el.teclado.dataset.tipo = ui.modo.teclado.alfabeto.has('0') ? 'numeros' : 'letras';

  for (const fila of filas) {
    const div = document.createElement('div');
    div.className = 'teclado__fila';
    for (const k of fila) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tecla';
      b.dataset.tecla = k;
      if (k === 'ENTER') {
        b.textContent = 'Enter';
        b.classList.add('tecla--ancha');
        b.setAttribute('aria-label', 'Enviar');
      } else if (k === 'BORRAR') {
        b.innerHTML = ICONOS.borrar;
        b.classList.add('tecla--ancha');
        b.setAttribute('aria-label', 'Borrar');
      } else {
        b.textContent = k;
      }
      div.append(b);
    }
    el.teclado.append(div);
  }
}

function renderTeclado() {
  const mapa = estadosTeclado(ui.partida.intentos, ui.partida.secreta);
  $$('.tecla[data-tecla]').forEach((b) => {
    const e = mapa.get(b.dataset.tecla);
    if (e) b.dataset.estado = e;
    else delete b.dataset.estado;
  });
}

/* ==========================================================================
   Entrada
   ========================================================================== */
function aviso(texto, ms = 1800) {
  const d = document.createElement('div');
  d.className = 'aviso';
  d.textContent = texto;
  d.style.animationDelay = `0s, ${Math.max(0, ms - 300) / 1000}s`;
  el.avisos.prepend(d);
  setTimeout(() => d.remove(), ms + 300);
}

function sacudir(fila) {
  fila.classList.remove('sacudir');
  void fila.offsetWidth; // reinicia la animación
  fila.classList.add('sacudir');
  fila.addEventListener('animationend', () => fila.classList.remove('sacudir'), { once: true });
}

function escribir(c) {
  if (ui.ocupado || ui.partida.resultado !== 'jugando') return;
  const cols = Array.from(ui.partida.secreta).length;
  if (Array.from(ui.actual).length >= cols) return;
  ui.actual += c;
  pintarFilaActual();
  const ficha = filaDom(ui.partida.intentos.length)?.children[Array.from(ui.actual).length - 1];
  if (ficha) {
    ficha.classList.remove('pop');
    void ficha.offsetWidth;
    ficha.classList.add('pop');
  }
}

function borrar() {
  if (ui.ocupado || ui.partida.resultado !== 'jugando') return;
  ui.actual = Array.from(ui.actual).slice(0, -1).join('');
  pintarFilaActual();
}

function rechazar(fila, motivo) {
  sacudir(fila);
  aviso(motivo);
}

async function enviar() {
  const p = ui.partida;
  if (ui.ocupado || p.resultado !== 'jugando') return;

  const cols = Array.from(p.secreta).length;
  const fila = filaDom(p.intentos.length);

  if (Array.from(ui.actual).length < cols) {
    return rechazar(fila, `Faltan ${ui.modo.teclado.unidad.plural}`);
  }
  if (ui.ajustes.estricto) {
    const r = ui.modo.validar(ui.actual);
    if (!r.ok) return rechazar(fila, r.motivo);
  }
  if (ui.ajustes.dificil && p.intentos.length) {
    const r = validarDificil(p.intentos, p.secreta, ui.actual);
    if (!r.ok) return rechazar(fila, r.motivo);
  }

  ui.ocupado = true;
  const intento = ui.actual;
  const estados = evaluar(intento, p.secreta);
  const indice = p.intentos.length;

  if (!indice) p.dificil = ui.ajustes.dificil;
  p.intentos.push(intento);
  ui.actual = '';

  const gano = intento === p.secreta;
  const perdio = !gano && p.intentos.length >= ui.modo.intentos;
  if (gano) p.resultado = 'ganada';
  else if (perdio) p.resultado = 'perdida';

  // Se guarda antes de animar: si recarga a mitad de la animación no se pierde nada.
  guardar();
  if ((gano || perdio) && ui.tipo === 'diaria') {
    const hoy = diaLocal();
    estadisticas.registrar(ui.modo.id, ui.modo.intentos, { gano, usados: p.intentos.length, dia: hoy });
    constancia.guardar(actualizarConstancia(constancia.cargar(), hoy));
  }

  await revelar(fila, intento, estados);
  renderTeclado();
  renderNav();
  aplicarAjustes();

  if (gano) {
    aviso(MENSAJES_VICTORIA[Math.min(indice, MENSAJES_VICTORIA.length - 1)], 2200);
    await celebrar(fila);
  } else if (perdio) {
    aviso((p.original || p.secreta).toLocaleUpperCase('es'), 3500);
  }

  ui.ocupado = false;
  if (gano || perdio) {
    await esperar(gano ? 300 : 700);
    if (ui.modo) abrirResultado();
  }
}

async function revelar(fila, intento, estados) {
  const letras = Array.from(intento);
  [...fila.children].forEach((ficha, i) => {
    setTimeout(() => {
      ficha.classList.add('girando');
      setTimeout(() => {
        ficha.dataset.estado = estados[i];
        ficha.dataset.letra = letras[i];
        ficha.setAttribute('aria-label', `${letras[i]}, ${estados[i]}`);
      }, 250);
      ficha.addEventListener('animationend', () => ficha.classList.remove('girando'), { once: true });
    }, i * 260);
  });
  await esperar(fila.children.length * 260 + 500);
}

async function celebrar(fila) {
  [...fila.children].forEach((ficha, i) => {
    setTimeout(() => {
      ficha.classList.add('salto');
      ficha.addEventListener('animationend', () => ficha.classList.remove('salto'), { once: true });
    }, i * 90);
  });
  await esperar(fila.children.length * 90 + 700);
}

/* ---------- Teclado físico y en pantalla ---------- */
function alApretarTecla(e) {
  if (ui.vista !== 'juego') return;
  if (ui.menuAbierto) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ($('dialog[open]')) return;

  // Un control de un modal recién cerrado no cuenta: el foco tarda un tick en soltarse.
  const control = e.target.closest?.('button, a, input, select, summary');
  const sobreControl = control && !control.closest('dialog:not([open])');
  if (e.key === 'Enter') {
    if (sobreControl) return;
    e.preventDefault();
    enviar();
  } else if (e.key === 'Backspace') {
    borrar();
  } else if (e.key.length === 1) {
    const c = normalizar(e.key);
    if (ui.modo.teclado.alfabeto.has(c)) escribir(c);
  }
}

el.teclado.addEventListener('click', (e) => {
  const b = e.target.closest('.tecla');
  if (!b) return;
  b.blur(); // para que Enter del teclado físico no vuelva a activar el botón
  const k = b.dataset.tecla;
  if (k === 'ENTER') enviar();
  else if (k === 'BORRAR') borrar();
  else escribir(k);
});

/* ==========================================================================
   Modales
   ========================================================================== */
function abrir(selector) {
  const d = $(selector);
  if (!d.open) d.showModal();
}

function abrirResultado() {
  renderEncabezado();
  renderStats();
  abrir('#dlg-stats');
}

/* Cerrado el cartel del fin, la pantalla no se queda en el resultado: si era la
   del día, el modo sigue en libre y arranca una palabra nueva. El registro vale
   solo para el día de hoy, así que mañana el mismo modo abre en "Del día". */
function continuarAlCerrarResultado() {
  if (ui.vista !== 'juego' || !ui.modo || !ui.partida) return;
  if (ui.partida.resultado === 'jugando') return; // era la ventana de estadísticas
  if (ui.tipo !== 'diaria') return;               // la libre ya ofrece "Otra palabra"
  libreAuto.guardar(ui.modo.id, diaLocal());
  refrescarTipo();
  iniciarPartida({ forzarNueva: true });
}

function tiempoHastaManana() {
  const ahora = new Date();
  const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
  const seg = Math.max(0, Math.floor((manana - ahora) / 1000));
  return [Math.floor(seg / 3600), Math.floor((seg % 3600) / 60), seg % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

function renderStatsGlobal() {
  const hoy = diaLocal();
  const todas = MODOS.map((m) => ({ m, s: estadisticas.cargar(m.id, m.intentos) }));
  const jugadas = todas.reduce((n, x) => n + x.s.jugadas, 0);
  const ganadas = todas.reduce((n, x) => n + x.s.ganadas, 0);
  const c = constancia.cargar();

  $('#stats-titulo').textContent = 'Estadísticas';
  $('#stats-numeros').innerHTML = [
    [jugadas, 'Jugadas'],
    [`${jugadas ? Math.round((ganadas / jugadas) * 100) : 0}%`, 'Victorias'],
    [constanciaVigente(c, hoy), 'Constancia'],
    [c ? c.mejor : 0, 'Mejor'],
  ].map(([n, t]) => `<div><b>${n}</b><span>${t}</span></div>`).join('');
  $('#stats-constancia').textContent = 'La constancia cuenta los días seguidos con al menos un juego del día terminado.';

  $('#stats-subtitulo').textContent = 'Por juego';
  $('#stats-dist').innerHTML = todas.map(({ m, s }) => (
    `<div class="fila-juego"><b>${m.nombre}</b><span>${s.jugadas} jugadas · ${s.jugadas ? Math.round((s.ganadas / s.jugadas) * 100) : 0}% · racha ${rachaVigente(s, hoy)}</span></div>`
  )).join('');

  $('#fin').hidden = true;
  $('#fin-acciones').hidden = true;
  clearInterval(ui.cuenta);
}

function renderStats() {
  if (!ui.modo) return renderStatsGlobal();
  const hoy = diaLocal();
  const m = ui.modo;
  const p = ui.partida;
  const s = estadisticas.cargar(m.id, m.intentos);
  $('#stats-subtitulo').textContent = 'Distribución de intentos';

  $('#stats-titulo').textContent = `Estadísticas · ${m.nombre}`;

  const porcentaje = s.jugadas ? Math.round((s.ganadas / s.jugadas) * 100) : 0;
  $('#stats-numeros').innerHTML = [
    [s.jugadas, 'Jugadas'],
    [`${porcentaje}%`, 'Victorias'],
    [rachaVigente(s, hoy), 'Racha'],
    [s.mejorRacha, 'Mejor racha'],
  ].map(([n, t]) => `<div><b>${n}</b><span>${t}</span></div>`).join('');

  const c = constancia.cargar();
  const dias = constanciaVigente(c, hoy);
  $('#stats-constancia').textContent = c && c.mejor
    ? `Constancia: ${dias} ${dias === 1 ? 'día seguido' : 'días seguidos'} (mejor: ${c.mejor}).`
    : '';

  const max = Math.max(1, ...s.distribucion);
  const ultima = p && p.resultado === 'ganada' && ui.tipo === 'diaria' ? p.intentos.length : 0;
  $('#stats-dist').innerHTML = s.distribucion.map((n, i) => (
    `<div class="barra-dist"><span>${i + 1}</span><div class="barra-dist__relleno" style="--w:${Math.round((n / max) * 100)}%" data-ultima="${ultima === i + 1}">${n}</div></div>`
  )).join('');

  const terminada = p.resultado !== 'jugando';
  $('#fin').hidden = !terminada;
  $('#fin-acciones').hidden = !terminada;
  clearInterval(ui.cuenta);
  if (!terminada) return;

  const gano = p.resultado === 'ganada';
  $('#fin-titulo').textContent = gano
    ? `Resuelto en ${p.intentos.length} de ${m.intentos}`
    : 'Esta vez no salió. La respuesta era:';
  $('#fin-palabra').textContent = (p.original || p.secreta).toLocaleUpperCase('es');
  $('#fin-pista').textContent = p.pista || '';

  // Al terminar la del día el paso natural es seguir en libre, sin pasar por
  // ajustes: ese botón pasa a ser la acción principal y Compartir queda al lado.
  const otra = $('#btn-otra');
  const compartirBtn = $('#btn-compartir');
  if (ui.tipo === 'diaria') {
    otra.textContent = 'Continuar jugando libre';
    otra.classList.add('boton--primario');
    compartirBtn.classList.remove('boton--primario');
  } else {
    otra.textContent = 'Otra palabra';
    otra.classList.remove('boton--primario');
    compartirBtn.classList.add('boton--primario');
  }

  const cuenta = $('#fin-cuenta');
  if (ui.tipo === 'diaria') {
    const tic = () => { cuenta.textContent = `Próxima palabra en ${tiempoHastaManana()}`; };
    tic();
    ui.cuenta = setInterval(tic, 1000);
  } else {
    cuenta.textContent = 'La partida libre no suma a tu racha.';
  }
}

async function compartir() {
  const m = ui.modo;
  const p = ui.partida;
  const gano = p.resultado === 'ganada';
  const alto = ui.ajustes.contraste;
  const cuadro = { [ESTADO.CORRECTA]: alto ? '🟧' : '🟩', [ESTADO.PRESENTE]: alto ? '🟦' : '🟨', [ESTADO.AUSENTE]: '⬛' };

  const titulo = ui.tipo === 'diaria'
    ? `${MARCA.nombre} · ${m.nombre} Nº${numeroDelDia(diaLocal(), DIA_INICIAL)}`
    : `${MARCA.nombre} · ${m.nombre} (libre)`;
  const marcaDificil = p.dificil ? '*' : '';
  const grilla = p.intentos.map((i) => evaluar(i, p.secreta).map((e) => cuadro[e]).join('')).join('\n');
  const texto = `${titulo} ${gano ? p.intentos.length : 'X'}/${m.intentos}${marcaDificil}\n\n${grilla}\n\n${location.origin}/${m.id}`;

  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text: texto });
    } else {
      await navigator.clipboard.writeText(texto);
      aviso('Copiado al portapapeles');
    }
  } catch (err) {
    if (err?.name !== 'AbortError') aviso('No se pudo compartir');
  }
}

/* ==========================================================================
   Arranque
   ========================================================================== */
function iniciar() {
  // Enlaces viejos con hash (#/clasico) pasan a la ruta limpia.
  if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1) || '/');

  aplicarAjustes();
  construirNav();

  // Menú desplegable de la cabecera.
  el.btnMenu.addEventListener('click', (e) => {
    if (ui.menuAbierto) cerrarMenu({ foco: true });
    else abrirMenu({ foco: e.detail === 0 });
  });
  el.fondo.addEventListener('click', () => cerrarMenu({ foco: true }));
  document.addEventListener('keydown', (e) => {
    if (!ui.menuAbierto) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrarMenu({ foco: true });
    } else if (e.key === 'Tab') {
      atraparFoco(e);
    }
  });
  // Al tocar un juego se cierra el menú y la ruta hace el resto.
  el.nav.addEventListener('click', (e) => { if (e.target.closest('a')) cerrarMenu(); });

  // Con mouse o touch (e.detail > 0) se suelta el foco, así al cerrar el modal Enter vuelve a jugar.
  const alClic = (fn) => (e) => { if (e.detail) e.currentTarget.blur(); fn(); };
  $('#btn-stats').addEventListener('click', alClic(() => { cerrarMenu(); renderStats(); abrir('#dlg-stats'); }));
  $('#btn-ayuda').addEventListener('click', alClic(() => { cerrarMenu(); abrir('#dlg-ayuda'); }));
  $('#btn-ajustes').addEventListener('click', alClic(() => { cerrarMenu(); aplicarAjustes(); abrir('#dlg-ajustes'); }));

  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => setTimeout(() => document.activeElement?.blur?.(), 0));
  });
  $('#dlg-stats').addEventListener('close', () => {
    clearInterval(ui.cuenta);
    continuarAlCerrarResultado();
  });

  // Ajustes
  $('#aj-dificil').addEventListener('change', (e) => cambiarAjuste('dificil', e.target.checked));
  $('#aj-estricto').addEventListener('change', (e) => cambiarAjuste('estricto', e.target.checked));
  $('#aj-contraste').addEventListener('change', (e) => cambiarAjuste('contraste', e.target.checked));
  $('#seg-tema').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) cambiarAjuste('tema', b.dataset.tema);
  });
  $('#seg-partida-aj').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    // Sin foco en el botón: si queda seleccionado, Enter lo vuelve a activar
    // en lugar de enviar el intento.
    b.blur();
    cambiarAjuste('partida', b.dataset.partida);
  });

  // Fin de partida
  el.sub.addEventListener('click', (e) => { if (e.target.closest('[data-otra]')) iniciarPartida({ forzarNueva: true }); });
  $('#btn-compartir').addEventListener('click', compartir);
  $('#btn-otra').addEventListener('click', () => {
    // En la diaria, cerrar el cartel ya deja el modo en libre y arranca la
    // palabra nueva (continuarAlCerrarResultado). En libre, "Otra palabra" es
    // esta misma acción.
    const enLibre = ui.tipo !== 'diaria';
    $('#dlg-stats').close();
    if (enLibre) iniciarPartida({ forzarNueva: true });
  });

  // Ruta
  document.addEventListener('click', enlaceInterno);
  window.addEventListener('popstate', mostrarRuta);
  document.addEventListener('keydown', alApretarTecla);
  mostrarRuta();

  // Si la pestaña sigue abierta pasada la medianoche, se renueva lo del día:
  // el modo que venía en libre por haber terminado la diaria vuelve a "Del día".
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (ui.vista === 'inicio') {
      renderInicio();
    } else {
      const antes = ui.tipo;
      const ahora = refrescarTipo();
      if (ahora !== antes || (ahora === 'diaria' && ui.partida.dia !== diaLocal())) iniciarPartida();
    }
    renderNav();
  });

  // Instalable, sin conexión y al día: si se publicó algo nuevo, se avisa acá.
  $('#btn-actualizar').addEventListener('click', () => location.reload());
  vigilarActualizaciones({
    alCambiar: () => { $('#aviso-version').hidden = false; },
  });
}

iniciar();
