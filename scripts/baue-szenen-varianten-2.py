#!/usr/bin/env python3
"""
Zweite Staffel Kulissen-Varianten (03.11.): je zwei neue SCHAUPLAETZE fuer Tennis, Climbing,
Speed-Schach, Takeshi's Castle und Showcase, ein dritter fuer Wettessen.

    python3 -I scripts/baue-szenen-varianten-2.py [tennis climbing speed-schach takeshis-castle showcase wettessen]

Chris, 03.11.: „mach nicht nur ne Tag- und Nachtszene, sondern wirklich andere Settings." Jede
Variante ist deshalb ein anderer Ort (Steilkueste statt Centre Court, Eiswand statt Halle …),
nicht dieselbe Kulisse mit anderem Licht.

Grundsatz wie in `baue-szenen-varianten.py` (Staffel 1): dieselbe selbstlaufende Szene wie die
Vorlage — gleicher Demo-Ablauf, gleiche Demo-Figuren, gleiche Geometrie (Linien, Griffe,
Brett, Bahn, Buehnenboden, Tische), gleiches HUD. Ersetzt wird nur, was die Szene als Bild
eingebettet hat und was NICHT Spielfeld ist; dazu kommt eine kleine, rein optische Effekt-Ebene
(`window.__fx`), direkt nach dem Hintergrund gezeichnet. Nichts davon beruehrt Wertung oder
Spielcode.

Was in einer Vorlage als Teil des Hintergrundbildes eingebrannt ist und stehen bleiben muss
(Schiedsrichter, Bankfiguren, Anzeigetafeln, Schilder, Fallen), wird ueber `freistellen()`
aus der Vorlage geloest: alle Farben, die im umgebenden Publikum/Himmel vorkommen, gelten als
Hintergrund, der Rest als Figur — Pixel-Art hat eine feste Palette, das trennt sauber.

Kulissen prozedural in Pixel-Art (feste Farbbaender, Bayer-Dithering, Licht in Stufen), auf dem
halben Massstab gemalt und ganzzahlig vergroessert, wo die Vorlage selbst verdoppelte Pixel hat.
Standbilder danach mit `node scripts/baue-szenen-poster.mjs <diszi>/<variante>`.
"""
import base64
import importlib.util
import io
import json
import math
import os
import random
import re
import sys
from collections import Counter, deque

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True  # das Staffel-1-Skript wird importiert: kein __pycache__ unter scripts/

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZ = os.path.join(ROOT, "public", "szenen")

_spec = importlib.util.spec_from_file_location("staffel1", os.path.join(ROOT, "scripts", "baue-szenen-varianten.py"))
S1 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(S1)
dec, enc, clamp, mix, BAYER4, band_gradient, add_glow, sat, luma = (
    S1.dec, S1.enc, S1.clamp, S1.mix, S1.BAYER4, S1.band_gradient, S1.add_glow, S1.sat, S1.luma,
)


# ------------------------------------------------------------------ allgemeine Hilfen
def lade(diszi, datei, var):
    """Liest die Vorlage und das JSON-Objekt `const <var> = {...};`."""
    s = open(os.path.join(SZ, diszi, datei), encoding="utf-8").read()
    m = re.search(r"const " + var + r" = (\{.*?\});\n", s, re.S)
    return s, m, json.loads(m.group(1))


def ersetze_json(s, m, D):
    return s[: m.start(1)] + json.dumps(D, ensure_ascii=False, separators=(", ", ": ")) + s[m.end(1):]


def schreibe(diszi, slug, out, title, h1, lead, hook, hook_call, fx):
    out = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", out, count=1)
    out = re.sub(r"<h1>.*?</h1>", f"<h1>{h1}</h1>", out, count=1)
    if lead is not None:
        out, n = re.subn(r'<p class="lead">.*?</p>', f'<p class="lead">{lead}</p>', out, count=1, flags=re.S)
    assert out.count(hook) == 1, (diszi, hook, out.count(hook))
    out = out.replace(hook, hook + "\n  " + hook_call)
    i = out.rindex("</script>")
    out = out[:i] + fx + out[i:]
    path = os.path.join(SZ, diszi, f"{slug}.html")
    open(path, "w", encoding="utf-8").write(out)
    print("geschrieben:", os.path.relpath(path, ROOT), f"{len(out) / 1e6:.2f} MB")


def quant(im, n=256):
    return im.convert("RGB").quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")


def palette_aus(im, boxes, min_n=2, ohne=()):
    px = im.load()
    c = Counter()
    for (x0, y0, x1, y1) in boxes:
        for y in range(y0, y1):
            for x in range(x0, x1):
                if any(a <= x < c2 and b <= y < d2 for (a, b, c2, d2) in ohne):
                    continue
                c[px[x, y][:3]] += 1
    return {k for k, n in c.items() if n >= min_n}


def freistellen(im, box, pal, min_comp=12, max_loch=40):
    """Loest eine eingebrannte Figur aus dem Hintergrund: Farbe nicht in `pal` = Figur.
    Kleine Splitter (< min_comp Pixel) fallen weg, eingeschlossene Loecher werden gefuellt."""
    x0, y0, x1, y1 = box
    px = im.load()
    W, H = x1 - x0, y1 - y0
    m = [[px[x0 + x, y0 + y][:3] not in pal for x in range(W)] for y in range(H)]
    seen = [[False] * W for _ in range(H)]
    keep = [[False] * W for _ in range(H)]
    for sy in range(H):
        for sx in range(W):
            if not m[sy][sx] or seen[sy][sx]:
                continue
            comp, q = [], deque([(sx, sy)])
            seen[sy][sx] = True
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < W and 0 <= ny < H and m[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            q.append((nx, ny))
            if len(comp) >= min_comp:
                for (x, y) in comp:
                    keep[y][x] = True
    # Loecher fuellen: was vom Rand aus nicht ohne Figur erreichbar ist UND klein ist (Brillenglas,
    # Augenweiss). Grosse Einschluesse (Rasen zwischen Leitersprossen) bleiben Hintergrund.
    out = [[False] * W for _ in range(H)]
    q = deque([(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)])
    while q:
        x, y = q.popleft()
        if not (0 <= x < W and 0 <= y < H) or out[y][x] or keep[y][x]:
            continue
        out[y][x] = True
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    for sy in range(H):
        for sx in range(W):
            if out[sy][sx] or keep[sy][sx]:
                continue
            comp, q = [], deque([(sx, sy)])
            out[sy][sx] = True
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not out[ny][nx] and not keep[ny][nx]:
                        out[ny][nx] = True
                        q.append((nx, ny))
            if len(comp) <= max_loch:
                for (x, y) in comp:
                    keep[y][x] = True
    out = [[not keep[y][x] for x in range(W)] for y in range(H)]
    res = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rp = res.load()
    for y in range(H):
        for x in range(W):
            if not out[y][x]:
                rp[x, y] = px[x0 + x, y0 + y][:3] + (255,)
    return res


def wolke(d, cx, cy, w, col, sh):
    """Pixel-Wolke aus gestapelten Ellipsen, unten flach, Schattenkante."""
    for k, (dx, dy, rw, rh) in enumerate(((0, 0, w, w // 3), (-w // 3, 2, w // 2, w // 4), (w // 3, 1, w // 2, w // 4), (0, -w // 5, w // 2, w // 3))):
        d.ellipse([cx + dx - rw // 2, cy + dy - rh // 2, cx + dx + rw // 2, cy + dy + rh // 2], fill=col)
    d.rectangle([cx - w // 2, cy + w // 8, cx + w // 2, cy + w // 6], fill=sh)


def zypresse(d, x, base, h, dark, light):
    for k in range(h):
        u = k / h
        half = max(1, int(round((math.sin(min(1, u * 1.15) * math.pi) ** 0.7) * h * 0.11)))
        y = base - k
        d.line([x - half, y, x + half, y], fill=dark)
        if half > 1:
            d.line([x - half, y, x - half + max(1, half // 2), y], fill=light)
    d.line([x, base, x, base + 2], fill=(70, 50, 34))


def pinie(d, x, base, h, trunk, dark, light):
    d.line([x, base, x + h // 6, base - h], fill=trunk)
    d.line([x + 1, base, x + h // 6 + 1, base - h], fill=trunk)
    cx, cy = x + h // 6, base - h
    d.ellipse([cx - h // 2, cy - h // 6, cx + h // 2, cy + h // 8], fill=dark)
    d.ellipse([cx - h // 3, cy - h // 4, cx + h // 3, cy], fill=light)


def palme(px, d, x0, base, h, stamm=((120, 82, 48), (90, 60, 34)), blatt=((70, 128, 52), (46, 96, 38))):
    for k in range(h):
        xx = x0 + int(4 * math.sin(k / h * 1.4))
        d.rectangle([xx - 1, base - k, xx + 1, base - k], fill=stamm[0] if k % 4 else stamm[1])
    tx, ty = x0 + int(4 * math.sin(1.4)), base - h
    for ang in range(0, 360, 36):
        for r in range(1, 18):
            fx = tx + int(math.cos(math.radians(ang)) * r)
            fy = ty + int(math.sin(math.radians(ang)) * r * 0.55 + (r * r) / 36)
            try:
                px[fx, fy] = blatt[0 if r % 3 else 1] + (255,)
                px[fx, fy + 1] = blatt[1] + (255,)
            except IndexError:
                pass


def publikum_reihe(d, rnd, x0, x1, y, kopf, farben, haut, dicht=1.0, schritt=None):
    """Eine Reihe stehender Zuschauer (Kopf + Schultern), y = Schulterlinie."""
    schritt = schritt or kopf + 2
    x = x0 + rnd.randint(0, schritt)
    while x < x1:
        if rnd.random() < dicht:
            c = rnd.choice(farben)
            h = rnd.choice(haut)
            dy = rnd.randint(-1, 1)
            d.rectangle([x - kopf // 2 - 1, y + dy, x + kopf // 2 + 1, y + dy + kopf], fill=c)
            d.rectangle([x - kopf // 2 + 1, y + dy - kopf + 1, x + kopf // 2 - 1, y + dy], fill=h)
            d.line([x - kopf // 2 + 1, y + dy - kopf + 1, x + kopf // 2 - 1, y + dy - kopf + 1], fill=rnd.choice([(60, 40, 30), (30, 26, 24), (200, 170, 90), (120, 60, 30), h]))
        x += schritt + rnd.randint(-1, 1)


# ================================================================== TENNIS
TN_SRC = ("tennis", "court.html", "SC")
TN_STRIP = (254, 298)              # Bandenwand mit den HUD-Feldern (Bildpixel)
TN_BOARD = (804, 12, 1116, 93)     # Anzeigetafel
TN_POSTS = (826, 1090)
# Platz-Polygon (Doppelfeld) in Bildpixeln, aus SC.court: Weltkoordinaten x2
TN_COURT = [(345, 401), (1677, 401), (1575, 707), (243, 707)]


TN_FIGS = ((985, 120, 1080, 350), (240, 200, 330, 330), (1745, 200, 1840, 330))


def tn_figuren(world):
    # Hintergrundpalette = alles oberhalb der Grundlinie ausser Figuren und Anzeigetafel
    pal = palette_aus(world, [(0, 0, 1920, 360)], ohne=TN_FIGS + (TN_BOARD,))
    strip = palette_aus(world, [(0, TN_STRIP[0], 1920, TN_STRIP[1])], ohne=TN_FIGS)
    figs = []
    for box in TN_FIGS:
        cut = freistellen(world, box, pal, min_comp=20)
        cp = cut.load()
        for y in range(cut.size[1]):
            for x in range(cut.size[0]):
                p = cp[x, y]
                if p[3] and box[1] + y >= TN_STRIP[1] and p[1] - p[2] > 35 and p[1] - p[0] > 25:
                    cp[x, y] = (0, 0, 0, 0)          # Rasenreste unter den Fuessen
        figs.append((box, cut))
    return figs, strip


def tn_figuren_einsetzen(im, figs, strip, umfaerben):
    for (box, cut) in figs:
        c = cut.copy()
        cp = c.load()
        for y in range(c.size[1]):
            for x in range(c.size[0]):
                p = cp[x, y]
                if p[3] and TN_STRIP[0] <= box[1] + y < TN_STRIP[1] and (p[:3] in strip or (p[1] - p[0] > 30 and p[1] - p[2] > 10)) and sat(p) < 80 and luma(p) < 120:
                    cp[x, y] = umfaerben(p) + (255,)  # Bandenkante vor den Figuren mitfaerben
        im.paste(c, box[:2], c)


def in_poly(x, y, P):
    ins = False
    j = len(P) - 1
    for i in range(len(P)):
        xi, yi = P[i]
        xj, yj = P[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            ins = not ins
        j = i
    return ins


def tn_boden(world, im, inner, outer, kontrast, patch=None):
    """Rasen -> neuer Belag. Weisse Linien bleiben; die Helligkeit des Rasens (Maehstreifen,
    Tribuenenschatten) wird gestaucht uebernommen, damit der Platz nicht flach wirkt."""
    sp = world.load()
    px = im.load()
    W, H = world.size
    ref = 112.0
    for y in range(TN_STRIP[1], H):
        for x in range(W):
            p = sp[x, y]
            if luma(p) > 185 and sat(p) < 50:      # Linien
                px[x, y] = p
                continue
            k = 1 + (luma(p) / ref - 1) * kontrast
            base = inner if in_poly(x, y, TN_COURT) else outer
            q = (clamp(base[0] * k), clamp(base[1] * k), clamp(base[2] * k))
            if patch and p[0] > p[1] - 4:          # abgespielte Stellen der Vorlage
                q = patch(q, x, y)
            px[x, y] = q


def tn_strip(world, im, umfaerben):
    sp = world.load()
    px = im.load()
    for y in range(TN_STRIP[0], TN_STRIP[1]):
        for x in range(world.size[0]):
            p = sp[x, y]
            px[x, y] = umfaerben(p) if (sat(p) < 80 and luma(p) < 120) else p


def tn_tafel(world, im, pfosten):
    d = ImageDraw.Draw(im)
    for x in TN_POSTS:
        d.rectangle([x, TN_BOARD[3], x + 3, TN_STRIP[0]], fill=pfosten)
    im.paste(world.crop(TN_BOARD), TN_BOARD[:2])


TN_STRIP_RIVIERA = lambda p: (clamp(p[1] * 1.55 + 4), clamp(p[0] * 1.15 + 6), clamp(p[2] * 0.62))
TN_STRIP_DACH = lambda p: (clamp(p[0] * 0.9 + 4), clamp(p[1] * 0.62 + 6), clamp(p[2] * 1.5 + 18))


def tn_riviera(world):
    """Sandplatz auf der Terrasse ueber dem Meer: Kuestenstadt, Zypressen, Balustrade."""
    rnd = random.Random(7301)
    w, h = 960, 127
    lo = Image.new("RGB", (w, h))
    px = lo.load()
    band_gradient(px, 0, 0, w, 74, [(84, 156, 222), (104, 172, 228), (132, 190, 232), (170, 210, 234), (214, 228, 230)])
    d = ImageDraw.Draw(lo)
    add_glow(px, w, h, 820, 20, 70, (50, 44, 20), 0.9)
    d.ellipse([810, 10, 830, 30], fill=(255, 246, 206))
    for cx, cy, ww in ((120, 18, 46), (330, 30, 34), (600, 14, 52), (900, 38, 30)):
        wolke(d, cx, cy, ww, (246, 248, 250), (210, 222, 234))
    # Meer + Inseln
    for y in range(74, h):
        for x in range(w):
            c = (40, 104, 170) if y < 86 else (34, 92, 156) if y < 100 else (28, 80, 140)
            px[x, y] = c
        if y % 2 == 0:
            for x in range((y * 5) % 9, w, 9 + y % 4):
                if (x * 7 + y) % 3:
                    px[x, y] = (80, 146, 204)
    for (cx, wd, hh) in ((520, 120, 9), (640, 60, 5), (860, 90, 7)):
        for x in range(cx - wd // 2, cx + wd // 2):
            u = (x - cx) / (wd / 2)
            top = 74 - int(hh * (1 - u * u))
            for y in range(top, 74):
                px[x, y] = (110, 140, 160) if y > top + 1 else (140, 166, 180)
    # Kuestenstadt auf dem Huegel links
    for x in range(0, 470):
        top = int(40 + 0.00028 * (x - 60) ** 2 + 3 * math.sin(x * 0.05))
        for y in range(top, h):
            px[x, y] = (122, 132, 82) if y < top + 2 else (98, 112, 66)
    hs = []
    for _ in range(150):
        x = rnd.randint(0, 430)
        top = int(40 + 0.00028 * (x - 60) ** 2)
        y = rnd.randint(top + 2, h - 6)
        hs.append((y, x))
    for (y, x) in sorted(hs):
        bw, bh = rnd.randint(7, 13), rnd.randint(6, 10)
        wall = rnd.choice([(240, 234, 218), (232, 220, 190), (246, 214, 170), (226, 196, 160), (250, 244, 232)])
        d.rectangle([x, y, x + bw, y + bh], fill=wall)
        d.line([x + bw, y, x + bw, y + bh], fill=mix(wall, (120, 100, 90), 0.35))
        d.polygon([(x - 1, y), (x + bw + 1, y), (x + bw - 2, y - 3), (x + 2, y - 3)], fill=rnd.choice([(196, 96, 60), (176, 82, 52), (210, 116, 70)]))
        for wx in range(x + 2, x + bw - 1, 4):
            d.rectangle([wx, y + 3, wx + 1, y + 4], fill=rnd.choice([(60, 70, 86), (70, 110, 90), (40, 50, 60)]))
    d.rectangle([150, 22, 158, 52], fill=(236, 226, 204))   # Glockenturm
    d.rectangle([150, 22, 151, 52], fill=(250, 244, 230))
    d.rectangle([152, 28, 156, 33], fill=(70, 60, 50))
    d.polygon([(149, 22), (159, 22), (154, 12)], fill=(190, 92, 58))
    # Pinien auf der Landzunge rechts
    for x in range(760, w):
        top = int(64 - (x - 760) * 0.12 + 2 * math.sin(x * 0.1))
        for y in range(top, h):
            px[x, y] = (150, 128, 96) if y < top + 2 else (124, 104, 78)
    for x0 in (790, 836, 880, 930):
        pinie(d, x0, 64 - (x0 - 760) // 9, 20 + (x0 % 5), (90, 64, 44), (52, 92, 58), (76, 124, 72))
    # Terrasse: Balustrade, Zypressen, Zuschauer
    for x in range(0, w):
        for y in range(108, h):
            px[x, y] = (214, 200, 172) if y < 110 else (188, 172, 144)
    publikum_reihe(d, rnd, 0, w, 106, 5, [(240, 240, 236), (230, 120, 90), (90, 140, 200), (240, 200, 90), (200, 80, 90), (120, 170, 120), (250, 250, 250)],
                   [(240, 200, 170), (200, 150, 110), (150, 100, 70), (250, 220, 190)], dicht=0.8)
    for x in range(0, w, 6):
        d.rectangle([x + 1, 112, x + 3, 124], fill=(236, 228, 210))
        d.line([x + 1, 112, x + 1, 124], fill=(250, 246, 236))
        d.line([x + 3, 116, x + 3, 120], fill=(196, 184, 160))
    d.rectangle([0, 109, w, 112], fill=(244, 238, 222))
    d.rectangle([0, 124, w, h], fill=(206, 190, 160))
    for x0 in (40, 200, 360, 660, 860, 940):
        zypresse(d, x0, 108, 46 + (x0 * 7) % 12, (34, 70, 44), (58, 100, 60))
    for x0 in range(110, w, 160):     # Terrakotta-Kuebel mit Bougainvillea
        d.rectangle([x0, 118, x0 + 10, 125], fill=(184, 92, 58))
        d.ellipse([x0 - 3, 108, x0 + 13, 120], fill=(196, 54, 120))
        d.ellipse([x0 + 1, 106, x0 + 9, 114], fill=(222, 90, 156))
    big = lo.resize((1920, 254), Image.NEAREST)
    im = world.copy()
    im.paste(big, (0, 0))
    tn_strip(world, im, TN_STRIP_RIVIERA)

    def scuff(q, x, y):
        return mix(q, (222, 150, 104), 0.45) if (x * 3 + y * 5) % 7 else q

    tn_boden(world, im, (196, 100, 62), (184, 92, 56), 0.55, scuff)
    # Besenstriche quer ueber den Sand
    px = im.load()
    for y in range(TN_STRIP[1] + 6, 784, 14):
        for x in range(0, 1920):
            p = px[x, y]
            if not (luma(p) > 185 and sat(p) < 50) and (x // 2 + y) % 5:
                px[x, y] = mix(p, (160, 76, 46), 0.25)
    tn_tafel(world, im, (60, 46, 36))
    return im


TN_FX_RIVIERA = r"""
window.__fx = (ctx, ts) => {
  const t = performance.now() / 1000;
  // Segelboot zieht am Horizont entlang, Glitzern auf dem Meer, zwei Moewen
  const bx = ((t * 14) % 2200) - 140, by = 150;
  ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.moveTo(bx, by - 2); ctx.lineTo(bx + 12, by - 2); ctx.lineTo(bx + 6, by - 26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6b3b2a'; ctx.fillRect(Math.round(bx) - 4, by - 2, 22, 4);
  ctx.fillStyle = '#cfe6ff';
  for (let i = 0; i < 60; i++) {
    const ph = (t * 0.9 + i * 0.29) % 1;
    if (ph < 0.45) ctx.fillRect(((i * 7919) % 1920 + t * (4 + i % 5)) % 1920 | 0, 150 + (i * 37) % 50, 4 + 2 * (i % 2), 2);
  }
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < 2; k++) {
    const gx = ((t * (40 + k * 12) + k * 700) % 2100) - 90, gy = 40 + k * 26 + Math.sin(t * 1.3 + k) * 8, f = Math.sin(t * 7 + k) > 0 ? -4 : 2;
    ctx.fillRect(gx | 0, gy | 0, 4, 2); ctx.fillRect((gx - 8) | 0, (gy + f) | 0, 8, 2); ctx.fillRect((gx + 4) | 0, (gy + f) | 0, 8, 2);
  }
};
"""


def tn_dach(world):
    """Hartplatz auf dem Hochhausdach in der Abenddaemmerung: Skyline, Zaun, Flutlicht."""
    rnd = random.Random(7302)
    w, h = 960, 127
    lo = Image.new("RGB", (w, h))
    px = lo.load()
    band_gradient(px, 0, 0, w, 110, [(34, 30, 76), (60, 44, 104), (110, 60, 120), (176, 84, 110), (230, 126, 92), (252, 178, 102)])
    d = ImageDraw.Draw(lo)
    add_glow(px, w, h, 300, 104, 140, (70, 40, 10), 0.9, ry=40)
    for _ in range(80):
        x, y = rnd.randrange(w), rnd.randrange(0, 34)
        px[x, y] = (200, 200, 236)
    # ferne Skyline
    x = 0
    while x < w:
        bw, bh = rnd.randint(14, 34), rnd.randint(20, 62)
        d.rectangle([x, 104 - bh, x + bw, h], fill=(70, 50, 100))
        x += bw + rnd.randint(-3, 2)
    # nahe Skyline mit Fenstern
    x = -6
    towers = []
    while x < w:
        bw, bh = rnd.randint(26, 60), rnd.randint(34, 96)
        top = 116 - bh
        col = rnd.choice([(30, 28, 54), (36, 32, 62), (26, 30, 52)])
        d.rectangle([x, top, x + bw, h], fill=col)
        d.line([x, top, x + bw, top], fill=mix(col, (250, 160, 100), 0.35))
        for wy in range(top + 4, h - 2, 5):
            for wx in range(x + 3, x + bw - 2, 5):
                if rnd.random() < 0.35:
                    d.rectangle([wx, wy, wx + 2, wy + 2], fill=rnd.choice([(250, 210, 120), (230, 180, 100), (170, 200, 240), (250, 230, 170)]))
        if bh > 70:
            d.line([x + bw // 2, top, x + bw // 2, top - 16], fill=(20, 20, 30))
            towers.append((x + bw // 2, top - 16))
        x += bw + rnd.randint(2, 10)
    # Wassertank auf dem Nachbardach
    d.rectangle([94, 60, 120, 84], fill=(90, 60, 44))
    for yy in range(62, 84, 4):
        d.line([94, yy, 120, yy], fill=(70, 46, 34))
    d.polygon([(92, 60), (122, 60), (107, 50)], fill=(60, 40, 30))
    for lx in (96, 104, 112, 118):
        d.line([lx, 84, lx - 2, 100], fill=(30, 26, 30))
    # Leuchtreklame
    d.rectangle([720, 40, 820, 62], fill=(24, 20, 40))
    d.rectangle([722, 42, 818, 60], outline=(255, 70, 160))
    for k, cx in enumerate(range(730, 812, 12)):
        d.rectangle([cx, 47, cx + 6, 55], outline=(90, 230, 255) if k % 2 else (255, 210, 90))
    # Dachkante, Lueftungskaesten, Maschendrahtzaun, Flutlichtmasten
    d.rectangle([0, 100, w, h], fill=(64, 66, 78))
    d.line([0, 100, w, 100], fill=(110, 110, 126))
    for x0 in (30, 180, 430, 610, 880):
        d.rectangle([x0, 92, x0 + 26, 104], fill=(150, 152, 160))
        d.rectangle([x0 + 2, 94, x0 + 24, 96], fill=(120, 122, 132))
        for k in range(x0 + 4, x0 + 24, 3):
            d.line([k, 98, k, 102], fill=(96, 98, 108))
    for y in range(70, h):
        for x in range(w):
            if (x + y) % 6 == 0 or (x - y) % 6 == 0:
                px[x, y] = mix(px[x, y], (170, 176, 186), 0.55)
    d.line([0, 70, w, 70], fill=(150, 156, 166))
    for x0 in range(0, w, 60):
        d.rectangle([x0, 66, x0 + 1, h], fill=(120, 124, 134))
    for mx in (20, 940):
        d.rectangle([mx - 1, 10, mx + 1, h], fill=(70, 72, 84))
        d.rectangle([mx - 9, 4, mx + 9, 12], fill=(40, 40, 50))
        for k in range(-7, 9, 4):
            d.rectangle([mx + k, 6, mx + k + 2, 10], fill=(255, 250, 220))
        add_glow(px, w, h, mx, 8, 40, (90, 90, 60), 0.9)
    big = lo.resize((1920, 254), Image.NEAREST)
    im = world.copy()
    im.paste(big, (0, 0))
    tn_strip(world, im, TN_STRIP_DACH)
    tn_boden(world, im, (46, 98, 168), (54, 120, 84), 0.28, lambda q, x, y: q)
    # Flutlichtkegel auf dem Belag
    px = im.load()
    for (cx, cy) in ((520, 430), (1400, 430)):
        add_glow(px, 1920, 784, cx, cy, 520, (26, 26, 20), 0.9, ry=220, y_min=TN_STRIP[1])
    tn_tafel(world, im, (40, 42, 54))
    return im, [(x * 2, y * 2) for (x, y) in towers]


TN_FX_DACH = r"""
window.__fx = (ctx, ts) => {
  const t = performance.now() / 1000;
  // Positionslichter auf den Antennen, Reklame flackert, ein Flugzeug blinkt vorbei
  for (const [x, y] of __TOWERS__) {
    if (Math.sin(t * 3 + x) > 0.2) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(x - 2, y - 2, 4, 4); }
  }
  const on = Math.sin(t * 11) > -0.7 || Math.sin(t * 2.3) > 0;
  ctx.strokeStyle = on ? 'rgba(255,90,170,0.9)' : 'rgba(120,40,80,0.6)'; ctx.lineWidth = 2;
  ctx.strokeRect(1444, 84, 192, 36);
  const px = ((t * 60) % 2400) - 200, py = 34 + Math.sin(t * 0.2) * 4;
  ctx.fillStyle = 'rgba(230,230,250,0.85)'; ctx.fillRect(px | 0, py | 0, 14, 2);
  if (Math.floor(t * 2) % 2) { ctx.fillStyle = '#ff5555'; ctx.fillRect((px + 14) | 0, py | 0, 2, 2); }
};
"""


def tennis():
    s, m, D = lade(*TN_SRC)
    world = dec(D["world"]).convert("RGB")
    figs, strip = tn_figuren(world)
    def fertig(im, slug, title, h1, lead, fx, umfaerben):
        tn_figuren_einsetzen(im, figs, strip, umfaerben)
        D2 = dict(D)
        D2["world"] = enc(im)
        out = ersetze_json(s, m, D2)
        if os.environ.get("SZENEN_DEBUG"):
            im.save(os.path.join(os.environ["SZENEN_DEBUG"], f"tennis-{slug}-bg.png"))
        schreibe("tennis", slug, out, title, h1, lead, "ctx.drawImage(WORLD, 0, 0);", "if (window.__fx) window.__fx(ctx, t);", fx)
    fertig(tn_riviera(world), "riviera", "Tennis Sandplatz Riviera", "Tennis &mdash; Sandplatz &uuml;ber dem Meer",
           "Derselbe Matchball wie auf dem Centre Court (gleiche Ballwege, gleiche Schl&auml;ge, gleiche Platzma&szlig;e), "
           "nur auf einer Terrasse &uuml;ber der K&uuml;stenstadt: Sand statt Rasen, Zypressen, Balustrade, Segelboot am Horizont.",
           TN_FX_RIVIERA, TN_STRIP_RIVIERA)
    im, towers = tn_dach(world)
    fertig(im, "dach", "Tennis Dachplatz", "Tennis &mdash; Hartplatz auf dem Hochhausdach",
           "Derselbe Matchball wie auf dem Centre Court (gleiche Ballwege, gleiche Schl&auml;ge, gleiche Platzma&szlig;e), "
           "nur zwischen den T&uuml;rmen der Stadt: blauer Hartplatz, Maschendrahtzaun, Flutlicht und Skyline in der D&auml;mmerung.",
           TN_FX_DACH.replace("__TOWERS__", json.dumps(towers)), TN_STRIP_DACH)


# ================================================================== CLIMBING
CL_SRC = ("climbing", "wand.html")
CL_WALL = (28, 24, 672, 576)       # Wandflaeche mit Griffen/Expressen (D.WALL_X0..X1, TOP_Y..WALL_Y1)
CL_MATS = (14, 588, 686, 654)
CL_TIMER = (636, 668, 680, 722)
CL_CROWD_Y = 728


def cl_lade():
    s = open(os.path.join(SZ, *CL_SRC), encoding="utf-8").read()
    m = re.search(r'const WALL_SRC = (".*?");', s, re.S)
    return s, m, dec(json.loads(m.group(1))).convert("RGB")


def rampe(stops, u):
    u = min(0.999, max(0.0, u)) * (len(stops) - 1)
    i = int(u)
    return mix(stops[i], stops[i + 1], u - i)


def cl_wand(src, ramp, strata, extra, seed):
    """Graue Kletterwand -> neues Material. Griffe (gesaettigt) bleiben, Expressen (dunkel)
    bleiben dunkel, Volumen werden ueber ihre Helligkeit zu Felsbuckeln/Eisnasen."""
    rnd = random.Random(seed)
    im = src.copy()
    sp, px = src.load(), im.load()
    x0, y0, x1, y1 = CL_WALL
    for y in range(y0, y1):
        for x in range(x0, x1):
            p = sp[x, y]
            if sat(p) >= 55:
                continue
            L = luma(p)
            if L < 70:            # dunkle Volumen, Expressen, Griffschatten: dunkle Stufe des Materials
                px[x, y] = rampe(ramp, 0.02 + L / 260)
                continue
            u = 0.52 + (L - 160) / 170 + strata(x, y)
            u += ((BAYER4[y & 3][x & 3] + 0.5) / 16 - 0.5) * 0.12
            px[x, y] = rampe(ramp, u)
    extra(im, rnd)
    # Griffe, die durch den Strich geraten sind, wieder obenauf
    for y in range(y0, y1):
        for x in range(x0, x1):
            if sat(sp[x, y]) >= 55:
                px[x, y] = sp[x, y]
    return im


def riss(px, rnd, x, y, n, dark, light, box):
    for _ in range(n):
        if box[0] < x < box[2] - 1 and box[1] < y < box[3] - 1:
            if sat(px[x, y]) < 55:
                px[x, y] = dark
            if sat(px[x + 1, y]) < 55:
                px[x + 1, y] = light
        y += 1
        x += rnd.choice((-1, 0, 0, 1))


def cl_rest(im, src, sky, ground, mats, sockel):
    """Alles ausser Wand: Himmel/Ueberhang oben, Raender, Sockel, Matten, Boden. Zeitanzeige und
    Publikum unten bleiben aus der Vorlage."""
    px, sp = im.load(), src.load()
    W, H = im.size
    sky(im)
    for y in range(CL_WALL[3], CL_MATS[1]):
        for x in range(W):
            px[x, y] = sockel(x, y)
    for y in range(CL_MATS[1], CL_CROWD_Y):
        for x in range(W):
            p = sp[x, y]
            inmat = CL_MATS[0] <= x < CL_MATS[2] and y < CL_MATS[3] and (p[2] > p[0] + 60)
            if inmat:
                px[x, y] = mats(p, x, y)
            elif not (CL_TIMER[0] <= x < CL_TIMER[2] and CL_TIMER[1] <= y < CL_TIMER[3]):
                px[x, y] = ground(x, y)


def cl_fels(src):
    """Sandsteinwand in der Schlucht: Felsbaender, Risse, Wuestenhimmel, Crashpads auf Sand."""
    ramp = [(78, 38, 30), (124, 62, 42), (166, 88, 56), (198, 118, 74), (222, 152, 100), (240, 190, 140)]
    strata = lambda x, y: 0.16 * math.sin(y * 0.11 + 1.6 * math.sin(x * 0.013)) + 0.07 * math.sin(y * 0.37 + x * 0.02)

    def extra(im, rnd):
        px = im.load()
        for _ in range(26):
            riss(px, rnd, rnd.randrange(40, 660), rnd.randrange(30, 520), rnd.randint(20, 70), (70, 34, 28), (226, 160, 110), CL_WALL)
        for _ in range(1600):   # Kiesel/Flechten
            x, y = rnd.randrange(30, 670), rnd.randrange(26, 574)
            if sat(px[x, y]) < 90:
                px[x, y] = rnd.choice([(150, 70, 44), (232, 176, 120), (120, 120, 70), (104, 52, 36)])
        d = ImageDraw.Draw(im)
        for (bx, by) in ((70, 300), (630, 160), (600, 470), (90, 520)):   # Wuestenstraeucher in Ritzen
            for k in range(7):
                a = math.radians(190 + k * 22)
                d.line([bx, by, bx + int(math.cos(a) * 7), by + int(math.sin(a) * 5)], fill=(96, 112, 52))

    im = cl_wand(src, ramp, strata, extra, 4101)

    def sky(im):
        px = im.load()
        band_gradient(px, 0, 0, 700, CL_WALL[1], [(88, 150, 214), (128, 178, 226)])
        for x in list(range(0, CL_WALL[0])) + list(range(CL_WALL[2], 700)):
            for y in range(0, CL_WALL[3]):
                if x < CL_WALL[0] and px[x, y][1] > 120 and y > CL_WALL[1]:
                    continue          # Meterskala links bleibt
                u = 0.45 + 0.12 * math.sin(y * 0.09 + x * 0.3)
                px[x, y] = rampe(ramp, u - 0.25)
        d = ImageDraw.Draw(im)
        # Ueberhangkante oben + ferne Tafelberge
        for x in range(0, 700):
            top = int(12 + 6 * math.sin(x * 0.02) + 3 * math.sin(x * 0.11))
            for y in range(top, CL_WALL[1]):
                px[x, y] = rampe(ramp, 0.25 + (y - top) / 40)
        d.ellipse([600, 2, 612, 14], fill=(255, 244, 200))

    def ground(x, y):
        v = (x * 73856093 ^ y * 19349663) & 15
        base = (214, 170, 112) if v > 2 else (176, 130, 84)
        if (y - CL_MATS[1]) < 4:
            base = mix(base, (120, 70, 44), 0.5)
        return base

    def mats(p, x, y):
        L = luma(p) / 140
        col = (196, 54, 46) if (x // 96) % 2 == 0 else (60, 64, 76)
        return (clamp(col[0] * L), clamp(col[1] * L), clamp(col[2] * L))

    cl_rest(im, src, sky, ground, mats, lambda x, y: rampe(ramp, 0.2 + (y - CL_WALL[3]) / 30 + 0.05 * math.sin(x * 0.2)))
    return im


CL_FX_FELS = r"""
window.__fx = (ctx) => {
  const t = performance.now() / 1000;
  // Adler kreist vor der Wand, Staubkoerner treiben im Aufwind
  const gx = 350 + Math.cos(t * 0.4) * 220, gy = 220 + Math.sin(t * 0.4) * 60, f = Math.sin(t * 5) > 0 ? -2 : 1;
  ctx.fillStyle = '#3b2618';
  ctx.fillRect(Math.round(gx) - 1, Math.round(gy), 3, 2);
  ctx.fillRect(Math.round(gx) - 8, Math.round(gy) + f, 7, 1); ctx.fillRect(Math.round(gx) + 2, Math.round(gy) + f, 7, 1);
  for (let i = 0; i < 50; i++) {
    const x = (i * 131 + Math.sin(t + i) * 20) % 700, y = 580 - ((t * (10 + i % 7) + i * 97) % 600);
    ctx.fillStyle = i % 2 ? 'rgba(240,200,150,0.55)' : 'rgba(190,130,90,0.5)';
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
};
"""


def cl_eis(src):
    """Gefrorener Wasserfall am Gletscher: Eiszapfen-Strukturen, Schnee auf den Kanten."""
    ramp = [(28, 56, 104), (52, 102, 164), (96, 156, 210), (150, 204, 236), (204, 236, 250), (242, 252, 255)]
    cols = [random.Random(4202 + k).random() for k in range(64)]
    strata = lambda x, y: 0.18 * math.sin(x * 0.09 + 2.2 * math.sin(y * 0.01 + cols[(x // 11) % 64] * 6)) + 0.06 * math.sin(y * 0.05)

    def extra(im, rnd):
        px = im.load()
        for _ in range(30):
            riss(px, rnd, rnd.randrange(40, 660), rnd.randrange(30, 520), rnd.randint(20, 80), (30, 60, 110), (240, 252, 255), CL_WALL)
        for _ in range(900):   # Luftblaeschen im Eis
            x, y = rnd.randrange(30, 670), rnd.randrange(26, 574)
            if sat(px[x, y]) < 140 and px[x, y][2] > 150:
                px[x, y] = (236, 248, 255)
        d = ImageDraw.Draw(im)
        for yy in (120, 300, 430):       # Schneebaender auf Absaetzen
            for x in range(30, 670):
                h = int(2 + 2 * math.sin(x * 0.07 + yy))
                for k in range(h):
                    if sat(px[x, yy + k]) < 55 or px[x, yy + k][2] > 150:
                        px[x, yy + k] = (246, 250, 255) if k < h - 1 else (200, 220, 236)

    im = cl_wand(src, ramp, strata, extra, 4202)

    def sky(im):
        px = im.load()
        band_gradient(px, 0, 0, 700, CL_WALL[1], [(150, 180, 214), (190, 210, 230)])
        for x in list(range(0, CL_WALL[0])) + list(range(CL_WALL[2], 700)):
            for y in range(0, CL_WALL[3]):
                if x < CL_WALL[0] and px[x, y][1] > 120 and y > CL_WALL[1]:
                    continue
                px[x, y] = rampe(ramp, 0.3 + 0.1 * math.sin(x * 0.4 + y * 0.05))
        d = ImageDraw.Draw(im)
        for x in range(0, 700, 9):       # Eiszapfen an der Oberkante
            ln = 6 + (x * 7) % 14
            d.polygon([(x, CL_WALL[1] - 4), (x + 6, CL_WALL[1] - 4), (x + 3, CL_WALL[1] - 4 + ln)], fill=(214, 238, 252))
            d.line([x + 1, CL_WALL[1] - 4, x + 3, CL_WALL[1] - 4 + ln], fill=(250, 254, 255))
        d.rectangle([0, 0, 700, CL_WALL[1] - 5], fill=(236, 244, 252))
        d.line([0, CL_WALL[1] - 5, 700, CL_WALL[1] - 5], fill=(200, 220, 238))

    def ground(x, y):
        v = (x * 73856093 ^ y * 19349663) & 15
        base = (236, 242, 250) if v > 3 else (206, 218, 234)
        if (y - CL_MATS[1]) < 4:
            base = (176, 196, 220)
        return base

    def mats(p, x, y):
        L = luma(p) / 140
        col = (84, 92, 110) if (x // 96) % 2 == 0 else (200, 120, 40)
        return (clamp(col[0] * L), clamp(col[1] * L), clamp(col[2] * L))

    cl_rest(im, src, sky, ground, mats, lambda x, y: (220, 232, 246) if (y - CL_WALL[3]) < 3 else rampe(ramp, 0.35 + 0.05 * math.sin(x * 0.3)))
    return im


CL_FX_EIS = r"""
window.__fx = (ctx) => {
  const t = performance.now() / 1000;
  // Schneefall vor der Wand, Eis glitzert
  for (let i = 0; i < 140; i++) {
    const sp = 18 + (i * 7) % 22;
    const x = (i * 173 + Math.sin(t * 0.8 + i) * 12 + 700) % 700, y = (i * 59 + t * sp) % 780;
    ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.85)' : 'rgba(220,236,255,0.7)';
    ctx.fillRect(Math.round(x), Math.round(y), i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
  }
  for (let i = 0; i < 30; i++) {
    const ph = (t * 0.7 + i * 0.37) % 1;
    if (ph < 0.15) { ctx.fillStyle = '#ffffff'; const x = 40 + (i * 977) % 620, y = 40 + (i * 613) % 520; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
};
"""


def climbing():
    s, m, src = cl_lade()
    for slug, painter, fx, title, h1, lead in (
        ("fels", cl_fels, CL_FX_FELS, "Climbing Sandsteinschlucht", "Climbing: Sandsteinwand in der Schlucht",
         "Dieselbe Route wie in der Halle (gleiche Griffe, Expressen und H&ouml;hen), nur drau&szlig;en am Fels: "
         "Sandsteinb&auml;nder und Risse statt Platten, Crashpads auf dem Sand, ein Adler kreist."),
        ("eis", cl_eis, CL_FX_EIS, "Climbing Eisfall", "Climbing: Gefrorener Wasserfall am Gletscher",
         "Dieselbe Route wie in der Halle (gleiche Griffe, Expressen und H&ouml;hen), nur an einem gefrorenen "
         "Wasserfall: Eis mit Rissen und Schneeb&auml;ndern, Eiszapfen oben, Schneefall."),
    ):
        im = painter(src)
        if os.environ.get("SZENEN_DEBUG"):
            im.save(os.path.join(os.environ["SZENEN_DEBUG"], f"climbing-{slug}-bg.png"))
        out = s[: m.start(1)] + json.dumps(enc(im)) + s[m.end(1):]  # ohne Quantisierung: die Griff-Farben muessen exakt bleiben
        schreibe("climbing", slug, out, title, h1, lead, "ctx.drawImage(IM.wall, 0, 0);", "if (window.__fx) window.__fx(ctx);", fx)


ALLE = {"tennis": tennis, "climbing": climbing}

if __name__ == "__main__":
    ziele = sys.argv[1:] or list(ALLE)
    for z in ziele:
        ALLE[z]()
