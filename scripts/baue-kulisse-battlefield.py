#!/usr/bin/env python3
"""BATTLEFIELD-KULISSE FUER DEN MOTOR (Kulissen-Integration 07.11.).

Die Battlefield-Szenen der Asset-Runde (public/szenen/battlefield/{eroberung,wuestenruine}.html)
haben ihre drei Eroberungspunkte zwar ebenfalls in einer senkrechten Reihe, aber im Massstab und
Ausschnitt der Demo (1280x840, Orte bei y=221,5/445,5/669,5, 224 px Abstand). Der Motor rechnet sie
auf der Leinwand 1240x470 bei x=MID, y=85/235/385 (ARENA_DOMINATION.battlefield.orte, Radius 65).
Ein Zuschnitt wie bei TDM (baue-arena-kulissen.py, Chassis "arena") setzte Turm, Altar und
Brueckenkopf deshalb neben die Fahnen des Motors — der offene Punkt aus
docs/design/arena-kulissen-im-motor-03-11.md.

Dieses Skript baut eine Kulisse, deren Landmarken genau auf den Motor-Orten liegen. Es benutzt
ausschliesslich Pixel der PixelLab-Szene (kein Nachmalen, keine API, deterministisch):

  1. Demo-Zutaten entfernen (in Szenen-Aufloesung):
     - die eingebrannten Besitz-Ringe (grau/schwarz/gelb = Demo-Spielstand) und die gestrichelten
       Demo-Heimkreise: jedes Ringpixel nimmt das an der naechsten Ringkante gespiegelte Pixel,
       so laeuft die echte Koernung von Gras und Erde durch;
     - A/B/C-Steinplatten (der Motor nennt die Orte Nord/Mitte/Sued), Demo-Fahnenmasten (der Motor
       zeichnet seinen eigenen Mast), Team-Banner mit den Demo-Kuerzeln V-W/A-A, Kisten und
       Sandsaecke (Hindernisse, die der Motor nicht kennt — Kaempfer liefen sichtbar hindurch,
       dieselbe Regel wie bei TDM) und Fluss/Steg am unteren Rand: zugeflickt mit dem Bodenstueck
       derselben Szene, dessen Umrandung am besten passt (Verfahren wie hindernisse_zumalen()).
  2. Den Turm (Ort A) um TURM_VERSATZ nach unten setzen: an seinem Szenenplatz ragte er bei y=-39
     aus der Leinwand und laege unter der Vier-Team-Tafel. Altar und Brueckenkopf bleiben, wo die
     Szene sie hat.
  3. Gleichmaessig skalieren mit S = 150/224 (Ortsabstand Motor / Szene), Szenen-Ort B auf
     (MID, 235) — damit liegen A auf (MID, 85) und C auf (MID, 385), ohne Verzerrung.
  4. Die Szene ist bei diesem Massstab zwischen den Palisaden nur ~755 px breit. Die Palisaden
     (sie stuenden bei x~220/1020 mitten in den Heimfeldern des Vierer-Pods) fallen weg; links und
     rechts wird das Spielfeld an der Palisadenlinie gespiegelt fortgesetzt. Der halbe Heimplatz an
     der Mauer wird so zum ganzen, die Wege laufen aus dem Bild hinaus.

Ergebnis: data/generated/kulissen-quellen/battlefield/<variante>.png (1240x470, verlustfrei).
baue-arena-kulissen.py (Chassis "quelle") macht daraus die Motor-Kulisse.

Nur Darstellung: ARENA_DOMINATION, Radien, Heimorte und Wertung bleiben unberuehrt.

    python3 -I scripts/baue-kulisse-battlefield.py [eroberung wuestenruine]
"""

from __future__ import annotations

import base64
import io
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WURZEL = Path(__file__).resolve().parent.parent
ZIEL = WURZEL / "data" / "generated" / "kulissen-quellen" / "battlefield"

LW, LH = 1240, 470
MID = LW / 2
# Szenen-Geometrie (vermessen an den Ringen der Demo-Szene; beide Varianten identisch)
ORTE_SZENE_Y = (221.5, 445.5, 669.5)
ORT_X = 639.5
RING_RX, RING_RY = 112.5, 91.5  # Mittellinie des eingebrannten Rings
HEIMKREIS = ((84.5, 445.0, 77.0), (1195.5, 445.0, 77.0))  # gestrichelte Demo-Heimkreise
PLATTEN_Y = (296, 520, 744)  # A/B/C-Steinplatten unter jedem Ring
# Spiegelachsen links/rechts: mitten durch die Heimplaetze, innen an den Demo-Bannern vorbei
# (Banner x 83..118 bzw. 1162..1197 samt Schatten). Was aussen liegt — Palisade, Tor, Banner,
# Heimkreis — faellt weg, der Heimplatz wird an der Achse zum ganzen Rund gespiegelt.
SPIEGEL_X = (128, 1152)
FLUSS_Y = 781  # Oberkante Fluss (Eroberung) bzw. Kanal (Wuestenruine)
STEG_Y = 757  # Anfang des Stegs unter Ort C
# Motor-Geometrie (ARENA_DOMINATION.battlefield.orte: fy 85/470, 0.5, 385/470)
ORTE_MOTOR_Y = (85, 235, 385)
S = (ORTE_MOTOR_Y[2] - ORTE_MOTOR_Y[0]) / (ORTE_SZENE_Y[2] - ORTE_SZENE_Y[0])
TURM_VERSATZ = 39  # Szenen-px (~26 px auf der Leinwand)
TURM_ERDE_Y = 165  # Oberkante der Erdflaeche von Ort A (Szene)


def auf_leinwand(sx: float, sy: float) -> tuple[float, float]:
    return MID + (sx - ORT_X) * S, ORTE_MOTOR_Y[1] + (sy - ORTE_SZENE_Y[1]) * S


def lade(variante: str):
    s = (WURZEL / "public" / "szenen" / "battlefield" / f"{variante}.html").read_text(encoding="utf-8")
    bg = Image.open(io.BytesIO(base64.b64decode(
        re.search(r'"bg"\s*:\s*"data:image/[a-z]+;base64,([A-Za-z0-9+/=]+)"', s).group(1)))).convert("RGB")
    i = s.find('"objs":[')
    block = s[i: s.find("}]", i) + 2]
    objs = []
    for m in re.finditer(r'\{"src":"data:image/[a-z]+;base64,([A-Za-z0-9+/=]+)","x":(-?\d+),"y":(-?\d+),"w":(\d+),"h":(\d+)', block):
        x, y, w, h = map(int, m.groups()[1:5])
        im = Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert("RGBA").resize((w, h), Image.NEAREST)
        objs.append({"bild": im, "x": x, "y": y, "w": w, "h": h})
    return bg, objs


def ist_landmarke(o) -> bool:
    """Turm, Altar, Saeulen, Barrikade: breiter als ein Fahnenmast und in der Ortsspalte."""
    return o["w"] >= 20 and o["x"] < ORT_X + 80 and o["x"] + o["w"] > ORT_X - 80


def ist_turm(o) -> bool:
    return ist_landmarke(o) and o["y"] + o["h"] < ORTE_SZENE_Y[0]


def alpha_maske(o, schwelle: int = 40) -> Image.Image:
    return o["bild"].getchannel("A").point(lambda v: 255 if v > schwelle else 0)


def ringe_spiegeln(a: np.ndarray, schutz: np.ndarray, halb: float = 9.0) -> None:
    """Ersetzt jedes Pixel im Ringband (+-halb um die Mittellinie) durch das an der naeheren Bandkante
    gespiegelte. Liegt das Spiegelpixel auf einer Landmarke (Saeule, Barrikade), wird an der anderen
    Kante gespiegelt — sonst wanderten Steinsplitter in die Wiese."""
    hh, ww = a.shape[:2]
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float64)
    schutz_weit = np.asarray(Image.fromarray(schutz.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))) > 0
    kreise = [(ORT_X, cy, RING_RX, RING_RY) for cy in ORTE_SZENE_Y] + [(cx, cy, r, r) for cx, cy, r in HEIMKREIS]
    for cx, cy, rx, ry in kreise:
        dx, dy = xx - cx, yy - cy
        d = np.sqrt((dx / rx) ** 2 + (dy / ry) ** 2) + 1e-9
        r_lok = np.sqrt(dx ** 2 + dy ** 2) / d  # Ellipsenradius in dieser Richtung
        t = (d - 1) * r_lok  # Abstand zur Mittellinie in px (+ aussen)
        band = (np.abs(t) <= halb) & ~schutz

        def quelle(t_q):
            f = (1 + t_q / r_lok) / d
            return (np.clip(np.rint(cx + dx * f), 0, ww - 1).astype(int),
                    np.clip(np.rint(cy + dy * f), 0, hh - 1).astype(int))

        aussen, innen = quelle(2 * halb + 1 - t), quelle(-2 * halb - 1 - t)
        nah_aussen = t >= 0
        qx = np.where(nah_aussen, aussen[0], innen[0])
        qy = np.where(nah_aussen, aussen[1], innen[1])
        blockiert = schutz_weit[qy, qx]
        qx = np.where(blockiert, np.where(nah_aussen, innen[0], aussen[0]), qx)
        qy = np.where(blockiert, np.where(nah_aussen, innen[1], aussen[1]), qy)
        ok = band & ~schutz_weit[qy, qx]
        a[ok] = a[qy[ok], qx[ok]]


def ueberlappt(a, b) -> bool:
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def flicken(bild: Image.Image, ziele, verboten, bereich, ring: int = 8, schritt: int = 3) -> Image.Image:
    """Jedes Zielrechteck bekommt das Bodenstueck gleicher Groesse, dessen Umrandung (8-px-Ring) am
    besten passt — verglichen vor allem im Muster (Bild minus Unschaerfe), wie hindernisse_zumalen()
    in baue-arena-kulissen.py. Quellen duerfen kein Ziel und nichts aus `verboten` beruehren."""
    roh = np.asarray(bild, dtype=np.float32)
    weich = np.asarray(bild.filter(ImageFilter.GaussianBlur(6)), dtype=np.float32)
    arr = (roh - weich) + 0.35 * weich
    aus = bild.copy()
    bx0, by0, bx1, by1 = bereich
    sperre = list(ziele) + list(verboten)
    for x0, y0, x1, y1 in ziele:
        w, h = x1 - x0, y1 - y0
        innen = np.ones((h + 2 * ring, w + 2 * ring), bool)
        innen[ring:ring + h, ring:ring + w] = False

        def umrandung(px, py):
            return arr[py - ring: py + h + ring, px - ring: px + w + ring][innen]

        ziel = umrandung(x0, y0)
        best, quelle = None, None
        for qy in range(by0 + ring, by1 - h - ring, schritt):
            for qx in range(bx0 + ring, bx1 - w - ring, schritt):
                q = (qx - ring, qy - ring, qx + w + ring, qy + h + ring)
                if any(ueberlappt(q, o) for o in sperre):
                    continue
                dd = float(np.mean((umrandung(qx, qy) - ziel) ** 2))
                if best is None or dd < best:
                    best, quelle = dd, (qx, qy)
        if quelle is None:
            print(f"    WARNUNG: kein freies Bodenstueck fuer {(x0, y0, x1, y1)}", file=sys.stderr)
            continue
        qx, qy = quelle
        stueck = bild.crop((qx - ring, qy - ring, qx + w + ring, qy + h + ring))
        kern = Image.new("L", stueck.size, 0)
        ImageDraw.Draw(kern).rectangle((ring, ring, ring + w - 1, ring + h - 1), fill=255)
        maske = Image.composite(kern, kern.filter(ImageFilter.GaussianBlur(ring / 2)), kern)
        aus.paste(stueck, (x0 - ring, y0 - ring), maske)
    return aus


def senkrecht_fuellen(bild: Image.Image, r, dy: int, rand: int = 5) -> None:
    """Fuellt Rechteck r mit dem Bildstreifen dy px darunter (dy<0: darueber), weich eingeblendet."""
    x0, y0, x1, y1 = r
    stueck = bild.crop((x0 - rand, y0 - rand + dy, x1 + rand, y1 + rand + dy))
    kern = Image.new("L", stueck.size, 0)
    ImageDraw.Draw(kern).rectangle((rand, rand, stueck.width - rand - 1, stueck.height - rand - 1), fill=255)
    bild.paste(stueck, (x0 - rand, y0 - rand), kern.filter(ImageFilter.GaussianBlur(rand / 2)))


def spiegeln_ab(bild: Image.Image, y: int, x0: int, x1: int) -> None:
    """Ersetzt alles unterhalb von y (Spalten x0..x1) durch die an y gespiegelten Zeilen darueber."""
    hoehe = bild.height - y
    bild.paste(bild.crop((x0, y - hoehe, x1, y)).transpose(Image.FLIP_TOP_BOTTOM), (x0, y))


def baue(variante: str) -> Image.Image:
    bg, objs = lade(variante)
    landmarken = [o for o in objs if ist_landmarke(o)]
    turm = next(o for o in landmarken if ist_turm(o))

    # 1a. Ringe und Heimkreise spiegeln (Landmarken ausser dem Turm geschuetzt)
    schutz = Image.new("L", bg.size, 0)
    for o in landmarken:
        if o is not turm:
            schutz.paste(255, (o["x"], o["y"]), alpha_maske(o))
    a = np.asarray(bg).copy()
    ringe_spiegeln(a, np.asarray(schutz) > 0)
    bild = Image.fromarray(a)

    # 1b. Demo-Objekte flicken (mit Schattenrand nach rechts unten)
    ziele = []
    for o in objs:
        if ist_landmarke(o) and o is not turm:
            continue
        if o["x"] + o["w"] < SPIEGEL_X[0] or o["x"] > SPIEGEL_X[1]:
            continue  # Banner aussen an der Spiegelachse: fallen ohnehin weg
        if o is turm:
            # Nur der Teil ueber der Erdflaeche (dort schaute der alte Turm durch die Mauerluecken des
            # tiefer gesetzten); unten bleibt die Erde, nur die Schuttsteine am alten Fuss gehen weg.
            ziele.append((o["x"] - 4, o["y"] - 4, o["x"] + o["w"] + 10, TURM_ERDE_Y))
            ziele.append((o["x"] - 4, o["y"] + o["h"] - 26, o["x"] + 16, o["y"] + o["h"] + 6))
            ziele.append((o["x"] + o["w"] - 36, o["y"] + o["h"] - 26, o["x"] + o["w"] + 6, o["y"] + o["h"] + 6))
            continue
        ziele.append((o["x"] - 4, o["y"] - 4, o["x"] + o["w"] + 10, o["y"] + o["h"] + 10))
    verboten = [(o["x"] - 6, o["y"] - 6, o["x"] + o["w"] + 12, o["y"] + o["h"] + 12) for o in landmarken if o is not turm]
    bild = flicken(bild, ziele, verboten, (SPIEGEL_X[0], 0, SPIEGEL_X[1], FLUSS_Y))
    # Steinplatten sitzen genau auf dem senkrechten Verbindungsweg zwischen den Orten: dort passt
    # kein Stueck von anderswo so gut wie der Weg direkt darunter (A, B) bzw. darueber (C).
    for py, dy in zip(PLATTEN_Y, (34, 34, -34)):
        senkrecht_fuellen(bild, (round(ORT_X) - 26, py - 17, round(ORT_X) + 26, py + 17), dy)
    # Fluss/Kanal und Steg: die Zeilen darueber nach unten spiegeln (auf der Leinwand ~10 px);
    # in der Stegspalte schon ab dem Steganfang, dort laeuft dann der Weg von C nach unten weiter.
    spiegeln_ab(bild, FLUSS_Y, 0, bild.width)
    spiegeln_ab(bild, STEG_Y, round(ORT_X) - 40, round(ORT_X) + 40)

    # 2. Turm tiefer setzen
    bild = bild.convert("RGBA")
    bild.alpha_composite(turm["bild"], (turm["x"], turm["y"] + TURM_VERSATZ))

    # 3. Skalieren und auf die Leinwand
    gw, gh = round(bild.width * S), round(bild.height * S)
    x0, y0 = auf_leinwand(0, 0)
    gross = bild.convert("RGB").resize((gw, gh), Image.LANCZOS)
    lein = Image.new("RGB", (LW, LH), (0, 0, 0))
    lein.paste(gross, (round(x0), round(y0)))

    # 4. Palisaden weg, an der Palisadenlinie spiegeln
    sl = round(auf_leinwand(SPIEGEL_X[0], 0)[0])
    sr = round(auf_leinwand(SPIEGEL_X[1], 0)[0])
    links = lein.crop((sl, 0, 2 * sl, LH)).transpose(Image.FLIP_LEFT_RIGHT)
    lein.paste(links, (0, 0))
    rechts = lein.crop((2 * sr - LW, 0, sr, LH)).transpose(Image.FLIP_LEFT_RIGHT)
    lein.paste(rechts, (sr, 0))
    return lein


def main() -> None:
    varianten = [a for a in sys.argv[1:] if not a.startswith("--")] or ["eroberung", "wuestenruine"]
    ZIEL.mkdir(parents=True, exist_ok=True)
    for v in varianten:
        fertig = baue(v)
        ziel = ZIEL / f"{v}.png"
        fertig.save(ziel, optimize=True)
        print(f"{v}: -> {ziel.relative_to(WURZEL)}")


if __name__ == "__main__":
    main()
