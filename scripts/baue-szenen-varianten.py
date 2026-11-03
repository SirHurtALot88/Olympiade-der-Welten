#!/usr/bin/env python3
"""
Baut zusaetzliche KULISSEN-Varianten fuer bestehende Pixel-Szenen (public/szenen/<diszi>/).

    python3 -I scripts/baue-szenen-varianten.py

Grundsatz (Chris, 03.11.: "ohne die Mechanismen komplett zu aendern, sondern einfach die
Darstellung"): eine Variante ist dieselbe selbstlaufende Szene wie ihre Vorlage — gleicher
Demo-Ablauf, gleiche Demo-Figuren, gleiche Geometrie, gleiches HUD. Ausgetauscht wird nur das
eingebettete Hintergrundbild (bei Wettessen zusaetzlich die Tisch-Ebene eingefaerbt), dazu
kommt eine kleine, rein optische Effekt-Ebene (`window.__fx`), die direkt nach dem Hintergrund
gezeichnet wird (Wellenglitzern, Leuchtturm, Flugsand, Feuerwerk). Nichts davon beruehrt Wertung
oder Spielcode.

Die Original-Kulissen der Asset-Runde vom 01./02.11. sind PixelLab-Bilder; ohne PixelLab-Zugang
malt dieses Skript die neuen Kulissen prozedural in Pixel-Art (feste Palette, ganzzahlige
Koordinaten, geordnetes Dithering) auf denselben Massstab und laesst alles, was die Szene
geometrisch traegt (Bahnen, Stapel, Silo, Anzeigetafeln), unangetastet bzw. faerbt es nur um.

Die Standbilder (`<variante>.jpg`) entstehen danach mit `node scripts/baue-szenen-poster.mjs`.
"""
import base64
import io
import json
import math
import os
import random
import re

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZ = os.path.join(ROOT, "public", "szenen")


# ------------------------------------------------------------------ Hilfen
def dec(uri):
    return Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1]))).convert("RGBA")


def enc(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def clamp(v):
    return 0 if v < 0 else 255 if v > 255 else int(v)


def mix(a, b, u):
    return tuple(clamp(a[i] + (b[i] - a[i]) * u) for i in range(3))


BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def band_gradient(px, x0, y0, x1, y1, stops):
    """Senkrechter Verlauf als Farbbaender mit 4x4-Bayer-Dithering an den Uebergaengen."""
    n = len(stops) - 1
    for y in range(y0, y1):
        u = (y - y0) / max(1, (y1 - y0 - 1)) * n
        i = min(n - 1, int(u))
        f = u - i
        for x in range(x0, x1):
            t = (BAYER4[y & 3][x & 3] + 0.5) / 16
            px[x, y] = stops[i + 1] if f > t else stops[i]


def add_glow(px, w, h, cx, cy, r, col, k, ry=None, y_min=0):
    ry = ry or r
    for y in range(max(y_min, int(cy - ry)), min(h, int(cy + ry) + 1)):
        for x in range(max(0, int(cx - r)), min(w, int(cx + r) + 1)):
            d = ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2
            if d >= 1:
                continue
            a = k * (1 - d) ** 1.6
            # Lichtstufen statt weichem Verlauf (Pixel-Art): auf 1/6 quantisieren
            a = math.floor(a * 6 + (BAYER4[y & 3][x & 3] + 0.5) / 16) / 6
            if a <= 0:
                continue
            p = px[x, y]
            px[x, y] = (clamp(p[0] + col[0] * a), clamp(p[1] + col[1] * a), clamp(p[2] + col[2] * a)) + tuple(p[3:])


def sat(p):
    return max(p[:3]) - min(p[:3])


def luma(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


# ------------------------------------------------------------------ Gewichtheben: Sandsack-Schicht
GW_SRC = os.path.join(SZ, "gewichtheben", "sandsack.html")
# Anzeigetafeln (HUD-Felder werden zur Laufzeit hineingeschrieben) — werden 1:1 uebernommen
GW_BOARDS = [(346, 38, 459, 104), (723, 12, 877, 79), (1146, 38, 1259, 104)]
GW_TOP = 148           # bis hierher reicht die Hallenwand der Vorlage, darunter beginnt der Boden
GW_LAMPS = [140, 265, 535, 660, 940, 1065, 1335, 1460]


def gw_load():
    s = open(GW_SRC, encoding="utf-8").read()
    m = re.search(r"const D = (\{.*?\});\n", s, re.S)
    return s, m, json.loads(m.group(1))


def gw_boards_on_posts(im, src, pole):
    d = ImageDraw.Draw(im)
    for (x0, y0, x1, y1) in GW_BOARDS:
        for px_ in (x0 + 14, x1 - 16):
            d.rectangle([px_, y1, px_ + 2, GW_TOP - 2], fill=pole[0])
            d.line([px_, y1, px_, GW_TOP - 2], fill=pole[1])
        im.paste(src.crop((x0, y0, x1, y1)), (x0, y0))


def gw_floor(im, grade_low, grade_sat, texture=None):
    px = im.load()
    W, H = im.size
    for y in range(GW_TOP, H):
        for x in range(W):
            p = px[x, y]
            if sat(p) < 26 or (luma(p) > 180 and sat(p) < 45):   # Grau + Kreideschrift
                q = grade_low(p, x, y)
            else:
                q = grade_sat(p, x, y)
            if texture and sat(p) < 26 and 70 < luma(p) < 120:
                q = texture(q, x, y)
            px[x, y] = q + (255,)


def gw_hafen(src):
    """Hafenkai bei Nacht: Frachter, Kran, Leuchtturm, Kopfsteinpflaster, Laternen."""
    rnd = random.Random(1102)
    W, H = src.size
    im = src.copy()
    px = im.load()
    # ---- Himmel + Sterne
    band_gradient(px, 0, 0, W, 98, [(10, 12, 30), (14, 18, 42), (20, 26, 56), (28, 38, 74), (38, 52, 92)])
    for _ in range(260):
        x, y = rnd.randrange(W), rnd.randrange(0, 80)
        c = rnd.choice([(170, 180, 220), (210, 214, 240), (130, 140, 190)])
        px[x, y] = c + (255,)
        if rnd.random() < 0.06 and 1 <= x < W - 1 and 1 <= y:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                px[x + dx, y + dy] = (110, 120, 170, 255)
    d = ImageDraw.Draw(im)
    # Mond
    mx, my, mr = 1003, 28, 13
    add_glow(px, W, H, mx, my, 44, (40, 46, 70), 0.9)
    d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=(232, 226, 196))
    d.ellipse([mx - mr + 6, my - mr - 2, mx + mr + 6, my + mr - 2], fill=None)
    for cx, cy, r in ((-4, -3, 3), (4, 4, 2), (-2, 6, 2), (5, -5, 1)):
        d.ellipse([mx + cx - r, my + cy - r, mx + cx + r, my + cy + r], fill=(204, 198, 168))
    # ---- Ferne Stadt
    x = 0
    while x < W:
        bw, bh = rnd.randint(18, 54), rnd.randint(8, 34)
        d.rectangle([x, 96 - bh, x + bw, 97], fill=(20, 24, 46))
        for wy in range(96 - bh + 3, 95, 4):
            for wx in range(x + 3, x + bw - 2, 5):
                if rnd.random() < 0.18:
                    d.rectangle([wx, wy, wx + 1, wy + 1], fill=rnd.choice([(232, 186, 92), (200, 160, 80), (150, 170, 210)]))
        x += bw + rnd.randint(0, 6)
    # Leuchtturm auf der Mole (der Strahl laeuft in der Effekt-Ebene)
    lx = 640
    d.polygon([(lx - 7, 97), (lx + 7, 97), (lx + 4, 58), (lx - 4, 58)], fill=(196, 196, 204))
    for k, yy in enumerate(range(62, 97, 8)):
        d.polygon([(lx - 4 - k, yy), (lx + 4 + k, yy), (lx + 5 + k, yy + 4), (lx - 5 - k, yy + 4)], fill=(170, 46, 46))
    d.rectangle([lx - 6, 50, lx + 6, 58], fill=(40, 42, 54))
    d.rectangle([lx - 4, 52, lx + 4, 56], fill=(255, 236, 160))
    d.polygon([(lx - 7, 50), (lx + 7, 50), (lx, 43)], fill=(60, 30, 30))
    add_glow(px, W, H, lx, 54, 22, (120, 100, 50), 0.8)
    d.rectangle([lx - 40, 97, lx + 46, 100], fill=(30, 32, 44))
    # ---- Meer
    for y in range(98, 140):
        for x in range(W):
            base = (14, 26, 52) if y < 120 else (12, 22, 44)
            px[x, y] = base + (255,)
        if y % 3 == 0:
            off = (y * 7) % 11
            for x in range(off, W, 11 + (y % 5)):
                ln = 3 + (x * 13 + y) % 4
                for k in range(ln):
                    if x + k < W:
                        px[x + k, y] = (30, 52, 88, 255)
    for y in range(99, 140, 2):  # Mondspur
        wdt = 3 + (y - 99) // 5
        for x in range(mx - wdt, mx + wdt):
            if (x + y) % 3 != 0:
                px[x, y] = (196, 196, 168, 255) if (x - mx + wdt) % 4 else (120, 124, 120, 255)
    # ---- Frachter links (hinter der V-W-Tafel)
    hull = [(30, 92), (610, 92), (590, 138), (52, 138)]
    d.polygon(hull, fill=(78, 26, 32))
    d.rectangle([34, 92, 606, 97], fill=(22, 20, 28))
    d.line([50, 126, 594, 126], fill=(58, 20, 26))
    for x in range(70, 580, 22):
        d.rectangle([x, 108, x + 2, 110], fill=(236, 190, 96))
    cols = [(150, 52, 44), (44, 86, 140), (60, 120, 70), (196, 120, 40), (120, 120, 130)]
    for row in range(3):
        for cx in range(60, 456, 44):
            if row == 2 and rnd.random() < 0.4:
                continue
            c = rnd.choice(cols)
            y1 = 91 - row * 11
            d.rectangle([cx, y1 - 10, cx + 42, y1], fill=c)
            for rx in range(cx + 3, cx + 41, 4):
                d.line([rx, y1 - 9, rx, y1 - 1], fill=mix(c, (0, 0, 0), 0.35))
            d.line([cx, y1 - 10, cx + 42, y1 - 10], fill=mix(c, (255, 255, 255), 0.25))
    d.rectangle([482, 46, 584, 91], fill=(176, 180, 192))
    d.rectangle([482, 46, 584, 49], fill=(210, 214, 222))
    for wy in (56, 68, 80):
        for wx in range(488, 580, 10):
            d.rectangle([wx, wy, wx + 5, wy + 4], fill=(240, 200, 110) if rnd.random() < 0.6 else (60, 70, 90))
    d.rectangle([548, 26, 566, 46], fill=(40, 40, 50))
    d.rectangle([548, 30, 566, 34], fill=(214, 138, 44))
    d.line([586, 46, 606, 22], fill=(90, 90, 100))
    # ---- Kran rechts
    cr = (206, 150, 42)
    crd = (140, 96, 26)
    for lx2 in (1352, 1400):
        d.rectangle([lx2, 22, lx2 + 3, 139], fill=cr)
    for yy in range(26, 138, 12):
        d.line([1355, yy, 1400, yy + 12], fill=crd)
        d.line([1400, yy, 1355, yy + 12], fill=crd)
    d.rectangle([1250, 16, 1598, 21], fill=cr)
    d.rectangle([1250, 22, 1598, 23], fill=crd)
    for xx in range(1252, 1596, 10):
        d.line([xx, 16, xx + 10, 21], fill=crd)
    d.rectangle([1342, 4, 1410, 15], fill=(60, 60, 70))
    d.rectangle([1348, 7, 1360, 12], fill=(240, 200, 110))
    d.line([1290, 22, 1290, 70], fill=(30, 30, 36))
    d.rectangle([1266, 70, 1314, 82], fill=(44, 86, 140))
    for rx in range(1269, 1313, 4):
        d.line([rx, 71, rx, 81], fill=(30, 60, 100))
    # ---- Kaimauer + Poller + Laternen
    for y in range(138, GW_TOP):
        for x in range(W):
            mort = (y == 138) or (y == 143) or ((x + (0 if y < 143 else 9)) % 18 == 0)
            px[x, y] = ((38, 38, 48) if mort else (80, 82, 96) if y == 139 else (62, 64, 78)) + (255,)
    for bx in range(100, W, 200):
        d.rectangle([bx - 3, 132, bx + 3, 140], fill=(28, 28, 34))
        d.rectangle([bx - 5, 131, bx + 5, 133], fill=(40, 40, 48))
    for lx3 in GW_LAMPS:
        d.rectangle([lx3 - 1, 44, lx3 + 1, GW_TOP - 1], fill=(30, 30, 38))
        d.rectangle([lx3 - 5, 36, lx3 + 5, 44], fill=(36, 36, 44))
        d.rectangle([lx3 - 3, 38, lx3 + 3, 42], fill=(255, 220, 140))
        d.polygon([(lx3 - 6, 36), (lx3 + 6, 36), (lx3, 31)], fill=(26, 26, 32))
        add_glow(px, W, H, lx3, 40, 26, (120, 90, 40), 0.9)
    gw_boards_on_posts(im, src, ((40, 40, 50), (70, 70, 84)))
    # ---- Boden: Kopfsteinpflaster, nasse Nacht
    def tex(q, x, y):
        row = (y - GW_TOP) // 7
        sx = (x + (row % 2) * 6) % 12
        sy = (y - GW_TOP) % 7
        if sx == 0 or sy == 0:
            return mix(q, (8, 10, 20), 0.45)
        if sy == 1 or sx == 1:
            return mix(q, (150, 160, 190), 0.10)
        return q

    gw_floor(
        im,
        lambda p, x, y: (clamp(p[0] * 0.50 + 4), clamp(p[1] * 0.54 + 8), clamp(p[2] * 0.62 + 22)),
        lambda p, x, y: (clamp(p[0] * 0.80), clamp(p[1] * 0.80 + 4), clamp(p[2] * 0.84 + 10)),
        tex,
    )
    px = im.load()
    for lx3 in GW_LAMPS:
        add_glow(px, W, H, lx3, GW_TOP + 6, 70, (110, 80, 34), 0.75, ry=26, y_min=GW_TOP)
    # Pfuetzen zwischen den Stationsreihen spiegeln den Himmel
    for (cx, cy, r) in ((120, 312, 26), (980, 446, 22), (1460, 316, 20), (640, 600, 30), (200, 598, 24), (1380, 590, 28)):
        for y in range(cy - r // 4, cy + r // 4 + 1):
            for x in range(cx - r, cx + r + 1):
                if ((x - cx) / r) ** 2 + ((y - cy) / (r / 4)) ** 2 < 1:
                    p = px[x, y]
                    px[x, y] = mix(p, (40, 56, 96), 0.55) + (255,)
                    if (x + y) % 9 == 0:
                        px[x, y] = (110, 130, 170, 255)
    return im


GW_FX_HAFEN = r"""
window.__fx = (ctx, ts) => {
  const t = performance.now() / 1000;
  // Leuchtturm: Strahl schwenkt ueber die Bucht
  const a = Math.sin(t * 0.7), lx = 640, ly = 54, len = 520;
  ctx.save(); ctx.globalAlpha = 0.16 + 0.06 * Math.abs(Math.cos(t * 0.7));
  ctx.fillStyle = '#ffeaa0';
  ctx.beginPath(); ctx.moveTo(lx, ly);
  ctx.lineTo(lx + a * len, ly - 18); ctx.lineTo(lx + a * len, ly + 22); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Glitzern auf dem Wasser
  ctx.fillStyle = '#9fb4dc';
  for (let i = 0; i < 70; i++) {
    const s = (i * 7919) % 1600, y = 100 + (i * 37) % 38;
    const ph = (t * 0.8 + i * 0.37) % 1;
    if (ph < 0.5) ctx.fillRect(Math.round((s + t * (6 + i % 5)) % 1600), y, 2 + (i % 3), 1);
  }
  // Laternen flackern leicht
  for (const x of [140, 265, 535, 660, 940, 1065, 1335, 1460]) {
    const f = 0.5 + 0.5 * Math.sin(t * 9 + x);
    ctx.fillStyle = `rgba(255,214,130,${0.10 + 0.10 * f})`;
    ctx.fillRect(x - 4, 37, 9, 7);
  }
};
"""


def gw_oase(src):
    """Oasen-Karawanserei am Mittag: Pyramiden, Duenen, Sandsteinmauer mit Teamfarben-Markisen."""
    rnd = random.Random(2711)
    W, H = src.size
    im = src.copy()
    px = im.load()
    band_gradient(px, 0, 0, W, 108, [(92, 156, 214), (118, 178, 226), (150, 198, 232), (190, 216, 228), (236, 222, 186)])
    d = ImageDraw.Draw(im)
    sx, sy = 1092, 26
    add_glow(px, W, H, sx, sy, 60, (60, 50, 20), 0.9)
    d.ellipse([sx - 12, sy - 12, sx + 12, sy + 12], fill=(255, 244, 196))
    d.ellipse([sx - 9, sy - 9, sx + 9, sy + 9], fill=(255, 252, 230))
    # duenne Schleierwolken
    for (cx, cy, wl) in ((200, 22, 90), (480, 36, 70), (1320, 18, 110), (860, 30, 60)):
        for k in range(wl):
            if (k * 7) % 5:
                px[cx + k, cy] = (226, 236, 240, 255)
            if k % 3 == 0 and 8 < k < wl - 8:
                px[cx + k, cy + 1] = (206, 222, 232, 255)
    # Ferne Duenen
    for layer, (col, base, amp, fr, ph) in enumerate((((222, 186, 128), 96, 10, 0.006, 0.3), ((206, 164, 104), 104, 7, 0.011, 1.7))):
        for x in range(W):
            top = int(base - amp * (0.5 + 0.5 * math.sin(x * fr + ph)) - 3 * math.sin(x * fr * 3.1))
            for y in range(top, 112):
                px[x, y] = (mix(col, (255, 240, 200), 0.18) if y == top else col) + (255,)
    # Pyramiden
    for (cx, base, hw, hh) in ((560, 104, 62, 50), (1010, 104, 44, 36), (1210, 106, 28, 22)):
        for y in range(base - hh, base):
            half = int((y - (base - hh)) / hh * hw)
            for x in range(cx - half, cx + half + 1):
                lit = x < cx + (y - base + hh) * 0.15
                c = (230, 192, 128) if lit else (172, 128, 82)
                if (y - base) % 4 == 0:
                    c = mix(c, (110, 76, 46), 0.35)
                px[x, y] = c + (255,)
    # Palmen hinter der Mauer
    def palme(x0, h):
        for k in range(h):
            xx = x0 + int(3 * math.sin(k / h * 1.4))
            yy = 120 - k
            c = (120, 82, 48) if k % 4 else (90, 60, 34)
            d.rectangle([xx - 1, yy, xx + 1, yy], fill=c)
        tx, ty = x0 + int(3 * math.sin(1.4)), 120 - h
        for ang in range(0, 360, 40):
            for r in range(1, 16):
                fx = tx + int(math.cos(math.radians(ang)) * r)
                fy = ty + int(math.sin(math.radians(ang)) * r * 0.55 + (r * r) / 40)
                px[fx, fy] = ((70, 128, 52) if r % 3 else (46, 96, 38)) + (255,)
                px[fx, fy + 1] = (46, 96, 38, 255)
    for x0 in (60, 310, 690, 905, 1120, 1530):
        palme(x0, rnd.randint(44, 62))
    # Sandsteinmauer mit Boegen + Markisen in Teamfarben
    wall_top = 112
    for y in range(wall_top, GW_TOP):
        for x in range(W):
            row = (y - wall_top) // 6
            mort = (y - wall_top) % 6 == 0 or (x + (row % 2) * 9) % 18 == 0
            c = (154, 112, 70) if mort else (200, 156, 100)
            if y < wall_top + 2:
                c = (222, 182, 124)
            px[x, y] = c + (255,)
    for x in range(0, W, 16):  # Zinnen
        d.rectangle([x, wall_top - 6, x + 8, wall_top - 1], fill=(200, 156, 100))
        d.line([x, wall_top - 6, x + 8, wall_top - 6], fill=(226, 188, 130))
    for ax in range(40, W, 100):
        team = (214, 138, 44) if ax < W / 2 else (52, 170, 180)
        d.rectangle([ax, 124, ax + 30, GW_TOP - 1], fill=(84, 56, 36))
        d.ellipse([ax, 116, ax + 30, 134], fill=(84, 56, 36))
        d.rectangle([ax + 2, 128, ax + 28, GW_TOP - 1], fill=(60, 40, 26))
        for k in range(0, 36, 6):
            c = team if (k // 6) % 2 == 0 else (238, 226, 200)
            d.polygon([(ax - 3 + k, 118), (ax + 3 + k, 118), (ax + 3 + k, 124), (ax - 3 + k, 124)], fill=c)
        for k in range(-3, 36, 6):
            d.polygon([(ax + k, 124), (ax + k + 6, 124), (ax + k + 3, 127)], fill=mix(team, (0, 0, 0), 0.25))
    gw_boards_on_posts(im, src, ((110, 76, 44), (150, 110, 66)))
    # ---- Boden: Sand mit Rippeln
    sand = (212, 176, 120)

    def low(p, x, y):
        L = luma(p)
        if 748 <= x <= 852:    # Silo-Sockel: nur leicht sonnengewaermt, Beschriftung bleibt lesbar
            return (clamp(p[0] * 1.05 + 8), clamp(p[1] * 1.0 + 4), clamp(p[2] * 0.9))
        if L > 135:            # Markierungen + Beschriftung: dunkles Seil/Brandzeichen statt Kreide
            return (112, 72, 40)
        k = L / 99.0
        return (clamp(sand[0] * k), clamp(sand[1] * k), clamp(sand[2] * k))

    def tex(q, x, y):
        v = math.sin(x * 0.09 + y * 0.55 + 2.0 * math.sin(x * 0.013))
        if v > 0.86:
            return mix(q, (150, 112, 70), 0.30)
        if v < -0.9:
            return mix(q, (250, 230, 180), 0.25)
        return q

    gw_floor(im, low, lambda p, x, y: (clamp(p[0] * 1.06 + 6), clamp(p[1] * 1.04 + 4), clamp(p[2] * 0.96)), tex)
    px = im.load()
    d = ImageDraw.Draw(im)
    # Schatten der Mauer + verstreute Steine und Gestruepp am Rand
    for y in range(GW_TOP, GW_TOP + 8):
        for x in range(W):
            if sat(px[x, y]) < 60:
                px[x, y] = mix(px[x, y], (120, 86, 56), 0.35 * (1 - (y - GW_TOP) / 8)) + (255,)
    for _ in range(140):
        x, y = rnd.randrange(W), rnd.randrange(GW_TOP + 10, H - 4)
        p = px[x, y]
        if sat(p) < 70 and 120 < luma(p) < 200:
            c = rnd.choice([(150, 116, 80), (176, 140, 98), (120, 96, 70)])
            d.rectangle([x, y, x + rnd.randint(1, 3), y + 1], fill=c)
    for (bx, by) in ((26, 330), (1572, 330), (30, 610), (1560, 600), (250, 455), (1350, 452), (700, 612), (900, 612)):
        for k in range(9):
            a = math.radians(200 + k * 17)
            d.line([bx, by, bx + int(math.cos(a) * 8), by + int(math.sin(a) * 6)], fill=(110, 120, 56))
        d.point([bx, by], fill=(80, 70, 40))
    return im


GW_FX_OASE = r"""
window.__fx = (ctx, ts) => {
  const t = performance.now() / 1000;
  // Flugsand, der quer ueber den Platz weht
  for (let i = 0; i < 90; i++) {
    const sp = 40 + (i * 13) % 50, y0 = 150 + (i * 97) % 470;
    const x = (i * 271 + t * sp) % 1700 - 50;
    const y = y0 + Math.sin(t * 2 + i) * 3;
    ctx.fillStyle = i % 3 ? 'rgba(246,226,180,0.55)' : 'rgba(200,160,110,0.6)';
    ctx.fillRect(Math.round(x), Math.round(y), i % 4 === 0 ? 3 : 2, 1);
  }
  // Geier kreist ueber den Pyramiden
  const gx = 760 + Math.cos(t * 0.35) * 120, gy = 40 + Math.sin(t * 0.35) * 12, fl = Math.sin(t * 6) > 0 ? -2 : 1;
  ctx.fillStyle = '#3a2c22';
  ctx.fillRect(Math.round(gx) - 1, Math.round(gy), 3, 2);
  ctx.fillRect(Math.round(gx) - 7, Math.round(gy) + fl, 6, 1); ctx.fillRect(Math.round(gx) + 2, Math.round(gy) + fl, 6, 1);
};
"""


def gw_variant(slug, title, h1, lead, painter, fx):
    s, m, D = gw_load()
    bg = dec(D["bg"])
    new = painter(bg).convert("RGB")
    D["bg"] = enc(new.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB"))
    out = s[: m.start(1)] + json.dumps(D, ensure_ascii=False, separators=(", ", ": ")) + s[m.end(1):]
    out = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", out, count=1)
    out = re.sub(r"<h1>.*?</h1>", f"<h1>{h1}</h1>", out, count=1)
    out = re.sub(r'<p class="lead">.*?</p>', f'<p class="lead">{lead}</p>', out, count=1, flags=re.S)
    hook = "ctx.drawImage(BG, 0, 0);"
    assert out.count(hook) == 1
    out = out.replace(hook, hook + "\n  if (window.__fx) window.__fx(ctx, ts);")
    out = out.replace("</script>\n</body>", fx + "</script>\n</body>")
    path = os.path.join(SZ, "gewichtheben", f"{slug}.html")
    open(path, "w", encoding="utf-8").write(out)
    if os.environ.get("SZENEN_DEBUG"):
        new.save(os.path.join(os.environ["SZENEN_DEBUG"], f"gewichtheben-{slug}-bg.png"))
    print("geschrieben:", os.path.relpath(path, ROOT), f"{len(out) / 1e6:.2f} MB")


# ------------------------------------------------------------------ Wettessen: Nachtmarkt
WE_SRC = os.path.join(SZ, "wettessen", "jahrmarkt.html")
WE_SKY = {(185, 236, 215), (252, 242, 201), (251, 241, 208), (252, 251, 248)}
WE_WHEEL = (212, 163, 37)


def catenary(x0, y0, x1, y1, sag, n):
    pts = []
    for i in range(n + 1):
        u = i / n
        pts.append((x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + sag * 4 * u * (1 - u)))
    return pts


WE_STRINGS = [
    (0, 70, 160, 112, 14, 9), (160, 112, 330, 108, 12, 10), (330, 108, 470, 112, 12, 9), (470, 112, 640, 70, 14, 9),
    (0, 238, 320, 242, 6, 22), (320, 242, 640, 238, 6, 22),
]
BULB_COLS = [(255, 214, 120), (255, 120, 120), (140, 220, 255), (190, 255, 150), (255, 170, 230)]


def we_bulbs():
    out = []
    for (x0, y0, x1, y1, sag, n) in WE_STRINGS:
        for i, (x, y) in enumerate(catenary(x0, y0, x1, y1, sag, n)):
            out.append((int(x), int(y), i))
    cx, cy, r = WE_WHEEL
    for k in range(16):
        a = k / 16 * math.tau
        out.append((int(cx + math.cos(a) * (r + 2)), int(cy + math.sin(a) * (r + 2)), 100 + k))
    return out


def we_night(bg):
    W, H = bg.size
    im = bg.copy()
    px = im.load()
    rnd = random.Random(3110)
    sky = [(10, 12, 34), (16, 18, 48), (24, 24, 62), (34, 30, 76), (52, 38, 88)]
    for y in range(H):
        for x in range(W):
            p = px[x, y]
            if y < 240 and p[:3] in WE_SKY:
                u = min(0.999, y / 200) * (len(sky) - 1)
                i = int(u)
                f = u - i
                c = sky[i + 1] if f > (BAYER4[y & 3][x & 3] + 0.5) / 16 else sky[i]
                if p[:3] != (185, 236, 215):  # ehemalige Wolken: duenne Nachtwolken
                    c = mix(c, (60, 60, 104), 0.16)
                px[x, y] = c + (255,)
            else:
                L = luma(p)
                k = 0.36 + 0.18 * (L / 255)
                px[x, y] = (clamp(p[0] * k + 4), clamp(p[1] * k + 4), clamp(p[2] * (k + 0.14) + 14), p[3])
    for _ in range(140):
        x, y = rnd.randrange(W), rnd.randrange(0, 110)
        if px[x, y][2] < 100 and px[x, y][0] < 60:
            px[x, y] = rnd.choice([(200, 206, 240), (150, 160, 210)]) + (255,)
    # Buehnenlicht: warmer Kegel auf die Bretter, Schild WETTESSEN leuchtet
    for y in range(255, H):
        for x in range(W):
            dx = abs(x - 320) / 320
            a = max(0.0, 0.55 - dx * 0.5) * min(1, (y - 255) / 30)
            a = math.floor(a * 6) / 6
            if a > 0:
                p = px[x, y]
                px[x, y] = (clamp(p[0] + 90 * a), clamp(p[1] + 64 * a), clamp(p[2] + 30 * a), p[3])
    for y in range(66, 108):
        for x in range(232, 410):
            q = bg.getpixel((x, y))
            if sat(q) > 60 or luma(q) > 200:
                px[x, y] = q
    add_glow(px, W, H, 320, 86, 110, (70, 20, 30), 0.7, ry=34)
    d = ImageDraw.Draw(im)
    for (x0, y0, x1, y1, sag, n) in WE_STRINGS:
        pts = catenary(x0, y0, x1, y1, sag, n * 4)
        d.line([(int(a), int(b)) for a, b in pts], fill=(30, 26, 36))
    cx, cy, r = WE_WHEEL
    for (x, y, i) in we_bulbs():
        c = BULB_COLS[i % len(BULB_COLS)]
        add_glow(px, W, H, x, y, 7, tuple(v // 3 for v in c), 0.9)
        d.rectangle([x - 1, y, x, y + 1], fill=c)
    # Lampions an den Zeltspitzen
    for (x, y) in ((70, 120), (150, 176), (300, 176), (350, 176), (470, 164), (590, 120)):
        add_glow(px, W, H, x, y, 12, (120, 70, 20), 0.9)
        d.rectangle([x - 2, y - 2, x + 2, y + 3], fill=(255, 170, 70))
        d.line([x - 2, y - 2, x + 2, y - 2], fill=(140, 60, 30))
    return im


def we_table_night(tb):
    im = tb.copy()
    px = im.load()
    W, H = im.size
    for y in range(H):
        for x in range(W):
            p = px[x, y]
            if p[3] == 0:
                continue
            dx = abs(x - 320) / 320
            k = 0.80 - 0.25 * dx
            px[x, y] = (clamp(p[0] * k + 10), clamp(p[1] * (k - 0.04) + 4), clamp(p[2] * (k - 0.02) + 10), p[3])
    return im


WE_FX = r"""
window.__fx = (ctx, t0) => {
  const t = performance.now() / 1000;
  // Feuerwerk: alle 2,6 s eine neue Rakete, Platzposition fest je Schuss
  for (let k = 0; k < 3; k++) {
    const per = 2.6, sh = Math.floor((t + k * per / 3) / per), u = ((t + k * per / 3) % per) / per;
    const r1 = Math.sin(sh * 12.9898 + k * 78.233) * 43758.5453, rr = r1 - Math.floor(r1);
    const x = 70 + rr * 500, y = 26 + ((rr * 7.3) % 1) * 40;
    const cols = ['#ffd36e', '#ff7a8a', '#8fe0ff', '#b8ff8f', '#ffa6e6'], col = cols[sh % cols.length];
    if (u < 0.28) {            // Aufstieg
      const v = u / 0.28; ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(Math.round(x), Math.round(250 - (250 - y) * v), 1, 3);
    } else if (u < 0.9) {      // Stern
      const v = (u - 0.28) / 0.62, rad = 4 + v * 26;
      ctx.save(); ctx.globalAlpha = 1 - v * v; ctx.fillStyle = col;
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * Math.PI * 2;
        ctx.fillRect(Math.round(x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad + v * v * 8), 2, 2);
      }
      ctx.restore();
    }
  }
  // Riesenrad-Lauflicht + funkelnde Lichterketten
  const B = __BULBS__;
  for (const [x, y, i] of B) {
    const on = i >= 100 ? ((i - 100 + Math.floor(t * 8)) % 4 === 0) : (Math.sin(t * 3 + i * 1.7) > 0.6);
    if (on) { ctx.fillStyle = 'rgba(255,255,230,0.85)'; ctx.fillRect(x - 1, y - 1, 3, 3); }
  }
};
"""


def we_variant():
    s = open(WE_SRC, encoding="utf-8").read()
    m = re.search(r"const DATA = (\{.*?\});\n", s, re.S)
    D = json.loads(m.group(1))
    D["layers"]["bg"] = enc(we_night(dec(D["layers"]["bg"])).convert("RGB"))
    D["layers"]["table"] = enc(we_table_night(dec(D["layers"]["table"])))
    out = s[: m.start(1)] + json.dumps(D, ensure_ascii=False, separators=(", ", ": ")) + s[m.end(1):]
    out = re.sub(r"<title>.*?</title>", "<title>Wettessen Nachtmarkt</title>", out, count=1)
    out = re.sub(r"<h1>.*?</h1>", "<h1>Wettessen &mdash; Nachtmarkt mit Feuerwerk</h1>", out, count=1)
    hook = "ctx.drawImage(IMG.bg, 0, 0);"
    assert out.count(hook) == 1
    out = out.replace(hook, hook + "\n  if (window.__fx) window.__fx(ctx, t);")
    fx = WE_FX.replace("__BULBS__", json.dumps(we_bulbs()))
    out = out.replace("</script>\n</body>", fx + "</script>\n</body>")
    path = os.path.join(SZ, "wettessen", "nachtmarkt.html")
    open(path, "w", encoding="utf-8").write(out)
    print("geschrieben:", os.path.relpath(path, ROOT), f"{len(out) / 1e6:.2f} MB")


if __name__ == "__main__":
    gw_variant(
        "hafen",
        "Sandsack-Schicht Hafenkai",
        "Sandsack-Schicht &mdash; Hafenkai bei Nacht",
        "Dieselbe Schicht wie in der Lagerhalle (gleiche Stationen, Wege, Gewichte), nur am Kai: "
        "Frachter, Kran und Leuchtturm im Hintergrund, Kopfsteinpflaster unter den Laternen.",
        gw_hafen,
        GW_FX_HAFEN,
    )
    gw_variant(
        "oase",
        "Sandsack-Schicht Oase",
        "Sandsack-Schicht &mdash; Karawanserei in der Oase",
        "Dieselbe Schicht wie in der Lagerhalle (gleiche Stationen, Wege, Gewichte), nur in der "
        "Mittagshitze vor der Karawanserei: Pyramiden, Duenen, Markisen in Teamfarben, Flugsand.",
        gw_oase,
        GW_FX_OASE,
    )
    we_variant()
