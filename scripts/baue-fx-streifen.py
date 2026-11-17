#!/usr/bin/env python3
"""Legt die PixelLab-Effekt-Rohblaetter (data/generated/pixellab-vfx/roh/*.png|json, Raster)
als waagerechte Streifen nach public/sprites/arena/fx_<name>.png (17.11., H1-Effekte).

    python3 -I scripts/baue-fx-streifen.py

Je Effekt: Quelle -> Streifen, alle Bilder gleich gross (Canvas des Effekts). Ausgegeben wird die
Tabelle (Bilder, Breite, Hoehe, Anker, fps), die der Motor als FX_BILD in battle-mode.engine.js fuehrt.
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROH = os.path.join(ROOT, "data", "generated", "pixellab-vfx", "roh")
ZIEL = os.path.join(ROOT, "public", "sprites", "arena")

EFFEKTE = {
    "fx_feuerwerk": "fx-feuerwerk-pro",
    "fx_funken": "fx-funken-pro",
    "fx_konfetti": "fx-konfetti-pro",
    "fx_klingen": "fx-klingen-lite",
    "fx_bodenstaub": "fx-bodenstaub-lite",
    "fx_eisstaub": "fx-eisstaub-lite",
    "fx_spritzer": "fx-spritzer-lite",
}


def main():
    tabelle = {}
    for ziel, quelle in EFFEKTE.items():
        blatt = Image.open(os.path.join(ROH, quelle + ".png")).convert("RGBA")
        meta = json.load(open(os.path.join(ROH, quelle + ".json")))
        auftrag = json.load(open(os.path.join(ROH, quelle + ".auftrag.json")))
        fr = meta["frames"]
        if isinstance(fr, dict):
            fr = list(fr.values())
        w, h = auftrag["canvas"]["w"], auftrag["canvas"]["h"]
        streifen = Image.new("RGBA", (w * len(fr), h), (0, 0, 0, 0))
        for i, f in enumerate(fr):
            r = f["frame"]
            streifen.paste(blatt.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])), (i * w, 0))
        streifen.save(os.path.join(ZIEL, ziel + ".png"), optimize=True)
        a = auftrag["anchor"]
        tabelle[ziel] = {"n": len(fr), "w": w, "h": h, "ax": a["x"], "ay": a["y"], "fps": auftrag["fps"]}
    print(json.dumps(tabelle))


if __name__ == "__main__":
    main()
