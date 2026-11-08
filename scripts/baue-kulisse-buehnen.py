#!/usr/bin/env python3
"""BUEHNEN-KULISSEN FUER DEN MOTOR (Kulissen-Integration 07.11., Batch 2: Tennis, Fechten, Speed-Schach).

Die Szenen der Asset-Runde (public/szenen/<disziplin>/<variante>.html) sind Demo-Bilder mit eigener
Geometrie: der Tennisplatz liegt quer statt laengs, die Fechtbahn sitzt anders als die des Motors, und
in allen stehen Demo-Zutaten (Anzeigetafeln mit Kiti/Wurzelbert, Banner V-W/A-A, Schiedsrichter,
Balljungen, Stuehle). Der Motor zeichnet Platz, Bahn und Brett selbst, aus seiner eigenen Geometrie
(tennisPlatzGeometrie(), die Fechtbahn in zeichneFechten(), das Brett in zeichneSchachBrett()).

Dieses Skript baut je Variante eine Kulisse, die nur die UMGEBUNG aus der Szene nimmt — Tribuene,
Mauer, Saal, Boden als Material — die Demo-Zutaten entfernt und dort, wo der Motor seine Flaeche
zeichnet, das passende Material der Szene einsetzt (Tennis: Belag genau im Platz-Trapez des Motors).
Linien, Netz, Bahn und Brett zeichnet weiter der Motor; die Kulisse zeigt nichts davon doppelt.

Nur Pixel der PixelLab-Szenen, deterministisch, ohne API. Ergebnis:
data/generated/kulissen-quellen/<disziplin>/<variante>.png (1240x470); baue-arena-kulissen.py
(Chassis "quelle") macht daraus die Motor-Kulisse.

    python3 -I scripts/baue-kulisse-buehnen.py [tennis fechten speed-schach]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

WURZEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WURZEL / "scripts" / "lib"))
from kulissen_werkzeug import (LH, LW, flicken, lade_szenenbilder, linien_entfernen, linien_maske,  # noqa: E402
                               seitlich_fuellen, speichere_quelle)

SZENEN = WURZEL / "public" / "szenen"
MID = LW / 2


# ---------------------------------------------------------------------------------------- Tennis
# Motor: tennisPlatzGeometrie() — topY=H*0.17, botY=H*0.615, halbe Breite W*0.145 (fern) bis
# W*0.30 (nah). tests/arena-kulissen.test.ts haelt fest, dass diese Zahlen im Motor so stehen.
T_TOP, T_BOT = LH * 0.17, LH * 0.615
T_HALB_TOP, T_HALB_BOT = LW * 0.145, LW * 0.30
# Szene (world 1920x784, alle drei Varianten gleicher Grundriss): Platz als Parallelogramm,
# Seitenlinien bei y=400,5/706,5, Grundlinien schraeg von x=343/1677 (oben) nach 242/1577 (unten).
T_TRIBUENE = (184, 296)  # Zeilen der Szene, die als Tribuenenband auf die Leinwand kommen
T_BAND_H = 72  # Hoehe des Tribuenenbands auf der Leinwand (bis knapp ueber die ferne Grundlinie)
# Demo-Zutaten (Szenen-px): Schiedsrichter samt Stuhl, Balljungen, Anzeigetafel (Kiti/Wurzelbert)
# samt Pfosten, TEMPO-Anzeige, Banner V-W und A-A (Szenen-px).
# Nur ab Zeile 176 noetig: darueber kommt nichts auf die Leinwand (T_TRIBUENE).
T_DEMO_TRIBUENE = [(993, 176, 1069, 258), (246, 176, 322, 258), (1756, 176, 1834, 258),
                   (821, 176, 835, 258), (1086, 176, 1100, 258)]
T_DEMO_BANDE = [(808, 259, 995, 294), (1108, 258, 1255, 295), (1488, 258, 1636, 295),
                (244, 258, 324, 295), (1754, 258, 1836, 295), (1001, 258, 1067, 295)]
# Belag: das Innere des Szenenplatzes zwischen den Seitenlinien, in der Spannweite, die in jeder
# Zeile innerhalb der schraegen Grundlinien liegt — dort ist der Belag ueberall gleich gemaeht/
# gewalzt, ohne Abnutzungsflecken der Grundlinien und ohne Platzkante.
T_BELAG = (343, 404, 1577, 702)
# Bandenschilder, die bleiben (OLYMPIADE, DER WELTEN, TENNIS): keine Flickquelle
T_BANDE_SCHILDER = [(341, 256, 571, 297), (576, 256, 799, 297), (1260, 256, 1483, 297)]
T_AUSLAUF_DACH = (710, 784)  # Hartplatz: der gruene Auslauf unter dem Platz (ohne Bandenschatten)


def tennis_breite(y: np.ndarray) -> np.ndarray:
    return T_HALB_TOP + (T_HALB_BOT - T_HALB_TOP) * (y - T_TOP) / (T_BOT - T_TOP)


def spiegel_index(i: np.ndarray, n: int) -> np.ndarray:
    """Index in 0..n-1, ausserhalb an den Raendern gespiegelt (… 2 1 0 0 1 2 … n-1 n-1 …)."""
    k = np.mod(i, 2 * n)
    return np.where(k >= n, 2 * n - 1 - k, k)


def baue_tennis(variante: str) -> Image.Image:
    welt = lade_szenenbilder(SZENEN / "tennis" / f"{variante}.html")["world"].convert("RGB")
    # Demo-Zutaten weg: Tribuene vom linken Nachbarn, Bande aus der leeren Bande links
    welt = seitlich_fuellen(welt, T_DEMO_TRIBUENE)
    welt = flicken(welt, T_DEMO_BANDE, T_BANDE_SCHILDER, (0, 254, 1920, 299), ring=3, schritt=2)
    # Platzlinien weg (der Motor zeichnet seine eigenen)
    m = linien_maske(welt)
    m[:298] = False
    welt = linien_entfernen(welt, m)
    a = np.asarray(welt)

    lein = np.zeros((LH, LW, 3), np.uint8)
    t0, t1 = T_TRIBUENE
    lein[:T_BAND_H] = np.asarray(welt.crop((0, t0, 1920, t1)).resize((LW, T_BAND_H), Image.LANCZOS))

    # Belag in Szenen-Massstab (1 px Szene ~ 1 px Leinwand), oben an der Bande beginnend, nach unten
    # gespiegelt fortgesetzt. Rasen und Sand: Auslauf und Platz sind derselbe Belag, also eine Flaeche.
    bx0, by0, bx1, by1 = T_BELAG
    belag = a[by0:by1, bx0:bx1]
    bh, bw = belag.shape[:2]
    # so gross, dass der Belag die ganze Flaeche unter der Bande deckt (kein Spiegeln, keine Naht)
    f = max(LW / bw, (LH - T_BAND_H) / bh)
    yy, xx = np.mgrid[0:LH, 0:LW].astype(np.float64)
    flaeche = belag[spiegel_index(np.rint((yy - T_BAND_H) / f).astype(int), bh),
                    spiegel_index(np.rint((xx - MID) / f + bw / 2).astype(int), bw)]
    if variante == "dach":
        # Hartplatz: blauer Platz, gruener Auslauf — Auslauf aus dem Streifen unter dem Szenenplatz,
        # der blaue Belag nur im Platz-Trapez des Motors.
        a0, a1 = T_AUSLAUF_DACH
        auslauf = a[a0:a1]
        ah = auslauf.shape[0]
        boden = auslauf[spiegel_index(np.rint((yy - T_BAND_H) / f).astype(int), ah),
                        np.clip(np.rint(960 + (xx - MID) / f).astype(int), 0, 1919)]
        rand = 3  # unter der Motor-Aussenlinie
        innen = (yy >= T_TOP - rand) & (yy <= T_BOT + rand) & (np.abs(xx - MID) <= tennis_breite(yy) + rand)
        boden[innen] = flaeche[innen]
    else:
        boden = flaeche
    lein[T_BAND_H:] = boden[T_BAND_H:]
    return Image.fromarray(lein)


# ---------------------------------------------------------------------------------------- Fechten
# Motor: Fechtbahn als Band bei y=147..190 (zeichneFechten), darunter die Bank der anderen Bahnen.
# Szene (world 1280x304): Hintergrund (Halle bzw. Schlosshof) bis y~215, Bahn bei y~222..258, darunter
# Boden mit roten/gruenen Demo-Teamstreifen. Die Kulisse nimmt den Hintergrund, setzt die Unterkante
# der Mauer/Bande knapp unter die Motor-Bahn und fuellt darunter mit dem Boden der Szene.
F_HINTERGRUND_BIS = 209  # letzte Zeile der Szene ueber der Bahn (ohne die Demo-Kampfrichtertische)
F_UNTERKANTE = 200  # wohin diese Zeile auf der Leinwand kommt (Motor-Bahn endet bei ~190)
F_BODEN = (286, 304)  # Bodenstreifen der Szene unter den Demo-Teamstreifen (Hallenboden bzw. Rasen)
# Demo-Anzeigetafel V-W/A-A samt Seitenlampen (Szenen-px), im Schlosshof samt Torturm dahinter
F_TAFEL = (527, 0, 752, 96)
# Schlosshof: Banner in den Demo-Teamfarben rot/gruen -> Heim-/Gastfarbe des Motors (--home/--away)
F_BANNER_ROT = [(178, 116, 216, 196), (294, 116, 332, 196), (410, 116, 448, 196), (497, 116, 535, 196)]
F_BANNER_GRUEN = [(771, 116, 809, 196), (858, 116, 896, 196), (974, 116, 1012, 196), (1090, 116, 1128, 196)]
HEIM_RGB, GAST_RGB = (242, 160, 61), (69, 176, 201)


def umfaerben(bild: Image.Image, kaesten, ist_farbe, ziel_rgb) -> Image.Image:
    """Faerbt in den Kaesten die Pixel, auf die ist_farbe(r,g,b) passt, in den Zielton um — die
    Helligkeit (Falten, Schatten der Pixel-Art) bleibt erhalten."""
    a = np.asarray(bild.convert("RGB"), dtype=np.float32).copy()
    zr, zg, zb = ziel_rgb
    zl = (zr + zg + zb) / 3
    for x0, y0, x1, y1 in kaesten:
        t = a[y0:y1, x0:x1]
        r, g, b = t[..., 0], t[..., 1], t[..., 2]
        m = ist_farbe(r, g, b)
        hell = (r + g + b) / 3
        for k, z in enumerate(ziel_rgb):
            t[..., k][m] = np.clip(hell[m] * z / max(zl, 1) * 0.9, 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def streifen_kacheln(band: Image.Image, breite: int, hoehe: int, saat: int) -> Image.Image:
    """Fuellt breite x hoehe mit dem schmalen Bodenstreifen: Lage fuer Lage um einen festen
    Zufallsbetrag waagerecht versetzt und jede zweite Lage gespiegelt — so wiederholt sich kein
    Muster sichtbar und keine Lagenkante ist hart."""
    import random

    rnd = random.Random(saat)
    # Zeilenhelligkeit angleichen: der Streifen ist oben oft heller (Licht von der Bahn), gekachelt
    # gaebe das harte Querbaender. Die Koernung jeder Zeile bleibt, nur ihr Mittelwert wird gleich.
    a = np.asarray(band, dtype=np.float32)
    a = a - a.mean(axis=1, keepdims=True) + a.mean(axis=(0, 1), keepdims=True)
    band = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    aus = Image.new("RGB", (breite, hoehe))
    breit = Image.new("RGB", (band.width * 3, band.height))
    for i, teil in enumerate((band.transpose(Image.FLIP_LEFT_RIGHT), band, band.transpose(Image.FLIP_LEFT_RIGHT))):
        breit.paste(teil, (i * band.width, 0))
    y, k = 0, 0
    while y < hoehe:
        dx = rnd.randrange(0, breit.width - breite)
        lage = breit.crop((dx, 0, dx + breite, band.height))
        if k % 2:
            lage = lage.transpose(Image.FLIP_TOP_BOTTOM)
        aus.paste(lage, (0, y))
        y += band.height
        k += 1
    return aus


def baue_fechten(variante: str) -> Image.Image:
    welt = lade_szenenbilder(SZENEN / "fechten" / f"{variante}.html")["world"].convert("RGB")
    welt = seitlich_fuellen(welt, [F_TAFEL])
    if variante == "schlosshof":
        welt = umfaerben(welt, F_BANNER_ROT, lambda r, g, b: (r > 120) & (r > g * 1.6) & (r > b * 1.6), HEIM_RGB)
        welt = umfaerben(welt, F_BANNER_GRUEN, lambda r, g, b: (g > 110) & (g > r * 1.4) & (g > b * 1.15), GAST_RGB)
    f = LW / 1280  # 0,969
    hg = welt.crop((0, 0, 1280, F_HINTERGRUND_BIS)).resize((LW, round(F_HINTERGRUND_BIS * f)), Image.LANCZOS)
    lein = Image.new("RGB", (LW, LH))
    oben = F_UNTERKANTE - hg.height
    lein.paste(hg, (0, oben))
    # Boden unter der Bahn: der Bodenstreifen der Szene, versetzt gekachelt
    b0, b1 = F_BODEN
    band = welt.crop((0, b0, 1280, b1)).resize((LW, round((b1 - b0) * f)), Image.LANCZOS)
    lein.paste(streifen_kacheln(band, LW, LH - F_UNTERKANTE, saat=11), (0, F_UNTERKANTE))
    return lein


# ---------------------------------------------------------------------------------------- Speed-Schach
# Szene (bg 576x324): Saalwand/Park/Abteil mit Publikum, darunter Boden mit zwei Demo-Stuehlen.
# Der Motor stellt Brett und Spieler mittig, unten die Bank der anderen Bretter. Die Kulisse nimmt die
# Szene deckend (wie Wettessen), entfernt die Demo-Stuehle und sitzt so, dass die Wand oben bleibt.
S_STUEHLE = [(206, 214, 246, 292), (330, 214, 370, 292)]
# Ganz unten ausgeschnitten: die Motor-Spieler (Fuesse bei y~240) stehen dann auf dem Boden statt
# zwischen Parkbank- bzw. Abteil-Publikum, das Publikum sitzt dahinter.
S_Y_ANTEIL = {"park": 1.0, "zug": 1.0}


def baue_schach(variante: str) -> Image.Image:
    bg = lade_szenenbilder(SZENEN / "speed-schach" / f"{variante}.html")["bg"].convert("RGB")
    bg = flicken(bg, S_STUEHLE, [], (0, 200, 576, 324), ring=6, schritt=1)
    w, h = bg.size
    nh = round(w * LH / LW)
    y0 = round((h - nh) * S_Y_ANTEIL.get(variante, 0.5))
    aus = bg.crop((0, y0, w, y0 + nh))
    f = int(LW / w) + 1  # Pixel-Art: erst ganzzahlig vergroessern, dann weich auf Leinwandgroesse
    aus = aus.resize((w * f, nh * f), Image.NEAREST)
    return aus.resize((LW, LH), Image.LANCZOS)


BAUER = {"tennis": baue_tennis, "fechten": baue_fechten, "speed-schach": baue_schach}
# Speed-Schach "turniersaal" fehlt bewusst: im Saal sitzen zwei eingebrannte Demo-Partien (Spieler an
# Seitentischen mit Brett) genau in Hoehe der Motor-Spieler — sie laesst sich nicht sauber freistellen
# und saehe aus wie zwei weitere Duelle. Kommt sie spaeter linienfrei neu, reicht ein Eintrag hier.
VARIANTEN = {"tennis": ["court", "dach", "riviera"], "fechten": ["piste", "schlosshof"],
             "speed-schach": ["park", "zug"]}


def main() -> None:
    disziplinen = [a for a in sys.argv[1:] if not a.startswith("--")] or list(BAUER)
    for d in disziplinen:
        for v in VARIANTEN[d]:
            ziel = speichere_quelle(d, v, BAUER[d](v))
            print(f"{d}/{v}: -> {ziel.relative_to(WURZEL)}")


if __name__ == "__main__":
    main()
