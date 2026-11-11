import { PALABRAS_VALIDAS } from '../diccionario.js';

/**
 * Modo Argentino — jerga, lunfardo y cosas bien nuestras.
 * Cada respuesta puede llevar una pista que se muestra arriba del tablero.
 */
const ENTRADAS = [
  ['chapa', 'La patente del auto, en la calle.'],
  ['cheto', 'Dicho de alguien que se las da de fino, de barrio caro.'],
  ['bondi', 'Lo que tomás para ir al laburo, con SUBE.'],
  ['piola', 'Algo o alguien tranquilo, copado, de confianza.'],
  ['morfi', 'La comida, en lunfardo.'],
  ['mango', 'Un peso, plata. "No tengo ni un ___".'],
  ['facha', 'Aspecto de una persona; "tener buena ___".'],
  ['birra', 'Cerveza.'],
  ['flaco', 'Forma cariñosa de dirigirse a alguien, sea como sea su físico.'],
  ['pibas', 'Chicas, en plural.'],
  ['banca', '"Aguantar la ___": paciencia, apoyo.'],
  ['minga', '"De ___": ni en broma, de ninguna manera.'],
  ['fiaca', 'Esa pereza de domingo a la tarde.'],
  ['fulbo', 'El deporte rey, escrito como se dice en la cancha.'],
  ['guita', 'Dinero.'],
  ['bocha', 'Mucho: "me gusta una ___".'],
  ['bardo', 'Lío, quilombo, situación complicada.'],
  ['lunfa', 'Apócope del dialecto que nació en los puertos del Río de la Plata.'],
  ['yirar', 'Andar por la calle sin rumbo, o ganarse la vida en ella.'],
  ['zapar', 'Mirar con curiosidad lo que hace otro.'],
  ['ñoqui', 'Comida del día 29 y también empleado que cobra sin ir a trabajar.'],
  ['asado', 'Ritual de domingo con parrilla, carne y amigos.'],
  ['truco', 'Juego de cartas con "envido" y "flor".'],
  ['facon', 'Cuchillo grande del gaucho.'],
  ['zamba', 'Danza folklórica del noroeste que se baila con pañuelo.'],
  ['locro', 'Guiso patrio que se come el 25 de Mayo.'],
  ['lucas', 'Billetes de mil pesos, en la calle.'],
  ['giles', 'Plural de una palabra que designa a quien se deja engañar.'],
  ['labia', 'Facilidad para hablar y convencer.'],
  ['pucho', 'Cigarrillo.'],
  ['copar', 'Entusiasmar, o tomar un lugar por la fuerza de la simpatía.'],
  ['tango', 'Música y baile nacido en el Río de la Plata a fines del siglo XIX.'],
  ['mates', 'Rondas con yerba, bombilla y agua caliente.'],
  ['tacho', 'Cesto de basura, o "irse al ___".'],
];

export default {
  id: 'argentino',
  nombre: 'Argentino',
  seccion: 'Palabras',
  descripcion: 'Jerga y lunfardo local, 5 letras.',
  acento: '#3bb4e5',
  teclado: 'letras',
  intentos: 6,
  respuestas: ENTRADAS.map(([palabra, pista]) => ({ palabra, pista })),
  // Las palabras propias del modo se suman solas en el validador; acá van las
  // formas generales del diccionario.
  validacion: { tipo: 'diccionario', palabras: PALABRAS_VALIDAS },
};
