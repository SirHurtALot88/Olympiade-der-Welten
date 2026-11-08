#!/usr/bin/env python3
"""BUEHNEN-KULISSEN FUER DEN MOTOR (Kulissen-Integration 07.11., Batch 2: Tennis, Fechten, Speed-Schach;
Batch 3: Showcase, Eiskunstlauf, Breaking, I-Spy).

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

    python3 -I scripts/baue-kulisse-buehnen.py [tennis fechten speed-schach showcase eiskunstlauf breaking i-spy]
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


# ---------------------------------------------------------------------------------------- Showcase
# Szene: bg (Buehne mit leerer LED-Wand) + fg (Rang/Zirkuszelt/Boxentuerme, Publikum vorn), 640x360.
# Die Demo-Jury (Ebene `judges`) bleibt weg — der Motor zeichnet sein eigenes Jury-Pult.
# Ausschnitt so, dass die Buehnenkante (Szene y~265) auf die Rampe des Motors faellt (H*0.86 = 404).
SC_KANTE_SZENE, SC_KANTE_MOTOR = 265, LH * 0.86


def deckend_mit_kante(bild: Image.Image, kante_szene: float, kante_motor: float) -> Image.Image:
    """Deckend auf die Leinwand skaliert (Pixel-Art erst ganzzahlig), so verschoben, dass Szenenzeile
    kante_szene auf Leinwandzeile kante_motor liegt."""
    w, h = bild.size
    f = LW / w
    nh = LH / f
    y0 = min(max(0.0, kante_szene - kante_motor / f), h - nh)
    aus = bild.crop((0, round(y0), w, round(y0 + nh)))
    g = int(f) + 1
    aus = aus.resize((aus.width * g, aus.height * g), Image.NEAREST)
    return aus.resize((LW, LH), Image.LANCZOS)


def baue_showcase(variante: str) -> Image.Image:
    b = lade_szenenbilder(SZENEN / "showcase" / f"{variante}.html")
    bild = b["bg"].copy()
    bild.alpha_composite(b["fg"])
    return deckend_mit_kante(bild.convert("RGB"), SC_KANTE_SZENE, SC_KANTE_MOTOR)


# ---------------------------------------------------------------------------------------- Eiskunstlauf
# Motor: Eisflaeche = eisRundweg(k) mit k aus kuerFlaeche(): l=W/2-W*0.35*1.18, r=..., o=H/2-H*0.28*1.34,
# u=..., Ecke 56 (quadratische Kurven). Szene (bg+fg 2640x855): Tribuene, Technisches Panel,
# Sponsorbande, Kiss&Cry oben; Eis mit Bande darunter; Boden ausserhalb (Halle dunkel, Waldsee Schnee).
# Die Kulisse: oben die Tribuene mit Bande bis an die obere Eiskante, darum der Boden der Szene, im
# Rundweg des Motors das Eis der Szene. Die Bande des Motors (weiss + Gold) zeichnet weiter der Motor.
E_K = {"l": LW / 2 - LW * 0.35 * 1.18, "r": LW / 2 + LW * 0.35 * 1.18,
       "o": LH / 2 - LH * 0.28 * 1.34, "u": LH / 2 + LH * 0.28 * 1.34, "ecke": 56}
E_TRIBUENE = (330, 60, 2310, 226)  # Szenen-Ausschnitt: gerade Bandenstrecke samt Tribuene und Panel
E_EIS = (400, 262, 2240, 736)  # Eis ohne Bande (unten vor der Bandenlinie des Waldsees)
E_BODEN = (0, 820, 2640, 855)  # Boden vor der vorderen Bande


def rundweg_maske(k: dict, ein: float = 0.0) -> Image.Image:
    """Dieselbe Form wie eisRundweg(k,ein) im Motor (Geraden + quadratische Ecken), als Maske."""
    from PIL import ImageDraw

    l, r, o, u = k["l"] + ein, k["r"] - ein, k["o"] + ein, k["u"] - ein
    e = max(4, k["ecke"] - ein)

    def quad(p0, p1, p2, n=16):
        return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                 (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in np.linspace(0, 1, n)]

    pts = [(l + e, o), (r - e, o)] + quad((r - e, o), (r, o), (r, o + e)) + [(r, u - e)] \
        + quad((r, u - e), (r, u), (r - e, u)) + [(l + e, u)] + quad((l + e, u), (l, u), (l, u - e)) \
        + [(l, o + e)] + quad((l, o + e), (l, o), (l + e, o))
    m = Image.new("L", (LW, LH), 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def baue_eiskunstlauf(variante: str) -> Image.Image:
    b = lade_szenenbilder(SZENEN / "eiskunstlauf" / f"{variante}.html")
    welt = b["bg"].copy()
    welt.alpha_composite(b["fg"])
    welt = welt.convert("RGB")
    # Boden
    b0 = welt.crop(E_BODEN)
    band = b0.resize((LW, max(8, round(b0.height * LW / b0.width * 3))), Image.LANCZOS)
    lein = streifen_kacheln(band, LW, LH, saat=23)
    # Tribuene: Unterkante (Bande) an die obere Eiskante des Motors
    t = welt.crop(E_TRIBUENE)
    th = round(t.height * LW / t.width)
    t = t.resize((LW, th), Image.LANCZOS)
    lein.paste(t, (0, round(E_K["o"]) - th + 2))
    # Eis im Rundweg
    eis = welt.crop(E_EIS)
    breite, hoehe = E_K["r"] - E_K["l"], E_K["u"] - E_K["o"]
    f = max(breite / eis.width, hoehe / eis.height)
    eis = eis.resize((round(eis.width * f), round(eis.height * f)), Image.LANCZOS)
    ex = round((E_K["l"] + E_K["r"]) / 2 - eis.width / 2)
    ey = round((E_K["o"] + E_K["u"]) / 2 - eis.height / 2)
    voll = Image.new("RGB", (LW, LH))
    voll.paste(eis, (ex, ey))
    lein.paste(voll, (0, 0), rundweg_maske(E_K))
    return lein


# ---------------------------------------------------------------------------------------- Breaking
# Szene (world 768x432): Kerker mit Publikum, Lichtkegel, Ketten; darunter eine flache Rundbuehne mit
# Rock in den Demo-Teamfarben rot/gruen und Demo-HUD (BREAKING-Schild, ZUG-Tafel, Uhr). Der Motor
# zeichnet sein eigenes Druck-Rund (zeichneBreaking). Die Kulisse nimmt Kerker, Publikum und die
# Oberflaeche der Rundbuehne — unten abgeschnitten vor Rock und HUD —, die weissen Startmarken weg.
BR_AUSSCHNITT = (96, 312)  # Szenenzeilen
BR_MARKEN = [(347, 283, 364, 315), (417, 283, 434, 315)]


def baue_breaking(variante: str) -> Image.Image:
    welt = lade_szenenbilder(SZENEN / "breaking" / f"{variante}.html")["world"].convert("RGB")
    welt = flicken(welt, BR_MARKEN, [], (150, 255, 620, 318), ring=4, schritt=1)
    y0, y1 = BR_AUSSCHNITT
    f = LH / (y1 - y0)
    nb = LW / f
    x0 = (welt.width - nb) / 2
    aus = welt.crop((round(x0), y0, round(x0 + nb), y1))
    g = int(f) + 1
    aus = aus.resize((aus.width * g, aus.height * g), Image.NEAREST)
    return aus.resize((LW, LH), Image.LANCZOS)


# ---------------------------------------------------------------------------------------- I-Spy
# Motor (bodenSchatzsuche): zwei Raeume, links 0..W*0.465, rechts W*0.535..W, dazwischen der Steg.
# Szene (bg 1280x840, Draufsicht): Garten/Hof/Halle mit Rueckwand oben. Jede Raumhaelfte bekommt die
# Szene deckend; die beiden Demo-Truhen unten (die Fundorte zeichnet der Motor selbst) sind weg.
IS_TRUHEN = [(138, 694, 199, 739), (1081, 694, 1142, 739)]
IS_STEG = (LW * 0.465, LW * 0.535)


def baue_ispy(variante: str) -> Image.Image:
    bg = lade_szenenbilder(SZENEN / "i-spy" / f"{variante}.html")["bg"].convert("RGB")
    bg = flicken(bg, IS_TRUHEN, [], (0, 560, 1280, 800), ring=8, schritt=2)
    halb = round(IS_STEG[0])
    f = max(halb / bg.width, LH / bg.height)
    raum = bg.resize((round(bg.width * f), round(bg.height * f)), Image.LANCZOS)
    rx = (raum.width - halb) // 2
    raum = raum.crop((rx, 0, rx + halb, LH))
    lein = Image.new("RGB", (LW, LH))
    lein.paste(raum, (0, 0))
    lein.paste(raum, (LW - halb, 0))
    return lein


# ---------------------------------------------------------------------------------------- Gewichtheben
# LIVE laeuft das Hantel-Duell (zeichneHeben/bodenHeben); der Sandsack-Pfad ist per BUEHNE_FLAGS aus und
# bekommt hier nichts. Die drei Szenen sind Sandsack-Stationsplaene — brauchbar ist nur ihr Kopfstreifen
# (Hafen-Skyline, Lagerhallen, Wueste mit Pyramiden) und das Bodenmaterial. Kopfstreifen ohne die drei
# Demo-Tafeln (V-W/A-A ARBEITSWERT, SANDSACK-SCHICHT) als Tribuenenhintergrund (bis H*0.34), darunter
# der Boden der Szene. Die Plattform zeichnet weiter der Motor.
G_KOPF = (0, 148)  # Szenenzeilen des Kopfstreifens
G_TAFELN = [(336, 30, 468, 110), (714, 4, 886, 86), (1137, 30, 1269, 110)]
G_PFOSTEN = [(397, 100, 407, 148), (735, 76, 745, 148), (858, 76, 868, 148), (1158, 100, 1168, 148), (1240, 100, 1250, 148)]
G_BODEN = (250, 584, 600, 628)
G_HIMMELSKOERPER = [(975, 0, 1130, 60)]  # Mond (Hafen) bzw. Sonne (Oase): nie als Flickquelle, sonst zwei davon
G_TRIBUENE_H = round(LH * 0.34)


def baue_gewichtheben(variante: str) -> Image.Image:
    bg = lade_szenenbilder(SZENEN / "gewichtheben" / f"{variante}.html")["bg"].convert("RGB")
    # Tafeln: bestpassendes Stueck aus dem Kopfstreifen (seitliches Fuellen verdoppelte Leuchtturm,
    # Pyramide und Lampenkegel daneben); die schmalen Pfosten vom linken Nachbarn.
    bg = flicken(bg, G_TAFELN, G_PFOSTEN + G_HIMMELSKOERPER, (0, 0, bg.width, 150), ring=6, schritt=2)
    bg = seitlich_fuellen(bg, G_PFOSTEN)
    y0, y1 = G_KOPF
    nb = round((y1 - y0) * LW / G_TRIBUENE_H)  # Szenenbreite fuer die Tribuenenhoehe
    x0 = (bg.width - nb) // 2
    kopf = bg.crop((x0, y0, x0 + nb, y1)).resize((LW, G_TRIBUENE_H), Image.LANCZOS)
    band = bg.crop(G_BODEN)
    band = band.resize((round(band.width * 1.4), round(band.height * 1.4)), Image.NEAREST)
    lein = Image.new("RGB", (LW, LH))
    # breiteres Band fuer streifen_kacheln (braucht mehr Breite als die Leinwand)
    breit = Image.new("RGB", (LW, band.height))
    x = 0
    while x < LW:
        breit.paste(band if (x // band.width) % 2 == 0 else band.transpose(Image.FLIP_LEFT_RIGHT), (x, 0))
        x += band.width
    lein.paste(streifen_kacheln(breit, LW, LH - G_TRIBUENE_H, saat=31), (0, G_TRIBUENE_H))
    lein.paste(kopf, (0, 0))
    return lein


# ---------------------------------------------------------------------------------------- Basketball
# Motor (bodenFeldspiel, Basketball): Feld in Draufsicht W*0.06..W*0.94 x 60..H-60, Linien, Zonen und
# Koerbe zeichnet der Motor. Szene (world 1920x1000): Halle bzw. Streetcourt in Schraegsicht mit
# Anzeigetafel (V-W/A-A), Teambaenken samt Demo-Figuren, Kampfgericht. Die Kulisse: oben und unten ein
# Tribuenenstreifen aus der Szene (nur Publikum bzw. Haeuser/Zaun, unterhalb der Anzeigetafel), im
# Feld der Belag der Szene ohne Linien (Parkett bzw. blauer Court), um das Feld der Hallen-/Asphaltboden.
BB_TRIBUENE = (124, 204)  # Szenenzeilen: Publikum unter der Anzeigetafel, ueber den Demo-Bankfiguren
BB_TAFEL_X = (733, 1188)  # Anzeigetafel reicht bis Zeile ~120, Rest frei
BB_BELAG = (1060, 368, 1330, 470)
BB_UMLAUF = (8, 420, 150, 760)
BB_FELD = (round(LW * 0.06), 60, round(LW * 0.94), LH - 60)


def kacheln_gespiegelt(stueck: Image.Image, breite: int, hoehe: int) -> Image.Image:
    """Flaeche aus einem Musterstueck, abwechselnd gespiegelt (keine Kanten), Helligkeit je Zeile und
    Spalte angeglichen (kein Lichtfleck der Szene wiederholt sich)."""
    a = np.asarray(stueck, dtype=np.float32)
    a = a - a.mean(axis=1, keepdims=True) + a.mean(axis=(0, 1), keepdims=True)
    a = a - a.mean(axis=0, keepdims=True) + a.mean(axis=(0, 1), keepdims=True)
    st = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    aus = Image.new("RGB", (breite, hoehe))
    for j, y in enumerate(range(0, hoehe, st.height)):
        for i, x in enumerate(range(0, breite, st.width)):
            t = st
            if i % 2:
                t = t.transpose(Image.FLIP_LEFT_RIGHT)
            if j % 2:
                t = t.transpose(Image.FLIP_TOP_BOTTOM)
            aus.paste(t, (x, y))
    return aus


def baue_basketball(variante: str) -> Image.Image:
    welt = lade_szenenbilder(SZENEN / "basketball" / f"{variante}.html")["world"].convert("RGB")
    lein = Image.new("RGB", (LW, LH))
    # Umlauf (Hallenboden/Asphalt) ueberall
    um = welt.crop(BB_UMLAUF)
    um = um.resize((um.width * 2, um.height * 2), Image.NEAREST)
    lein.paste(kacheln_gespiegelt(um, LW, LH), (0, 0))
    # Tribuenenstreifen oben und unten (unten gespiegelt: Publikum "gegenueber")
    t0, t1 = BB_TRIBUENE
    trib = welt.crop((0, t0, 1920, t1))
    th = 54
    trib = trib.resize((LW, th), Image.LANCZOS)
    lein.paste(trib, (0, 0))
    lein.paste(trib, (0, LH - th))
    # Belag ohne Linien im Feld
    belag = welt.crop(BB_BELAG)
    m = linien_maske(belag)
    belag = linien_entfernen(belag, m)
    belag = belag.resize((round(belag.width * 1.5), round(belag.height * 1.5)), Image.NEAREST)
    fx0, fy0, fx1, fy1 = BB_FELD
    lein.paste(kacheln_gespiegelt(belag, fx1 - fx0, fy1 - fy0), (fx0, fy0))
    return lein


# ---------------------------------------------------------------------------------------- Football
# Motor (bodenFeldspiel, Football): Feld W*0.04..W*0.96 x 50..H-50, Endzonen, Yard-Linien und Zahlen
# zeichnet der Motor. Szene (world 1920x1416): Stadion bzw. Strand in Schraegsicht mit Anzeigetafel,
# Torstangen, Kettencrew/Bank (Demo), Feld mit eingebrannten Linien und Demo-Endzone A-A.
# Kulisse: Tribuenen-/Strandstreifen oben und unten (ohne Tafel, Pfosten, Torstange, Kettenmasten),
# im Feld der Belag der Szene ohne Linien, um das Feld der Seitenstreifen der Szene (Rasen bzw. Sand).
FB_TRIBUENE = (126, 262)
FB_STOERER = [(1752, 0, 1790, 262), (460, 160, 475, 262), (808, 160, 823, 262), (748, 96, 766, 262), (1156, 96, 1174, 262),
              (240, 236, 290, 262), (425, 212, 498, 262), (772, 232, 842, 262)]
FB_BELAG = (1322, 412, 1425, 700)
FB_RAND = (900, 338, 1450, 358)
FB_FELD = (round(LW * 0.04), 50, round(LW * 0.96), LH - 50)


def baue_football(variante: str) -> Image.Image:
    welt = lade_szenenbilder(SZENEN / "football" / f"{variante}.html")["world"].convert("RGB")
    welt = seitlich_fuellen(welt, sorted(FB_STOERER))
    rand = welt.crop(FB_RAND)
    rand = rand.resize((round(rand.width * 0.8), round(rand.height * 1.6)), Image.NEAREST)
    breit = Image.new("RGB", (LW + 400, rand.height))
    x = 0
    while x < breit.width:
        breit.paste(rand if (x // rand.width) % 2 == 0 else rand.transpose(Image.FLIP_LEFT_RIGHT), (x, 0))
        x += rand.width
    lein = streifen_kacheln(breit, LW, LH, saat=41)
    t0, t1 = FB_TRIBUENE
    th = 46
    trib = welt.crop((0, t0, 1920, t1)).resize((LW, th), Image.LANCZOS)
    lein.paste(trib, (0, 0))
    lein.paste(trib, (0, LH - th))
    belag = welt.crop(FB_BELAG)
    belag = linien_entfernen(belag, linien_maske(belag))
    belag = belag.resize((round(belag.width * 1.4), round(belag.height * 1.4)), Image.NEAREST)
    fx0, fy0, fx1, fy1 = FB_FELD
    lein.paste(kacheln_gespiegelt(belag, fx1 - fx0, fy1 - fy0), (fx0, fy0))
    return lein


# ---------------------------------------------------------------------------------------- Hockey
# Motor (eisflaeche): RINK = l W*0.045, r W*0.955, o 44, u H-44, Ecke 64 — eisRundweg(k). Linien, Kreise,
# Tore, Bande zeichnet der Motor. Szene (clean 1840x632): Halle mit Publikum bzw. Bergsee mit Bergen,
# Eis mit eingebrannten Linien. Kulisse: Tribuenen-/Bergstreifen oben, Hallenboden bzw. Schnee drumherum,
# im Rundweg des Motors das Eis der Szene ohne Linien.
HK_K = {"l": LW * 0.045, "r": LW * 0.955, "o": 44, "u": LH - 44, "ecke": 64}
HK_OBEN = {"eis": (38, 162), "bergsee": (0, 118)}
HK_EIS = (252, 230, 1588, 540)  # die ganze Spielflaeche zwischen den Torraeumen
HK_LOGO = [(850, 362, 992, 440), (904, 328, 938, 352), (904, 450, 938, 474)]  # Stern, Kreuzungen Kreis/Mittellinie
HK_BODEN = (0, 596, 1840, 630)


def baue_hockey(variante: str) -> Image.Image:
    welt = lade_szenenbilder(SZENEN / "hockey" / f"{variante}.html")["clean"].convert("RGB")
    b = welt.crop(HK_BODEN)
    b = b.resize((LW + 400, round(b.height * 1.2)), Image.LANCZOS)
    lein = streifen_kacheln(b, LW, LH, saat=53)
    o0, o1 = HK_OBEN[variante]
    oben = welt.crop((0, o0, 1840, o1))
    oh = round(oben.height * LW / 1840)
    lein.paste(oben.resize((LW, oh), Image.LANCZOS), (0, 0))
    # Erst das Logo flicken, dann alle Linien (weiss, rot, blau, auch die blassen Schriftzuege) aus der
    # ganzen Spielflaeche nehmen — ein kleines Musterstueck gespiegelt ergab ein Kaleidoskop.
    welt = flicken(welt, HK_LOGO, [], (252, 230, 1588, 540), ring=6, schritt=3)
    eis = welt.crop(HK_EIS)
    a = np.asarray(eis, dtype=np.int32)
    weich = np.asarray(eis.filter(ImageFilter.GaussianBlur(6)), dtype=np.int32)
    farbig = (a[..., 0] - a[..., 2] > 40) | (a[..., 2] - a[..., 0] > 45) | (np.abs(a - weich).sum(axis=2) > 90)
    m = np.asarray(Image.fromarray(farbig.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
    eis = linien_entfernen(eis, m | linien_maske(eis), schritte=(5, 8, 12, 16, 22))
    eis = eis.resize((round(HK_K["r"] - HK_K["l"]), round(HK_K["u"] - HK_K["o"])), Image.LANCZOS)
    flaeche = eis.resize((LW, LH), Image.LANCZOS)  # Grund unter der Maskenkante: auch Eis
    flaeche.paste(eis, (round(HK_K["l"]), round(HK_K["o"])))
    lein.paste(flaeche, (0, 0), rundweg_maske(HK_K))
    return lein


# ---------------------------------------------------------------------------------------- Spurt
# Motor (bodenSpurtGerade): Bahnband oben=H*0.14 .. unten=H*0.94, Bahnlinien, Stationen (Huerden,
# Balken, Mauer, Seil …), Start/Ziel zeichnet der Motor nach den Renn-Werten (HUERDEN_N, camX). Szene
# (bg 1680x960, HYROX-Halle in Draufsicht): Publikum oben/unten, Asphalt, blaue Laufbahn. Kulisse: oben
# Publikum + Hallenboden, im Bahnband der blaue Belag der Laufschleife (Stueck zwischen den Pfeilen),
# unten Publikum. Die Stationen der Szene (Schlitten, Rudergeraete …) kommen nicht mit.
SP_OBEN, SP_UNTEN = round(LH * 0.14), round(LH * 0.94)
SP_PUBLIKUM_OBEN = (0, 0, 1680, 40)
SP_PUBLIKUM_UNTEN = (0, 912, 1680, 960)
SP_ASPHALT = (640, 440, 820, 480)
SP_BELAG = (520, 66, 760, 134)


def band_breit(stueck: Image.Image, breite: int) -> Image.Image:
    aus = Image.new("RGB", (breite, stueck.height))
    for i, x in enumerate(range(0, breite, stueck.width)):
        aus.paste(stueck if i % 2 == 0 else stueck.transpose(Image.FLIP_LEFT_RIGHT), (x, 0))
    return aus


def baue_spurt(variante: str) -> Image.Image:
    bg = lade_szenenbilder(SZENEN / "spurt" / f"{variante}.html")["bg"].convert("RGB")
    lein = kacheln_gespiegelt(bg.crop(SP_ASPHALT), LW, LH)
    po = bg.crop(SP_PUBLIKUM_OBEN)
    po = po.resize((round(po.width * 0.9), round(po.height * 0.9)), Image.LANCZOS)
    lein.paste(band_breit(po, LW), (0, 0))
    pu = bg.crop(SP_PUBLIKUM_UNTEN)
    pu = pu.resize((round(pu.width * 0.9), round(pu.height * 0.9)), Image.LANCZOS)
    lein.paste(band_breit(pu, LW), (0, LH - pu.height))
    belag = bg.crop(SP_BELAG)
    belag = belag.resize((belag.width * 2, belag.height * 2), Image.NEAREST)
    lein.paste(kacheln_gespiegelt(belag, LW, SP_UNTEN - SP_OBEN), (0, SP_OBEN))
    return lein


# ---------------------------------------------------------------------------------------- Staffel
# Motor (bodenSpurtOval): Oval um OVAL_CX=W/2, OVAL_CY=H*0.615, halbe Gerade 263, Aussenradius 288,
# 6 Bahnen a 26, Stauchung 0,57 (bahnPfad). Linien, Wechselzonen-Marken, Ziel zeichnet der Motor.
# Szene (arena, 3360x1864): Stadion mit Tribuenen, Rasen, Tartanbahn (tuerkis) in Draufsicht.
# Kulisse: Rasen der Szene ueberall, Tribuene oben, im Bahnring der Tartan der Szene ohne Linien,
# im Innenfeld der gestreifte Rasen. Nur die Variante "arena": "stabwechsel" ist dasselbe Stadion.
ST_CX, ST_CY, ST_HL, ST_RA, ST_BA, ST_N, ST_ST = LW / 2, LH * 0.615, 263, 288, 26, 6, 0.57
ST_TRIBUENE = (0, 0, 3360, 76)
ST_RASEN = (840, 672, 2352, 1176)
ST_TARTAN = (1344, 218, 2100, 270)


def oval_maske(r: float) -> Image.Image:
    from PIL import ImageDraw

    ry = r * ST_ST
    m = Image.new("L", (LW, LH), 0)
    d = ImageDraw.Draw(m)
    d.rectangle((ST_CX - ST_HL, ST_CY - ry, ST_CX + ST_HL, ST_CY + ry), fill=255)
    d.ellipse((ST_CX + ST_HL - r, ST_CY - ry, ST_CX + ST_HL + r, ST_CY + ry), fill=255)
    d.ellipse((ST_CX - ST_HL - r, ST_CY - ry, ST_CX - ST_HL + r, ST_CY + ry), fill=255)
    return m


def baue_staffel(variante: str) -> Image.Image:
    import base64
    import io
    import re

    s = (SZENEN / "staffel" / f"{variante}.html").read_text(encoding="utf-8")
    b64 = re.search(r'data:image/[a-z]+;base64,([A-Za-z0-9+/=]{5000,})', s).group(1)
    welt = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    rasen = welt.crop(ST_RASEN).resize((round(1512 * 0.6), round(504 * 0.6)), Image.LANCZOS)
    lein = Image.new("RGB", (LW, LH))
    flaeche = Image.new("RGB", (LW, LH))
    for y in range(0, LH, rasen.height):
        for x in range(0, LW, rasen.width):
            flaeche.paste(rasen, (x, y))
    lein.paste(flaeche, (0, 0))
    trib = welt.crop(ST_TRIBUENE)
    trib = trib.resize((LW, round(trib.height * LW / trib.width * 1.6)), Image.LANCZOS)
    lein.paste(trib, (0, 0))
    tartan = welt.crop(ST_TARTAN)
    tartan = linien_entfernen(tartan, linien_maske(tartan))
    tartan = tartan.resize((round(tartan.width * 0.6), round(tartan.height * 0.6)), Image.LANCZOS)
    ring = kacheln_gespiegelt(tartan, LW, LH)
    r_innen = ST_RA - ST_N * ST_BA
    m = np.asarray(oval_maske(ST_RA + 2)).copy()
    m[np.asarray(oval_maske(r_innen - 1)) > 0] = 0
    lein.paste(ring, (0, 0), Image.fromarray(m))
    return lein


BAUER = {"tennis": baue_tennis, "fechten": baue_fechten, "speed-schach": baue_schach,
         "showcase": baue_showcase, "eiskunstlauf": baue_eiskunstlauf, "breaking": baue_breaking, "i-spy": baue_ispy,
         "gewichtheben": baue_gewichtheben, "basketball": baue_basketball,
         "football": baue_football, "hockey": baue_hockey,
         "spurt": baue_spurt, "staffel": baue_staffel}
# Speed-Schach "turniersaal" fehlt bewusst: im Saal sitzen zwei eingebrannte Demo-Partien (Spieler an
# Seitentischen mit Brett) genau in Hoehe der Motor-Spieler — sie laesst sich nicht sauber freistellen
# und saehe aus wie zwei weitere Duelle. Kommt sie spaeter linienfrei neu, reicht ein Eintrag hier.
VARIANTEN = {"tennis": ["court", "dach", "riviera"], "fechten": ["piste", "schlosshof"],
             "speed-schach": ["park", "zug"], "showcase": ["buehne", "festival", "zirkus"],
             "eiskunstlauf": ["kuer", "waldsee"], "breaking": ["standard", "brutal"],
             "i-spy": ["aztec", "horror", "lostplace", "ruinengarten"],
             "gewichtheben": ["hafen", "oase", "sandsack"], "basketball": ["parkett", "streetcourt"],
             "football": ["feld", "strand"], "hockey": ["eis", "bergsee"],
             "spurt": ["kurs"], "staffel": ["arena"]}


def main() -> None:
    disziplinen = [a for a in sys.argv[1:] if not a.startswith("--")] or list(BAUER)
    for d in disziplinen:
        for v in VARIANTEN[d]:
            ziel = speichere_quelle(d, v, BAUER[d](v))
            print(f"{d}/{v}: -> {ziel.relative_to(WURZEL)}")


if __name__ == "__main__":
    main()
