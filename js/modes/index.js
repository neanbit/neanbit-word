/**
 * Registro de modos. Todos viven en la misma app y el mismo dominio:
 *   /clasico   /argentino   /futbol   /fechas
 *
 * Para sumar uno:
 *   1. Crear js/modes/<id>.js con una definición por defecto (contrato abajo).
 *   2. Importarla y agregarla a DEFINICIONES.
 *   3. Sacarla de proximamente.js si estaba ahí.
 * El motor, la interfaz, el teclado, las estadísticas y la ruta salen solos.
 *
 * Contrato de una definición:
 *   id          texto único; es la ruta (/id)
 *   nombre      texto de la pestaña
 *   seccion     etiqueta chica (Palabras, Deportes, Historia...)
 *   descripcion una línea para la tarjeta de inicio
 *   enunciado   false para no repetir la descripción bajo el título del juego
 *               (cuando el tablero ya muestra la mecánica)
 *   acento      color del juego (pestaña activa, pista, tarjeta)
 *   teclado     'letras' | 'numeros' (ver TECLADOS en config.js)
 *   intentos    cantidad de filas
 *   respuestas  Array de texto, o de { palabra, pista? }
 *               (el largo puede variar por respuesta: el tablero se adapta)
 *   validacion  { tipo: 'diccionario', palabras: [...] }  solo palabras que existen
 *               (array o Set de formas válidas, sin normalizar)
 *               { tipo: 'rango', min, max }               números dentro de un rango
 *               { tipo: 'ninguna' }                       se acepta cualquier intento
 */

import { normalizar } from '../engine.js';
import { TECLADOS } from '../config.js';

import clasico from './clasico.js';
import argentino from './argentino.js';
import futbol from './futbol.js';
import fechas from './fechas.js';

const DEFINICIONES = [clasico, argentino, futbol, fechas];

function crearValidador(def, respuestas) {
  const v = def.validacion || { tipo: 'ninguna' };

  if (v.tipo === 'diccionario') {
    const conocidas = new Set(respuestas.map((r) => r.palabra));
    for (const palabra of v.palabras) conocidas.add(normalizar(palabra));
    return {
      aplica: true,
      validar: (intento) =>
        conocidas.has(intento) ? { ok: true } : { ok: false, motivo: 'No está en el diccionario' },
    };
  }

  if (v.tipo === 'rango') {
    return {
      aplica: true,
      validar: (intento) => {
        const n = Number(intento);
        return n >= v.min && n <= v.max
          ? { ok: true }
          : { ok: false, motivo: `Probá entre ${v.min} y ${v.max}` };
      },
    };
  }

  return { aplica: false, validar: () => ({ ok: true }) };
}

function preparar(def) {
  const teclado = TECLADOS[def.teclado];
  if (!teclado) throw new Error(`Modo "${def.id}": teclado "${def.teclado}" no existe`);

  const respuestas = def.respuestas.map((r) => {
    const base = typeof r === 'string' ? { palabra: r } : r;
    return {
      palabra: normalizar(base.palabra),
      original: base.original || base.palabra,
      pista: base.pista || null,
    };
  });

  const { aplica, validar } = crearValidador(def, respuestas);

  return {
    id: def.id,
    nombre: def.nombre,
    seccion: def.seccion || '',
    descripcion: def.descripcion || '',
    enunciado: def.enunciado !== false,
    acento: def.acento || '#6c8cff',
    teclado,
    intentos: def.intentos || 6,
    respuestas,
    validar,
    tieneValidacion: aplica,
  };
}

export const MODOS = DEFINICIONES.map(preparar);

export const obtenerModo = (id) => MODOS.find((m) => m.id === id) || null;
