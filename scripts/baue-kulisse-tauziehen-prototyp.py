#!/usr/bin/env python3
"""KULISSE FUER DEN TAUZIEHEN-PROTOTYP (Format-Varianten 08.11., docs/design/format-varianten-machbarkeit-08-11.md).

"Hafenkante": die naechtliche Hafen-Szene der Gewichtheben-Sandsack-Runde (public/szenen/gewichtheben/
hafen.html, PixelLab) ohne Sandsack-Bahnen, Silo und Anzeigetexte, dafuer ein offenes Hafenbecken in der
Mitte, ueber das die Taue gespannt werden. Wer verliert, geht baden.

Verfahren wie die Motor-Kulissen (scripts/baue-kulisse-buehnen.py, scripts/lib/kulissen_werkzeug.py auf dem
Branch der Kulissen-Integration): nur Pixel der PixelLab-Szene, deterministisch, ohne API. Die Szene wird
NICHT skaliert, sondern mittig auf 1240x470 (die Motor-Leinwand) zugeschnitten, damit die Pixelkunst scharf
bleibt. Die Pflasterflaeche wird aus einem sauberen Stueck derselben Szene gekachelt (Ziegelperiode 24x28,
per Autokorrelation gemessen), das Becken ist in Pixeloptik dazugezeichnet.

Bewusst ein EIGENES Skript statt eines Eintrags in baue-kulisse-buehnen.py: jene Datei ist gerade in Arbeit
(Kulissen-Integration Batch 5), und ein Prototyp soll dort nichts anfassen.

    python3 -I scripts/baue-kulisse-tauziehen-prototyp.py

Zwei Bilder: hafenkante.png (Becken quer durch den Kai, Reihen-Ansicht) und hafengrube.png (runder Schacht,
Fables Bild "Die Grube", Stern-Ansicht).
"""

from __future__ import annotations

import base64
import io
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

WURZEL = Path(__file__).resolve().parent.parent
SZENE = WURZEL / "public" / "szenen" / "gewichtheben" / "hafen.html"
ZIEL = WURZEL / "public" / "mockups" / "tauziehen-prototyp" / "hafenkante.png"
LW, LH = 1240, 470
X0 = (1600 - LW) // 2  # 180: mittiger Zuschnitt der 1600 px breiten Szene

# Szenen-Koordinaten (1600x630)
OBEN_BIS = 158          # Himmel, Schiff, Kran, Kai-Laternen samt Lichtkegeln
SILO_KOPF = (745, 144, 857, OBEN_BIS)   # Kopf der Silo-Rinne, ragt ins obere Band
TAFELN = [(731, 18, 869, 72), (351, 44, 455, 96), (1151, 44, 1255, 96)]  # Innenflaechen der Anzeigetafeln
PFLASTER = (0, 350, 192, 434)  # sauberes Ziegelstueck (links der Station-2-Marke), 8x24 breit, 3x28 hoch

BECKEN_X0, BECKEN_X1 = 560, 680   # Leinwand-px: das offene Becken in der Mitte
KANTE = 7                          # Steinkante
GRUBE = (620, 318, 150, 62)        # Variante Grube: Mittelpunkt und Halbachsen der Schachtoeffnung (Leinwand-px)


def lade_bg() -> Image.Image:
    s = SZENE.read_text(encoding="utf-8")
    m = re.search(r'"bg"\s*:\s*"data:image/[a-z]+;base64,([A-Za-z0-9+/=]+)"', s)
    if not m:
        raise SystemExit(f"kein bg-Bild in {SZENE}")
    return Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert("RGB")


def tafel_leeren(bild: Image.Image, box) -> None:
    """Text/Ziffern einer Anzeigetafel weg: Innenflaeche in der dunkelsten Tafelfarbe, mit 1-px-Rahmen."""
    arr = np.asarray(bild.crop(box), dtype=np.int32)
    lum = arr.sum(axis=2)
    dunkel = tuple(int(v) for v in np.median(arr[lum <= np.percentile(lum, 30)], axis=0))
    d = ImageDraw.Draw(bild)
    d.rectangle(box, fill=dunkel)


def kachel(flaeche: Image.Image, w: int, h: int, versatz_y: int = 0) -> Image.Image:
    aus = Image.new("RGB", (w, h))
    tw, th = flaeche.size
    for y in range(-((versatz_y) % th), h, th):
        for x in range(0, w, tw):
            aus.paste(flaeche, (x, y))
    return aus


def wasser(w: int, h: int, saat: int = 811) -> Image.Image:
    """Hafenwasser in Pixeloptik: Grundton der Szenen-Nacht, waagerechte Kraeuselstriche, Mondglitzer."""
    rng = np.random.default_rng(saat)
    arr = np.zeros((h, w, 3), np.uint8)
    for y in range(h):
        t = y / max(1, h - 1)
        arr[y, :] = (int(14 + 6 * t), int(30 + 10 * t), int(58 + 14 * t))
    bild = Image.fromarray(arr)
    d = ImageDraw.Draw(bild)
    for _ in range(int(w * h / 90)):
        x, y = int(rng.integers(0, w)), int(rng.integers(0, h))
        l = int(rng.integers(3, 12))
        hell = rng.random()
        farbe = (70, 110, 150) if hell > 0.85 else (34, 62, 98)
        d.line((x, y, x + l, y), fill=farbe)
    for _ in range(int(h / 6)):
        x, y = int(rng.integers(w * 0.3, w * 0.7)), int(rng.integers(0, h))
        d.point((x, y), fill=(220, 220, 170))
    return bild


def main() -> None:
    bg = lade_bg()
    for box in TAFELN:
        tafel_leeren(bg, box)
    flaeche = bg.crop(PFLASTER)
    # Silo-Kopf im oberen Band mit Pflaster zumalen (Ziegelphase an der Szenenzeile ausrichten)
    kopf = kachel(flaeche, SILO_KOPF[2] - SILO_KOPF[0], SILO_KOPF[3] - SILO_KOPF[1],
                  versatz_y=SILO_KOPF[1] - PFLASTER[1])
    bg.paste(kopf, SILO_KOPF[:2])

    lein = Image.new("RGB", (LW, LH))
    lein.paste(bg.crop((X0, 0, X0 + LW, OBEN_BIS)), (0, 0))
    unten = kachel(flaeche, LW, LH - OBEN_BIS, versatz_y=OBEN_BIS - PFLASTER[1])
    lein.paste(unten, (0, OBEN_BIS))

    # Becken: Wasser, Steinkanten, Schatten der Kaimauer, Leitern, Poller, Warnstreifen
    d = ImageDraw.Draw(lein)
    becken_y0 = OBEN_BIS - 6
    lein.paste(wasser(BECKEN_X1 - BECKEN_X0, LH - becken_y0), (BECKEN_X0, becken_y0))
    for y in range(becken_y0, LH):  # Mauerschatten am Wasserrand (links/rechts)
        for k in range(10):
            a = 1 - k / 10
            for x in (BECKEN_X0 + k, BECKEN_X1 - 1 - k):
                r, g, b = lein.getpixel((x, y))
                lein.putpixel((x, y), (int(r * (1 - 0.55 * a)), int(g * (1 - 0.55 * a)), int(b * (1 - 0.55 * a))))
    stein, stein_hell, stein_dunkel = (128, 126, 132), (168, 166, 170), (78, 76, 84)
    for x0 in (BECKEN_X0 - KANTE, BECKEN_X1):
        d.rectangle((x0, becken_y0, x0 + KANTE - 1, LH), fill=stein)
        d.line((x0, becken_y0, x0, LH), fill=stein_hell)
        d.line((x0 + KANTE - 1, becken_y0, x0 + KANTE - 1, LH), fill=stein_dunkel)
        for y in range(becken_y0 + 9, LH, 18):  # Fugen
            d.line((x0 + 1, y, x0 + KANTE - 2, y), fill=stein_dunkel)
    # Warnstreifen gelb/schwarz auf dem Pflaster vor der Kante
    for x0, x1 in ((BECKEN_X0 - KANTE - 14, BECKEN_X0 - KANTE - 1), (BECKEN_X1 + KANTE, BECKEN_X1 + KANTE + 13)):
        for y in range(becken_y0, LH):
            for x in range(x0, x1 + 1):
                gelb = ((x + y) // 5) % 2 == 0
                if gelb:
                    lein.putpixel((x, y), (214, 172, 44))
                else:
                    r, g, b = lein.getpixel((x, y))
                    lein.putpixel((x, y), (int(r * 0.45), int(g * 0.45), int(b * 0.45)))
    # Eiserne Leitern in der Kaimauer
    for lx, ly in ((BECKEN_X0 + 2, 250), (BECKEN_X1 - 12, 360)):
        for sx in (lx, lx + 9):
            d.line((sx, ly, sx, ly + 70), fill=(58, 52, 50))
        for sy in range(ly + 4, ly + 70, 9):
            d.line((lx, sy, lx + 9, sy), fill=(92, 84, 78))
    # Poller oben an beiden Kanten
    for px in (BECKEN_X0 - KANTE - 34, BECKEN_X1 + KANTE + 22):
        d.ellipse((px, OBEN_BIS + 2, px + 14, OBEN_BIS + 10), fill=(40, 40, 46))
        d.rectangle((px + 3, OBEN_BIS - 6, px + 11, OBEN_BIS + 6), fill=(52, 52, 60))
        d.ellipse((px + 1, OBEN_BIS - 9, px + 13, OBEN_BIS - 3), fill=(70, 70, 80))

    ZIEL.parent.mkdir(parents=True, exist_ok=True)
    lein.save(ZIEL, optimize=True)
    print(f"geschrieben: {ZIEL.relative_to(WURZEL)} ({LW}x{LH})")

    # ---- Variante "Grube" (Fables Bild, Brainstorm Abschnitt 2.3): runder Schacht im Kai statt Becken.
    grube = Image.new("RGB", (LW, LH))
    grube.paste(bg.crop((X0, 0, X0 + LW, OBEN_BIS)), (0, 0))
    grube.paste(unten, (0, OBEN_BIS))
    cx, cy, rx, ry = GRUBE
    # Warnring, Steinrand, Wasser mit Innenschatten
    maske = Image.new("L", (LW, LH), 0)
    ImageDraw.Draw(maske).ellipse((cx - rx - 20, cy - ry - 10, cx + rx + 20, cy + ry + 10), fill=255)
    ImageDraw.Draw(maske).ellipse((cx - rx - 8, cy - ry - 4, cx + rx + 8, cy + ry + 4), fill=0)
    streifen = Image.new("RGB", (LW, LH))
    sa = np.asarray(grube, dtype=np.float32) * 0.45
    yy, xx = np.mgrid[0:LH, 0:LW]
    gelb = ((xx + yy) // 6) % 2 == 0
    sa[gelb] = (214, 172, 44)
    streifen = Image.fromarray(sa.astype(np.uint8))
    grube.paste(streifen, (0, 0), maske)
    d = ImageDraw.Draw(grube)
    d.ellipse((cx - rx - 8, cy - ry - 4, cx + rx + 8, cy + ry + 4), fill=stein)
    d.ellipse((cx - rx - 8, cy - ry - 4, cx + rx + 8, cy + ry + 4), outline=stein_hell)
    wmaske = Image.new("L", (LW, LH), 0)
    ImageDraw.Draw(wmaske).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
    w = wasser(2 * rx, 2 * ry + 40, saat=912)
    wl = Image.new("RGB", (LW, LH)); wl.paste(w, (cx - rx, cy - ry))
    # Schacht-Innenwand: obere Haelfte dunkle Mauer (man schaut hinein), Wasser tiefer
    wand = Image.new("L", (LW, LH), 0)
    ImageDraw.Draw(wand).ellipse((cx - rx, cy - ry, cx + rx, cy + ry - 22), fill=255)
    grube.paste(wl, (0, 0), wmaske)
    wa = np.asarray(grube, dtype=np.float32)
    wm = (np.asarray(wand) > 0) & (np.asarray(wmaske) > 0)
    # Mauer: oberes Segment (zwischen Rand und um 22 px versetzter Ellipse) als Ziegelschatten
    innen = Image.new("L", (LW, LH), 0)
    ImageDraw.Draw(innen).ellipse((cx - rx, cy - ry + 22, cx + rx, cy + ry), fill=255)
    mauer = (np.asarray(wmaske) > 0) & ~(np.asarray(innen) > 0)
    ziegel = np.asarray(kachel(flaeche, LW, LH), dtype=np.float32) * 0.42
    wa[mauer] = ziegel[mauer]
    grube = Image.fromarray(wa.astype(np.uint8))
    d = ImageDraw.Draw(grube)
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), outline=stein_dunkel)
    for px, py in ((cx - rx - 70, cy - ry - 40), (cx + rx + 56, cy - ry - 40), (cx - rx - 70, cy + ry + 24), (cx + rx + 56, cy + ry + 24)):
        d.ellipse((px, py + 8, px + 14, py + 16), fill=(40, 40, 46))
        d.rectangle((px + 3, py, px + 11, py + 12), fill=(52, 52, 60))
        d.ellipse((px + 1, py - 3, px + 13, py + 3), fill=(70, 70, 80))
    ziel2 = ZIEL.with_name("hafengrube.png")
    grube.save(ziel2, optimize=True)
    print(f"geschrieben: {ziel2.relative_to(WURZEL)} ({LW}x{LH})")


if __name__ == "__main__":
    main()
