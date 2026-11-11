#!/usr/bin/env bash
# Descarga las fuentes del diccionario fuera del repo (pesan más de 1 GB).
#
# Uso:
#   tools/diccionario/fuentes.sh [destino]      # por defecto /tmp/dict-work
#
# Después:
#   python3 tools/diccionario/construir.py --fuentes /tmp/dict-work
#
# Hacen falta además `unmunch` (paquete hunspell-tools) y wordfreq
# (`python3 -m pip install --user wordfreq`). Sin red no se puede regenerar el
# diccionario: las fuentes no se versionan.
set -euo pipefail

DESTINO="${1:-/tmp/dict-work}"
DICCIONARIOS="https://raw.githubusercontent.com/LibreOffice/dictionaries/master/es"
KAIKKI="https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl"

mkdir -p "$DESTINO"

for locale in es_AR es_ES; do
  for ext in aff dic; do
    archivo="$DESTINO/$locale.$ext"
    if [[ -s "$archivo" ]]; then
      echo "ya está: $archivo"
    else
      echo "bajando $locale.$ext…"
      curl -fsSL --retry 3 -o "$archivo" "$DICCIONARIOS/$locale.$ext"
    fi
  done
done

archivo="$DESTINO/kaikki-es.jsonl"
if [[ -s "$archivo" ]]; then
  echo "ya está: $archivo"
else
  echo "bajando kaikki-es.jsonl (más de 1 GB, tarda)…"
  curl -fL --retry 3 -o "$archivo" "$KAIKKI"
fi

echo
echo "Fuentes en $DESTINO"
echo "Ahora: python3 tools/diccionario/construir.py --fuentes $DESTINO"
