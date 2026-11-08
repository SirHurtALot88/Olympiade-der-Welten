#!/usr/bin/env python3
"""ZEITFAHREN-KULISSEN FUER DEN MOTOR (Kulissen-Integration, Batch 8, 08.11.).

Eigene Datei statt eines weiteren Bausteins in scripts/baue-kulisse-buehnen.py, weil die
Zeitfahren-Szenen anders gebaut sind als alle bisherigen: keine eingebetteten base64-Bilder in einer
HTML, sondern je Streckenkarte vier Parallax-Ebenen als eigene PNGs (`far`, `mid`, `course`, `front`,
4000 px breit, Hoehe je Karte verschieden: 432..760), elf Varianten (Standard + 10 Streckenkarten).
Die Szene ist eine SEITENANSICHT mit eigenem, eingebranntem Hoehenprofil: die Strasse in `course.png`
steigt und faellt nach der Demo-Strecke, nicht nach `BAHN_ART["time-trial"].gelaende` des Motors.

Der Motor (bodenZeitfahren() -> bodenSpurtGerade()) zeigt das Rennen in Draufsicht: zwoelf Bahnen im
Band H*0.14..H*0.94, darueber ein Kopfstreifen, in dem er die Hoehensilhouette aus `gelaende` zeichnet
(ZF_HUEGEL_PX je Steigung), auf der Bahn die Zonen-Toenung samt Schraffur und Glyphen. Die Kulisse darf
deshalb KEIN eigenes Profil mitbringen — sichtbar ist allein das Profil aus `gelaende`. Sie liefert nur:

  1. Kopfstreifen (0..H*0.14): das Panorama der Karte (`far` + `mid`: Himmel, Berge, Kueste, Weinberge,
     Vulkan …) knapp ueber Strassenhoehe, verkleinert, ohne die Strasse (`course`) und ohne die
     Demo-Zutaten (`front`: Zwischenzeit-Tafeln, Schilder). Unten ein schmaler Grasrand der Karte.
     Die Hoehensilhouette des Motors legt sich davor.
  2. Bahnband (H*0.14..H*0.94): der Asphalt der Karte aus dem flachen Stueck hinter der Startrampe
     (zwischen den beiden weissen Randlinien), Mittelstriche entfernt, gespiegelt gekachelt.
     Bahnlinien, Zonen-Toenung, Start und Ziel zeichnet der Motor.
  3. Fussstreifen (H*0.94..H): der Grasrand unter der Strasse der Karte.

Die Startrampe, die Strassenmarkierungen (ALLEZ KITI/HOPP) und die Demo-Figuren kommen nicht mit.
Nur Pixel der PixelLab-Szenen, deterministisch, ohne API. Ergebnis:
data/generated/kulissen-quellen/time-trial/<variante>.png (1240x470); baue-arena-kulissen.py
(Chassis "quelle") macht daraus die Motor-Kulisse.

    python3 -I scripts/baue-kulisse-zeitfahren.py [variante ...]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

WURZEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WURZEL / "scripts" / "lib"))
from kulissen_werkzeug import LH, LW, linien_entfernen, speichere_quelle  # noqa: E402

SZENE = WURZEL / "public" / "szenen" / "time-trial"
# Motor: bodenSpurtGerade()/bodenZeitfahren() — oben=H*0.14, unten=H*0.94 (tests/arena-kulissen.test.ts).
ZF_OBEN, ZF_UNTEN = round(LH * 0.14), round(LH * 0.94)
VARIANTEN = ["standard", "bergzeitfahren-alpen", "etappe-pass", "abfahrt-kamm", "etappe-kueste",
             "flachsprint-kueste", "etappe-mittelgebirge", "huegel-weinberge", "etappe-strade-bianche",
             "etappe-vulkan", "wueste-hitze"]
# Alle Karten haben denselben Grundriss am Start: Startrampe bis x=335, danach ein flaches Stueck
# Strasse mit zwei weissen Randlinien (je 2 px) im Abstand 34 px; nur deren Hoehe ist je Karte anders.
ZF_ASPHALT_X = (350, 478)
ZF_RAND_ABSTAND = 34
ZF_PANORAMA_SKALA = 0.25  # Szenen-px -> Leinwand im Kopfstreifen
ZF_PANORAMA_X0 = 1000  # erste Spalte des wiederholten Panoramabands (s. baue_zeitfahren)
ZF_PANORAMA_UNTER = 30  # Szenen-px unter der Kante, ab der die mittlere Ebene dicht ist
ZF_GRAS_H = 8  # Grasrand unten im Kopfstreifen (Leinwand-px)


def ebenen(variante: str) -> dict[str, Image.Image]:
    ordner = SZENE / ("demo-assets" if variante == "standard" else f"{variante}/assets")
    return {n: Image.open(ordner / f"{n}.png").convert("RGBA") for n in ("far", "mid", "course")}


def weisse_zeilen(course: np.ndarray, x: int) -> set[int]:
    c = course[:, x]
    m = (c[:, 3] > 200) & (c[:, :3].min(axis=1) > 200) & (np.ptp(c[:, :3], axis=1) < 40)
    return set(np.nonzero(m)[0].tolist())


def strasse_finden(course: np.ndarray) -> tuple[int, int, int]:
    """(y0 der oberen Randlinie, x_von, x_bis) des flachen Strassenstuecks hinter der Startrampe.

    Das Stueck ist fuer alle Karten dasselbe (ZF_ASPHALT_X): hinter der schraegen Startlinie und vor
    dem ersten Anstieg (die frueheste Steigung beginnt bei Huegel & Weinberge an x=482). Gesucht wird
    nur die Hoehe: die oberste weisse Zeile in der Mitte des Stuecks, deren Gegenstueck 34 px tiefer
    ebenfalls weiss ist."""
    xa, xb = ZF_ASPHALT_X
    # Ueber das ganze Stueck gezaehlt: bei Wueste & Hitze sind die Randlinien versandet und haben Luecken.
    zaehler: dict[int, int] = {}
    for x in range(xa, xb):
        for y in weisse_zeilen(course, x):
            zaehler[y] = zaehler.get(y, 0) + 1
    w = {y for y, n in zaehler.items() if n >= (xb - xa) // 3}
    for y0 in sorted(w):
        if w & {y0 + ZF_RAND_ABSTAND - 1, y0 + ZF_RAND_ABSTAND, y0 + ZF_RAND_ABSTAND + 1}:
            return y0, xa, xb
    raise SystemExit("keine Strasse (zwei Randlinien im Abstand 34 px) hinter der Startrampe gefunden")


def kacheln(stueck: Image.Image, breite: int, hoehe: int, senkrecht: bool = True) -> Image.Image:
    """Abwechselnd gespiegelt gekachelt, ohne Kanten."""
    aus = Image.new("RGB", (breite, hoehe))
    for j, y in enumerate(range(0, hoehe, stueck.height)):
        for i, x in enumerate(range(0, breite, stueck.width)):
            t = stueck
            if i % 2:
                t = t.transpose(Image.FLIP_LEFT_RIGHT)
            if senkrecht and j % 2:
                t = t.transpose(Image.FLIP_TOP_BOTTOM)
            aus.paste(t, (x, y))
    return aus


def baue_zeitfahren(variante: str) -> Image.Image:
    e = ebenen(variante)
    course_rgb = Image.new("RGBA", e["course"].size, (0, 0, 0, 255))
    course_rgb.alpha_composite(e["course"])
    course = np.asarray(e["course"])
    y0, xa, xb = strasse_finden(course)
    lein = Image.new("RGB", (LW, LH))

    # 2. Bahnband: Asphalt zwischen den Randlinien (ohne deren Antialiasing-Zeile), Mittelstriche weg.
    asphalt = course_rgb.crop((xa + 2, y0 + 3, xb - 2, y0 + ZF_RAND_ABSTAND - 1)).convert("RGB")
    a = np.asarray(asphalt, dtype=np.int32)
    hell = a.mean(axis=2) > a.mean() + 45
    maske = np.asarray(Image.fromarray(hell.astype(np.uint8) * 255).resize(asphalt.size)) > 0
    maske = maske | np.roll(maske, 1, 0) | np.roll(maske, -1, 0) | np.roll(maske, 1, 1) | np.roll(maske, -1, 1)
    asphalt = linien_entfernen(asphalt, maske, schritte=(3, 5, 8))
    # Helligkeit je Zeile/Spalte angleichen (kein Schatten der Randlinie wiederholt sich als Streifen).
    b = np.asarray(asphalt, dtype=np.float32)
    b = b - b.mean(axis=1, keepdims=True) + b.mean(axis=(0, 1), keepdims=True)
    b = b - b.mean(axis=0, keepdims=True) + b.mean(axis=(0, 1), keepdims=True)
    asphalt = Image.fromarray(np.clip(b, 0, 255).astype(np.uint8))
    asphalt = asphalt.resize((asphalt.width * 2, asphalt.height * 2), Image.NEAREST)
    lein.paste(kacheln(asphalt, LW, ZF_UNTEN - ZF_OBEN), (0, ZF_OBEN))

    # 3. Fussstreifen: Grasrand unter der Strasse (2 px Abstand zur Randlinie), doppelt hoch.
    fuss_h = LH - ZF_UNTEN
    gras_u = course_rgb.crop((xa, y0 + ZF_RAND_ABSTAND + 3, xb, y0 + ZF_RAND_ABSTAND + 3 + (fuss_h + 1) // 2))
    gras_u = gras_u.convert("RGB").resize((gras_u.width * 2, gras_u.height * 2), Image.NEAREST)
    lein.paste(kacheln(gras_u, LW, fuss_h, senkrecht=False), (0, ZF_UNTEN))

    # 1. Kopfstreifen: Panorama aus far+mid, ohne Strasse (`course`) und Demo-Zutaten (`front`). Die
    # Strasse liegt je Karte auf ganz anderer Hoehe (Abfahrt Kamm startet oben bei y=152, Bergzeitfahren
    # Alpen unten bei y=662), taugt also nicht als Bezug. Bezug ist die Hoehe, ab der die mittlere Ebene
    # (Waldrand, Huegel, Duenen) dicht wird: das Fenster endet ZF_PANORAMA_UNTER px darunter und reicht
    # nach oben ueber Berge bzw. Kueste und Himmel.
    pan = e["far"].copy()
    pan.alpha_composite(e["mid"])
    pan = pan.convert("RGB")
    pan_h = ZF_OBEN - ZF_GRAS_H
    dicht = np.nonzero((np.asarray(e["mid"])[:, :, 3] > 128).mean(axis=1) > 0.6)[0]
    unter = min(pan.height, (int(dicht[0]) if len(dicht) else pan.height) + ZF_PANORAMA_UNTER)
    # Hoechstens ZF_PANORAMA_SKALA verkleinert, aber nie breiter als die Ebene (4000 px): sonst
    # bliebe rechts ein schwarzer Rest.
    # Links (bis etwa x=800) traegt jede `far`-Ebene ein ausgemaltes Startbild (Gipfel, Felsbucht,
    # Vulkan), das mit harter Kante in das wiederholte Band uebergeht. Die Kante saehe im Kopfstreifen
    # wie ein Bruch aus, also nur das Band ab ZF_PANORAMA_X0.
    # Ist das Band verkleinert schmaler als die Leinwand, wird es gespiegelt fortgesetzt (Landschaft
    # ohne Schrift, die Spiegelung faellt nicht auf) — so bleiben die Gipfel im Bild, statt dass das
    # Fenster flacher wird.
    hoehe_szene = min(round(pan_h / ZF_PANORAMA_SKALA), unter)
    band = pan.crop((ZF_PANORAMA_X0, unter - hoehe_szene, pan.width, unter))
    band = band.resize((round(band.width * pan_h / hoehe_szene), pan_h), Image.LANCZOS)
    kopf = kacheln(band, LW, pan_h, senkrecht=False)
    lein.paste(kopf, (0, 0))
    gras_o = course_rgb.crop((xa, y0 - ZF_GRAS_H // 2 - 1, xb, y0 - 1)).convert("RGB")
    gras_o = gras_o.resize((gras_o.width * 2, gras_o.height * 2), Image.NEAREST)
    lein.paste(kacheln(gras_o, LW, ZF_GRAS_H, senkrecht=False), (0, pan_h))
    return lein


def main() -> None:
    varianten = [a for a in sys.argv[1:] if not a.startswith("--")] or VARIANTEN
    for v in varianten:
        ziel = speichere_quelle("time-trial", v, baue_zeitfahren(v))
        print(f"time-trial/{v}: -> {ziel.relative_to(WURZEL)}")


if __name__ == "__main__":
    main()
