#!/usr/bin/env python3
"""
Genera las listas del diccionario de 5 letras de neanbit-word.

Uso típico (las fuentes viven fuera del repo, ver README):

    python3 tools/diccionario/construir.py \
        --fuentes /ruta/a/dict-work \
        --variante rioplatense

El directorio de fuentes debe tener:
    es_AR.dic, es_AR.aff   (y opcionalmente es_ES.*, es_MX.*)
    kaikki-es.jsonl        (volcado de Wiktionary en español de Kaikki.org)
    unmunch                (herramienta de hunspell; también vale $PATH)

Escribe js/data/diccionario.js y tools/diccionario/informe.json.
No usa red: las fuentes se descargan aparte con tools/diccionario/fuentes.sh.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

try:
    from wordfreq import zipf_frequency
except ImportError:
    sys.exit("Falta wordfreq: python3 -m pip install wordfreq")


# --------------------------------------------------------------------------
# Reglas del idioma (se exportan también al runtime en js/diccionario.js)
# --------------------------------------------------------------------------

LARGO = 5
VARIANTES = {
    # La variante fija qué diccionarios Hunspell alimentan la lista. Kaikki
    # (Wiktionary) se suma siempre como complemento neutro.
    "rioplatense": ["es_AR", "es_ES"],
    "neutro": ["es_ES"],
    "mexicano": ["es_MX", "es_ES"],
    "todas": ["es_AR", "es_ES", "es_MX"],
}
PRIORIDAD_FUENTE = {"es_AR": 40, "es_ES": 30, "es_MX": 20, "kaikki": 10}
PLIEGUES = str.maketrans(
    "áéíóúüàèìòùâêîôûäëïö",
    "aeiouuaeiouaeiouaeio",
)
SOLO_PALABRA = re.compile(r"^[a-zñ]{5}$")
POS_IGNORADAS = {"name", "symbol", "punct", "prefix", "suffix", "interfix", "infix"}
TAGS_BASURA = {
    "misspelling",
    "error-unrecognized-form",
    "table-tags",
    "inflection-template",
}
TAGS_SUCIAS = {
    "obsolete",
    "archaic",
    "nonstandard",
    "misspelling",
    "eye-dialect",
    "pronunciation-spelling",
    "acronym",
    "initialism",
    "sigla",  # marca interna para siglas detectadas por la glosa
}
TAGS_VERBALES = {
    "first-person",
    "second-person",
    "third-person",
    "preterite",
    "imperfect",
    "future",
    "conditional",
    "subjunctive",
    "imperative",
    "participle",
    "gerund",
}


def normalizar(texto: str) -> str:
    """Minúsculas, NFC y plegado de tildes/diéresis. La ñ se conserva."""
    texto = unicodedata.normalize("NFC", texto.strip().lower())
    return texto.translate(PLIEGUES)


def valida(texto: str) -> bool:
    return bool(SOLO_PALABRA.match(texto)) and bool(set(texto) & set("aeiou"))


# --------------------------------------------------------------------------
# Fuentes
# --------------------------------------------------------------------------

class Formas:
    """Formas de 5 letras con su procedencia."""

    def __init__(self) -> None:
        self.datos: dict[str, dict] = {}
        self.lemas: dict[str, set[str]] = defaultdict(set)       # cualquier largo
        self.nombres: set[str] = set()                           # pos=name
        self.lemas_kaikki: dict[str, set[str]] = defaultdict(set)

    @staticmethod
    def _entrada(norm: str) -> dict:
        return {
            "originales": {},   # original -> {"fuentes": set, "kaikki": bool, "limpio": bool, "lema": bool}
            "pos": set(),
            "tags": set(),
            "lema": False,
            "kaikki": False,
            "limpio": False,
        }

    def _original(self, d: dict, original: str) -> dict:
        return d["originales"].setdefault(
            original, {"fuentes": set(), "kaikki": False, "limpio": False, "lema": False}
        )

    def agregar(self, norm: str, original: str, fuente: str, limpio: bool = False, lema: bool = False) -> None:
        d = self.datos.setdefault(norm, self._entrada(norm))
        o = self._original(d, original)
        o["fuentes"].add(fuente)
        if fuente == "kaikki":
            o["kaikki"] = True
            o["limpio"] = o["limpio"] or limpio
            o["lema"] = o["lema"] or lema
            d["kaikki"] = True
            d["limpio"] = d["limpio"] or limpio

    def marcar_lema(self, norm: str, original: str, pos: str, limpio: bool = True) -> None:
        self.agregar(norm, original, "kaikki", limpio=limpio, lema=True)
        self.datos[norm]["pos"].add(pos)
        self.datos[norm]["lema"] = True
        self.lemas_kaikki[norm].add(pos)

    def _mejor_original(self, norm: str, d: dict) -> str:
        from wordfreq import zipf_frequency

        def clave(original: str) -> tuple:
            o = d["originales"][original]
            prioridad = max(PRIORIDAD_FUENTE.get(f, 0) for f in o["fuentes"])
            return (
                1 if o["kaikki"] else 0,      # atestiguada en Wiktionary
                1 if o["limpio"] else 0,      # sin marcas de obsoleto/error
                1 if o["lema"] else 0,        # entrada canónica, no una flexión
                zipf_frequency(original, "es"),
                prioridad,
                -sum(c in "áéíóúü" for c in original),
            )

        # max() se queda con el primero en caso de empate: el orden alfabético
        # mantiene la salida determinista.
        return max(sorted(d["originales"]), key=clave)

    def original(self, norm: str) -> str:
        return self._mejor_original(norm, self.datos[norm])


def expandir_hunspell(locale: str, fuentes: Path, unmunch: str, formas: Formas) -> int:
    dic = fuentes / f"{locale}.dic"
    aff = fuentes / f"{locale}.aff"
    if not dic.exists() or not aff.exists():
        print(f"  aviso: no está {locale}.dic/.aff; se omite", file=sys.stderr)
        return 0
    proc = subprocess.run(
        [unmunch, str(dic), str(aff)],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        check=True,
    )
    vistos = 0
    for linea in proc.stdout.splitlines():
        w = linea.strip()
        if not w or "/" in w or w[0].isupper():
            continue
        n = normalizar(w)
        if not valida(n):
            continue
        formas.agregar(n, w.lower(), locale)
        vistos += 1
    return vistos


def leer_kaikki(ruta: Path, formas: Formas) -> int:
    vistos = 0
    with ruta.open(encoding="utf-8") as f:
        for numero, linea in enumerate(f, 1):
            if numero % 250_000 == 0:
                print(f"  kaikki: {numero:,} líneas…", file=sys.stderr)
            d = json.loads(linea)
            if d.get("lang_code") != "es":
                continue
            pos = d.get("pos") or ""
            w = d.get("word") or ""
            n = normalizar(w)

            if pos == "name":
                if valida(n):
                    formas.nombres.add(n)
                continue
            if pos in POS_IGNORADAS:
                continue

            # Lemas de cualquier largo, para detectar plurales/femeninos triviales.
            # Se llenan más abajo, solo con entradas que no son "form-of".

            marcas: set[str] = set(d.get("tags") or ())
            sentidos = d.get("senses") or []
            for s in sentidos:
                marcas.update(s.get("tags") or ())
                for glosa in s.get("glosses") or ():
                    # "CBTIS, ..." delata una sigla que Wiktionary no marcó.
                    if glosa[: len(w)].isupper() and glosa[: len(w)].lower() == w.lower():
                        marcas.add("sigla")
            if marcas & {"sigla", "acronym", "initialism"}:
                continue
            limpio = not (marcas & TAGS_SUCIAS)
            # Wiktionary crea una entrada por cada forma flexiva, con la marca
            # "form-of". Esas entradas no son lemas aunque tengan `pos`.
            solo_forma = bool(sentidos) and all(
                "form-of" in set(s.get("tags") or ()) for s in sentidos
            )

            if not solo_forma and n:
                formas.lemas[n].add(pos)

            if valida(n):
                if solo_forma:
                    formas.agregar(n, w.lower(), "kaikki", limpio=limpio)
                    d5 = formas.datos[n]
                    d5["pos"].add(pos)
                    d5["tags"].update(marcas)
                else:
                    formas.marcar_lema(n, w.lower(), pos, limpio=limpio)
                formas.datos[n]["tags"].update(marcas)
                vistos += 1

            for f in d.get("forms") or []:
                forma = f.get("form") or ""
                fn = normalizar(forma)
                if not valida(fn):
                    continue
                tags = set(f.get("tags") or ())
                if tags & TAGS_BASURA:
                    continue
                formas.agregar(fn, forma.lower(), "kaikki", limpio=limpio)
                d5 = formas.datos[fn]
                d5["pos"].add(pos)
                d5["tags"].update(tags)
                vistos += 1
    return vistos


# --------------------------------------------------------------------------
# Selección
# --------------------------------------------------------------------------

def construir(fuentes: Path, variante: str, tope_soluciones: int, umbral: float, umbral_verbal: float, umbral_forma: float) -> tuple[list, list, dict]:
    formas = Formas()
    unmunch = shutil.which("unmunch") or str(fuentes / "unmunch")
    if not Path(unmunch).exists() and not shutil.which("unmunch"):
        sys.exit("No encuentro unmunch (hunspell-tools). Ver tools/diccionario/fuentes.sh")

    total_hunspell = 0
    for locale in VARIANTES[variante]:
        print(f"Expandiendo {locale}…", file=sys.stderr)
        total_hunspell += expandir_hunspell(locale, fuentes, unmunch, formas)

    kaikki = fuentes / "kaikki-es.jsonl"
    if not kaikki.exists():
        sys.exit(f"Falta {kaikki}")
    print("Leyendo Wiktionary (Kaikki)…", file=sys.stderr)
    total_kaikki = leer_kaikki(kaikki, formas)

    print(f"Formas de 5: {len(formas.datos):,}", file=sys.stderr)

    # Frecuencia de uso (wordfreq, español general).
    zipf = {}
    for n in formas.datos:
        fs = formas.datos[n]["originales"]
        zipf[n] = max(zipf_frequency(n, "es"), *(zipf_frequency(o, "es") for o in fs))

    def es_plural_trivial(n: str) -> bool:
        if not n.endswith("s"):
            return False
        base = n[:-1]
        return (
            base in formas.lemas
            and bool(formas.lemas[base] & {"noun", "adj", "det", "pron", "num"})
            and zipf_frequency(base, "es") >= 2.5
            and zipf[n] <= zipf_frequency(base, "es") + 1.5
        )

    def es_femenino_trivial(n: str) -> bool:
        if not n.endswith("a"):
            return False
        masc = n[:-1] + "o"
        return (
            masc in formas.lemas
            and bool(formas.lemas[masc] & {"noun", "adj", "det", "pron", "num"})
            and zipf_frequency(masc, "es") >= 2.5
            and zipf[n] <= zipf_frequency(masc, "es") + 1.5
        )

    candidatos = []
    descartes = defaultdict(int)
    for n, d in formas.datos.items():
        if not d["kaikki"]:
            descartes["sin_atestiguar_en_wiktionary"] += 1
            continue
        if not d["limpio"]:
            descartes["solo_formas_marcadas"] += 1
            continue
        if n in formas.nombres and zipf[n] < 5.2:
            descartes["nombre_propio"] += 1
            continue
        if d["tags"] & {"Internet", "Japanese"} and zipf[n] < 4.5:
            descartes["termino_de_nicho"] += 1
            continue
        if es_plural_trivial(n):
            descartes["plural_trivial"] += 1
            continue
        if es_femenino_trivial(n):
            descartes["femenino_trivial"] += 1
            continue
        if d["tags"] & TAGS_VERBALES and not d["lema"] and zipf[n] < umbral_verbal:
            descartes["forma_verbal_rara"] += 1
            continue
        if not d["lema"] and zipf[n] < umbral_forma:
            descartes["flexion_poco_frecuente"] += 1
            continue
        if zipf[n] < umbral:
            descartes["poco_frecuente"] += 1
            continue
        candidatos.append(n)

    candidatos.sort(key=lambda n: (-zipf[n], n))
    soluciones_n = candidatos[:tope_soluciones]
    if len(soluciones_n) < 2000:
        sys.exit(
            f"Solo {len(soluciones_n)} soluciones probables; bajá el umbral de frecuencia "
            "o revisá las fuentes (mínimo pedido: 2000)."
        )

    # La lista válida es todo lo que pasó la limpieza, más las soluciones.
    validas_n = sorted(formas.datos)
    soluciones = [[formas.original(n), n.upper()] for n in sorted(soluciones_n)]
    validas = [[formas.original(n), n.upper()] for n in validas_n]

    informe = {
        "variante": variante,
        "fuentes_hunspell": VARIANTES[variante],
        "formas_expandidas_hunspell": total_hunspell,
        "formas_leidas_kaikki": total_kaikki,
        "formas_5_unicas": len(formas.datos),
        "soluciones": len(soluciones),
        "validas": len(validas),
        "umbral_zipf": umbral,
        "umbral_verbal_zipf": umbral_verbal,
        "umbral_forma_zipf": umbral_forma,
        "tope_soluciones": tope_soluciones,
        "descartes": dict(sorted(descartes.items())),
        "zipf_solucion_min": min(zipf[n] for n in soluciones_n),
        "zipf_solucion_max": max(zipf[n] for n in soluciones_n),
    }
    return soluciones, validas, informe


# --------------------------------------------------------------------------
# Salida
# --------------------------------------------------------------------------

CABECERA = """/**
 * Diccionario de 5 letras. ARCHIVO GENERADO: no editar a mano.
 *
 * Regenerar con: python3 tools/diccionario/construir.py --fuentes <dir>
 * Fuentes, versión y licencia: README.md, sección «Diccionario».
 *
 * Cada entrada es [forma original, forma normalizada]:
 *   - original: ortografía de la fuente, con tildes y ñ.
 *   - normalizada: mayúsculas, sin tildes, ü→u, ñ conservada. Es la que usa el juego.
 *
 * Variante: {variante}
 * SOLUCIONES: {nsol} (pueden salir como respuesta del día)
 * VALIDAS: {nval} (se aceptan como intento; incluye a SOLUCIONES)
 */

export const VARIANTE = {variante_json};

"""


def escribir_js(ruta: Path, soluciones: list, validas: list, variante: str) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", encoding="utf-8", newline="\n") as f:
        f.write(CABECERA.format(
            variante=variante,
            variante_json=json.dumps(variante),
            nsol=len(soluciones),
            nval=len(validas),
        ))
        f.write("export const SOLUCIONES = [\n")
        for original, normalizada in soluciones:
            f.write(
                f"  [{json.dumps(original, ensure_ascii=False)}, "
                f"{json.dumps(normalizada, ensure_ascii=False)}],\n"
            )
        f.write("];\n\nexport const VALIDAS = [\n")
        for original, normalizada in validas:
            f.write(
                f"  [{json.dumps(original, ensure_ascii=False)}, "
                f"{json.dumps(normalizada, ensure_ascii=False)}],\n"
            )
        f.write("];\n")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--fuentes", required=True, type=Path)
    ap.add_argument("--salida", type=Path, default=Path("js/data/diccionario.js"))
    ap.add_argument("--informe", type=Path, default=Path("tools/diccionario/informe.json"))
    ap.add_argument("--variante", choices=sorted(VARIANTES), default="rioplatense")
    ap.add_argument("--tope-soluciones", type=int, default=2000)
    ap.add_argument("--umbral", type=float, default=2.0, help="zipf mínimo para ser solución")
    ap.add_argument("--umbral-verbal", type=float, default=4.8, help="zipf mínimo de una flexión verbal")
    ap.add_argument("--umbral-forma", type=float, default=4.0, help="zipf mínimo de una flexión no verbal")
    args = ap.parse_args()

    soluciones, validas, informe = construir(
        args.fuentes, args.variante, args.tope_soluciones,
        args.umbral, args.umbral_verbal, args.umbral_forma,
    )
    escribir_js(args.salida, soluciones, validas, args.variante)
    args.informe.parent.mkdir(parents=True, exist_ok=True)
    args.informe.write_text(
        json.dumps(informe, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Listo: {informe['soluciones']:,} soluciones / {informe['validas']:,} válidas"
        f" → {args.salida}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
