/**
 * engine.js: lógica pura del juego. No toca el DOM ni localStorage,
 * así que todo lo exportado se puede probar desde Node.
 */

export const ESTADO = Object.freeze({
  CORRECTA: 'correcta', // letra en su lugar
  PRESENTE: 'presente', // está en la palabra pero en otra posición
  AUSENTE: 'ausente',   // no está (o ya se agotaron sus apariciones)
});

const PESO = { [ESTADO.AUSENTE]: 1, [ESTADO.PRESENTE]: 2, [ESTADO.CORRECTA]: 3 };

/**
 * Mayúsculas y sin tildes, pero conservando la Ñ.
 * "canción" -> "CANCION", "ñoqui" -> "ÑOQUI", "pingüino" -> "PINGUINO"
 */
export function normalizar(texto) {
  let salida = '';
  for (const c of String(texto).normalize('NFC').toUpperCase()) {
    salida += c === 'Ñ' ? c : c.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  return salida;
}

/**
 * Evalúa un intento contra la palabra secreta (dos pasadas, maneja repetidas).
 * @returns {string[]} un ESTADO por posición
 */
export function evaluar(intento, secreta) {
  const a = Array.from(intento);
  const s = Array.from(secreta);
  const res = new Array(s.length).fill(ESTADO.AUSENTE);
  const restantes = new Map();

  for (let i = 0; i < s.length; i++) {
    if (a[i] === s[i]) res[i] = ESTADO.CORRECTA;
    else restantes.set(s[i], (restantes.get(s[i]) || 0) + 1);
  }
  for (let i = 0; i < s.length; i++) {
    if (res[i] === ESTADO.CORRECTA) continue;
    const quedan = restantes.get(a[i]) || 0;
    if (quedan > 0) {
      res[i] = ESTADO.PRESENTE;
      restantes.set(a[i], quedan - 1);
    }
  }
  return res;
}

/** Mejor estado conocido por tecla, a partir de todos los intentos. */
export function estadosTeclado(intentos, secreta) {
  const mapa = new Map();
  for (const intento of intentos) {
    const ev = evaluar(intento, secreta);
    Array.from(intento).forEach((letra, i) => {
      const previo = mapa.get(letra);
      if (!previo || PESO[ev[i]] > PESO[previo]) mapa.set(letra, ev[i]);
    });
  }
  return mapa;
}

/* ---------- Palabra del día (determinista, sin servidor) ---------- */

/** Días enteros desde 1970 en hora LOCAL del jugador. */
export function diaLocal(fecha = new Date()) {
  return Math.floor(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) / 86400000);
}

function hashTexto(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(semilla) {
  let t = semilla >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Elige la respuesta del día. Recorre toda la lista sin repetir antes de
 * reordenarla (ciclo a ciclo), con semilla por modo, así cada modo tiene su propio orden.
 */
export function indiceDelDia(modoId, cantidad, dia, diaInicial) {
  const n = Math.max(0, dia - diaInicial);
  const ciclo = Math.floor(n / cantidad);
  const pos = n % cantidad;
  const rnd = mulberry32(hashTexto(`${modoId}:${ciclo}`));
  const orden = Array.from({ length: cantidad }, (_, i) => i);
  for (let i = cantidad - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  return orden[pos];
}

/** Número de partida del día (se muestra como "Nº 312"). */
export function numeroDelDia(dia, diaInicial) {
  return Math.max(0, dia - diaInicial) + 1;
}

/* ---------- Modo difícil ---------- */

/**
 * Chequea que el intento nuevo reutilice lo ya descubierto:
 * las correctas en su lugar y las presentes al menos tantas veces como se vieron.
 * @returns {{ok: boolean, motivo?: string}}
 */
export function validarDificil(intentos, secreta, nuevo) {
  const minimo = new Map();
  const nuevas = Array.from(nuevo);

  for (const previo of intentos) {
    const letras = Array.from(previo);
    const ev = evaluar(previo, secreta);
    const vistas = new Map();
    for (let i = 0; i < letras.length; i++) {
      if (ev[i] === ESTADO.CORRECTA && nuevas[i] !== letras[i]) {
        return { ok: false, motivo: `Posición ${i + 1}: tiene que ser ${letras[i]}` };
      }
      if (ev[i] !== ESTADO.AUSENTE) vistas.set(letras[i], (vistas.get(letras[i]) || 0) + 1);
    }
    for (const [l, n] of vistas) minimo.set(l, Math.max(minimo.get(l) || 0, n));
  }

  for (const [l, n] of minimo) {
    if (nuevas.filter((x) => x === l).length < n) return { ok: false, motivo: `Tiene que incluir ${l}` };
  }
  return { ok: true };
}

/* ---------- Constancia (días seguidos con al menos un juego del día terminado) ---------- */

/** Suma el día `hoy` a la constancia guardada. Idempotente dentro del mismo día. */
export function actualizarConstancia(previa, hoy) {
  const s = { ultimo: 0, racha: 0, mejor: 0, ...previa };
  if (s.ultimo === hoy) return s;
  s.racha = s.ultimo === hoy - 1 ? s.racha + 1 : 1;
  s.mejor = Math.max(s.mejor, s.racha);
  s.ultimo = hoy;
  return s;
}

/** Racha que se muestra: se corta si pasó más de un día sin jugar. */
export function constanciaVigente(previa, hoy) {
  if (!previa || !previa.ultimo) return 0;
  return hoy - previa.ultimo > 1 ? 0 : previa.racha;
}

/** Racha de victorias de un juego: también se corta si faltó algún día. */
export function rachaVigente(stats, hoy) {
  if (!stats.ultimoDia) return stats.racha;
  return hoy - stats.ultimoDia > 1 ? 0 : stats.racha;
}
