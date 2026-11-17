#!/usr/bin/env python3
"""BASKETBALL-ASSETS (Benchmark-Disziplin, 17.11.): baut aus den gewaehlten PixelLab-Rohbildern
(data/generated/pixellab-requisiten/roh/bb_*.png, bestellt mit scripts/pixellab-basketball-bestellen.py)
die Motor-Dateien. Deterministisch, ohne Netz.

  python3 -I scripts/baue-basketball-assets.py            alles (Korb, Wappen, Schussuhr, Boden-Overlays, Anker)
  python3 -I scripts/baue-basketball-assets.py --vorschau DIR   zusaetzlich Montagen (Vorher/Nachher) nach DIR
  Geometrie-Schalter (falls der Motor Korb/Bogen/Zone verschiebt, s. GEO): --korb-x 0.076 --dreier-rx 112.8
  --dreier-ry 112.8 --zone-tiefe 220.6 --zone-breite 150.4 --korb-skala 1.25

Ergebnis:
  public/sprites/basketball/korb_links_hinten.png, korb_links_vorne.png, korb_links.png   (96x128)
  public/sprites/basketball/korb_rechts_hinten.png, korb_rechts_vorne.png, korb_rechts.png (gespiegelt)
  public/sprites/basketball/wappen_parkett.png, wappen_streetcourt.png                    (96x96)
  public/sprites/basketball/schussuhr_rahmen.png                                          (48x32)
  public/sprites/kulissen/basketball/parkett_linien.png, streetcourt_linien.png           (1240x470, transparent)
  data/generated/pixellab-requisiten/basketball-17-11/anker.json                          (Ankerpunkte, gemessen)

KORB-EBENEN. Das Rohbild zeigt den linken Korb (Staender links, Ring ragt nach rechts). Zwei Ebenen in
derselben Box, damit der Ball DURCH den Ring laufen kann -- Zeichenreihenfolge im Motor:
  1. korb_*_hinten  (Sockel, Mast, Brett, hinterer Ringbogen, abgedunkelte Netz-Rueckseite)
  2. Ball (solange er am/im Ring ist)
  3. korb_*_vorne   (vorderer Ringbogen + Netz-Vorderseite)
Schnitt: `vorne` = alle Pixel mit y >= RING_CY+1 und x >= RING_X0 (vorderer Bogen und das Netz darunter);
alles andere ist `hinten`. Die Netz-Rueckseite ist dieselbe Netzflaeche, abgedunkelt und 2 px hoeher --
sie fuellt die Maschen der Vorderseite dunkel, der Ball liegt dazwischen.

BODEN-OVERLAY. Die Geometrie MUSS die des Motors sein (DREIER_RADIUS trifft den gezeichneten Bogen, s.
Kommentar an DREIER_RADIUS in battle-mode.engine.js) -- deshalb malt nicht PixelLab die Linien, sondern
dieses Skript: pixelgenau, ohne Kantenglaettung, mit Farbabrieb. PixelLab liefert Halle/Belag
(Kulisse), das Mittelkreis-Wappen und den Korb. Der Motor legt das Overlay in bodenFeldspiel() ueber die
Kulisse (nach kulisseZeichnen(), an Stelle der weissen Vektorlinien) und zeichnet darauf die Koerbe.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROH = os.path.join(WURZEL, "data/generated/pixellab-requisiten/roh")
SPRITES = os.path.join(WURZEL, "public/sprites")
ANKER = os.path.join(WURZEL, "data/generated/pixellab-requisiten/basketball-17-11/anker.json")

W, H = 1240, 470   # Leinwand des Motors (cv.width/cv.height)

# --- Korb-Rohbild (roh/bb_korb.png, 96x128), gemessen an Kandidat 3 -----------------------------------
RING_CX, RING_CY = 68, 52        # Mittelpunkt der Ringoeffnung
RING_RX_AUSSEN, RING_RY_AUSSEN = 12, 7   # Ring mit Kontur: x 56..80, y 44..58
RING_RX_INNEN, RING_RY_INNEN = 8, 3      # freie Oeffnung: x 62..77, y 49..55
RING_X0 = 56                     # linke Kante des Rings (links davon liegt bei y >= 53 nur noch Brett)
NETZ_Y0, NETZ_Y1 = 59, 76        # Netz haengt von y 59 bis 75
BODEN_Y = 111                    # Standflaeche des Sockels (Mitte der Sockel-Grundflaeche, x 18..49)
SOCKEL_CX = 33


def lade(name):
    return Image.open(os.path.join(ROH, name + ".png")).convert("RGBA")


def speichere(im, rel):
    ziel = os.path.join(SPRITES, rel)
    os.makedirs(os.path.dirname(ziel), exist_ok=True)
    im.save(ziel, optimize=True)
    return ziel


def baue_korb():
    roh = lade("bb_korb")
    a = np.asarray(roh).copy()
    a[:, :, 3] = np.where(a[:, :, 3] >= 128, 255, 0)
    ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    ist_vorne = (ys >= RING_CY + 1) & (xs >= RING_X0) & (a[:, :, 3] > 0)
    vorne = a.copy()
    vorne[~ist_vorne] = 0
    hinten = a.copy()
    hinten[ist_vorne] = 0
    # Netz-Rueckseite: Netzflaeche abgedunkelt, 2 px hoeher, nur wo `hinten` frei ist
    netz = np.zeros_like(a)
    m = ist_vorne & (ys >= NETZ_Y0) & (ys < NETZ_Y1)
    netz[m] = a[m]
    netz[:, :, :3] = (netz[:, :, :3] * 0.42).astype(np.uint8)
    netz = np.roll(netz, -2, axis=0)
    frei = (hinten[:, :, 3] == 0) & (netz[:, :, 3] > 0) & (ys >= RING_CY + RING_RY_INNEN)
    hinten[frei] = netz[frei]
    aus = {}
    for seite in ("links", "rechts"):
        h_im, v_im = Image.fromarray(hinten), Image.fromarray(vorne)
        if seite == "rechts":
            h_im, v_im = h_im.transpose(Image.FLIP_LEFT_RIGHT), v_im.transpose(Image.FLIP_LEFT_RIGHT)
        ganz = h_im.copy()
        ganz.alpha_composite(v_im)
        speichere(h_im, f"basketball/korb_{seite}_hinten.png")
        speichere(v_im, f"basketball/korb_{seite}_vorne.png")
        speichere(ganz, f"basketball/korb_{seite}.png")
        aus[seite] = (h_im, v_im)
    return aus


def baue_kleinteile():
    w1 = lade("bb_wappen")
    w2 = lade("bb_wappen_street")
    speichere(w1, "basketball/wappen_parkett.png")
    speichere(w2, "basketball/wappen_streetcourt.png")
    su = lade("bb_schussuhr")
    speichere(su, "basketball/schussuhr_rahmen.png")
    return {"parkett": w1, "streetcourt": w2}, su


# --- Boden-Overlay ---------------------------------------------------------------------------------
def rausch(saat, form, zelle):
    """Wertrauschen 0..1, deterministisch, bilinear aus einem groben Gitter."""
    rng = np.random.default_rng(saat)
    gh, gw = form[0] // zelle + 2, form[1] // zelle + 2
    g = rng.random((gh, gw))
    y = np.arange(form[0]) / zelle
    x = np.arange(form[1]) / zelle
    y0, x0 = y.astype(int), x.astype(int)
    fy, fx = (y - y0)[:, None], (x - x0)[None, :]
    a = g[y0][:, x0]
    b = g[y0][:, x0 + 1]
    c = g[y0 + 1][:, x0]
    d = g[y0 + 1][:, x0 + 1]
    return a * (1 - fy) * (1 - fx) + b * (1 - fy) * fx + c * fy * (1 - fx) + d * fy * fx


FARBEN = {
    # linie: Farbe der Markierungen; zone: Fuellung der Zone (r,g,b,deckkraft); bogen: Tönung der Flaeche
    # innerhalb der Dreierlinie (macht den Bogen auch als FLAECHE lesbar); rand: dunkle Kontur der Farbe.
    "parkett": dict(linie=(244, 232, 204), zone=(112, 20, 26, 0.50), bogen=(60, 24, 10, 0.16), rand=(40, 16, 8, 0.45)),
    "streetcourt": dict(linie=(238, 238, 230), zone=(196, 74, 40, 0.52), bogen=(16, 28, 60, 0.20), rand=(14, 22, 40, 0.45)),
}


def baue_overlay(variante, geo, wappen):
    f = FARBEN[variante]
    ys, xs = np.mgrid[0:H, 0:W]
    px, py = xs + 0.5, ys + 0.5
    x0, x1, y0, y1 = W * 0.06, W * 0.94, 60.0, H - 60.0
    cy = H / 2
    linie = np.zeros((H, W), bool)     # normale Linien (3 px)
    zone = np.zeros((H, W), bool)
    innen3 = np.zeros((H, W), bool)
    im_feld = (px >= x0) & (px <= x1) & (py >= y0) & (py <= y1)
    t = 3.0

    def strecke(ax, ay, bx, by, dicke=t):
        vx, vy = bx - ax, by - ay
        l2 = vx * vx + vy * vy
        u = np.clip(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1)
        d = np.hypot(px - (ax + u * vx), py - (ay + u * vy))
        return d <= dicke / 2

    def rahmen(ax, ay, bx, by, dicke=t):
        return strecke(ax, ay, bx, ay, dicke) | strecke(ax, by, bx, by, dicke) | strecke(ax, ay, ax, by, dicke) | strecke(bx, ay, bx, by, dicke)

    linie |= rahmen(x0, y0, x1, y1, 4.0)
    linie |= strecke(W / 2, y0, W / 2, y1)
    r_mitte = H * 0.09
    if wappen is None:
        linie |= np.abs(np.hypot(px - W / 2, py - cy) - r_mitte) <= t / 2
    for links in (True, False):
        s = 1 if links else -1
        gx = x0 if links else x1
        kx = W * geo["korb_x"] if links else W * (1 - geo["korb_x"])
        zt, zb = geo["zone_tiefe"], geo["zone_breite"]
        zx = gx + s * zt
        za, zc = min(gx, zx), max(gx, zx)
        zone |= (px >= za) & (px <= zc) & (np.abs(py - cy) <= zb / 2)
        linie |= rahmen(za, cy - zb / 2, zc, cy + zb / 2)
        # Freiwurfkreis: feldseitige Haelfte durchgezogen, zonenseitige gestrichelt
        d = np.hypot(px - zx, py - cy)
        ring = np.abs(d - r_mitte) <= t / 2
        feldseitig = (px - zx) * s >= 0
        winkel = np.arctan2(py - cy, (px - zx) * s)
        strich = (np.floor(winkel / (np.pi / 9)).astype(int) % 2) == 0
        linie |= ring & (feldseitig | strich)
        # Dreierlinie: Ellipsenbogen um den Korb (rx/ry; Motor heute: Kreis H*0.24), an den Enden
        # (Winkel 0.20 vor der Senkrechten, wie ctx.arc im Motor) gerade Stuecke bis zur Grundlinie.
        rx, ry = geo["dreier_rx"], geo["dreier_ry"]
        ex, ey = (px - kx) * s / rx, (py - cy) / ry
        e = np.hypot(ex, ey)
        ende_x = np.sin(0.20) * rx          # x-Abstand der Bogenenden vom Korb (feldwaerts)
        ende_y = np.cos(0.20) * ry
        vor_ende = (px - kx) * s >= ende_x
        skala = np.minimum(rx, ry)
        bogen = (np.abs(e - 1) * skala <= 2.0) & vor_ende
        ecke_x = kx + s * ende_x
        ecken = strecke(gx, cy - ende_y, ecke_x, cy - ende_y, 4.0) | strecke(gx, cy + ende_y, ecke_x, cy + ende_y, 4.0)
        linie |= bogen | ecken
        innen3 |= ((e <= 1) & vor_ende) | (((px - gx) * s >= 0) & ~vor_ende & (np.abs(py - cy) <= ende_y))
    linie &= (px >= x0 - 2) & (px <= x1 + 2) & (py >= y0 - 2) & (py <= y1 + 2)
    zone &= im_feld
    innen3 &= im_feld & ~zone

    # Abrieb: grobes und feines Rauschen, deterministisch je Variante
    saat = {"parkett": 1711, "streetcourt": 1712}[variante]
    grob = rausch(saat, (H, W), 14)
    fein = rausch(saat + 1, (H, W), 3)
    abrieb = (grob * 0.6 + fein * 0.4)
    aus = np.zeros((H, W, 4), np.float32)

    def lege(maske, farbe, deck):
        d = np.where(maske, deck, 0.0)
        a_alt = aus[:, :, 3]
        a_neu = d + a_alt * (1 - d)
        for k in range(3):
            aus[:, :, k] = np.where(a_neu > 0, (farbe[k] * d + aus[:, :, k] * a_alt * (1 - d)) / np.maximum(a_neu, 1e-6), 0)
        aus[:, :, 3] = a_neu

    lege(innen3, f["bogen"][:3], f["bogen"][3])
    zdeck = f["zone"][3] * (0.82 + 0.36 * (abrieb - 0.5))
    lege(zone, f["zone"][:3], np.clip(zdeck, 0, 1))
    # dunkle Kontur um die Linien (1 px), dann die Farbe selbst mit Abriebluecken
    nachbar = linie.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nachbar |= np.roll(np.roll(linie, dy, 0), dx, 1)
    lege(nachbar & ~linie, f["rand"][:3], f["rand"][3])
    luecke = abrieb < 0.30
    ldeck = np.where(luecke, 0.38, 0.86 + 0.14 * fein)
    ton = 1.0 - 0.10 * grob
    farbe = [f["linie"][k] * ton for k in range(3)]
    lege(linie, farbe, np.clip(ldeck, 0, 1))
    bild = Image.fromarray(np.clip(np.dstack([aus[:, :, 0], aus[:, :, 1], aus[:, :, 2], aus[:, :, 3] * 255]), 0, 255).astype(np.uint8))
    if wappen is not None:
        # Mittelkreis-Wappen 1:1 (Ringdurchmesser 82 px ~ Mittelkreis 2*H*0.09 = 84.6), wie Farbe auf dem
        # Boden: leicht durchscheinend, mit denselben Abriebluecken.
        wp = np.asarray(wappen).astype(np.float32).copy()
        ox, oy = W // 2 - wappen.width // 2, H // 2 - wappen.height // 2
        ab = abrieb[oy:oy + wappen.height, ox:ox + wappen.width]
        wp[:, :, 3] *= np.where(ab < 0.26, 0.45, 0.90)
        bild.alpha_composite(Image.fromarray(wp.astype(np.uint8)), (ox, oy))
    speichere(bild, f"kulissen/basketball/{variante}_linien.png")
    return bild


# --- Vorschau-Montagen (nur Dokumentation) -----------------------------------------------------------
def kulisse_wie_motor(pfad, dunkel):
    """Kulisse mit Abdunklung und Randverlauf wie kulisseZeichnen() (rand = 1)."""
    k = np.asarray(Image.open(pfad).convert("RGB")).astype(np.float32)
    k = k * (1 - dunkel) + np.array([10, 10, 16]) * dunkel
    ys, xs = np.mgrid[0:H, 0:W]
    d = np.hypot(xs - W / 2, ys - H / 2)
    q = np.clip((d - 60) / (W * 0.62 - 60), 0, 1)
    al = np.where(q < 0.6, 0.18 * q / 0.6, 0.18 + (0.48 - 0.18) * (q - 0.6) / 0.4)
    k = k * (1 - al[:, :, None])
    return Image.fromarray(np.clip(k, 0, 255).astype(np.uint8)).convert("RGBA")


def figuren(bild):
    """Ein paar Bestandsfiguren im Motor-Massstab (HOEHEN_BEZUG 52 px) als Groessenvergleich."""
    orte = [("abu-t", "east", 150, 250), ("__schiri", "south", 620, 330), ("abu-t", "west", 1085, 215),
            ("__schiri", "east", 330, 170), ("abu-t", "east", 240, 300), ("abu-t", "west", 930, 290)]
    for slug, r, x, y in orte:
        p = os.path.join(SPRITES, "figuren", slug, ("east" if r == "west" else r) + ".png")
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGBA")
        if r == "west":
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        bb = im.getbbox()
        im = im.crop(bb)
        s = 52 / im.height
        im = im.resize((round(im.width * s), 52), Image.NEAREST)
        bild.alpha_composite(im, (x - im.width // 2, y - 52))


def montage_nachher(variante, dunkel, overlay, korb, geo, ball_im_netz=True):
    b = kulisse_wie_motor(os.path.join(SPRITES, f"kulissen/basketball/{variante}.jpg"), dunkel)
    b.alpha_composite(overlay)
    s = geo["korb_skala"]
    ball = Image.open(os.path.join(SPRITES, "basketball/ball.png")).convert("RGBA").resize((18, 18), Image.LANCZOS)
    gr = (round(96 * s), round(128 * s))
    schichten = []
    for seite in ("links", "rechts"):
        kx = W * geo["korb_x"] if seite == "links" else W * (1 - geo["korb_x"])
        rcx = RING_CX if seite == "links" else 95 - RING_CX
        ox, oy = round(kx - rcx * s), round(H / 2 - BODEN_Y * s)
        schichten.append((seite, ox, oy, kx))
    for seite, ox, oy, kx in schichten:
        b.alpha_composite(korb[seite][0].resize(gr, Image.NEAREST), (ox, oy))
    figuren(b)
    for seite, ox, oy, kx in schichten:
        if ball_im_netz and seite == "links":   # Ball faellt gerade durch den Ring
            b.alpha_composite(ball, (round(kx) - 9, round(H / 2 - (BODEN_Y - RING_CY) * s) - 5))
        b.alpha_composite(korb[seite][1].resize(gr, Image.NEAREST), (ox, oy))
    return b.convert("RGB")


def montage_vorher(kulisse_pfad, dunkel):
    """Nachbau der heutigen Motor-Zeichnung (bodenFeldspiel): weisse Vektorlinien + korb_topdown."""
    from PIL import ImageDraw
    b = kulisse_wie_motor(kulisse_pfad, dunkel)
    ebene = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ebene)
    weiss = (255, 255, 255, 140)
    x0, x1 = W * 0.06, W * 0.94
    d.rectangle([x0, 60, x1, H - 60], outline=weiss, width=2)
    d.line([W / 2, 60, W / 2, H - 60], fill=weiss, width=2)
    r = H * 0.09
    d.ellipse([W / 2 - r, H / 2 - r, W / 2 + r, H / 2 + r], outline=weiss, width=2)
    zt, zb = W * 0.88 * (19 / 94), H * (16 / 50)
    alt = Image.open(os.path.join(SPRITES, "basketball/korb_topdown.png")).convert("RGBA").resize((56, 56), Image.NEAREST)
    for links in (True, False):
        gx = x0 if links else x1
        kx = W * 0.076 if links else W * 0.924
        zx = gx + zt if links else gx - zt
        d.rectangle([min(gx, zx), H / 2 - zb / 2, max(gx, zx), H / 2 + zb / 2], outline=weiss, width=2)
        d.ellipse([zx - r, H / 2 - r, zx + r, H / 2 + r], outline=weiss, width=2)
        R = H * 0.24
        gr0, gr1 = (-90 + 11.46, 90 - 11.46) if links else (90 + 11.46, 270 - 11.46)
        d.arc([kx - R, H / 2 - R, kx + R, H / 2 + R], gr0, gr1, fill=weiss, width=2)
        d.line([gx, H / 2, kx - 22 if links else kx + 22, H / 2], fill=(210, 210, 215, 153), width=5)
        k = alt.rotate(90 if links else -90)
        # drawImage(-28,-20,56,56) nach Drehung um (korbX, H/2)
        dx, dy = (-20, -28) if links else (-36, -28)
        ebene.alpha_composite(k, (round(kx + dx), round(H / 2 + dy)))
    b.alpha_composite(ebene)
    figuren(b)
    return b.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vorschau")
    ap.add_argument("--vorher-parkett", help="alte parkett.jpg fuer die Vorher-Montage")
    ap.add_argument("--korb-x", type=float, default=0.076)        # korbXVon(): W*0.076 / W*0.924
    ap.add_argument("--dreier-rx", type=float, default=112.8)     # DREIER_RADIUS = H*0.24
    ap.add_argument("--dreier-ry", type=float, default=112.8)
    ap.add_argument("--zone-tiefe", type=float, default=round(W * 0.88 * (19 / 94), 1))   # 220.6
    ap.add_argument("--zone-breite", type=float, default=round(H * (16 / 50), 1))         # 150.4
    ap.add_argument("--korb-skala", type=float, default=1.25)
    args = ap.parse_args()
    geo = dict(korb_x=args.korb_x, dreier_rx=args.dreier_rx, dreier_ry=args.dreier_ry,
               zone_tiefe=args.zone_tiefe, zone_breite=args.zone_breite, korb_skala=args.korb_skala)
    korb = baue_korb()
    wappen, _ = baue_kleinteile()
    overlays = {v: baue_overlay(v, geo, wappen[v]) for v in ("parkett", "streetcourt")}
    s = geo["korb_skala"]
    anker = {
        "_hinweis": "Ankerpunkte der Basketball-Assets, gemessen von scripts/baue-basketball-assets.py. Pixel in der "
                    "jeweiligen Datei, Ursprung oben links. Rechter Korb = linker gespiegelt (x' = 95 - x).",
        "korb": {
            "dateien": ["korb_links_hinten.png", "korb_links_vorne.png", "korb_rechts_hinten.png", "korb_rechts_vorne.png"],
            "groesse": [96, 128],
            "links": {"ring_mitte": [RING_CX, RING_CY], "boden_unter_ring": [RING_CX, BODEN_Y], "sockel_mitte": [SOCKEL_CX, BODEN_Y]},
            "rechts": {"ring_mitte": [95 - RING_CX, RING_CY], "boden_unter_ring": [95 - RING_CX, BODEN_Y], "sockel_mitte": [95 - SOCKEL_CX, BODEN_Y]},
            "ring_aussen_rx_ry": [RING_RX_AUSSEN, RING_RY_AUSSEN], "ring_innen_rx_ry": [RING_RX_INNEN, RING_RY_INNEN],
            "ring_hoehe_ueber_boden": BODEN_Y - RING_CY, "netz_y": [NETZ_Y0, NETZ_Y1 - 1],
            "skala_empfohlen": s,
            "im_motor_bei_skala": {"ring_hoehe_px": round((BODEN_Y - RING_CY) * s, 1), "ring_aussen_breite_px": round(2 * RING_RX_AUSSEN * s, 1),
                                   "ring_innen_breite_px": round(2 * RING_RX_INNEN * s, 1), "ball_px": 18,
                                   "drawImage_links": f"x = korbX - {RING_CX}*s, y = H/2 - {BODEN_Y}*s, w = 96*s, h = 128*s",
                                   "drawImage_rechts": f"x = korbX - {95 - RING_CX}*s, y = H/2 - {BODEN_Y}*s, w = 96*s, h = 128*s"},
        },
        "schussuhr_rahmen": {"groesse": [48, 32], "rahmen_box": [4, 2, 44, 32], "tafel_innen": [11, 9, 37, 24], "ziffer_mitte": [24, 16]},
        "wappen": {"groesse": [96, 96], "mitte": [48, 48], "ring_durchmesser": 82},
        "boden_overlay": {"groesse": [W, H], "geometrie": geo, "feld": [round(W * 0.06, 1), 60, round(W * 0.94, 1), H - 60]},
    }
    os.makedirs(os.path.dirname(ANKER), exist_ok=True)
    json.dump(anker, open(ANKER, "w"), indent=1, ensure_ascii=False)
    open(ANKER, "a").write("\n")
    print("gebaut: Korb (6 Dateien), Wappen (2), Schussuhr (1), Boden-Overlays (2), anker.json")
    if args.vorschau:
        os.makedirs(args.vorschau, exist_ok=True)
        reg = {}
        txt = open(os.path.join(WURZEL, "public/mockups/battle-mode.kulissen.js")).read()
        reg = json.loads(txt[txt.index("{", txt.index("window.__ARENA_KULISSEN")):txt.rindex("}") + 1])
        dunkel = {k["id"]: k["dunkel"] for k in reg["basketball"]}
        for v in ("parkett", "streetcourt"):
            n = montage_nachher(v, dunkel[v], overlays[v], korb, geo)
            n.save(os.path.join(args.vorschau, f"{v}-nachher.jpg"), quality=90)
            n.crop((0, 60, 420, 410)).resize((840, 700), Image.NEAREST).save(os.path.join(args.vorschau, f"{v}-nachher-korb-zoom.jpg"), quality=90)
            alt = args.vorher_parkett if (v == "parkett" and args.vorher_parkett) else os.path.join(SPRITES, f"kulissen/basketball/{v}.jpg")
            vd = 0.18 if (v == "parkett" and args.vorher_parkett) else dunkel[v]
            vb = montage_vorher(alt, vd)
            vb.save(os.path.join(args.vorschau, f"{v}-vorher.jpg"), quality=90)
            vb.crop((0, 60, 420, 410)).resize((840, 700), Image.NEAREST).save(os.path.join(args.vorschau, f"{v}-vorher-korb-zoom.jpg"), quality=90)
        # Korb-Ebenen einzeln, 4-fach
        h_im, v_im = korb["links"]
        bogen = Image.new("RGBA", (4 * 96 * 4 + 50, 128 * 4 + 10), (70, 96, 70, 255))
        ganz = h_im.copy()
        ganz.alpha_composite(v_im)
        mit_ball = h_im.copy()
        ball = Image.open(os.path.join(SPRITES, "basketball/ball.png")).convert("RGBA").resize((14, 14), Image.LANCZOS)
        mit_ball.alpha_composite(ball, (RING_CX - 7, RING_CY - 3))
        mit_ball.alpha_composite(v_im)
        for i, im in enumerate((h_im, v_im, ganz, mit_ball)):
            bogen.alpha_composite(im.resize((96 * 4, 128 * 4), Image.NEAREST), (10 + i * (96 * 4 + 10), 5))
        bogen.convert("RGB").save(os.path.join(args.vorschau, "korb-ebenen.png"))
        print("Vorschau ->", args.vorschau)


if __name__ == "__main__":
    main()
