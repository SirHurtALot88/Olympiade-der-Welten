#!/usr/bin/env python3
"""
Zweite SCHAUPLAETZE fuer bestehende Pixel-Szenen (gestaffelter Ausbau vom 03.11.).

    python3 -I scripts/baue-szenen-schauplaetze.py [basketball hockey football eiskunstlauf fechten battlefield]
    node scripts/baue-szenen-poster.mjs basketball/streetcourt ...

Chris, 03.11.: „mach nicht nur ne Tag- und Nachtszene, sondern wirklich andere Settings.“
Jede Variante ist deshalb ein anderer ORT, nicht dieselbe Halle bei anderem Licht:

  basketball/streetcourt   Halle mit Parkett       -> Kaefig-Platz zwischen Backsteinhaeusern
  hockey/bergsee           Eishalle                -> Freiluft-Eisfeld im verschneiten Gebirge
  football/strand          Flutlicht-Stadion       -> Beach-Football an der Kueste
  eiskunstlauf/waldsee     ISU-Eishalle            -> zugefrorener Waldsee mit Schneewaellen
  fechten/schlosshof       Fechthalle              -> Burghof mit Zinnen, Bergfried und Bannern
  battlefield/wuestenruine Wiese mit Fluss         -> Wuestenruine mit ausgetrocknetem Wadi

Grundsatz wie in scripts/baue-szenen-varianten.py: dieselbe selbstlaufende Szene wie die
Vorlage — gleicher Demo-Ablauf, gleiche Demo-Figuren, gleiche Spielfeld-Geometrie, gleiches HUD.
Ausgetauscht werden nur die eingebetteten Kulissenbilder: alles ausserhalb des Spielfelds wird
prozedural neu gemalt (feste Palette, ganzzahlige Pixel, Bayer-Dithering, Licht in Stufen), das
Spielfeld selbst bleibt deckungsgleich und wird hoechstens umgefaerbt (Parkett -> Hartplatz,
Rasen -> Sand). Bei den 2x-Szenen (Basketball, Football, Fechten) wird auf dem halben Raster
gemalt und verdoppelt, damit das Pixelraster der Vorlage erhalten bleibt. Nichts davon beruehrt
Wertung oder Spielcode.
"""
import base64
import importlib.util
import io
import math
import os
import random
import re
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZ = os.path.join(ROOT, "public", "szenen")

_spec = importlib.util.spec_from_file_location("szv", os.path.join(ROOT, "scripts", "baue-szenen-varianten.py"))
szv = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(szv)
band_gradient, add_glow, mix, clamp, sat, luma, BAYER4 = (
    szv.band_gradient, szv.add_glow, szv.mix, szv.clamp, szv.sat, szv.luma, szv.BAYER4)


# ------------------------------------------------------------------ Bild-Schluessel in den Szenen
B64 = r"data:image/(?:png|jpeg);base64,[A-Za-z0-9+/=]+"


def get_img(s, key):
    m = re.search(r'"%s":\s*"(%s)"' % (key, B64), s)
    assert m, key
    return Image.open(io.BytesIO(base64.b64decode(m.group(1).split(",", 1)[1]))), m


def set_img(s, key, im):
    _, m = get_img(s, key)
    buf = io.BytesIO()
    if im.mode == "RGB":
        im = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    im.save(buf, "PNG", optimize=True)
    uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return s[: m.start(1)] + uri + s[m.end(1):]


def retitle(s, title, h1=None):
    s = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", s, count=1)
    if h1:
        s = re.sub(r"<h1>.*?</h1>", f"<h1>{h1}</h1>", s, count=1, flags=re.S)
    return s


def write(diszi, slug, s):
    path = os.path.join(SZ, diszi, f"{slug}.html")
    open(path, "w", encoding="utf-8").write(s)
    print("geschrieben:", os.path.relpath(path, ROOT), f"{len(s) / 1e6:.2f} MB")


def debug(name, im):
    if os.environ.get("SZENEN_DEBUG"):
        im.save(os.path.join(os.environ["SZENEN_DEBUG"], name + ".png"))


def half(im):
    return im.resize((im.width // 2, im.height // 2), Image.NEAREST)


def double(im):
    return im.resize((im.width * 2, im.height * 2), Image.NEAREST)


def in_poly(x, y, poly):
    ins = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            ins = not ins
    return ins


def tint_luma(p, dark, light, lo=20, hi=200):
    """Farbe durch eine Rampe dark->light ersetzen, Helligkeit (Licht, Kanten) bleibt erhalten."""
    u = (luma(p) - lo) / (hi - lo)
    u = 0 if u < 0 else 1 if u > 1 else u
    return mix(dark, light, u)


def noise(x, y, seed=0):
    v = math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453
    return v - math.floor(v)


# ------------------------------------------------------------------ gemeinsame Kulissen-Bausteine
def sky(px, w, y0, y1, stops):
    band_gradient(px, 0, y0, w, y1, stops)


def mountains(px, w, base, amp, col, snow, seed, fr=0.012, snow_line=0.55, top_lim=0):
    rnd = random.Random(seed)
    ph = [rnd.random() * 6.28 for _ in range(3)]
    hgt = lambda x: amp * (0.55 + 0.25 * math.sin(x * fr + ph[0]) + 0.15 * math.sin(x * fr * 2.7 + ph[1])
                           + 0.08 * math.sin(x * fr * 6.1 + ph[2]))
    for x in range(w):
        h = hgt(x)
        shade = hgt(x + 3) < h - 0.4          # nach rechts abfallender Hang liegt im Schatten
        top = max(top_lim, int(base - h))
        for y in range(top, base):
            c = col
            # Schneekappe: unregelmaessige Unterkante (mehrere Wellen statt Saegezahn)
            depth = (base - top) * snow_line * (0.55 + 0.25 * math.sin(x * 0.043 + ph[2])
                                                 + 0.15 * math.sin(x * 0.11 + ph[0]) + 0.08 * math.sin(x * 0.29))
            if snow and (y - top) < depth:
                c = snow
                if (y - top) > depth - 2 or (noise(x, y, seed) > 0.9 and (y - top) > 3):
                    c = mix(snow, col, 0.35)
            # Lichtseite links, Schattenseite rechts der Grate
            if shade:
                c = mix(c, (0, 0, 0), 0.18)
            px[x, y] = c + (255,) if len(px[x, y]) == 4 else c


def pine(d, x, base, h, dark, light, snow=None):
    for k in range(h):
        wdt = int((k / h) * h * 0.38) + 1
        y = base - h + k
        if k % 3 == 2:
            wdt += 1
        d.line([x - wdt, y, x + wdt, y], fill=dark)
        d.line([x - wdt, y, x - wdt // 2, y], fill=light)
        if snow and k % 4 == 0 and wdt > 1:
            d.line([x - wdt + 1, y, x + wdt // 3, y], fill=snow)
    d.rectangle([x, base, x + 1, base + max(1, h // 8)], fill=(60, 40, 30))


# ================================================================== BASKETBALL — Street-Court
BB_SRC = os.path.join(SZ, "basketball", "parkett.html")
BB_COURT = [(123, 181), (911, 181), (837, 394), (48, 394)]   # Spielfeld (halbes Raster), etwas grosszuegig
BB_JUMBO = (366, 0, 594, 60)
BB_BENCH = (228, 104, 832, 180)
BB_HEADS = [(326, 100, 380, 124), (390, 100, 432, 124), (680, 100, 720, 124)]
BB_LED = (122, 141)
BB_REF = (506, 326, 552, 402)   # eingebrannter Schiedsrichter auf dem Feld
BB_HC = 426


def bb_heads_mask(src):
    """Pixel der drei Bankfiguren, die in die Tribuene ragen: je Zeile die Spanne zwischen
    linkem und rechtem schwarzen Umriss."""
    keep = set()
    px = src.load()
    for (x0, y0, x1, y1) in BB_HEADS:
        for y in range(y0, y1):
            xs = [x for x in range(x0, x1) if luma(px[x, y]) < 24 and sat(px[x, y]) < 30]
            if len(xs) >= 2 and xs[-1] - xs[0] < 36:
                for x in range(xs[0], xs[-1] + 1):
                    keep.add((x, y))
    return keep


def bb_world(world):
    src = half(world.convert("RGB"))
    W, H = src.size
    im = src.copy()
    px = im.load()
    rnd = random.Random(4471)
    heads = bb_heads_mask(src)
    # ---- Himmel (Spaetnachmittag) + Hinterhaus-Silhouette
    sky(px, W, 0, BB_LED[0], [(96, 150, 206), (128, 172, 214), (170, 194, 214), (226, 196, 160), (240, 176, 120)])
    d = ImageDraw.Draw(im)
    sx, sy = 820, 30
    add_glow(px, W, H, sx, sy, 40, (70, 50, 20), 0.9, y_min=0)
    d.ellipse([sx - 8, sy - 8, sx + 8, sy + 8], fill=(255, 236, 190))
    # ferne Hochhaeuser
    x = 0
    while x < W:
        bw, bh = rnd.randint(16, 40), rnd.randint(30, 70)
        top = 96 - bh
        c = rnd.choice([(118, 134, 160), (132, 146, 170), (108, 122, 150)])
        d.rectangle([x, top, x + bw, 100], fill=c)
        for wy in range(top + 4, 98, 5):
            for wx in range(x + 3, x + bw - 2, 4):
                if rnd.random() < 0.5:
                    d.point([wx, wy], fill=mix(c, (220, 230, 240), 0.35))
        x += bw + rnd.randint(1, 5)
    # Backstein-Mietshaeuser davor (mit Feuertreppen und Wassertank)
    x = -6
    while x < W:
        bw, bh = rnd.randint(70, 120), rnd.randint(54, 84)
        top = BB_LED[0] - bh
        base = rnd.choice([(150, 70, 52), (126, 58, 44), (170, 96, 62), (110, 82, 70)])
        for yy in range(top, BB_LED[0]):
            for xx in range(max(0, x), min(W, x + bw)):
                c = base
                if (yy - top) % 4 == 0 or (xx + ((yy - top) // 4 % 2) * 4) % 8 == 0:
                    c = mix(base, (60, 30, 24), 0.35)
                px[xx, yy] = c
        d.rectangle([x, top - 3, x + bw, top - 1], fill=mix(base, (40, 30, 30), 0.5))
        for wy in range(top + 8, BB_LED[0] - 14, 16):
            for wx in range(x + 8, x + bw - 10, 16):
                lit = rnd.random() < 0.25
                d.rectangle([wx, wy, wx + 7, wy + 9], fill=(40, 46, 60))
                d.rectangle([wx + 1, wy + 1, wx + 6, wy + 8], fill=(232, 196, 120) if lit else (88, 112, 140))
                d.line([wx + 1, wy + 4, wx + 6, wy + 4], fill=(40, 46, 60))
                d.line([wx - 1, wy + 10, wx + 8, wy + 10], fill=mix(base, (230, 220, 200), 0.4))
        if rnd.random() < 0.7:   # Feuertreppe
            fx = x + bw // 2 - 12
            for wy in range(top + 18, BB_LED[0] - 10, 16):
                d.rectangle([fx, wy, fx + 24, wy], fill=(36, 36, 40))
                for k in range(0, 25, 3):
                    d.point([fx + k, wy - 1], fill=(36, 36, 40))
                d.line([fx + 2, wy, fx + 20, wy + 16], fill=(46, 46, 52))
        if rnd.random() < 0.35:  # Wassertank auf dem Dach
            tx = x + rnd.randint(10, max(11, bw - 30))
            d.rectangle([tx + 3, top - 10, tx + 4, top - 3], fill=(60, 44, 34))
            d.rectangle([tx + 17, top - 10, tx + 18, top - 3], fill=(60, 44, 34))
            d.rectangle([tx, top - 26, tx + 21, top - 10], fill=(122, 86, 58))
            for k in range(tx, tx + 22, 3):
                d.line([k, top - 25, k, top - 11], fill=(100, 70, 46))
            d.polygon([(tx - 1, top - 26), (tx + 22, top - 26), (tx + 10, top - 33)], fill=(80, 60, 44))
        x += bw + rnd.randint(0, 3)
    # Graffiti-Mauer direkt hinter dem Platz
    wall_top = 96
    for yy in range(wall_top, BB_LED[0]):
        for xx in range(W):
            c = (150, 150, 146) if (xx // 24 + yy // 6) % 2 else (140, 140, 136)
            if xx % 24 == 0:
                c = (112, 112, 108)
            px[xx, yy] = c
    tags = [(222, 70, 120), (60, 170, 210), (250, 200, 60), (90, 200, 110), (170, 90, 210), (240, 120, 50)]
    gx = 6
    while gx < W:
        col = rnd.choice(tags)
        gw = rnd.randint(30, 70)
        for k in range(gw):
            yy = wall_top + 12 + int(5 * math.sin((gx + k) * 0.25 + gx))
            d.rectangle([gx + k, yy - 3, gx + k, yy + 3], fill=col)
            if k % 9 == 0:
                d.rectangle([gx + k, yy - 6, gx + k + 1, yy + 6], fill=mix(col, (255, 255, 255), 0.3))
        d.line([gx, wall_top + 20, gx + gw, wall_top + 20], fill=mix(col, (0, 0, 0), 0.4))
        gx += gw + rnd.randint(12, 40)
    # Kaefig: Zaunpfosten + Maschendraht vor allem, was hinter dem Platz liegt
    for yy in range(30, BB_LED[0]):
        for xx in range(W):
            if (xx + yy) % 6 == 0 or (xx - yy) % 6 == 0:
                c = px[xx, yy]
                px[xx, yy] = mix(c, (210, 214, 220), 0.55)
    for pxx in range(0, W, 80):
        d.rectangle([pxx, 26, pxx + 2, BB_LED[0] - 1], fill=(120, 124, 132))
        d.line([pxx, 26, pxx, BB_LED[0] - 1], fill=(176, 180, 188))
    d.rectangle([0, 28, W, 29], fill=(150, 154, 162))
    # Anzeigetafel haengt jetzt an zwei Masten
    for mx in (BB_JUMBO[0] + 30, BB_JUMBO[2] - 32):
        d.rectangle([mx, BB_JUMBO[3], mx + 3, BB_LED[0] - 1], fill=(70, 74, 84))
        d.line([mx, BB_JUMBO[3], mx, BB_LED[0] - 1], fill=(120, 126, 138))
    im.paste(src.crop(BB_JUMBO), BB_JUMBO[:2])
    for (x, y) in heads:
        px[x, y] = src.getpixel((x, y))
    # ---- Boden: Asphalt ausserhalb, Hartplatz (blau, Zone terrakotta) innerhalb der Linien
    asp_d, asp_l = (34, 36, 40), (118, 118, 116)
    for y in range(BB_LED[1], BB_HC):
        for x in range(W):
            p = px[x, y]
            inside = in_poly(x, y, BB_COURT)
            bench = BB_BENCH[0] <= x < BB_BENCH[2] and y < BB_BENCH[3]
            ref = BB_REF[0] <= x < BB_REF[2] and BB_REF[1] <= y < BB_REF[3]
            if ref or bench:
                # Figuren, Stuehle, Kampfgericht: nur, was eindeutig Boden ist, wird umgefaerbt
                if inside and sat(p) > 30 and p[0] > p[2] and abs(p[0] - p[1]) < 70 and luma(p) > 120:
                    px[x, y] = tint_luma(p, (28, 70, 132), (92, 150, 210), 120, 230)
                elif not inside and sat(p) < 30 and 6 <= p[2] - p[0] <= 30 and 30 < luma(p) < 85:
                    px[x, y] = tint_luma(p, asp_d, asp_l, 20, 120)
                elif inside and sat(p) < 30 and 6 <= p[2] - p[0] <= 30 and 55 < luma(p) < 130:
                    px[x, y] = tint_luma(p, (120, 50, 36), (214, 104, 70), 50, 140)
                continue
            if inside:
                L = luma(p)
                if sat(p) > 30 and p[0] > p[2]:              # Parkett -> blauer Acryl-Hartplatz
                    c = tint_luma(p, (28, 70, 132), (92, 150, 210), 120, 230)
                elif L > 190:                                # Linien bleiben weiss
                    c = p
                else:                                        # graue Zone + Mittelkreis -> terrakotta
                    c = tint_luma(p, (120, 50, 36), (214, 104, 70), 50, 140)
                px[x, y] = c
            elif sat(p) < 30 and luma(p) < 120:
                c = tint_luma(p, asp_d, asp_l, 20, 120)
                if not bench:
                    n = noise(x, y, 3)
                    if n > 0.93:
                        c = mix(c, (150, 150, 146), 0.5)
                    elif n < 0.06:
                        c = mix(c, (10, 10, 12), 0.5)
                px[x, y] = c
    # Risse und Kreide im Asphalt
    for _ in range(26):
        x, y = rnd.randrange(W), rnd.randrange(BB_LED[1] + 40, BB_HC - 4)
        if in_poly(x, y, BB_COURT) or (BB_BENCH[0] <= x < BB_BENCH[2] and y < BB_BENCH[3]):
            continue
        for k in range(rnd.randint(6, 18)):
            x += rnd.choice((-1, 0, 1))
            y += rnd.choice((0, 1))
            if 0 <= x < W and BB_LED[1] < y < BB_HC and not in_poly(x, y, BB_COURT):
                px[x, y] = (22, 22, 26)
    return double(im)


def bb_fg(fg):
    """Vordergrund: statt Zuschauerkoepfen der untere Zaunrand mit Bordstein und Unkraut."""
    W, H = fg.width // 2, fg.height // 2
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = im.load()
    rnd = random.Random(88)
    for y in range(H):
        for x in range(W):
            if y >= H - 6:
                px[x, y] = (96, 96, 94, 255) if y == H - 6 else (70, 70, 70, 255)
            elif (x + y) % 6 == 0 or (x - y) % 6 == 0:
                px[x, y] = (196, 200, 206, 200)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 1], fill=(150, 154, 162, 255))
    for pxx in range(40, W, 80):
        d.rectangle([pxx, 0, pxx + 2, H - 6], fill=(120, 124, 132, 255))
    for _ in range(60):
        x = rnd.randrange(W)
        for k in range(rnd.randint(2, 5)):
            d.line([x, H - 6, x + rnd.randint(-2, 2), H - 7 - rnd.randint(1, 4)], fill=(76, 120, 52, 255))
    return double(im)


def build_basketball():
    s = open(BB_SRC, encoding="utf-8").read()
    world, _ = get_img(s, "world")
    fg, _ = get_img(s, "src")   # erstes "src" im SC-Objekt ist der Vordergrund (fg.src)
    new = bb_world(world)
    debug("basketball-streetcourt-world", new)
    s = set_img(s, "world", new)
    m = re.search(r'"fg": \{"src": "(%s)"' % B64, s)
    buf = io.BytesIO()
    bb_fg(fg).save(buf, "PNG", optimize=True)
    s = s[: m.start(1)] + "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode() + s[m.end(1):]
    s = retitle(s, "Basketball Street-Court", "Basketball &mdash; Street-Court im K&auml;fig")
    write("basketball", "streetcourt", s)


# ================================================================== HOCKEY — Freiluft-Eisfeld im Gebirge
HK_SRC = os.path.join(SZ, "hockey", "eis.html")
HK_STANDS = 163          # bis hierher reicht die Tribuene der Vorlage
HK_RAIL = 118            # Oberkante der Bandenverglasung auf der Geraden
HK_GLASS_X = (235, 1605)  # Geraden-Abschnitt der Verglasung, ausserhalb Viertelellipsen bis zur Bande


def hk_floor_mask(clean):
    """Flutfuellung des dunklen Hallenbodens (inkl. Boden hinter Glas) ab den Raendern."""
    W, H = clean.size
    px = clean.load()
    ok = lambda p: sat(p) < 28 and luma(p) < 100
    seen = bytearray(W * H)
    stack = [(x, H - 1) for x in range(0, W, 7)] + [(0, y) for y in range(HK_STANDS, H, 5)] + \
            [(W - 1, y) for y in range(HK_STANDS, H, 5)] + [(x, HK_STANDS) for x in range(0, W, 5)]
    # Boden hinter dem gebogenen Glas an den Stirnseiten ist von Handlauf und Pfosten eingeschlossen
    glass = px[150, 200]
    for y in range(HK_STANDS, 470):
        for x in list(range(40, 245)) + list(range(1595, 1800)):
            if sum(abs(a - b) for a, b in zip(px[x, y], glass)) < 24:
                stack.append((x, y))
    while stack:
        x, y = stack.pop()
        if not (0 <= x < W and HK_STANDS <= y < H) or seen[y * W + x] or not ok(px[x, y]):
            continue
        seen[y * W + x] = 1
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return seen


def hk_glass_top(x):
    x0, x1 = HK_GLASS_X
    if x0 <= x <= x1:
        return HK_RAIL
    cx = x0 if x < x0 else x1
    u = min(1.0, abs(x - cx) / 185)
    return int(360 - 242 * math.sqrt(max(0.0, 1 - u * u)))


def hk_backdrop(W, H):
    im = Image.new("RGB", (W, H))
    px = im.load()
    rnd = random.Random(1907)
    sky(px, W, 0, 140, [(108, 156, 214), (138, 178, 224), (170, 200, 232), (204, 222, 238), (226, 234, 242)])
    d = ImageDraw.Draw(im)
    sx, sy = 1480, 34
    add_glow(px, W, H, sx, sy, 50, (50, 46, 30), 0.8)
    d.ellipse([sx - 9, sy - 9, sx + 9, sy + 9], fill=(255, 248, 222))
    for (cx, cy, wl) in ((220, 30, 120), (640, 52, 90), (1100, 22, 140), (1700, 58, 80)):
        for k in range(wl):
            if (k * 5) % 7:
                px[cx + k, cy] = (240, 244, 248)
            if 10 < k < wl - 10:
                px[cx + k, cy + 1] = (226, 234, 244)
            if 25 < k < wl - 30 and k % 2:
                px[cx + k, cy - 1] = (248, 250, 252)
    mountains(px, W, 132, 112, (122, 138, 168), (236, 242, 250), 11, fr=0.006, snow_line=0.5)
    mountains(px, W, 150, 70, (92, 108, 132), (222, 232, 244), 23, fr=0.011, snow_line=0.35)
    # Nadelwald mit Schnee
    for x in range(-10, W + 10, 9):
        h = 22 + int(12 * noise(x, 1, 5)) + int(8 * math.sin(x * 0.03))
        pine(d, x + rnd.randint(-3, 3), 158, h, (34, 70, 56), (52, 96, 74), (236, 242, 248))
    for x in range(-6, W + 6, 13):
        h = 28 + int(14 * noise(x, 2, 9))
        pine(d, x + rnd.randint(-4, 4), 166, h, (24, 56, 44), (40, 82, 62), (240, 246, 250))
    # Holzhuette mit Lichterkette links, Glühweinstand rechts
    for (hx, w_, label) in ((70, 120, 0), (1640, 130, 1)):
        top = 112
        d.rectangle([hx, top + 14, hx + w_, 166], fill=(120, 74, 44))
        for yy in range(top + 16, 166, 5):
            d.line([hx, yy, hx + w_, yy], fill=(92, 54, 32))
        d.polygon([(hx - 10, top + 16), (hx + w_ + 10, top + 16), (hx + w_ // 2, top - 12)], fill=(236, 242, 250))
        d.line([(hx - 10, top + 16), (hx + w_ // 2, top - 12), (hx + w_ + 10, top + 16)], fill=(150, 160, 178))
        d.rectangle([hx + 18, top + 30, hx + 40, top + 46], fill=(255, 210, 120))
        d.rectangle([hx + w_ - 40, top + 30, hx + w_ - 18, top + 46], fill=(255, 210, 120))
        d.line([hx + 29, top + 30, hx + 29, top + 46], fill=(92, 54, 32))
        d.line([hx + w_ - 29, top + 30, hx + w_ - 29, top + 46], fill=(92, 54, 32))
        add_glow(px, W, H, hx + 29, top + 38, 18, (90, 60, 20), 0.7)
        add_glow(px, W, H, hx + w_ - 29, top + 38, 18, (90, 60, 20), 0.7)
        d.rectangle([hx + w_ - 30, top - 20, hx + w_ - 22, top + 2], fill=(90, 80, 76))
        for k in range(0, w_ + 20, 6):
            col = [(255, 90, 90), (255, 220, 120), (120, 220, 255), (150, 255, 150)][k // 6 % 4]
            px[hx - 10 + k, top + 17 + int(2 * math.sin(k * 0.3))] = col
    # Schneefeld rund um die Bahn
    band_gradient(px, 0, HK_STANDS, W, H, [(208, 220, 236), (220, 230, 242), (232, 238, 246), (226, 234, 244)])
    for _ in range(900):
        x, y = rnd.randrange(W), rnd.randrange(HK_STANDS + 2, H)
        px[x, y] = rnd.choice([(196, 208, 226), (244, 248, 252), (186, 200, 220)])
    for _ in range(40):   # Fussspuren
        x, y = rnd.randrange(W), rnd.randrange(HK_STANDS + 10, H - 10)
        for k in range(rnd.randint(4, 10)):
            d.rectangle([x + k * 7, y + (k % 2) * 4, x + k * 7 + 2, y + (k % 2) * 4 + 1], fill=(178, 192, 214))
    # Schneewall direkt unter dem Waldrand
    for x in range(W):
        top = HK_STANDS - 3 + int(2 * math.sin(x * 0.07))
        for y in range(top, HK_STANDS + 4):
            px[x, y] = (244, 248, 252) if y == top else (230, 238, 248)
    return im


def hk_compose(src, clean, back, floor, keep_diff):
    W, H = src.size
    out = src.copy()
    po, ps, pb = out.load(), src.load(), back.load()
    pc = clean.load()
    x0g, x1g = 40, W - 40
    for y in range(H):
        for x in range(W):
            if keep_diff and ps[x, y] != pc[x, y]:
                continue      # eingebrannte Bankfiguren
            surround = y < HK_STANDS or floor[y * W + x]
            if not surround:
                continue
            c = pb[x, y]
            if x0g <= x <= x1g and y >= hk_glass_top(x) and y < 470:
                c = mix(c, (214, 230, 244), 0.22)        # hinter der Verglasung
                if y >= HK_STANDS and luma(pc[x, y]) > 70:
                    c = mix(c, (236, 244, 252), 0.15)
            po[x, y] = c
    # Schatten der Bande auf den Schnee
    for y in range(HK_STANDS + 1, H):
        for x in range(W):
            if floor[y * W + x] and not floor[(y - 1) * W + x] and (y - 1) >= HK_STANDS:
                for k in range(6):
                    if y + k < H and floor[(y + k) * W + x]:
                        po[x, y + k] = mix(po[x, y + k], (120, 140, 170), 0.35 * (1 - k / 6))
    # Verglasung oben: Handlauf und Pfosten neu, da die Tribuene darunter ersetzt ist
    d = ImageDraw.Draw(out)
    for x in range(HK_GLASS_X[0] - 180, HK_GLASS_X[1] + 181):
        y = hk_glass_top(x)
        if y < HK_STANDS:
            po[x, y] = (236, 242, 250)
            po[x, y + 1] = (170, 184, 204)
    for x in range(HK_GLASS_X[0], HK_GLASS_X[1] + 1, 114):
        d.line([x, HK_RAIL + 2, x, HK_STANDS - 1], fill=(176, 190, 210))
    return out


def build_hockey():
    s = open(HK_SRC, encoding="utf-8").read()
    world, _ = get_img(s, "world")
    clean, _ = get_img(s, "clean")
    world, clean = world.convert("RGB"), clean.convert("RGB")
    floor = hk_floor_mask(clean)
    back = hk_backdrop(*clean.size)
    new_clean = hk_compose(clean, clean, back, floor, False)
    new_world = hk_compose(world, clean, back, floor, True)
    debug("hockey-bergsee-world", new_world)
    s = set_img(s, "world", new_world)
    s = set_img(s, "clean", new_clean)
    # Draussen gibt es keine Tribuene, die beim Tor hochspringt (die Sprung-Animation schneidet
    # Streifen aus der Kulisse und wuerde sonst die Berge huepfen lassen).
    hook = "function drawCrowd(t, x0, x1) {"
    assert s.count(hook) == 1
    s = s.replace(hook, hook + " return;")
    s = retitle(s, "Eishockey Bergsee", "Eishockey &mdash; Freiluft-Eisfeld im Gebirge")
    write("hockey", "bergsee", s)


# ================================================================== FOOTBALL — Beach-Football an der Kueste
FB_SRC = os.path.join(SZ, "football", "feld.html")
FB_BOARD = (350, 4, 610, 50)
FB_RIBBON = (136, 147)
FB_PANEL = 596
FB_ENDZONE = [(745, 181), (922, 181), (852, 567), (673, 567)]


def fb_world(world):
    src = half(world.convert("RGB"))
    W, H = src.size
    im = src.copy()
    px = im.load()
    rnd = random.Random(5150)
    d = ImageDraw.Draw(im)
    horizon = 58
    sky(px, W, 0, horizon, [(70, 140, 214), (96, 160, 224), (128, 184, 232), (168, 206, 236), (206, 226, 240)])
    sx, sy = 160, 20
    add_glow(px, W, H, sx, sy, 34, (60, 56, 30), 0.9)
    d.ellipse([sx - 8, sy - 8, sx + 8, sy + 8], fill=(255, 248, 210))
    for (cx, cy, wl) in ((40, 34, 70), (300, 16, 50), (660, 26, 90), (840, 12, 60)):
        for k in range(wl):
            r = int(4 * math.sin(k / wl * math.pi))
            for yy in range(cy - r, cy + 1):
                px[cx + k, yy] = (250, 252, 252) if yy < cy else (214, 228, 238)
    # Meer mit Wellenkaemmen und Segelboot
    for y in range(horizon, 100):
        u = (y - horizon) / 42
        base = mix((34, 108, 168), (52, 170, 186), u)
        for x in range(W):
            c = base
            if (y % 4 == 0) and ((x * 3 + y * 7) % 23) < 6:
                c = mix(base, (220, 240, 246), 0.55)
            px[x, y] = c
    d.line([0, horizon, W, horizon], fill=(28, 84, 140))
    bx = 560
    d.polygon([(bx, 52), (bx + 22, 52), (bx + 18, 57), (bx + 4, 57)], fill=(250, 250, 246))
    d.polygon([(bx + 10, 30), (bx + 10, 50), (bx + 22, 50)], fill=(250, 250, 246))
    d.polygon([(bx + 9, 34), (bx + 9, 50), (bx + 1, 50)], fill=(230, 110, 70))
    # Brandung + Strand-Hintergrund
    for x in range(W):
        top = 98 + int(2 * math.sin(x * 0.08))
        for y in range(top, top + 3):
            px[x, y] = (244, 248, 246)
        for y in range(top + 3, FB_RIBBON[0]):
            px[x, y] = (224, 196, 138) if (x + y) % 9 else (210, 180, 122)
    # Sonnenschirme mit Badegaesten, Strandhuetten, Rettungsturm, Palmen
    cols = [(230, 70, 70), (250, 200, 60), (60, 150, 220), (90, 190, 110), (240, 130, 190), (250, 250, 246)]
    for ux in range(20, W, 46):
        if FB_BOARD[0] - 20 < ux < FB_BOARD[2] + 10 and rnd.random() < 0.5:
            continue
        c1, c2 = rnd.sample(cols, 2)
        top = 104 + rnd.randint(-2, 3)
        d.line([ux, top, ux, top + 22], fill=(110, 90, 70))
        for k in range(-14, 15):
            hgt = int(6 * (1 - (k / 14) ** 2))
            d.line([ux + k, top - hgt, ux + k, top], fill=c1 if (k + 14) // 5 % 2 else c2)
        for kk in range(rnd.randint(1, 3)):     # Badegaeste
            gx = ux + rnd.randint(-12, 12)
            skin = rnd.choice([(240, 200, 160), (200, 150, 110), (150, 100, 70), (110, 70, 50)])
            d.rectangle([gx, top + 14, gx + 2, top + 16], fill=skin)
            d.rectangle([gx - 1, top + 17, gx + 3, top + 21], fill=rnd.choice(cols))
    for hx in (80, 250, 690):
        d.rectangle([hx, 104, hx + 26, 126], fill=(250, 246, 236))
        for k in range(hx, hx + 27, 6):
            d.rectangle([k, 104, k + 2, 126], fill=(60, 140, 200))
        d.polygon([(hx - 3, 104), (hx + 29, 104), (hx + 13, 94)], fill=(200, 70, 60))
        d.rectangle([hx + 9, 114, hx + 17, 126], fill=(90, 66, 44))
    tx = 800
    for lx in (tx, tx + 22):
        d.line([lx, 104, lx + 4, 134], fill=(250, 250, 246))
    d.rectangle([tx - 2, 88, tx + 28, 104], fill=(230, 70, 60))
    d.rectangle([tx + 4, 92, tx + 22, 100], fill=(250, 240, 220))
    d.polygon([(tx - 5, 88), (tx + 31, 88), (tx + 13, 80)], fill=(250, 250, 246))
    def palme(x0, h):
        for k in range(h):
            xx = x0 + int(4 * math.sin(k / h * 1.6))
            d.rectangle([xx - 1, 134 - k, xx + 1, 134 - k], fill=(130, 92, 56) if k % 4 else (100, 70, 40))
        tx_, ty_ = x0 + int(4 * math.sin(1.6)), 134 - h
        for ang in range(0, 360, 36):
            for r in range(1, 18):
                fx = tx_ + int(math.cos(math.radians(ang)) * r)
                fy = ty_ + int(math.sin(math.radians(ang)) * r * 0.5 + (r * r) / 36)
                if 0 <= fx < W and 0 <= fy < H:
                    px[fx, fy] = (60, 140, 60) if r % 3 else (40, 104, 46)
                    if fy + 1 < H:
                        px[fx, fy + 1] = (40, 104, 46)
    for x0 in (8, 150, 330, 640, 760, 930):
        palme(x0, rnd.randint(48, 66))
    # Anzeigetafel auf zwei Masten
    for mx in (FB_BOARD[0] + 26, FB_BOARD[2] - 30):
        d.rectangle([mx, FB_BOARD[3], mx + 3, FB_RIBBON[0] - 1], fill=(80, 84, 94))
        d.line([mx, FB_BOARD[3], mx, FB_RIBBON[0] - 1], fill=(140, 146, 160))
    im.paste(src.crop(FB_BOARD), FB_BOARD[:2])
    # ---- Spielfeld + Seitenlinie: Rasen -> Sand (Linien, Zahlen, Endzone bleiben)
    for y in range(FB_RIBBON[1], FB_PANEL):
        for x in range(W):
            p = px[x, y]
            if in_poly(x, y, FB_ENDZONE):
                continue
            if p[1] > p[0] + 8 and p[1] > p[2] + 4:
                c = tint_luma(p, (176, 138, 86), (252, 232, 182), 50, 140)
                n = noise(x, y, 7)
                if n > 0.9:
                    c = mix(c, (255, 240, 200), 0.4)
                elif n < 0.08:
                    c = mix(c, (130, 96, 58), 0.4)
                px[x, y] = c
    # Fussspuren und Muscheln im Sand neben dem Feld
    for _ in range(140):
        x, y = rnd.randrange(W), rnd.choice([rnd.randrange(150, 178), rnd.randrange(583, FB_PANEL - 1)])
        p = px[x, y]
        if sat(p) > 40 and p[0] > p[2] + 30:
            px[x, y] = rnd.choice([(250, 240, 226), (196, 160, 110), (232, 170, 150)])
    return double(im)


def build_football():
    s = open(FB_SRC, encoding="utf-8").read()
    world, _ = get_img(s, "world")
    new = fb_world(world)
    debug("football-strand-world", new)
    s = set_img(s, "world", new)
    s = retitle(s, "Football Strand", "Football &mdash; Beach-Football an der K&uuml;ste")
    write("football", "strand", s)


BUILDERS = {
    "basketball": build_basketball,
    "hockey": build_hockey,
    "football": build_football,
}

if __name__ == "__main__":
    wanted = sys.argv[1:] or list(BUILDERS)
    for k in wanted:
        BUILDERS[k]()
