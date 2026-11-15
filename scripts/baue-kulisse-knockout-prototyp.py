#!/usr/bin/env python3
"""Baut die Kulisse fuer den Basketball-Knockout-Prototyp (08.11.).

Quelle ist ausschliesslich die vorhandene Basketball-Szene public/szenen/basketball/parkett.html
(PixelLab-Halle, 1920x1000, Skala 2). Dort liegen Welt, Korb-Ebenen und Spiegelung als data-URIs
im Objekt `SC`. Das Skript
  * nimmt die leere Welt (Halle, Parkett, Tribuene, Bank),
  * legt BEIDE Korb-Ebenen samt Spiegelung darueber (gespielt wird nur auf den rechten Korb),
  * retuschiert den Trainer, der in der Welt mitten auf der Seitenlinie steht (Bodenstueck
    derselben Zeilen, 96 px weiter rechts),
  * schneidet die Box-Score-Leiste unten ab (der Prototyp zeigt seinen eigenen Boxscore).

Kein API-Aufruf, kein neues Bildmaterial: nur Pixel der Szene. Eigene Datei (statt
baue-kulisse-buehnen.py zu erweitern), damit die laufende Kulissen-Integration unberuehrt bleibt.

    python3 scripts/baue-kulisse-knockout-prototyp.py
"""
import base64
import io
import json
from pathlib import Path

from PIL import Image

WURZEL = Path(__file__).resolve().parent.parent
QUELLE = WURZEL / "public/szenen/basketball/parkett.html"
ZIEL = WURZEL / "public/mockups/basketball-knockout-prototyp/halle.png"


def lade_sc():
    s = QUELLE.read_text()
    i = s.index("const SC = ") + len("const SC = ")
    j = s.index(";\n", i)
    return json.loads(s[i:j])


def dec(uri):
    return Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1]))).convert("RGBA")


def main():
    sc = lade_sc()
    welt = dec(sc["world"])
    for k in ("-1", "1"):
        welt.alpha_composite(dec(sc["baskets"][k]["refl"]))
        welt.alpha_composite(dec(sc["baskets"][k]["layer"]))
    # Trainer auf der Seitenlinie (x ~1025..1100, y ~655..800 in Skala 2) wegretuschieren.
    x0, x1, y0, y1, dx = 1018, 1104, 650, 806, 96
    welt.paste(welt.crop((x0 + dx, y0, x1 + dx, y1)), (x0, y0))
    hc = sc["HC"] * sc["S"]  # Hallenhoehe ohne Box-Score-Leiste
    welt = welt.crop((0, 0, welt.width, hc)).convert("RGB")
    ZIEL.parent.mkdir(parents=True, exist_ok=True)
    welt.save(ZIEL, optimize=True)
    print(f"{ZIEL.relative_to(WURZEL)}  {welt.size[0]}x{welt.size[1]}")


if __name__ == "__main__":
    main()
