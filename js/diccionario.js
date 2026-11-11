/**
 * diccionario.js: reglas y validación en runtime del diccionario de 5 letras.
 *
 * Las listas viven en data/diccionario.js (generado). Acá se arman los índices
 * una sola vez y se expone la API que usan los modos y las pruebas.
 *
 * Reglas del idioma:
 *  - Las tildes no se escriben al jugar: la comparación usa la forma normalizada.
 *  - La ñ es una letra propia y NO se convierte en n.
 *  - La ü se pliega a u.
 *  - ch, ll y rr ya no son letras: cada una ocupa dos casillas.
 *  - El largo se cuenta sobre la forma normalizada, con la ñ como una letra.
 */

import { normalizar } from './engine.js';
import { SOLUCIONES as DATOS_SOLUCIONES, VALIDAS, VARIANTE } from './data/diccionario.js';

export const REGLAS = Object.freeze({
  LARGO: 5,
  TILDES: 'Se ignoran al comparar; la forma original se conserva para mostrar.',
  ENE: 'Letra propia: no se pliega a n.',
  DIERESIS: 'La ü se pliega a u.',
  DIGRAFOS: 'ch, ll y rr ocupan dos casillas.',
  VARIANTE,
});

/** normalizada (mayúsculas, sin tildes) -> forma original de la fuente. */
const POR_VALIDA = new Map(VALIDAS.map(([original, normalizada]) => [normalizada, original]));
const POR_SOLUCION = new Map(DATOS_SOLUCIONES.map(([original, normalizada]) => [normalizada, original]));

export const PALABRAS_VALIDAS = new Set(POR_VALIDA.keys());
export const PALABRAS_SOLUCION = new Set(POR_SOLUCION.keys());

/** Soluciones en el formato que espera un modo: palabra normalizada + original. */
export const SOLUCIONES = DATOS_SOLUCIONES.map(([original, normalizada]) => ({
  palabra: normalizada,
  original,
}));

/** Normaliza un intento con las mismas reglas que el motor. */
export const normalizarIntento = (texto) => normalizar(texto);

/** ¿La palabra existe en la lista grande de formas válidas? */
export function esValida(texto) {
  return PALABRAS_VALIDAS.has(normalizar(texto));
}

/** ¿Puede salir como respuesta del día? */
export function esSolucion(texto) {
  return PALABRAS_SOLUCION.has(normalizar(texto));
}

/**
 * Valida un intento y devuelve la forma normalizada y la original.
 * No aplica reglas de modo (largo, difícil): solo existencia en el diccionario.
 */
export function validarIntento(texto) {
  const normalizada = normalizar(texto);
  if (Array.from(normalizada).length !== REGLAS.LARGO) {
    return { ok: false, motivo: `Tienen que ser ${REGLAS.LARGO} letras` };
  }
  if (!POR_VALIDA.has(normalizada)) {
    return { ok: false, motivo: 'No está en el diccionario' };
  }
  return { ok: true, normalizada, original: POR_VALIDA.get(normalizada) };
}

/** Forma original (con tilde y ñ) de una palabra normalizada o escrita por el jugador. */
export function originalDe(texto) {
  const normalizada = normalizar(texto);
  return POR_SOLUCION.get(normalizada) ?? POR_VALIDA.get(normalizada) ?? null;
}

/** Texto listo para mostrar: la ortografía original en mayúsculas. */
export function formaParaMostrar(texto) {
  const original = originalDe(texto);
  return (original ?? String(texto)).toLocaleUpperCase('es');
}
