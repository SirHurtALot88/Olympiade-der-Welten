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
    for x in range(w):
        h = amp * (0.55 + 0.25 * math.sin(x * fr + ph[0]) + 0.15 * math.sin(x * fr * 2.7 + ph[1])
                   + 0.08 * math.sin(x * fr * 6.1 + ph[2]))
        top = max(top_lim, int(base - h))
        for y in range(top, base):
            rel = (y - top) / max(1, base - top)
            c = col
            if snow and rel < snow_line * (0.6 + 0.4 * math.sin(x * 0.21 + y * 0.05)):
                c = snow
                if (x + y) % 7 == 0 or (math.sin(x * 0.9) > 0.6 and rel > 0.1):
                    c = mix(snow, col, 0.35)
            # Lichtseite links, Schattenseite rechts der Grate
            slope = math.cos(x * fr * 2.7 + ph[1])
            if slope < -0.3:
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


BUILDERS = {
    "basketball": build_basketball,
}

if __name__ == "__main__":
    wanted = sys.argv[1:] or list(BUILDERS)
    for k in wanted:
        BUILDERS[k]()
