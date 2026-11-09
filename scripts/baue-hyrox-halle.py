#!/usr/bin/env python3
"""
Baut die HYROX-HALLENRUNDE-Kulisse: public/sprites/arena/hyrox_halle.jpg

    python3 -I scripts/baue-hyrox-halle.py

Ableitung aus `public/szenen/spurt/hyrox.jpg` (PixelLab, Asset-Runde 01./02.11.) -- KEIN
neuer PixelLab-Auftrag, dasselbe Verfahren wie die Boegen aus Batch 15
(`scripts/baue-kulisse-buehnen.py --spurt-requisiten`) und wie die Demo-Szene
`scripts/baue-spurt-szene.py` (`PATCHES`/`clean_bg()`, hier woertlich uebernommen statt neu
erfunden, s. docs/design/spurt-hyrox-routen-design-opus-09-11.md Abschnitt 6.6).

Zwei Schritte:
  1. `clean_bg()`/`PATCHES` (identisch zu baue-spurt-szene.py): die sechs eingebrannten
     Demo-Figuren heraus stempeln.
  2. DREI WEITERE FLICKEN (`EXTRA`): die uebrigen Schlitten vom Kunstrasen nehmen, denn
     dort stehen in der Hallenrunde ab jetzt die Stationssprites (Wassergraben/Mauer/
     Strohballen) statt vier Schlitten.

Reine Anzeige -- kein Bezug zur Wertung, nichts im Spielcode liest dieses Bild direkt
(der Motor laedt es ueber `hallenBild["hyrox_halle"]`, s. battle-mode.engine.js).
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_JPG = os.path.join(ROOT, "public", "szenen", "spurt", "hyrox.jpg")
OUT = os.path.join(ROOT, "public", "sprites", "arena", "hyrox_halle.jpg")

# ------------------------------------------------------------------ dieselben Flicken wie
# scripts/baue-spurt-szene.py (clean_bg()/PATCHES) -- woertlich uebernommen, damit beide
# Ableitungen bei einer kuenftigen Aenderung der Rohszene nicht auseinanderlaufen.
PATCHES = [
    ((1095, 38, 1182, 116), -311),   # Johanna auf der oberen Geraden
    ((532, 798, 600, 860), +311),    # Kiti auf der unteren Geraden (samt Pfeil darunter)
    ((316, 236, 410, 294), +130),    # Wurzelbert + Schlitten, Kunstrasen Bahn 2
    ((436, 588, 484, 620), -150),    # gruene Kettlebells mitten in Bahn 2
    ((1140, 620, 1178, 688), -250),  # Wurzelbert in Box 3 (bringt den Ersatzball mit)
    ((1148, 512, 1172, 538), -250),  # Wall Ball in der Luft
]

# DREI WEITERE FLICKEN (Design-Dokument 6.6): die uebrigen Schlitten der Rasenbahnen 1/3/4
# nehmen -- Bahn 2 ist durch PATCHES oben schon frei (Wurzelbert + sein Schlitten). Quelle
# je Flicken: ein Stueck leerer Kunstrasen aus der NAECHSTEN Rasenbahn, waagerecht versetzt
# um ein Vielfaches der Bahnbreite (138 px, aus den vier Rasenbahn-Mitten y=218/274/330/385
# hergeleitet), damit Fugen/Linien des Rasens weiter zueinander passen.
EXTRA = [
    ((222, 186, 268, 238), +100),   # Schlitten Rasenbahn 1
    ((518, 296, 564, 348), -150),   # Schlitten Rasenbahn 3
    ((222, 352, 268, 404), +100),   # Schlitten Rasenbahn 4
]


def clean_bg():
    im = Image.open(SRC_JPG).convert("RGB")
    src = im.copy()
    for (x0, y0, x1, y1), dx in PATCHES:
        im.paste(src.crop((x0 + dx, y0, x1 + dx, y1)), (x0, y0))
    # EXTRA-Flicken aus dem bereits einmal geflickten Bild schneiden (nicht aus `src`):
    # sonst waere die Schlitten-Lage von PATCHES in der Quelle fuer EXTRA noch sichtbar.
    src2 = im.copy()
    for (x0, y0, x1, y1), dx in EXTRA:
        im.paste(src2.crop((x0 + dx, y0, x1 + dx, y1)), (x0, y0))
    return im


def enc_jpg_save(im, path):
    # Dieselben Parameter wie enc_jpg() in baue-spurt-szene.py: die Vorlage ist selbst ein
    # JPEG, subsampling=0 haelt die Lichtkegel ohne Farbbaender.
    im.save(path, "JPEG", quality=92, subsampling=0)


def main():
    bg = clean_bg()
    if os.environ.get("SZENEN_DEBUG"):
        bg.save(os.path.join(os.environ["SZENEN_DEBUG"], "hyrox-halle-bg.png"))
    enc_jpg_save(bg, OUT)
    groesse = os.path.getsize(OUT) / 1e6
    print("geschrieben:", os.path.relpath(OUT, ROOT), f"{groesse:.2f} MB", bg.size)


if __name__ == "__main__":
    main()
