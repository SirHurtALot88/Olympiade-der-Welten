#!/usr/bin/env bash
# Baut die Abgleich-Bilder "Mockup | App" der Einsatzliste (Optik-Runde 18.11.) mit ImageMagick.
# Voraussetzung: scripts/screenshot-einsatzliste-mockups.mjs und scripts/screenshot-einsatzliste-optik.ts sind gelaufen.
set -euo pipefail
ORDNER="${1:-docs/design/einsatzliste-optik-18-11}"
for breite in 2560 1920 1710; do
  for paar in "mockup-formmoral:app-basketball:abgleich-aufstellung-basketball" "mockup-formmoral:app-tennis:abgleich-aufstellung-tennis" "mockup-einsatzliste-gegner:app-basketball-gegner:abgleich-gegner-basketball"; do
    m="${paar%%:*}"; rest="${paar#*:}"; a="${rest%%:*}"; ziel="${rest#*:}"
    [ -f "$ORDNER/$m-$breite.png" ] && [ -f "$ORDNER/$a-$breite.png" ] || continue
    convert "$ORDNER/$m-$breite.png" -resize 1600x "$ORDNER/.l.png"
    convert "$ORDNER/$a-$breite.png" -resize 1600x "$ORDNER/.r.png"
    convert "$ORDNER/.l.png" "$ORDNER/.r.png" +append -resize 3200x "$ORDNER/$ziel-$breite.png"
    rm -f "$ORDNER/.l.png" "$ORDNER/.r.png"
  done
done
