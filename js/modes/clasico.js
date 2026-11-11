import { SOLUCIONES, PALABRAS_VALIDAS } from '../diccionario.js';

/**
 * Modo Clásico — el Wordle de toda la vida, en castellano.
 * Las soluciones son la lista generada por frecuencia; los intentos se validan
 * contra todas las formas del diccionario.
 */
export default {
  id: 'clasico',
  nombre: 'Clásico',
  seccion: 'Palabras',
  descripcion: 'Una palabra de 5 letras en 6 intentos.',
  // El tablero ya dice cuántas letras y filas: en partida no hace falta el enunciado.
  enunciado: false,
  acento: '#6c8cff',
  teclado: 'letras',
  intentos: 6,
  respuestas: SOLUCIONES,
  validacion: { tipo: 'diccionario', palabras: PALABRAS_VALIDAS },
};
