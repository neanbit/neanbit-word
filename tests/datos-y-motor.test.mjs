// npm test   (o: node --test)
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluar, normalizar, estadosTeclado, indiceDelDia,
  validarDificil, actualizarConstancia, constanciaVigente, rachaVigente,
} from '../js/engine.js';
import { MODOS } from '../js/modes/index.js';
import {
  SOLUCIONES, PALABRAS_VALIDAS, PALABRAS_SOLUCION, REGLAS,
  esValida, esSolucion, validarIntento, originalDe, formaParaMostrar,
} from '../js/diccionario.js';

const L = { correcta: 'C', presente: 'P', ausente: 'A' };
const ev = (i, s) => evaluar(i, s).map((e) => L[e]).join('');

test('normalizar: sin tildes, mayúsculas, conserva Ñ', () => {
  assert.equal(normalizar('canción'), 'CANCION');
  assert.equal(normalizar('ñoqui'), 'ÑOQUI');
  assert.equal(normalizar('pingüino'), 'PINGUINO');
});

test('evaluar: letras repetidas', () => {
  assert.equal(ev('CASAS', 'CASAS'), 'CCCCC');
  assert.equal(ev('SASAS', 'CASAS'), 'ACCCC');   // la 1ª S sobra: las dos S ya están en su lugar
  assert.equal(ev('ERROR', 'ROBAR'), 'APAPC');   // solo una R "presente"; la otra queda ausente
  assert.equal(ev('AAAAA', 'CASAS'), 'ACACA');
  assert.equal(ev('LLAMA', 'CALMA'), 'PAPCC');
  assert.equal(ev('2022', '2002'), 'CCAC');
});

test('estadosTeclado: gana el mejor estado conocido', () => {
  const m = estadosTeclado(['LLAMA', 'CALMA'], 'CALMA');
  assert.equal(m.get('A'), 'correcta');
  assert.equal(m.get('L'), 'correcta');
});

test('palabra del día: no repite dentro de un ciclo y es estable', () => {
  const n = 37;
  const vistos = new Set();
  for (let d = 0; d < n; d++) vistos.add(indiceDelDia('x', n, 500 + d, 500));
  assert.equal(vistos.size, n);
  assert.equal(indiceDelDia('x', n, 520, 500), indiceDelDia('x', n, 520, 500));
});

test('diccionario: 5 letras, sin duplicados y soluciones incluidas', () => {
  for (const palabra of PALABRAS_VALIDAS) {
    assert.equal(Array.from(palabra).length, 5, `largo != 5: ${palabra}`);
    assert.match(palabra, /^[A-ZÑ]+$/, `carácter raro: ${palabra}`);
  }
  assert.equal(PALABRAS_SOLUCION.size, SOLUCIONES.length, 'soluciones duplicadas');
  for (const { palabra } of SOLUCIONES) {
    assert.ok(PALABRAS_VALIDAS.has(palabra), `solución fuera de las válidas: ${palabra}`);
  }
  assert.ok(PALABRAS_VALIDAS.size > 10000, `diccionario demasiado chico: ${PALABRAS_VALIDAS.size}`);
  assert.ok(PALABRAS_SOLUCION.size >= 1000, `pocas soluciones: ${PALABRAS_SOLUCION.size}`);
});

test('diccionario: normaliza, valida y conserva la ortografía original', () => {
  assert.equal(REGLAS.LARGO, 5);
  assert.ok(esValida('ábaco'));
  assert.ok(esValida('señor'));
  assert.ok(!esValida('senor'), 'la Ñ no se pliega a N');
  assert.ok(esSolucion('ABACO'));
  assert.equal(originalDe('abaco'), 'ábaco');
  assert.equal(formaParaMostrar('abaco'), 'ÁBACO');
  assert.deepEqual(validarIntento('ábaco'), { ok: true, normalizada: 'ABACO', original: 'ábaco' });
  const rechazo = validarIntento('zzzzz');
  assert.equal(rechazo.ok, false);
  assert.match(rechazo.motivo, /diccionario/);
  assert.equal(validarIntento('sol').ok, false, 'el largo se cuenta normalizado');
});

for (const m of MODOS) {
  test(`modo ${m.id}: respuestas coherentes con su teclado`, () => {
    const vistas = new Set();
    for (const r of m.respuestas) {
      assert.ok(!vistas.has(r.palabra), `duplicada: ${r.palabra}`);
      vistas.add(r.palabra);
      for (const c of r.palabra) assert.ok(m.teclado.alfabeto.has(c), `"${c}" de ${r.palabra} no está en el teclado`);
      if (r.pista && m.id !== 'fechas') assert.ok(!r.pista.toUpperCase().includes(r.palabra), `la pista revela ${r.palabra}`);
    }
  });
}

test('validadores', () => {
  const cl = MODOS.find((m) => m.id === 'clasico');
  assert.ok(cl.validar('PERRO').ok);
  assert.ok(!cl.validar('XQZWV').ok);
  const fe = MODOS.find((m) => m.id === 'fechas');
  assert.ok(fe.validar('1983').ok);
  assert.ok(!fe.validar('0042').ok);
  assert.ok(MODOS.find((m) => m.id === 'futbol').validar('ZZZZZ').ok);
});

test('diccionario clásico: cubre palabras comunes', () => {
  const cl = MODOS.find((m) => m.id === 'clasico');
  for (const palabra of ['PUEDO', 'FAVOR', 'SEÑOR', 'AMIGO', 'GUSTA', 'TODAS', 'VOCES', 'NUEVA', 'SUENE', 'DARLE']) {
    assert.ok(cl.validar(palabra).ok, `${palabra} debería estar en el diccionario`);
  }
  assert.ok(PALABRAS_VALIDAS.size > 10000, `diccionario demasiado chico: ${PALABRAS_VALIDAS.size}`);
});

test('modo difícil: correctas en su lugar y presentes incluidas', () => {
  // secreta CALMA; "LLAMA" deja la 4ª M... y la 5ª A en su lugar, y una L presente
  const previos = ['LLAMA'];
  assert.ok(!validarDificil(previos, 'CALMA', 'PERRO').ok);
  assert.match(validarDificil(previos, 'CALMA', 'PERRO').motivo, /Posición/);
  assert.ok(!validarDificil(previos, 'CALMA', 'BOTMA').ok);        // falta la L presente
  assert.match(validarDificil(previos, 'CALMA', 'BOTMA').motivo, /incluir L/);
  assert.ok(validarDificil(previos, 'CALMA', 'CALMA').ok);
  assert.ok(validarDificil([], 'CALMA', 'ZZZZZ').ok);
});

test('modo difícil: respeta cuántas veces apareció una letra', () => {
  // dos S en SASAS contra CASAS: las dos quedan en su lugar, hay que mantenerlas
  assert.ok(!validarDificil(['SASAS'], 'CASAS', 'CASAB').ok);
  assert.ok(validarDificil(['SASAS'], 'CASAS', 'CASAS').ok);
});

test('constancia: suma días seguidos, no duplica y se corta con un salto', () => {
  let c = actualizarConstancia(null, 100);
  assert.equal(c.racha, 1);
  assert.equal(actualizarConstancia(c, 100).racha, 1);
  c = actualizarConstancia(c, 101);
  c = actualizarConstancia(c, 102);
  assert.equal(c.racha, 3);
  assert.equal(c.mejor, 3);
  assert.equal(constanciaVigente(c, 103), 3);
  assert.equal(constanciaVigente(c, 104), 0);
  c = actualizarConstancia(c, 110);
  assert.equal(c.racha, 1);
  assert.equal(c.mejor, 3);
});

test('racha de un juego: vigente solo si jugó ayer u hoy', () => {
  assert.equal(rachaVigente({ racha: 5, ultimoDia: 200 }, 201), 5);
  assert.equal(rachaVigente({ racha: 5, ultimoDia: 200 }, 203), 0);
  assert.equal(rachaVigente({ racha: 2, ultimoDia: 0 }, 999), 2);
});
