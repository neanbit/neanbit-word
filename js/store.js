/**
 * store.js: persistencia en localStorage, tolerante a fallos
 * (modo privado, cuota llena o storage bloqueado: el juego sigue andando).
 */

const PREFIJO = 'nbw:v1:';

const AJUSTES_BASE = Object.freeze({
  estricto: true,      // solo palabras que existen
  dificil: false,      // obliga a reutilizar las pistas
  tema: 'auto',        // 'auto' | 'claro' | 'oscuro'
  contraste: false,    // paleta alternativa (daltonismo)
  partida: 'diaria',   // 'diaria' | 'libre'
});

function leer(clave, porDefecto) {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave);
    return crudo ? JSON.parse(crudo) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribir(clave, valor) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    /* sin storage: seguimos en memoria */
  }
}

/* ---- Ajustes (globales a todos los modos) ---- */
export const ajustes = {
  cargar: () => ({ ...AJUSTES_BASE, ...leer('ajustes', {}) }),
  guardar: (a) => escribir('ajustes', a),
};

/* ---- Partida en curso, una por (modo, tipo) ---- */
export const partidas = {
  cargar: (modoId, tipo) => leer(`juego:${modoId}:${tipo}`, null),
  guardar: (modoId, tipo, p) => escribir(`juego:${modoId}:${tipo}`, p),
  borrar: (modoId, tipo) => {
    try { localStorage.removeItem(`${PREFIJO}juego:${modoId}:${tipo}`); } catch { /* noop */ }
  },
};

/* ---- Estadísticas, una por modo ---- */
const statsVacias = (intentos) => ({
  jugadas: 0,
  ganadas: 0,
  racha: 0,
  mejorRacha: 0,
  ultimoDia: 0,
  distribucion: new Array(intentos).fill(0),
});

export const estadisticas = {
  cargar(modoId, intentos) {
    const s = leer(`stats:${modoId}`, null) || statsVacias(intentos);
    while (s.distribucion.length < intentos) s.distribucion.push(0);
    return s;
  },
  registrar(modoId, intentos, { gano, usados, dia }) {
    const s = this.cargar(modoId, intentos);
    if (s.ultimoDia && dia - s.ultimoDia > 1) s.racha = 0;
    s.ultimoDia = dia;
    s.jugadas += 1;
    if (gano) {
      s.ganadas += 1;
      s.racha += 1;
      s.mejorRacha = Math.max(s.mejorRacha, s.racha);
      s.distribucion[usados - 1] += 1;
    } else {
      s.racha = 0;
    }
    escribir(`stats:${modoId}`, s);
    return s;
  },
};

/* ---- Constancia global ---- */
export const constancia = {
  cargar: () => leer('constancia', null),
  guardar: (c) => escribir('constancia', c),
};

export const claveVisto = PREFIJO + 'visto';
