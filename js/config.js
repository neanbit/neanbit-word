/**
 * config.js: constantes globales del sitio.
 * Lo que cambia entre modos vive en js/modes/*.js; acá solo lo compartido.
 */

export const MARCA = {
  nombre: 'neanbit',
};

/** Día de la partida Nº 1 (hora local del jugador). */
export const LANZAMIENTO = { anio: 2026, mes: 11, dia: 8 };

export const MODO_POR_DEFECTO = 'clasico';

const FILA_Q = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
const FILA_A = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'];
const FILA_Z = ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BORRAR'];

/** Teclados disponibles. Cada modo elige uno por nombre (`teclado: 'letras'`). */
export const TECLADOS = {
  letras: {
    filas: [FILA_Q, FILA_A, FILA_Z],
    alfabeto: new Set([...FILA_Q, ...FILA_A, ...FILA_Z.filter((k) => k.length === 1)]),
    unidad: { plural: 'letras', singular: 'letra' },
  },
  numeros: {
    filas: [['1', '2', '3', '4', '5'], ['6', '7', '8', '9', '0'], ['ENTER', 'BORRAR']],
    alfabeto: new Set('0123456789'.split('')),
    unidad: { plural: 'números', singular: 'número' },
  },
};
