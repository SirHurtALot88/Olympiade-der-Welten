#!/usr/bin/env python3
"""BUEHNEN-KULISSEN FUER DEN MOTOR (Kulissen-Integration 07.11., Batch 2: Tennis, Fechten, Speed-Schach;
Batch 3: Showcase, Eiskunstlauf, Breaking, I-Spy; Batch 12 (08.11.): Showcase und Breaking als
"Rahmen statt Material" mit Licht, s. baue_showcase()/baue_breaking()).

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

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WURZEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WURZEL / "scripts" / "lib"))
from kulissen_werkzeug import (LH, LW, flicken, freistellen, lade_szenenbilder, linien_entfernen,  # noqa: E402
                               linien_maske, seitlich_fuellen, speichere_quelle, tribuenen_mischen)

SZENEN = WURZEL / "public" / "szenen"
SPRITES = WURZEL / "public" / "sprites"
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
T_BANDE_OBEN = 254  # erste Szenen-Zeile der Bande (Schilder ab 256, T_DEMO_BANDE ab 258); darueber Publikum
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
    # Gemischt statt eines Blocks im Takt, s. tribuenen_mischen()-Kommentar/Audit 4.8a -- aber NUR das
    # Publikum. Die Bande darunter traegt Schrift (OLYMPIADE, DER WELTEN, TENNIS); mit gemischt hatte
    # tribuenen_mischen() das rechte Drittel samt Schild gespiegelt, und in allen drei Varianten stand
    # oben rechts "ƧIИИƎT" (Sicht-Audit 16.11., tennis-z1-spiegelschrift.png). Bande deshalb ungemischt.
    band = welt.crop((0, t0, 1920, t1)).resize((LW, T_BAND_H), Image.LANCZOS)
    bande_ab = round((T_BANDE_OBEN - t0) * T_BAND_H / (t1 - t0))
    publikum = tribuenen_mischen(band.crop((0, 0, LW, bande_ab)), 3, saat=3)
    band.paste(publikum, (0, 0))
    lein[:T_BAND_H] = np.asarray(band)

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
    return fechten_vordergrund(lein, welt, variante)


# "RAHMEN STATT MATERIAL" (Sicht-Audit 16.11., Kulissen-Audit 08.11. Abschnitt 4.7, Rang 7): zwischen der
# Motor-Bahn (bis y~190) und der Bank der Bahnen 2-6 (zeichneFechten, deckend ab y~366) lagen 45 % des
# Bildes als leerer Rasen bzw. leerer Hallenboden. Jetzt hat der Raum eine Mitte und einen Vordergrund:
#   Schlosshof - Hofpflaster der Szene (ihre Steinflaeche links neben der Demo-Bahn) statt Rasen, nach
#                vorn dunkler; vorne die Rosenhecke der Burgmauer als Vordergrundkante vor der Bank;
#   Halle      - Lichtinsel der Hallenscheinwerfer unter der Bahn, vorne die ersten Zuschauerreihen
#                der Szene als dunkle Silhouette (Ruecken zum Betrachter, im Gegenlicht).
# Die Mitte direkt unter der Bahn bleibt ruhig: dort schreibt der Motor Namen und Trefferverlauf.
F_PFLASTER = (0, 224, 160, 262)  # Hofpflaster der Szene (Schlosshof), links neben der Demo-Bahn
F_HECKE = (230, 196, 590, 215)  # Rosenhecke vor der Burgmauer, ohne Laternenpfahl und Tor
F_PUBLIKUM = (232, 140, 1048, 205)  # Halle: vordere Zuschauerreihen zwischen den Demo-Signalmasten
F_BANK_OBEN = 366  # Oberkante der deckenden Bank (zeichneFechten), gemessen im Sicht-Audit 16.11.


def fechten_vordergrund(lein: Image.Image, welt: Image.Image, variante: str) -> Image.Image:
    a = np.asarray(lein.convert("RGB")).astype(np.float32)
    yy = np.mgrid[0:LH, 0:LW][0].astype(np.float32)
    if variante == "schlosshof":
        # Bewusst NICHT kacheln_gespiegelt(): dessen Zeilen-/Spaltenangleich glaettet genau die Fugen
        # weg, und aus Pflaster wurde ein verwaschenes Karomuster. Massstab 1:1 wie die Mauersteine.
        stueck = welt.crop(F_PFLASTER)
        flaeche = Image.new("RGB", (LW, LH - F_UNTERKANTE))
        for j, y in enumerate(range(0, flaeche.height, stueck.height)):
            for i, x in enumerate(range(0, LW + stueck.width, stueck.width)):
                flaeche.paste(stueck if i % 2 == 0 else stueck.transpose(Image.FLIP_LEFT_RIGHT),
                              (x + (stueck.width // 2 if j % 2 else 0) - stueck.width // 2, y))
        pflaster = np.asarray(flaeche).astype(np.float32)
        # nach vorn (unten) dunkler: Schatten der Mauer/Hecke, Tiefe
        t = np.clip((yy[F_UNTERKANTE:] - F_UNTERKANTE) / (F_BANK_OBEN - F_UNTERKANTE), 0, 1)[..., None]
        a[F_UNTERKANTE:] = pflaster * (1.0 - 0.30 * t)
        hecke = welt.crop(F_HECKE)
        hh = 42
        hecke = hecke.resize((round(hecke.width * hh / hecke.height), hh), Image.NEAREST)
        reihe = Image.new("RGB", (LW, hh))
        x, k = 0, 0
        while x < LW:
            reihe.paste(hecke if k % 2 == 0 else hecke.transpose(Image.FLIP_LEFT_RIGHT), (x, 0))
            x += hecke.width
            k += 1
        r = np.asarray(reihe).astype(np.float32) * 0.78  # Vordergrund liegt im Schatten
        a[F_BANK_OBEN - hh + 4:F_BANK_OBEN + 4] = r
    else:
        a = licht_rund(a, LW / 2, 205, 560, 70, (190, 225, 255), 0.30, haerte=1.4)
        # gespiegelt, damit es nicht als Spiegelbild der Raenge oben liest
        pub = welt.crop(F_PUBLIKUM).transpose(Image.FLIP_LEFT_RIGHT)
        ph = 70
        pub = pub.resize((LW, round(pub.height * LW / pub.width)), Image.LANCZOS)
        pub = pub.crop((0, pub.height - ph, LW, pub.height))
        p = np.asarray(pub).astype(np.float32)
        # Silhouette im Gegenlicht (naeher, also groesser als die Raenge oben): dunkel und kalt
        p = p * 0.24 + np.array([4, 8, 18.0])[None, None]
        a[F_BANK_OBEN - ph + 4:F_BANK_OBEN + 4] = p
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


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


# ---------------------------------------------------------------------------- Licht (Batch 12, 08.11.)
# "Rahmen statt Material" (docs/design/kulissen-qualitaets-audit-08-11.md, Abschnitt 4.5/4.6): Licht
# als Gestaltungsmittel statt flaechiger Abdunklung. Alles in Szenen-px, Ueberblendung "Screen"
# (hellt nur auf, nie ab, Schwarz bleibt Schwarz an Stellen ohne Licht).
def _gitter(a: np.ndarray):
    return np.mgrid[0:a.shape[0], 0:a.shape[1]].astype(np.float32)


def screen(a: np.ndarray, w: np.ndarray, farbe) -> np.ndarray:
    """a (h,w,3) float 0..255, w (h,w) Deckung 0..1, farbe RGB: Screen-Ueberblendung."""
    f = np.asarray(farbe, np.float32)[None, None, :] / 255.0
    return 255.0 - (255.0 - a) * (1.0 - np.clip(w, 0, 1)[..., None] * f)


def licht_rund(a: np.ndarray, cx, cy, rx, ry, farbe, staerke, haerte=2.0) -> np.ndarray:
    yy, xx = _gitter(a)
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    return screen(a, np.clip(1 - d, 0, 1) ** haerte * staerke, farbe)


def licht_kegel(a: np.ndarray, x0, y0, halb0, x1, y1, halb1, farbe, staerke) -> np.ndarray:
    """Weicher Lichtkegel von (x0,y0) nach (x1,y1), Halbbreite halb0 -> halb1, zur Mitte hin heller."""
    yy, xx = _gitter(a)
    t = np.clip((yy - y0) / max(1.0, y1 - y0), 0, 1)
    innen = (yy >= y0) & (yy <= y1)
    c = x0 + (x1 - x0) * t
    halb = halb0 + (halb1 - halb0) * t
    w = np.clip(1 - np.abs(xx - c) / halb, 0, 1) ** 1.6 * staerke * (0.75 + 0.25 * t) * innen
    return screen(a, w, farbe)


# ---------------------------------------------------------------------------------------- Showcase
# Szene (bg/fg 640x360, alle drei Varianten gleicher Grundriss): Buehnenraum mit Traverse, in der Mitte
# eine schwarze Demo-LED-Wand (die Szene schrieb per DOM "ALS NAECHSTES DRACO" darauf; im bg ist sie
# leer und schwarz), davor der Buehnenboden als Trapez, vorne die Rampe mit Fusslichtern; fg traegt
# Vorhaenge, Raenge und Publikum. Bis Batch 3 kam das unveraendert in den Motor: schwarzer Raum,
# schwarze Tafel, der Kuenstler in einem Lichtfleck im Nichts (Audit 08.11., Rang 5).
# Batch 12 baut den Rahmen in drei Ebenen um die unveraenderte Motor-Geometrie (Rampe H*0.86):
#   fern  - Buehnenprospekt statt LED-Loch: Theater = gemalte Mondnacht, Zirkus = roter Samtvorhang
#           mit Goldstern (beide PixelLab, roh/showcase_prospekt_*.png), Festival = leuchtende
#           LED-Punktmatrix wie im Poster der Szene (ohne Schrift);
#   mitte - Buehnenboden: Theater warmes Holz, Festival dunkler Glanzboden mit Spiegelung der Wand;
#           Lichtkegel von den Traversen-Scheinwerfern, Lichtpfuetzen auf dem Boden;
#   vorne - Rampe, Vorhaenge, Raenge, Publikum der Szene (fg), unbeleuchtet davor.
SC_LED_SUCHE = (180, 25, 460, 155)  # dort liegt die LED-Wand; innen ist sie schwarz (Summe RGB <= 40)
SC_BODEN = (149, 262, (100, 540), (52, 588))  # Zeile oben/unten, Trapez x oben, x unten (Szenen-px)
SC_SCHEINWERFER = [150, 210, 270, 370, 430, 490]  # Traversen-Lampen (Szenenzeile ~32)
SC_POOLS = [(200, 205, 54, 15), (320, 182, 62, 17), (440, 205, 54, 15)]  # Mitte = Motor-Kuenstler
PROSPEKT_ROH = WURZEL / "data" / "generated" / "pixellab-requisiten" / "roh"


def led_box(bg: Image.Image) -> tuple[int, int, int, int]:
    a = np.asarray(bg.convert("RGB")).astype(int).sum(2)
    x0, y0, x1, y1 = SC_LED_SUCHE
    m = a[y0:y1, x0:x1] <= 40
    ys, xs = np.where(m)
    return x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1


def prospekt_pixellab(name: str, w: int, h: int) -> Image.Image:
    p = Image.open(PROSPEKT_ROH / f"{name}.png").convert("RGB")
    a = np.asarray(p).astype(int)
    # PixelLab hat beim Zirkus graue Randspalten (177,177,177) stehen lassen: weg damit
    grau = (np.abs(a - 177).sum(2) <= 6).all(axis=0)
    xs = np.where(~grau)[0]
    p = p.crop((xs.min(), 0, xs.max() + 1, p.height))
    return p.resize((w, h), Image.NEAREST)


def prospekt_led(w: int, h: int) -> Image.Image:
    """Festival: LED-Wand in Betrieb, Punktmatrix im 3-px-Raster, Sonnenstrahlen von unten, Bernstein
    oben nach Magenta unten (Farben aus dem Poster der Szene). Ohne Schrift."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = yy / max(1, h - 1)
    oben, unten = np.array([255, 176, 70.0]), np.array([236, 70, 150.0])
    farbe = oben[None, None] * (1 - t[..., None]) + unten[None, None] * t[..., None]
    winkel = np.arctan2(yy - h * 1.15, xx - w / 2)
    strahl = 0.55 + 0.45 * np.cos(winkel * 14)
    rad = np.clip(1.15 - np.hypot((xx - w / 2) / (w * 0.62), (yy - h * 1.05) / (h * 1.3)), 0.25, 1)
    staerke = (strahl * rad)[..., None]
    punkt = ((xx % 3 == 1) & (yy % 3 == 1))[..., None]
    grund = np.array([24, 10, 26.0])[None, None]
    bild = np.where(punkt, grund + farbe * staerke * 0.95, grund + farbe * staerke * 0.10)
    return Image.fromarray(np.clip(bild, 0, 255).astype(np.uint8))


def boden_maske(shape) -> np.ndarray:
    y0, y1, (xo0, xo1), (xu0, xu1) = SC_BODEN
    yy, xx = np.mgrid[0:shape[0], 0:shape[1]].astype(np.float32)
    t = (yy - y0) / (y1 - y0)
    links, rechts = xo0 + (xu0 - xo0) * t, xo1 + (xu1 - xo1) * t
    return (yy >= y0) & (yy < y1) & (xx >= links) & (xx <= rechts)


def baue_showcase(variante: str) -> Image.Image:
    b = lade_szenenbilder(SZENEN / "showcase" / f"{variante}.html")
    bg = b["bg"].convert("RGB")
    # fern: Buehnenprospekt in die LED-Wand
    x0, y0, x1, y1 = led_box(bg)
    if variante == "festival":
        prospekt = prospekt_led(x1 - x0, y1 - y0)
    else:
        prospekt = prospekt_pixellab(f"showcase_prospekt_{variante}", x1 - x0, y1 - y0)
    bg.paste(prospekt, (x0, y0))
    a = np.asarray(bg).astype(np.float32)
    # mitte: Buehnenboden (Zirkus hat schon hellen Holzboden, dort nur Licht)
    m = boden_maske(a.shape)
    if variante != "zirkus":
        lum = a[..., :3].mean(2)
        rel = np.clip(lum / max(1.0, float(np.median(lum[m]))), 0.6, 1.5)
        if variante == "buehne":
            holz = np.array([112, 72, 46.0])
            neu = holz[None, None] * rel[..., None] * 0.62
        else:
            glanz = np.array([44, 46, 78.0])
            neu = glanz[None, None] * rel[..., None]
            # Spiegelung der leuchtenden Wand im Glanzboden, zur Rampe hin auslaufend
            yy, xx = _gitter(a)
            sp = np.clip(1 - (yy - SC_BODEN[0]) / 46, 0, 1) ** 1.5 * np.clip(1 - np.abs(xx - 320) / 150, 0, 1)
            neu = screen(neu, sp * 0.55, (240, 120, 120))
        a = np.where(m[..., None], neu, a)
    # Lichtkegel von der Traverse auf den Boden, Lichtpfuetzen
    warm = (255, 226, 170) if variante != "festival" else (255, 190, 220)
    kegel_st = 0.13 if variante != "zirkus" else 0.08
    for sx in SC_SCHEINWERFER:
        ziel = min(SC_POOLS, key=lambda p: abs(p[0] - sx))
        a = licht_kegel(a, sx, 32, 4, ziel[0] + (sx - ziel[0]) * 0.35, ziel[1], ziel[2] * 0.7, warm, kegel_st)
    for px, py, rx, ry in SC_POOLS:
        a = licht_rund(a, px, py, rx, ry, warm, 0.42 if variante != "zirkus" else 0.22, haerte=1.4)
    bild = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert("RGBA")
    # vorne: Vorhaenge, Raenge, Publikum (fg) unbeleuchtet davor
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


# "RAHMEN STATT MATERIAL" (Sicht-Audit 16.11., Kulissen-Audit 08.11. Abschnitt 4.4, Rang 4). Bis hierher
# lag die Tribuene der Szene so, dass ihre UNTERKANTE an der oberen Eiskante sass -- bei o=59 px rutschten
# Himmel, Berge und Tannen (Waldsee) bzw. das Publikum (Kuer) komplett ueber den Leinwandrand, uebrig blieb
# eine helle Linie. Das Eis fuellt 83 % der Leinwand; Ort kann die Kulisse nur in den drei Raendern
# zeigen: oben 59 px (zum Teil unter dem Broadcast-Bug), links/rechts je 108 px, unten 59 px. Jetzt:
#   fern   - oben das ganze Panorama der Szene (Himmel, Bergkette, Tannenreihe bzw. Hallendach und Raenge)
#            auf die Leinwandbreite gestaucht, Unterkante an der Eiskante;
#   mitte  - links/rechts Tannenreihen auf Schnee (Waldsee) bzw. Seitentribuenen (Kuer), in Lagen
#            gestaffelt, zum Rand hin dunkler;
#   vorne  - unten eine Tannenreihe als dunkle Silhouette (Waldsee) bzw. die Sponsorenbande der Szene vor
#            Publikumsruecken (Kuer);
#   Eis    - Spiegelung des Panoramas an der oberen Eiskante (Waldsee: Abendrot), zu den Raendern hin
#            kaelter, in der Mitte heller (Kuer: drei Lichtpfuetzen der Hallenscheinwerfer).
# Eisflaeche, Bande (weiss + Gold), Fuehrungssaum, Kampfgericht, Startbereich und Kiss-and-Cry zeichnet
# weiter der Motor. Nur Pixel der PixelLab-Szenen, keine neue Bestellung, deterministisch.
E_PANORAMA = {"waldsee": 150, "kuer": 138}  # Szenenzeilen 0..n: Himmel/Berge/Tannen bzw. Dach/Raenge
E_KISS = (80, 0, 290, 260)  # Demo-Kiss-&-Cry-Kabine ("BITTE WARTEN") samt Schild, Szenen-px
E_TANNEN = (0, 104, 2640, 150)  # Waldsee: Tannenreihe vor den Bergen
E_RAENGE = (0, 40, 2640, 137)  # Kuer: Publikumsraenge
E_SPONSOR = (490, 194, 2150, 231)  # Kuer: gerade Bandenstrecke mit Sponsorenschildern
E_PANEL = (1186, 66, 1454, 192)  # Demo-"TECHNISCHES PANEL" samt Richtern J1..J9 (der Motor hat sein Kampfgericht)


def _kiss_weg(welt: Image.Image) -> Image.Image:
    """Demo-Kiss-&-Cry-Kabine durch den gleich breiten Streifen RECHTS daneben ersetzen (links ist kein
    Platz), weich eingeblendet -- dieselbe Idee wie seitlich_fuellen()."""
    x0, y0, x1, y1 = E_KISS
    w, rand = x1 - x0, 6
    stueck = welt.crop((x1 - rand, y0, x1 + w + rand, y1))
    kern = Image.new("L", stueck.size, 0)
    ImageDraw.Draw(kern).rectangle((rand, 0, stueck.width - rand - 1, stueck.height - 1), fill=255)
    aus = welt.copy()
    aus.paste(stueck, (x0 - rand, y0), kern.filter(ImageFilter.GaussianBlur(rand / 2)))
    return aus


def _tannen_freistellen(band: Image.Image) -> Image.Image:
    """Tannen (dunkles Tannengruen + Schnee auf den Zweigen) vor Bergen/Himmel freistellen."""
    a = np.asarray(band.convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gruen = (g > r + 6) & (g >= b - 8) & (a.sum(2) < 420)
    schnee = (np.abs(r - b) < 14) & (np.abs(g - b) < 14) & (a.sum(2) > 600)
    # Schneereste der Berge, die als Schnee durchrutschen, tragen keine Tannen darunter: nur Pixel, in
    # deren Spalte weiter unten Tannengruen steht, gehoeren zur Tanne.
    unten = np.maximum.accumulate(gruen[::-1], axis=0)[::-1]
    m = Image.fromarray((((gruen | (schnee & unten)) * 255)).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    aus = band.convert("RGBA")
    aus.putalpha(m)
    return aus


def _lagen(streifen: Image.Image, breite: int, hoehe: int, lage_h: int, saat: int, dunkel_rand: bool,
           x_spiegel: bool, luecke: float) -> Image.Image:
    """Seitenflaeche aus Lagen desselben Streifens (Tannenreihen bzw. Raenge): jede Lage waagerecht
    zufaellig versetzt, untere Lagen (naeher) leicht groesser. Transparent, wo der Streifen es ist."""
    import random

    rnd = random.Random(saat)
    aus = Image.new("RGBA", (breite, hoehe), (0, 0, 0, 0))
    y = -lage_h // 2
    while y < hoehe:
        t = max(0.0, y / hoehe)
        h = round(lage_h * (0.85 + 0.35 * t))
        f = h / streifen.height
        s = streifen.resize((round(streifen.width * f), h), Image.LANCZOS)
        dx = rnd.randrange(0, max(1, s.width - breite))
        lage = s.crop((dx, 0, dx + breite, h))
        aus.alpha_composite(lage, (0, y))
        y += round(h * luecke)
    if dunkel_rand:
        # zum Leinwandrand hin dunkler (Tiefe), zur Eisflaeche hin unveraendert
        xx = np.linspace(1.0, 0.0, breite) if not x_spiegel else np.linspace(0.0, 1.0, breite)
        f = (1 - 0.38 * xx ** 1.4)[None, :, None]
        a = np.asarray(aus).astype(np.float32)
        a[..., :3] *= f
        aus = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
    return aus


def baue_eiskunstlauf(variante: str) -> Image.Image:
    b = lade_szenenbilder(SZENEN / "eiskunstlauf" / f"{variante}.html")
    welt = b["bg"].copy()
    welt.alpha_composite(b["fg"])
    welt = seitlich_fuellen(_kiss_weg(welt.convert("RGB")), [E_PANEL])
    waldsee = variante == "waldsee"
    lo, ro, oo, uo = (round(E_K[s]) for s in ("l", "r", "o", "u"))
    # Boden (Schnee bzw. dunkler Hallenboden) als Grund ueberall
    b0 = welt.crop(E_BODEN)
    band = b0.resize((LW, max(8, round(b0.height * LW / b0.width * 3))), Image.LANCZOS)
    lein = streifen_kacheln(band, LW, LH, saat=23).convert("RGBA")

    # fern: Panorama, Unterkante an der oberen Eiskante
    pn = E_PANORAMA[variante]
    pano = welt.crop((0, 0, welt.width, pn))
    ph = round(pn * LW / welt.width)
    pano = pano.resize((LW, ph), Image.LANCZOS)
    lein.paste(pano, (0, oo + 3 - ph))

    # mitte: Seiten (links/rechts der Eisflaeche), von knapp unter dem Panorama bis zum Boden
    sb = lo + 8
    if waldsee:
        streifen = _tannen_freistellen(welt.crop(E_TANNEN))
        lage_h, luecke = 40, 1.0  # Schnee zwischen den Reihen
    else:
        streifen = welt.crop(E_RAENGE).convert("RGBA")
        lage_h, luecke = 50, 0.62
    for seite, x in ((0, 0), (1, LW - sb)):
        flaeche = _lagen(streifen, sb, LH - oo + 6, lage_h, saat=31 + seite, dunkel_rand=True,
                         x_spiegel=seite == 1, luecke=luecke)
        lein.alpha_composite(flaeche, (x, oo - 6))

    # vorne: unter der Eisflaeche
    unten_y = uo + 4
    if waldsee:
        reihe = _tannen_freistellen(welt.crop(E_TANNEN))
        f = 60 / reihe.height
        reihe = reihe.resize((round(reihe.width * f), 60), Image.LANCZOS)
        reihe = reihe.crop((300, 0, 300 + LW, 60))
        a = np.asarray(reihe).astype(np.float32)
        a[..., :3] *= 0.55  # Vordergrund-Silhouette im Gegenlicht
        lein.alpha_composite(Image.fromarray(a.astype(np.uint8), "RGBA"), (0, unten_y + 2))
    else:
        bande = welt.crop(E_SPONSOR)
        bh = round(bande.height * (ro - lo) / bande.width)
        bande = bande.resize((ro - lo, bh), Image.LANCZOS)
        lein.paste(bande, (lo, unten_y))
        rue = welt.crop(E_RAENGE).resize((LW * 2, round(E_RAENGE[3] - E_RAENGE[1]) * 2 * LW // welt.width), Image.LANCZOS)
        rue = rue.crop((LW // 3, 0, LW // 3 + LW, rue.height))
        a = np.asarray(rue.convert("RGB")).astype(np.float32) * 0.45  # Publikumsruecken im Dunkel
        ry = unten_y + bh + 1
        lein.paste(Image.fromarray(a.astype(np.uint8)).crop((0, 0, LW, max(1, LH - ry))), (0, ry))

    # Eis im Rundweg
    eis = welt.crop(E_EIS)
    breite, hoehe = E_K["r"] - E_K["l"], E_K["u"] - E_K["o"]
    f = max(breite / eis.width, hoehe / eis.height)
    eis = eis.resize((round(eis.width * f), round(eis.height * f)), Image.LANCZOS)
    ex = round((E_K["l"] + E_K["r"]) / 2 - eis.width / 2)
    ey = round((E_K["o"] + E_K["u"]) / 2 - eis.height / 2)
    voll = Image.new("RGB", (LW, LH))
    voll.paste(eis, (ex, ey))
    e = np.asarray(voll).astype(np.float32)
    yy, xx = np.mgrid[0:LH, 0:LW].astype(np.float32)
    # Licht: Mitte hell, Raender kalt (statt gleichfoermig grauweiss)
    d = np.sqrt(((xx - LW / 2) / (breite / 2)) ** 2 + ((yy - LH / 2) / (hoehe / 2)) ** 2)
    kalt = np.array([168, 198, 228.0])[None, None]
    w = np.clip((d - 0.45) / 0.6, 0, 1)[..., None] * 0.30
    e = e * (1 - w) + kalt * w
    if waldsee:
        # Spiegelung des Panoramas (Abendrot, Tannen) an der oberen Eiskante, nach unten auslaufend
        sp = pano.transpose(Image.FLIP_TOP_BOTTOM).filter(ImageFilter.GaussianBlur(2.2))
        spa = np.zeros_like(e)
        spa[oo:oo + ph] = np.asarray(sp.convert("RGB")).astype(np.float32)[:min(ph, LH - oo)]
        t = np.clip(1 - (yy - oo) / (ph * 1.1), 0, 1)[..., None] * (yy >= oo)[..., None] * 0.26
        e = e * (1 - t) + spa * t
    else:
        for cx in (LW * 0.3, LW * 0.5, LW * 0.7):
            e = licht_rund(e, cx, LH * 0.52, 170, 120, (255, 255, 255), 0.55, haerte=1.6)
    voll = Image.fromarray(np.clip(e, 0, 255).astype(np.uint8))
    lein.paste(voll, (0, 0), rundweg_maske(E_K))
    return lein.convert("RGB")


# ---------------------------------------------------------------------------------------- Breaking
# Szene (world 768x432): Kerker mit Publikum, Lichtkegel, Ketten; darunter eine flache Rundbuehne mit
# Rock in den Demo-Teamfarben rot/gruen und Demo-HUD (BREAKING-Schild, ZUG-Tafel, Uhr). Der Motor
# zeichnet sein eigenes Druck-Rund (zeichneBreaking). Die Kulisse nimmt Kerker, Publikum und die
# Oberflaeche der Rundbuehne — unten abgeschnitten vor Rock und HUD —, die weissen Startmarken weg.
BR_AUSSCHNITT = (96, 312)  # Szenenzeilen
BR_MARKEN = [(347, 283, 364, 315), (417, 283, 434, 315)]


# Batch 12 (08.11., Audit Rang 6 "Schleier ueber guter Szene"): Ausschnitt bleibt, dazu Licht. Die
# Fackeln leuchten (Glut um die Flamme, gesucht als hellorange Pixel links/rechts), der Lichtschacht
# von oben laeuft weiter bis auf die Mitte des Motor-Druck-Runds (zeichneBreaking: cx=W/2, cy=H*0.54
# -> Szene ~384/213) und bildet dort eine Helligkeitsinsel; die Schatten sind leicht angehoben, damit
# Publikum und Pfeiler lesbar werden. Der Motor legt sein Violett dafuer nur noch zu 20 % darueber.
BR_FACKEL_SUCHE = [(60, 70, 200, 150), (580, 70, 720, 150)]
BR_RUND_MITTE = (384, 213)


def fackeln(welt: np.ndarray) -> list[tuple[float, float]]:
    out = []
    for x0, y0, x1, y1 in BR_FACKEL_SUCHE:
        s = welt[y0:y1, x0:x1].astype(int)
        m = (s[..., 0] > 215) & (s[..., 1] > 110) & (s[..., 2] < 110)
        ys, xs = np.where(m)
        if len(xs):
            out.append((x0 + xs.mean(), y0 + ys.mean()))
    return out


def breaking_licht(welt: Image.Image) -> Image.Image:
    a = np.asarray(welt).astype(np.float32)
    flammen = fackeln(a)
    a = 255.0 * (a / 255.0) ** 0.78  # Schatten anheben
    for fx, fy in flammen:
        a = licht_rund(a, fx, fy + 6, 105, 85, (255, 140, 60), 0.55, haerte=1.7)
        a = licht_rund(a, fx, fy, 18, 18, (255, 214, 130), 0.6)
    cx, cy = BR_RUND_MITTE
    a = licht_kegel(a, cx, 0, 40, cx, cy, 96, (255, 238, 205), 0.20)
    a = licht_rund(a, cx, cy, 130, 98, (255, 226, 176), 0.45, haerte=1.3)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def baue_breaking(variante: str) -> Image.Image:
    welt = lade_szenenbilder(SZENEN / "breaking" / f"{variante}.html")["world"].convert("RGB")
    welt = flicken(welt, BR_MARKEN, [], (150, 255, 620, 318), ring=4, schritt=1)
    welt = breaking_licht(welt)
    y0, y1 = BR_AUSSCHNITT
    f = LH / (y1 - y0)
    nb = LW / f
    x0 = (welt.width - nb) / 2
    aus = welt.crop((round(x0), y0, round(x0 + nb), y1))
    g = int(f) + 1
    aus = aus.resize((aus.width * g, aus.height * g), Image.NEAREST)
    return aus.resize((LW, LH), Image.LANCZOS)


# ---------------------------------------------------------------------------------------- I-Spy
# Motor (bodenSchatzsuche): EINE grosse Arena ueber die ganze Leinwand (Darstellungsrunde 16.11., Chris:
# "eine grosse Arena statt mehrerer getrennter Bereiche"; vorher zwei Raeume links 0..W*0.465 und
# rechts W*0.535..W mit schwarzem Steg dazwischen). Szene (bg 1280x840, Draufsicht): Garten/Hof/Halle
# mit Rueckwand oben und Seitenwaenden. Auf Leinwandhoehe skaliert ist sie nur ~716 px breit; die Halle
# entsteht aus zwei Kopien derselben Szene, links ohne ihre rechte, rechts ohne ihre linke Seitenwand,
# in der Mitte ueber IS_UEBERGANG Pixel weich ineinander geblendet -- eine durchgehende Rueckwand, ein
# Boden, nur die beiden Aussenwaende bleiben. Die beiden Demo-Truhen unten (die Fundorte zeichnet der
# Motor selbst) sind weg. (Rueckfall-Weg, 16.11.: nur Pixel der vorhandenen PixelLab-Szene.)
#
# BREITFORMAT-HALLE (17.11., Chris: "wir verwenden nur noch neue PixelLab-Assets"): liegt
# roh/ispy_halle_<variante>.png vor (PixelLab 792x300 = Seitenverhaeltnis der Leinwand, EINE Halle,
# Rueckwand nur im obersten Streifen, freie Bodenflaeche fuer die Fundorte; Auftrag in
# scripts/pixellab-requisiten.py), wird sie direkt auf die Leinwand gezogen -- keine Kopien, keine
# Naht, keine zwei Pavillons mehr. Die Szenen-Kopie unten bleibt nur der Rueckfall.
IS_TRUHEN = [(138, 694, 199, 739), (1081, 694, 1142, 739)]
IS_UEBERGANG = 56
IS_HALLE_ROH = WURZEL / "data" / "generated" / "pixellab-requisiten" / "roh"


def baue_ispy(variante: str) -> Image.Image:
    halle = IS_HALLE_ROH / f"ispy_halle_{variante}.png"
    if halle.exists():
        roh = Image.open(halle).convert("RGB")
        # erst ganzzahlig hoch (Pixelraster bleibt scharf), dann weich auf die Leinwand
        g = int(LW / roh.width) + 1
        return roh.resize((roh.width * g, roh.height * g), Image.NEAREST).resize((LW, LH), Image.LANCZOS)
    bg = lade_szenenbilder(SZENEN / "i-spy" / f"{variante}.html")["bg"].convert("RGB")
    bg = flicken(bg, IS_TRUHEN, [], (0, 560, 1280, 800), ring=8, schritt=2)
    f = LH / bg.height
    raum = bg.resize((round(bg.width * f), LH), Image.LANCZOS)
    halb, ueb = LW // 2, IS_UEBERGANG
    links = raum.crop((0, 0, halb + ueb // 2, LH))
    rechts = raum.crop((raum.width - halb - ueb // 2, 0, raum.width, LH))
    lein = Image.new("RGB", (LW, LH))
    lein.paste(rechts, (LW - rechts.width, 0))
    # Weiche Naht: die linke Kopie laeuft ueber `ueb` Pixel linear aus.
    maske = Image.new("L", links.size, 255)
    rampe = np.clip(np.linspace(1.0, 0.0, ueb), 0, 1)
    m = np.asarray(maske).copy()
    m[:, links.width - ueb:] = (rampe * 255).astype(np.uint8)[None, :]
    lein.paste(links, (0, 0), Image.fromarray(m))
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
    # Tribuenenstreifen oben und unten (unten gespiegelt: Publikum "gegenueber"). Gemischt statt eines
    # Blocks im Takt (Kulissen-Audit 08.11., Abschnitt 4.8a; tribuenen_mischen()-Kommentar s. dort).
    t0, t1 = BB_TRIBUENE
    trib = welt.crop((0, t0, 1920, t1))
    th = 54
    trib = tribuenen_mischen(trib.resize((LW, th), Image.LANCZOS), 3, saat=0)
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
    # Gemischt statt eines Blocks im Takt, s. tribuenen_mischen()-Kommentar/Audit 4.8a.
    trib = tribuenen_mischen(welt.crop((0, t0, 1920, t1)).resize((LW, th), Image.LANCZOS), 3, saat=1)
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
    # Gemischt statt eines Blocks im Takt, s. tribuenen_mischen()-Kommentar/Audit 4.8a.
    lein.paste(tribuenen_mischen(oben.resize((LW, oh), Image.LANCZOS), 3, saat=2), (0, 0))
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
# (bg 1680x960, HYROX-Halle in Draufsicht): Publikum oben/unten, Hallenboden mit Rudergeraeten,
# Kettlebell-Staendern, Schlitten, Anzeigetafel, Scheinwerferkegeln und den IN-/OUT-/FINISH-Boegen.
#
# KULISSEN BATCH 15 (08.11., Audit-Rang 3 — Chris' eigene Kritik, "das Vorher-Bild hatte mehr
# Charakter"): die ERSTE Fassung (Batch 6, 07.11.) nahm von alldem nur den Asphalt und zwei
# 40-px-Publikumsstreifen — der Befund "80 % einfarbig blaues Band" aus
# docs/design/kulissen-qualitaets-audit-08-11.md Abschnitt 2/4.3. Diese Fassung holt die Halle
# tatsaechlich ins Bild, nach demselben "Rahmen statt Material"-Muster wie Batch 12 (Showcase/
# Breaking) und Batch 13/14 (Takeshi/Climbing) — nur dass hier so gut wie nichts neu bestellt werden
# muss: Schlitten, Rudergeraete, Boegen und Anzeigetafel STEHEN SCHON in der Rohszene, sie wurden nur
# nie geschnitten. Band-Geometrie (SP_OBEN/SP_UNTEN), HUERDEN_N()/camX() und alle Stationspositionen
# bleiben unangetastet — dieses Skript aendert nur, WAS auf und um das Band gezeichnet wird:
#
#   - Kopfstreifen (0..SP_OBEN): drei Ebenen uebereinander statt 40 px Publikum. Fern: ein
#     gemaltes Hallendach mit Traegern und Lichtbaendern (keine Vorlage in der Szene — reiner
#     Vektor, Farbsprache deckt sich zufaellig mit der "HALLE"-Stimmung aus
#     docs/design/einsatzliste-gesamtkonzept-visuell-08-11.md Abschnitt 3.2, Hallendach-Traeger
#     #2B2F36 / Lichtbaender #F2EFE6 — unabhaengig gewaehlt, fuer ein anderes Dokument). Mitte: die
#     Tribuene der Szene. Vorne: eine Gerätezeile aus Rudergeraeten und Schlitten-Symbolen, als
#     dunkle Silhouette direkt ueber der Bahn — UND die Anzeigetafel der Szene (FINISH-Uhr), als
#     eigenes, hoeheres Landmark rechts, wie in der Rohszene.
#   - Bahnband: unveraendert der blaue Loop-Belag (SP_BELAG), die Kacheltechnik von Batch 6 bleibt.
#   - Fussstreifen (SP_UNTEN..H): eine Sponsoren-Bande (Vektor, kein Vorbild in der Szene) mit ein
#     paar kleinen Betreuer-Silhouetten statt eines zweiten Publikumsstreifens (Audit: "kein
#     zweites Publikum").
#
# Die Boegen (IN/FINISH) UND die Stationsumfeld-/Lichtebene zeichnet NICHT dieses Skript, sondern
# der Motor selbst (bodenSpurtGerade(), Kulissen Batch 15 dort): die Bahn zoomt/scrollt mit `cam`,
# und das Standbild hier kennt camX() nicht — nur der Motor weiss, wo Start/Ziel/Stationen gerade
# auf dem Bildschirm stehen. spurt_requisiten() unten liefert dafuer nur die beiden freigestellten
# Bogen-Sprites nach public/sprites/arena/.
SP_OBEN, SP_UNTEN = round(LH * 0.14), round(LH * 0.94)  # 66, 442
SP_PUBLIKUM_OBEN = (0, 0, 1680, 40)
SP_BELAG = (520, 66, 760, 134)
SP_RUDER_ROW = (822, 192, 1398, 290)  # eine Reihe Rudergeraete, ohne die zweite Reihe darunter
SP_SLED = (222, 198, 260, 232)  # ein Schlitten samt Gewichtsscheibe, Kunstrasen-Bahn 1
SP_ANZEIGETAFEL = (1409, 198, 1560, 390)  # "FINISH"-Uhr samt Staender, ohne den Bahnrand rechts
SP_FINISH_BOGEN = (1516, 388, 1676, 528)
SP_IN_BOGEN = (715, 668, 866, 792)

SP_HALLE_DACH_TOP = (22, 24, 29)
SP_HALLE_DACH_BOT = (36, 40, 48)
SP_LICHTBAND = (242, 239, 230)
SP_H_DACH, SP_H_TRIB, SP_H_GER = 12, 24, 30  # Summe = SP_OBEN
assert SP_H_DACH + SP_H_TRIB + SP_H_GER == SP_OBEN


def _sp_hallendach(breite: int, hoehe: int) -> Image.Image:
    """Fern: Hallendach mit Traegern und Lichtbaendern (Audit 4.3) — reiner Vektor, die Szene zeigt
    keine Decke (Draufsicht)."""
    a = np.zeros((hoehe, breite, 3), dtype=np.float32)
    for y in range(hoehe):
        u = y / max(1, hoehe - 1)
        a[y, :] = [SP_HALLE_DACH_TOP[k] + (SP_HALLE_DACH_BOT[k] - SP_HALLE_DACH_TOP[k]) * u for k in range(3)]
    im = Image.fromarray(a.astype(np.uint8)).convert("RGBA")
    d = ImageDraw.Draw(im)
    for x0 in range(-20, breite + 40, 62):
        d.line([(x0, hoehe), (x0 + 30, 0)], fill=(12, 13, 17, 160), width=2)
    for i in range(5):
        cx = breite * (0.05 + i * 0.22)
        bw = breite * 0.13
        d.rectangle((cx, hoehe * 0.28, cx + bw, hoehe * 0.28 + 2), fill=SP_LICHTBAND + (230,))
        d.rectangle((cx - 3, hoehe * 0.28 - 1, cx + bw + 3, hoehe * 0.28 + 4), fill=SP_LICHTBAND + (40,))
    return im.convert("RGB")


def _sp_geraetezeile(bg: Image.Image, breite: int, hoehe: int) -> Image.Image:
    """Vorne: Rudergeraete + Schlitten als dunkle Silhouetten, knapp ueber der Bahn (Audit 4.3)."""
    ruder = bg.crop(SP_RUDER_ROW)
    sc = hoehe / ruder.height
    ruder2 = ruder.resize((round(ruder.width * sc), hoehe), Image.LANCZOS)
    sled = bg.crop(SP_SLED)
    scs = hoehe / sled.height
    sled2 = sled.resize((round(sled.width * scs), hoehe), Image.LANCZOS)
    einheit = Image.new("RGB", (ruder2.width * 2 + sled2.width, hoehe))
    einheit.paste(ruder2, (0, 0))
    einheit.paste(sled2, (ruder2.width, 0))
    einheit.paste(ruder2, (ruder2.width + sled2.width, 0))
    aus = Image.new("RGB", (breite + einheit.width, hoehe))
    x = 0
    while x < aus.width:
        aus.paste(einheit, (x, 0))
        x += einheit.width
    aus = aus.crop((0, 0, breite, hoehe))
    a = np.asarray(aus, dtype=np.float32) * 0.72  # Silhouette, nicht Grundflaeche
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def _sp_kopfstreifen(bg: Image.Image) -> Image.Image:
    kopf = Image.new("RGB", (LW, SP_OBEN))
    kopf.paste(_sp_hallendach(LW, SP_H_DACH), (0, 0))
    trib = bg.crop(SP_PUBLIKUM_OBEN).resize((LW, SP_H_TRIB), Image.LANCZOS)
    kopf.paste(trib, (0, SP_H_DACH))
    kopf.paste(_sp_geraetezeile(bg, LW, SP_H_GER), (0, SP_H_DACH + SP_H_TRIB))
    # Anzeigetafel: eigenes, groesseres Landmark rechts aussen (wie in der Rohszene), haengt von der
    # Traverse bis fast an die Geraetezeile herunter — deckt bewusst Tribuene UND Geraetezeile ab.
    tafel = bg.crop(SP_ANZEIGETAFEL)
    th = SP_H_TRIB + SP_H_GER + 4
    sc = th / tafel.height
    tafel2 = tafel.resize((round(tafel.width * sc), th), Image.LANCZOS)
    kopf.paste(tafel2, (round(LW * 0.885), SP_H_DACH - 2))
    return kopf


def _sp_sponsorenbande(breite: int, hoehe: int) -> Image.Image:
    """Fussstreifen, oberer Teil: Bande mit Sponsoren (Audit 4.3) — kein Vorbild in der Szene,
    reiner Vektor wie die Bandenschilder bei Tennis/Football."""
    im = Image.new("RGB", (breite, hoehe), (16, 18, 24))
    d = ImageDraw.Draw(im)
    farben = [(190, 60, 60), (60, 130, 190), (205, 172, 55), (55, 170, 120), (170, 80, 170)]
    segb = 150
    i, x = 0, 0
    while x < breite:
        d.rectangle((x, 0, x + segb - 3, hoehe - 1), fill=farben[i % len(farben)])
        d.rectangle((x + 10, hoehe * 0.22, x + segb - 13, hoehe * 0.78), fill=(246, 246, 244))
        x += segb
        i += 1
    return im


def _sp_betreuer(h: int) -> Image.Image:
    w = max(5, round(h * 0.42))
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((w * 0.28, 0, w * 0.72, h * 0.26), fill=(230, 210, 185, 255))
    d.polygon([(w * 0.5, h * 0.24), (w * 0.08, h * 0.56), (w * 0.18, h * 0.60),
               (w * 0.5, h * 0.40), (w * 0.82, h * 0.60), (w * 0.92, h * 0.56)], fill=(70, 78, 92, 255))
    d.rectangle((w * 0.30, h * 0.24, w * 0.70, h * 0.68), fill=(70, 78, 92, 255))
    d.rectangle((w * 0.30, h * 0.66, w * 0.46, h), fill=(28, 28, 34, 255))
    d.rectangle((w * 0.54, h * 0.66, w * 0.70, h), fill=(28, 28, 34, 255))
    return im


def _sp_fussstreifen() -> Image.Image:
    """Fussstreifen: Bande mit Sponsoren und ein paar Betreuer, KEIN zweites Publikum (Audit 4.3)."""
    h = LH - SP_UNTEN
    hb, hf = 14, h - 14
    im = Image.new("RGB", (LW, h))
    im.paste(_sp_sponsorenbande(LW, hb), (0, 0))
    im.paste(Image.new("RGB", (LW, hf), (26, 28, 34)), (0, hb))
    fig = _sp_betreuer(hf - 2)
    for f in (0.07, 0.24, 0.42, 0.60, 0.77, 0.93):
        im.paste(fig, (round(LW * f), hb + 1), fig)
    return im


def baue_spurt(variante: str) -> Image.Image:
    bg = lade_szenenbilder(SZENEN / "spurt" / f"{variante}.html")["bg"].convert("RGB")
    lein = Image.new("RGB", (LW, LH))
    belag = bg.crop(SP_BELAG)
    belag = belag.resize((belag.width * 2, belag.height * 2), Image.NEAREST)
    lein.paste(kacheln_gespiegelt(belag, LW, SP_UNTEN - SP_OBEN), (0, SP_OBEN))
    lein.paste(_sp_kopfstreifen(bg), (0, 0))
    lein.paste(_sp_fussstreifen(), (0, SP_UNTEN))
    return lein


def spurt_requisiten() -> None:
    """Die beiden Bahn-Boegen (IN/FINISH) fuer den MOTOR (nicht fuer die Kulisse hier): aus der
    HYROX-Rohszene freigestellt (kulissen_werkzeug.freistellen — kettengeflutete Alpha, kein manuell
    genanntes Hintergrundgruen/-blau noetig) und nach public/sprites/arena/ geschrieben, dieselbe
    Stelle wie jede andere Motor-Requisite (A_TEILE in battle-mode.engine.js). Kein PixelLab-Auftrag:
    die Rohszene fuehrt beide Boegen bereits (Audit woertlich), es fehlte nur der Schnitt.

        python3 -I scripts/baue-kulisse-buehnen.py --spurt-requisiten
    """
    bg = Image.open(SZENEN / "spurt" / "hyrox.jpg").convert("RGB")
    ziel = SPRITES / "arena"
    eintraege = {
        "spurt_bogen_in.png": (SP_IN_BOGEN, "gelb-schwarzer IN-Bogen am Streckenanfang der Kunstrasen-Schleife"),
        "spurt_bogen_finish.png": (SP_FINISH_BOGEN, "roter FINISH-Bogen samt Anzeigetafel-Sockel am Streckenende"),
    }
    quellen_pfad = ziel / "quellen.json"
    text = quellen_pfad.read_text(encoding="utf-8")
    vorhanden = json.loads(text)
    anhaengen = []
    for datei, (box, beschreibung) in eintraege.items():
        bild = freistellen(bg.crop(box), 26)
        bild.save(ziel / datei, optimize=True)
        print(f"spurt-requisit: -> {(ziel / datei).relative_to(WURZEL)} ({bild.size[0]}x{bild.size[1]})")
        if datei in vorhanden:
            print(f"  (quellen.json fuehrt {datei} schon — Eintrag bleibt wie er ist, kein erneutes Anhaengen)")
            continue
        x0, y0, x1, y1 = box
        wert = {
            "paket": "PixelLab (Asset-Runde, ueber die Spurt-Rohszene)",
            "quelle": "public/szenen/spurt/hyrox.jpg",
            "schnitt": f"x={x0} y={y0} {x1 - x0}x{y1 - y0}, kettengeflutet freigestellt (kulissen_werkzeug.freistellen, Schwelle 26)",
            "beschreibung": beschreibung,
            "skript": "python3 -I scripts/baue-kulisse-buehnen.py --spurt-requisiten",
            "lizenz": "PixelLab-Abonnement (Tier 3), eigene Erzeugung fuer dieses Projekt",
            "erzeugt": "2026-11-08",
        }
        # Textgenau angehaengt (nicht per json.dumps() der GANZEN Datei neu serialisiert): die Datei
        # hat eine Einrueckung von 1 Leerzeichen je Ebene und Einfuegereihenfolge als Lesereihenfolge
        # -- ein voller Reserialize haette ueber 2000 Zeilen Diff erzeugt, obwohl nur zwei Eintraege
        # dazukommen. json.dumps(wert, indent=1) liefert dieselbe Verschachtelung ab Ebene 2; nur die
        # erste Zeile ("{") bekommt den Schluessel vorangestellt, alle Zeilen ab der zweiten eine
        # zusaetzliche Stufe Einrueckung (sie stehen eine Ebene tiefer als ein Wurzel-Objekt).
        block = json.dumps(wert, indent=1, ensure_ascii=False)
        zeilen = block.splitlines()
        zeilen = [zeilen[0]] + [" " + z for z in zeilen[1:]]
        anhaengen.append(f' "{datei}": ' + "\n".join(zeilen))
    if anhaengen:
        assert text.endswith("}\n"), "quellen.json endet nicht wie erwartet auf '}\\n'"
        text = text[: -len("}\n")].rstrip()
        text += ",\n" + ",\n".join(anhaengen) + "\n}\n"
        quellen_pfad.write_text(text, encoding="utf-8")
        json.loads(text)  # sofort gegenlesen: die handgenaehte Datei muss gueltiges JSON bleiben


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
ST_ZIEGEL = (181, 68, 47)


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
    # Gemischt statt eines Blocks im Takt, s. tribuenen_mischen()-Kommentar/Audit 4.8a.
    trib = tribuenen_mischen(trib, 3, saat=4)
    lein.paste(trib, (0, 0))
    # ZWEITE TRIBUENENSEITE UNTEN (Kulissen-Audit 08.11., Abschnitt 4.8c, Politur — bisher nur oben,
    # wie Basketball/Football/Hockey es mit ihrem zweiten Tribuenenband schon tun). Die Szene zeigt nur
    # eine Tribuenenseite; gespiegelt als Gegenueber. Nur der schmale Streifen UNTERHALB der Bahnkurve
    # (OVAL_CY+OVAL_R_AUSSEN*OVAL_STAUCH, s. bodenSpurtOval() im Motor) -- sonst ueberdeckte die
    # Tribuene die untere Kurve selbst, bevor der Ring unten am Schluss ueber die Maske kommt.
    marge = round(LH - (ST_CY + ST_RA * ST_ST))
    if marge > 4:
        trib_unten = trib.transpose(Image.FLIP_TOP_BOTTOM).resize((LW, marge), Image.LANCZOS)
        lein.paste(trib_unten, (0, LH - marge))
    tartan = welt.crop(ST_TARTAN)
    tartan = linien_entfernen(tartan, linien_maske(tartan))
    tartan = tartan.resize((round(tartan.width * 0.6), round(tartan.height * 0.6)), Image.LANCZOS)
    # Klassisches Ziegelrot (Mondo-Bahn, #b5442f wie bisher im Motor) statt des Tuerkis des Assets:
    # die Koernung bleibt (Helligkeit relativ zum Mittel), nur der Farbton wird getauscht.
    t = np.asarray(tartan, dtype=np.float32)
    hell = t.mean(axis=2, keepdims=True)
    rel = hell / max(float(hell.mean()), 1.0)
    rot = np.clip(rel * np.array(ST_ZIEGEL, dtype=np.float32), 0, 255).astype(np.uint8)
    ring = kacheln_gespiegelt(Image.fromarray(rot), LW, LH)
    r_innen = ST_RA - ST_N * ST_BA
    m = np.asarray(oval_maske(ST_RA + 2)).copy()
    m[np.asarray(oval_maske(r_innen - 1)) > 0] = 0
    lein.paste(ring, (0, 0), Image.fromarray(m))
    return lein


# ---------------------------------------------------------------------------------------- Climbing
# Motor (bodenWand): senkrecht scrollende Wand (camY), Griffe aus BA().hindernisse und HUERDEN_TYP —
# genau die Werte, mit denen das Rennen rechnet —, Bahnlinien wandX, Sicherungsfiguren zeichnet der
# Motor. Szene (700x780): Kletterwand (Halle, Fels, Eis) mit Griffen, Volumen, Hoehenskala, Matten.
# Kulisse: nur das WANDMATERIAL — Griffe, Bolzen und Volumen herausgenommen —, als Kachel, die sich
# senkrecht nahtlos wiederholt (obere Haelfte + gespiegelte Kopie): der Motor zieht sie mit der Kamera
# mit (kulisseZeichnen(versatzY)), damit die Wand nicht stehen bleibt, waehrend die Griffe wandern.
CL_WAND = (30, 24, 670, 574)
CL_ACHSEN = {"wand": (0, 1), "fels": (1,), "eis": (0,)}


def laufender_median(a: np.ndarray, achse: int, fenster: int) -> np.ndarray:
    """Median ueber `fenster` Pixel entlang `achse` (0 = senkrecht), Raender gespiegelt."""
    h = fenster // 2
    pad = [(h, h) if i == achse else (0, 0) for i in range(a.ndim)]
    p = np.pad(a, pad, mode="reflect")
    aus = np.empty_like(a)
    n = a.shape[achse]
    for i in range(0, n, 32):
        j = min(n, i + 32)
        if achse == 0:
            fenst = np.lib.stride_tricks.sliding_window_view(p[i:j + 2 * h], fenster, axis=0)
            aus[i:j] = np.median(fenst, axis=-1).astype(a.dtype)
        else:
            fenst = np.lib.stride_tricks.sliding_window_view(p[:, i:j + 2 * h], fenster, axis=1)
            aus[:, i:j] = np.median(fenst, axis=-1).astype(a.dtype)
    return aus


def baue_climbing(variante: str) -> Image.Image:
    import base64
    import io
    import re

    s = (SZENEN / "climbing" / f"{variante}.html").read_text(encoding="utf-8")
    b64 = re.search(r'data:image/[a-z]+;base64,([A-Za-z0-9+/=]{5000,})', s).group(1)
    wand = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB").crop(CL_WAND)
    # Griffe und Volumen sind klein gegen die Wand: ein laufender Median entlang der Maserung nimmt sie
    # heraus und laesst die Maserung stehen (Eis: senkrechte Zapfen -> senkrecht; Fels: waagerechte
    # Schichten -> waagerecht; Hallenwand: beides, die Plattenfugen bleiben).
    a = np.asarray(wand, dtype=np.uint8)
    for achse in CL_ACHSEN[variante]:
        a = laufender_median(a, achse, 201 if variante == "eis" else 121)
    # Feine Koernung der Szene zurueck (Hochpass, nur kleine Ausschlaege — Griffkanten sind gross)
    roh = np.asarray(wand, dtype=np.float32)
    hp = roh - np.asarray(wand.filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)
    # nur wo das Original schon nahe am Median liegt: sonst kaemen Volumen-/Griffkanten als Geister zurueck
    nah = np.abs(roh - a.astype(np.float32)).max(axis=2, keepdims=True) < 18
    ruhig = (np.abs(hp).max(axis=2, keepdims=True) < 10) & nah
    a = np.clip(a.astype(np.float32) + hp * ruhig, 0, 255).astype(np.uint8)
    wand = Image.fromarray(a)
    f = LW / wand.width
    wand = wand.resize((LW, round(wand.height * f)), Image.LANCZOS)
    halb = wand.crop((0, 0, LW, LH // 2))
    lein = Image.new("RGB", (LW, LH))
    lein.paste(halb, (0, 0))
    lein.paste(halb.transpose(Image.FLIP_TOP_BOTTOM), (0, LH // 2))
    return lein


def baue_takeshi(variante: str) -> Image.Image:
    """TAKESHI-ARENEN-REMAKE (17.11., docs/design/takeshi-arenen-remake-17-11.md): es gibt bewusst
    KEINEN Bau aus der alten Szene -- die Arena ist eine gemalte PixelLab-Karte (roh/
    kulisse_takeshis_castle_<variante>.png, Auftrag gleichen Namens in
    scripts/pixellab-requisiten.py), auf deren gemaltem Weg die Motor-Route liegt
    (TAKESHI_ARENEN in battle-mode.engine.js). Fehlt das Rohbild, gibt es keine Kulisse und der
    Motor zeichnet die alte Midoriyama-Karte (Rueckfall)."""
    raise SystemExit(f"takeshis-castle/{variante}: Rohbild roh/kulisse_takeshis_castle_{variante}.png fehlt")


BAUER = {"tennis": baue_tennis, "fechten": baue_fechten, "speed-schach": baue_schach,
         "showcase": baue_showcase, "eiskunstlauf": baue_eiskunstlauf, "breaking": baue_breaking, "i-spy": baue_ispy,
         "gewichtheben": baue_gewichtheben, "basketball": baue_basketball,
         "football": baue_football, "hockey": baue_hockey,
         "spurt": baue_spurt, "staffel": baue_staffel, "climbing": baue_climbing,
         "takeshis-castle": baue_takeshi}
# Speed-Schach "turniersaal" fehlt bewusst: im Saal sitzen zwei eingebrannte Demo-Partien (Spieler an
# Seitentischen mit Brett) genau in Hoehe der Motor-Spieler — sie laesst sich nicht sauber freistellen
# und saehe aus wie zwei weitere Duelle. Kommt sie spaeter linienfrei neu, reicht ein Eintrag hier.
VARIANTEN = {"tennis": ["court", "dach", "riviera"], "fechten": ["piste", "schlosshof"],
             "speed-schach": ["park", "zug"], "showcase": ["buehne", "festival", "zirkus"],
             "eiskunstlauf": ["kuer", "waldsee"], "breaking": ["standard", "brutal"],
             "i-spy": ["aztec", "horror", "lostplace", "ruinengarten"],
             "gewichtheben": ["hafen", "oase", "sandsack"], "basketball": ["parkett", "streetcourt"],
             "football": ["feld", "strand"], "hockey": ["eis", "bergsee"],
             "spurt": ["kurs"], "staffel": ["arena"], "climbing": ["wand", "fels", "eis"],
             "takeshis-castle": ["eisfestung", "dschungel"]}


# ---------------------------------------------------------------------------------------- Welle A
# PIXELLAB-BREITFORMATE (17.11., Chris: "nur noch PixelLab-Assets", Welle A des Audits
# docs/design/pixellab-nur-neue-assets-audit-17-11.md): liegt roh/kulisse_<disziplin>_<variante>.png vor
# (PixelLab 792x300, Auftrag in scripts/pixellab-requisiten.py), ersetzt es die Variante ganz -- wie die
# I-Spy-Hallen: ganzzahlig NEAREST hoch, dann LANCZOS auf die Leinwand. Das Bild traegt nur Untergrund
# und Rand (Deko oben und an den Seiten, Boden frei, ohne Markierungen); Linien, Netz, Tore und Bande
# zeichnet weiter der Motor. Fehlt das Rohbild, baut BAUER die Variante wie bisher (Rueckfall).
PL_ROH = WURZEL / "data" / "generated" / "pixellab-requisiten" / "roh"
# RAND AN DIE MOTOR-GEOMETRIE (nur wo noetig): PixelLab trifft die Breite der Randdeko nicht genau. Je
# Seite (roh-Kante, Leinwand-Kante): der Randstreifen ausserhalb der roh-Kante bleibt im Massstab
# unverzerrt und wird nur am aeusseren Ende beschnitten, damit seine Innenkante genau auf der
# Leinwand-Kante liegt; der freie Boden dazwischen wird gestreckt. Fehlt eine Seite, gilt der
# gleichmaessige Massstab. Basketball: Zaun oben/unten lag sonst 40 px tief im Feld (60..H-60);
# Tennis-Dach: Zaununterkante sonst unter der fernen Grundlinie (H*0.17); Waldsee: Ufer/Tannen sonst
# innerhalb der Bande (kuerFlaeche: ~110..1130 x 60..410).
PL_RAENDER = {
    ("basketball", "streetcourt"): {"oben": (72, 58), "unten": (239, LH - 58)},
    ("tennis", "dach"): {"oben": (75, 78)},
    ("eiskunstlauf", "waldsee"): {"oben": (76, 64), "unten": (262, LH - 58), "links": (97, 112), "rechts": (695, LW - 112)},
}


def _achse(n_lein: int, n_roh: int, s: float, a=None, b=None) -> np.ndarray:
    """Leinwand-Koordinate (Mitte jedes Pixels) -> roh-Koordinate, stueckweise linear (s. PL_RAENDER)."""
    c = np.arange(n_lein) + 0.5
    r = c / s
    a_roh, a_lein = a if a else (0.0, 0.0)
    b_roh, b_lein = b if b else (n_roh, n_roh * s)
    r = np.where(c < a_lein, a_roh - (a_lein - c) / s, r)
    mitte = (c >= a_lein) & (c < b_lein)
    r = np.where(mitte, a_roh + (c - a_lein) * (b_roh - a_roh) / (b_lein - a_lein), r)
    r = np.where(c >= b_lein, b_roh + (c - b_lein) / s, r)
    return np.clip(r, 0, n_roh - 1e-6)


def pixellab_breitform(disziplin: str, variante: str) -> Image.Image | None:
    roh_pfad = PL_ROH / f"kulisse_{disziplin.replace('-', '_')}_{variante}.png"
    if not roh_pfad.exists():
        return None
    roh = Image.open(roh_pfad).convert("RGB")
    rd = PL_RAENDER.get((disziplin, variante))
    if not rd:
        g = int(LW / roh.width) + 1
        return roh.resize((roh.width * g, roh.height * g), Image.NEAREST).resize((LW, LH), Image.LANCZOS)
    # doppelte Leinwand, Pixel des roh-Bildes per naechstem Nachbarn, dann weich auf die Leinwand
    s = LW / roh.width
    ys = _achse(LH * 2, roh.height, s * 2, *(None if k not in rd else (rd[k][0], rd[k][1] * 2) for k in ("oben", "unten")))
    xs = _achse(LW * 2, roh.width, s * 2, *(None if k not in rd else (rd[k][0], rd[k][1] * 2) for k in ("links", "rechts")))
    a = np.asarray(roh)[ys.astype(int)[:, None], xs.astype(int)[None, :]]
    return Image.fromarray(a).resize((LW, LH), Image.LANCZOS)


def main() -> None:
    if "--spurt-requisiten" in sys.argv[1:]:
        spurt_requisiten()
        return
    disziplinen = [a for a in sys.argv[1:] if not a.startswith("--")] or list(BAUER)
    for d in disziplinen:
        for v in VARIANTEN[d]:
            bild = pixellab_breitform(d, v)
            ziel = speichere_quelle(d, v, bild if bild is not None else BAUER[d](v))
            print(f"{d}/{v}: -> {ziel.relative_to(WURZEL)}")


if __name__ == "__main__":
    main()
