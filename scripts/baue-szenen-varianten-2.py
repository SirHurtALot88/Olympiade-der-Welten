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
        if not n:   # Vorlagen ohne class="lead": erster Absatz direkt unter der Ueberschrift
            out = re.sub(r'(</h1>\s*<p[^>]*>).*?(</p>)', lambda mm: mm.group(1) + lead + mm.group(2), out, count=1, flags=re.S)
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


# ================================================================== SPEED-SCHACH
# Hintergrund 576x324 = Welt 288x162 verdoppelt. Tisch, Brett, Uhr und beide Spieler (samt
# Sitzflaeche) sind eigene Ebenen; aus dem Hintergrund werden nur die zwei Stuhlgestelle
# uebernommen, alles andere (Saal, Nebenbretter, Publikum) ist Kulisse.
SC_CHAIRS = ((200, 200, 252, 300), (322, 200, 376, 300))
SC_CHAIR_COLS = {(92, 52, 30), (62, 34, 20)}


def sc_stuehle(src, im):
    sp, px = src.load(), im.load()
    for (x0, y0, x1, y1) in SC_CHAIRS:
        for y in range(y0, y1):
            for x in range(x0, x1):
                if sp[x, y][:3] in SC_CHAIR_COLS:
                    px[x, y] = sp[x, y][:3]


def sitzend(d, x, y, rnd, farben, haut, rueck=None):
    """Kleine sitzende Zuschauerfigur (Welt-Massstab): Kopf, Rumpf, Beine."""
    c, h = rnd.choice(farben), rnd.choice(haut)
    d.rectangle([x - 3, y - 6, x + 3, y + 1], fill=c)
    d.rectangle([x - 2, y - 11, x + 2, y - 7], fill=h)
    d.line([x - 2, y - 11, x + 2, y - 11], fill=rnd.choice([(50, 34, 24), (30, 26, 24), (200, 170, 90), (150, 70, 40), (220, 220, 220)]))
    d.rectangle([x - 3, y + 2, x + 3, y + 3], fill=mix(c, (0, 0, 0), 0.4))
    if rueck:
        d.rectangle([x - 4, y + 4, x + 4, y + 7], fill=rueck)


SC_FARBEN = [(180, 60, 60), (60, 90, 160), (220, 180, 70), (70, 130, 80), (140, 80, 150), (230, 230, 230), (60, 60, 70), (200, 110, 50)]
SC_HAUT = [(240, 200, 170), (200, 150, 110), (150, 100, 70), (250, 220, 190), (120, 160, 90)]


def sc_park():
    """Stadtpark im Herbst: Ahornbaeume, Wiese, Parkbaenke mit Kiebitzen, Brunnen, Kiesplatz."""
    rnd = random.Random(5101)
    w, h = 288, 162
    im = Image.new("RGB", (w, h))
    px = im.load()
    d = ImageDraw.Draw(im)
    band_gradient(px, 0, 0, w, 70, [(120, 176, 222), (150, 196, 230), (190, 214, 232)])
    # ferne Stadtsilhouette
    x = 0
    while x < w:
        bw, bh = rnd.randint(8, 18), rnd.randint(8, 22)
        d.rectangle([x, 66 - bh, x + bw, 70], fill=(150, 170, 190))
        x += bw + rnd.randint(0, 3)
    # Baumkronen im Herbstlaub
    for (cx, cy, r) in ((20, 46, 26), (70, 38, 30), (128, 44, 24), (170, 36, 30), (226, 42, 28), (276, 48, 24)):
        d.rectangle([cx - 2, cy, cx + 2, 88], fill=(80, 56, 40))
        for k in range(60):
            a, rr = rnd.random() * math.tau, r * math.sqrt(rnd.random())
            bx, by = cx + int(math.cos(a) * rr), cy + int(math.sin(a) * rr * 0.75)
            col = rnd.choice([(204, 96, 40), (226, 140, 50), (180, 64, 36), (236, 184, 72), (150, 120, 50)])
            d.ellipse([bx - 5, by - 4, bx + 5, by + 4], fill=col)
        for k in range(14):
            a, rr = rnd.random() * math.tau, r * math.sqrt(rnd.random())
            d.point([cx + int(math.cos(a) * rr), cy + int(math.sin(a) * rr * 0.75) - 3], fill=(250, 214, 120))
    # Wiese + Hecke
    for y in range(76, 100):
        for x in range(w):
            px[x, y] = (96, 140, 64) if (x * 7 + y * 3) % 11 else (80, 124, 54)
    d.rectangle([0, 74, w, 79], fill=(62, 100, 52))
    for x in range(0, w, 6):
        d.ellipse([x - 2, 71, x + 5, 78], fill=(70, 112, 58))
    # Brunnen links
    d.ellipse([28, 84, 72, 96], fill=(160, 160, 168))
    d.ellipse([31, 86, 69, 94], fill=(90, 150, 200))
    d.rectangle([47, 70, 53, 89], fill=(176, 176, 184))
    d.ellipse([42, 68, 58, 74], fill=(190, 190, 198))
    # Parkbaenke mit Zuschauern
    for bx in (88, 196, 236):
        for k in range(3):
            sitzend(d, bx + 6 + k * 10, 86, rnd, SC_FARBEN, SC_HAUT)
        d.rectangle([bx, 86, bx + 34, 88], fill=(120, 76, 44))
        d.rectangle([bx, 80, bx + 34, 82], fill=(140, 90, 52))
        d.line([bx + 2, 88, bx + 2, 93], fill=(40, 40, 46))
        d.line([bx + 32, 88, bx + 32, 93], fill=(40, 40, 46))
    # Laternen
    for lx in (150, 268):
        d.rectangle([lx, 52, lx + 1, 96], fill=(40, 46, 50))
        d.rectangle([lx - 3, 48, lx + 4, 53], fill=(50, 56, 60))
        d.rectangle([lx - 2, 49, lx + 3, 52], fill=(250, 236, 180))
    # Kiesplatz unter dem Turniertisch
    for y in range(96, h):
        for x in range(w):
            v = (x * 73856093 ^ y * 19349663) & 31
            c = (198, 182, 150) if v > 6 else (170, 152, 122) if v > 1 else (222, 210, 182)
            px[x, y] = c
    for y in range(96, h):       # Rasenkante rechts/links in Perspektive
        e = int((y - 96) * 0.9)
        for x in range(0, max(0, 14 - e)):
            px[x, y] = (96, 140, 64)
    # Laub auf dem Kies
    for _ in range(220):
        x, y = rnd.randrange(w), rnd.randrange(98, h)
        d.point([x, y], fill=rnd.choice([(204, 96, 40), (226, 140, 50), (180, 64, 36), (236, 184, 72)]))
    # Tauben
    for (tx, ty) in ((60, 140), (66, 146), (232, 150), (240, 138)):
        d.rectangle([tx, ty, tx + 3, ty + 1], fill=(120, 124, 140))
        d.point([tx + 3, ty - 1], fill=(90, 94, 110))
    return im


SC_FX_PARK = r"""
window.__fx = (ctx) => {
  const t = performance.now() / 1000;
  // fallendes Laub, Wasserstrahl im Brunnen
  const cols = ['#cc6028', '#e28c32', '#b44024', '#ecb848'];
  for (let i = 0; i < 26; i++) {
    const sp = 14 + (i * 7) % 12, x0 = (i * 97) % 576;
    const y = (i * 53 + t * sp) % 330 - 6, x = x0 + Math.sin(t * 1.5 + i) * 10;
    ctx.fillStyle = cols[i % 4];
    ctx.fillRect(Math.round(x), Math.round(y), Math.sin(t * 4 + i) > 0 ? 4 : 2, 2);
  }
  ctx.fillStyle = 'rgba(200,230,255,0.8)';
  for (let i = 0; i < 10; i++) {
    const ph = (t * 1.2 + i / 10) % 1, a = (i % 2 ? 1 : -1) * (6 + i * 1.5);
    ctx.fillRect(Math.round(100 + a * ph), Math.round(136 - 28 * ph + 40 * ph * ph), 2, 2);
  }
};
"""


SC_WINDOWS = [(30, 44, 78, 78), (96, 44, 136, 78), (152, 44, 192, 78), (210, 44, 258, 78)]


def sc_zug():
    """Speisewagen eines Nachtzugs: Mahagoni-Taefelung, Fenster (Landschaft in der Effekt-Ebene),
    Gepaeckablagen, Polsterbaenke mit Fahrgaesten, Teppich im Gang."""
    rnd = random.Random(5202)
    w, h = 288, 162
    im = Image.new("RGB", (w, h))
    px = im.load()
    d = ImageDraw.Draw(im)
    # Decke + Taefelung
    band_gradient(px, 0, 0, w, 34, [(214, 196, 160), (190, 168, 128)])
    for y in range(34, 100):
        for x in range(w):
            c = (96, 44, 32) if (x // 3) % 7 else (80, 36, 26)
            if (x * 13 + y * 3) % 23 == 0:
                c = (112, 54, 38)
            px[x, y] = c
    d.rectangle([0, 34, w, 37], fill=(150, 110, 50))           # Messingleiste
    for x in range(0, w, 72):                                   # Deckenlampen
        d.rectangle([x + 30, 22, x + 42, 26], fill=(180, 150, 80))
        d.rectangle([x + 32, 26, x + 40, 29], fill=(255, 236, 190))
        add_glow(px, w, h, x + 36, 28, 26, (60, 46, 20), 0.8)
    for (x0, y0, x1, y1) in SC_WINDOWS:
        d.rectangle([x0 - 4, y0 - 4, x1 + 4, y1 + 4], fill=(150, 110, 50))
        d.rectangle([x0 - 2, y0 - 2, x1 + 2, y1 + 2], fill=(60, 28, 20))
        d.rectangle([x0, y0, x1, y1], fill=(40, 60, 96))      # wird von der Effekt-Ebene ueberzeichnet
        d.rectangle([x0 - 2, y0 - 10, x1 + 2, y0 - 6], fill=(170, 130, 60))   # Gepaeckablage
        for k in range(x0, x1, 4):
            d.line([k, y0 - 6, k, y0 - 4], fill=(120, 90, 40))
        if rnd.random() < 0.8:
            sx = rnd.randint(x0, x1 - 12)
            d.rectangle([sx, y0 - 16, sx + 12, y0 - 10], fill=rnd.choice([(120, 60, 40), (60, 70, 100), (140, 120, 80)]))
    for x in (88, 144, 202):                                    # Wandleuchten zwischen den Fenstern
        d.rectangle([x - 1, 54, x + 1, 62], fill=(170, 130, 60))
        d.ellipse([x - 3, 48, x + 3, 55], fill=(255, 226, 170))
        add_glow(px, w, h, x, 52, 14, (70, 50, 20), 0.9)
    # Polsterbaenke mit Fahrgaesten
    d.rectangle([0, 80, w, 100], fill=(70, 30, 24))
    for bx in range(4, w, 44):
        for k in range(2):
            if rnd.random() < 0.75:
                sitzend(d, bx + 12 + k * 14, 88, rnd, SC_FARBEN, SC_HAUT)
        d.rectangle([bx, 84, bx + 40, 96], outline=(40, 70, 56))
        d.rectangle([bx + 1, 90, bx + 39, 96], fill=(46, 92, 70))
        d.line([bx + 1, 90, bx + 39, 90], fill=(70, 124, 96))
    d.rectangle([0, 99, w, 101], fill=(150, 110, 50))
    # Gangteppich
    for y in range(101, h):
        for x in range(w):
            c = (130, 30, 36)
            if (x + (y - 101)) % 12 == 0 or (x - (y - 101)) % 12 == 0:
                c = (170, 120, 60)
            elif (x // 6 + y // 6) % 2:
                c = (118, 26, 32)
            if y < 104:
                c = mix(c, (40, 10, 12), 0.4)
            px[x, y] = c
    return im


SC_FX_ZUG = r"""
window.__fx = (ctx) => {
  const t = performance.now() / 1000;
  // Landschaft zieht an den Fenstern vorbei (nur innerhalb der Scheiben gezeichnet)
  const W = __WINDOWS__;
  ctx.save();
  ctx.beginPath(); for (const [a, b, c, d] of W) ctx.rect(a * 2, b * 2, (c - a + 1) * 2, (d - b + 1) * 2); ctx.clip();
  const g = ctx.createLinearGradient(0, 88, 0, 156); g.addColorStop(0, '#f2a86a'); g.addColorStop(1, '#ffd9a0');
  ctx.fillStyle = g; ctx.fillRect(0, 80, 576, 80);
  ctx.fillStyle = '#ffe9b8'; ctx.beginPath(); ctx.arc(400, 112, 10, 0, 7); ctx.fill();
  const layer = (sp, base, amp, fr, col) => {
    ctx.fillStyle = col;
    const off = (t * sp) % 2000;
    for (let x = 0; x < 576; x += 2) {
      const xx = x + off, y = base - amp * (0.5 + 0.5 * Math.sin(xx * fr) * Math.sin(xx * fr * 0.37 + 1));
      ctx.fillRect(x, Math.round(y), 2, 160 - Math.round(y));
    }
  };
  layer(12, 136, 20, 0.013, '#8a6a8c'); layer(40, 146, 12, 0.03, '#5a7a4a'); layer(120, 152, 4, 0.08, '#3e5a34');
  ctx.fillStyle = '#2a2a2a';
  const po = (t * 260) % 160;
  for (let x = -po; x < 576; x += 160) { ctx.fillRect(Math.round(x), 96, 2, 60); ctx.fillRect(Math.round(x) - 4, 100, 10, 2); }
  ctx.restore();
  // leichtes Ruckeln der Lampen
  const s = Math.sin(t * 9) > 0.95 ? 1 : 0;
  ctx.fillStyle = 'rgba(255,236,190,0.25)'; for (const x of [72, 216, 360, 504]) ctx.fillRect(x - 6 + s, 54, 12, 4);
};
"""


def speed_schach():
    s, m, D = lade("speed-schach", "turniersaal.html", "IMGS")
    src = dec(D["bg"]).convert("RGB")
    for slug, painter, fx, title, h1, lead in (
        ("park", sc_park, SC_FX_PARK, "Speed-Schach Stadtpark", "Speed-Schach: Blitzpartie im Stadtpark",
         "Derselbe Zugwechsel wie im Turniersaal (gleiches Brett, gleiche Uhr, gleiche Z&uuml;ge), nur unter Ahornb&auml;umen "
         "im Herbst: Kiesplatz, Brunnen, Kiebitze auf den Parkb&auml;nken, fallendes Laub."),
        ("zug", sc_zug, SC_FX_ZUG.replace("__WINDOWS__", json.dumps(SC_WINDOWS)), "Speed-Schach Speisewagen", "Speed-Schach: Blitzpartie im Speisewagen",
         "Derselbe Zugwechsel wie im Turniersaal (gleiches Brett, gleiche Uhr, gleiche Z&uuml;ge), nur im Speisewagen eines "
         "Fernzugs: Mahagoni, Polsterb&auml;nke mit Fahrg&auml;sten, drau&szlig;en zieht die Abendlandschaft vorbei."),
    ):
        im = painter().resize((576, 324), Image.NEAREST)
        sc_stuehle(src, im)
        if os.environ.get("SZENEN_DEBUG"):
            im.save(os.path.join(os.environ["SZENEN_DEBUG"], f"speed-schach-{slug}-bg.png"))
        D2 = dict(D)
        D2["bg"] = enc(im.convert("RGBA"))
        out = ersetze_json(s, m, D2)
        schreibe("speed-schach", slug, out, title, h1, lead, "ctx.drawImage(IM.bg, 0, 0);", "if (window.__fx) window.__fx(ctx);", fx)


# ================================================================== TAKESHI'S CASTLE
# Basisbild 2560x720 (Weltmassstab, Kamera zeigt y 300..700). Ueber der Laufbahn (y < 516) wird die
# Natur der Vorlage (Himmel, Kirschbaeume, Berge, Wiese) durch die neue Kulisse ersetzt — erkannt an
# ihren Farbfamilien; Schilder, Startbogen, Nummernpfosten, Tribuene und Kugel-Trichter bleiben.
# Darunter werden nur Sandweg, Wasser und Uferwiese umgefaerbt; Bloecke, Bruecken, Ponton bleiben.
TC_GROUND_Y = 516
TC_STANDS = (676, 268, 1484, 482)
TC_CASTLE = (2036, 268, 2528, 536)
TC_TREE_ZONES = ((0, 700), (1480, 2040), (2500, 2560))
TC_LAWN = (190, 420, 690, 482)
TC_TRUNK = {(57, 29, 41), (65, 37, 45), (70, 34, 49), (132, 90, 89), (100, 65, 70), (92, 39, 60), (34, 19, 30),
            (116, 81, 82), (78, 45, 53), (76, 58, 61), (65, 45, 49), (54, 61, 53)}
TC_SAND = {(228, 198, 138): 1, (240, 214, 160): 2, (206, 174, 114): 0}
TC_GAPS = ((280, 620), (690, 1110), (1180, 1560))


def hsv(p):
    r, g, b = p[0] / 255, p[1] / 255, p[2] / 255
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == mn:
        return 0.0, 0.0, mx
    d = mx - mn
    if mx == r:
        hh = ((g - b) / d) % 6
    elif mx == g:
        hh = (b - r) / d + 2
    else:
        hh = (r - g) / d + 4
    return hh * 60, d / mx, mx


TC_GRAS = {(124, 204, 66), (158, 228, 92), (98, 174, 54), (129, 207, 74), (102, 186, 92)}
TC_ZIEL = (2078, 438, 2142, 522)     # gruenes Schild "ZIEL / FALLE 14" samt Pfosten


def tc_burg_innen(x, y):
    return (2076 <= x < 2500 and TC_CASTLE[1] <= y < 470) or (2090 <= x < 2492 and 470 <= y < TC_CASTLE[3])


def tc_natur(p, x, y):
    hh, ss, vv = hsv(p)
    if 172 <= hh <= 205 and p[1] > 200 and vv > 0.85:            # Himmel
        return True
    if TC_STANDS[0] <= x < TC_STANDS[2] and TC_STANDS[1] <= y < TC_STANDS[3]:
        return False
    if p[:3] in TC_GRAS and not (TC_ZIEL[0] <= x < TC_ZIEL[2] and TC_ZIEL[1] <= y < TC_ZIEL[3]):
        return True
    if tc_burg_innen(x, y) or (TC_ZIEL[0] <= x < TC_ZIEL[2] and TC_ZIEL[1] <= y < TC_ZIEL[3]):
        return False
    if 70 <= hh < 182 and ss > 0.18 and p[1] < 225:               # Laub, Berge
        return True
    if (300 <= hh < 350 and p[0] > 200 and ss < 0.78) or p[:3] in ((251, 197, 216), (250, 204, 216), (246, 215, 217), (251, 242, 237), (251, 172, 200), (251, 187, 212)):
        return True                                               # Kirschbluete (nicht das rote Schild)
    if p[:3] in ((226, 132, 182), (244, 164, 204), (255, 206, 228), (176, 84, 128)):
        return True
    if p[:3] in TC_TRUNK and any(a <= x < b for a, b in TC_TREE_ZONES):
        return True
    if TC_LAWN[0] <= x < TC_LAWN[2] and TC_LAWN[1] <= y < TC_LAWN[3] and p[:3] in ((246, 242, 217), (251, 242, 237), (191, 219, 119), (169, 194, 129), (221, 229, 144), (132, 172, 83)):
        return True
    return False


def tc_ist_wasser(p, x, y):
    if y >= 688 or not (p[2] > p[0] + 50 and p[2] > 120):
        return False
    return y >= 592 or (y >= 556 and any(a <= x < b for a, b in TC_GAPS))


def tc_umbau(base, kulisse, wasser, sand, wiese, burg, tribuene, deko):
    W, H = base.size
    im = base.copy()
    bp, kp, px = base.load(), kulisse.load(), im.load()
    maske = [[False] * W for _ in range(TC_GROUND_Y)]
    for y in range(0, TC_GROUND_Y):
        for x in range(W):
            if tc_natur(bp[x, y], x, y):
                px[x, y] = kp[x, y]
                maske[y][x] = True
    for y in range(400, TC_GROUND_Y):          # Sandkuppe des Kugelhangs ragt ueber die Grundlinie
        for x in range(1600, 2040):
            if bp[x, y][:3] in TC_SAND:
                px[x, y] = sand[TC_SAND[bp[x, y][:3]]]
    for y in range(TC_GROUND_Y, H):
        for x in range(W):
            p = bp[x, y]
            if p[:3] in TC_SAND:
                px[x, y] = sand[TC_SAND[p[:3]]]
            elif tc_ist_wasser(p, x, y):
                px[x, y] = wasser(p, x, y)
            elif y >= 688 and p[1] > p[0] + 30 and p[1] > p[2] + 30:
                px[x, y] = wiese(p, x, y)
    for y in range(TC_CASTLE[1], TC_CASTLE[3]):
        for x in range(TC_CASTLE[0], TC_CASTLE[2]):
            if not (y < TC_GROUND_Y and maske[y][x]) and bp[x, y][:3] not in TC_SAND:
                px[x, y] = burg(px[x, y], x, y)
    for y in range(TC_STANDS[1], TC_STANDS[3]):
        for x in range(TC_STANDS[0], TC_STANDS[2]):
            if y < TC_GROUND_Y and not maske[y][x]:
                px[x, y] = tribuene(px[x, y], x, y)
    deko(im, maske)
    return im


def tc_kanten(maske, y0=280):
    """Oberkanten stehengebliebener Bauten: Pixel, ueber denen Kulisse liegt."""
    out = []
    for y in range(max(1, y0), TC_GROUND_Y):
        row, up = maske[y], maske[y - 1]
        for x in range(len(row)):
            if not row[x] and up[x]:
                out.append((x, y))
    return out


def tc_berge(px, W, rnd, base_y, amp, cols, schnee=None, seed=0.0, fr=0.004):
    tops = []
    for x in range(W):
        u = x * fr + seed
        top = int(base_y - amp * (0.55 + 0.25 * math.sin(u) + 0.2 * math.sin(u * 2.7 + 1.3) + 0.12 * math.sin(u * 6.1)))
        tops.append(top)
    for x in range(W):
        top = tops[x]
        lit = tops[min(W - 1, x + 3)] >= tops[max(0, x - 3)]   # Flanke zur Sonne (links) hell
        for y in range(top, TC_GROUND_Y):
            c = cols[0] if lit else cols[1]
            if schnee and y < top + schnee + int(4 * math.sin(x * 0.05)):
                c = (246, 250, 255) if lit else (196, 214, 236)
            px[x, y] = c
    return tops


def tc_kulisse_eis():
    rnd = random.Random(6101)
    W = 2560
    im = Image.new("RGB", (W, TC_GROUND_Y))
    px = im.load()
    d = ImageDraw.Draw(im)
    band_gradient(px, 0, 0, W, 420, [(96, 150, 210), (124, 172, 222), (156, 196, 232), (190, 218, 240), (220, 234, 246)])
    add_glow(px, W, TC_GROUND_Y, 1900, 300, 180, (40, 40, 30), 0.8)
    for _ in range(14):
        wolke(d, rnd.randrange(W), rnd.randint(285, 340), rnd.randint(40, 90), (246, 250, 255), (210, 224, 240))
    tc_berge(px, W, rnd, 420, 110, ((170, 196, 226), (132, 160, 200)), schnee=40, seed=0.4, fr=0.006)
    tc_berge(px, W, rnd, 450, 70, ((120, 150, 190), (92, 120, 166)), schnee=18, seed=2.1, fr=0.011)
    # Gletscherkante + Eisklippen
    for x in range(W):
        top = int(462 + 5 * math.sin(x * 0.03) + 3 * math.sin(x * 0.13))
        for y in range(top, TC_GROUND_Y):
            px[x, y] = (210, 232, 248) if y < top + 2 else (176, 210, 236) if (x // 7 + y // 5) % 5 else (150, 190, 226)
    # verschneite Tannen
    for _ in range(170):
        x, b = rnd.randrange(W), rnd.randint(452, 486)
        hgt = rnd.randint(18, 40)
        for k in range(hgt):
            half = int((k / hgt) * hgt * 0.32)
            y = b - hgt + k
            d.line([x - half, y, x + half, y], fill=(34, 74, 70) if k % 5 else (26, 60, 58))
            if k % 5 == 0:
                d.line([x - half, y, x + half - 1, y], fill=(240, 246, 252))
        d.line([x, b, x, b + 3], fill=(70, 50, 40))
    # Schneefeld
    for y in range(486, TC_GROUND_Y):
        for x in range(W):
            v = (x * 73856093 ^ y * 19349663) & 31
            px[x, y] = (244, 248, 255) if v > 4 else (210, 224, 240) if v > 0 else (255, 255, 255)
    for _ in range(40):                               # Eiskristalle
        x, y = rnd.randrange(W), rnd.randint(470, 512)
        d.polygon([(x, y - 9), (x + 3, y), (x, y + 2), (x - 3, y)], fill=(170, 220, 250))
        d.line([x, y - 8, x, y], fill=(240, 252, 255))
    return im


def tc_eis(base):
    ramp = [(14, 44, 78), (28, 74, 116), (60, 120, 160), (120, 176, 206), (200, 232, 246)]

    def wasser(p, x, y):
        u = (luma(p) - 60) / 180
        q = rampe(ramp, u)
        if (x * 7 + y * 13) % 97 == 0:
            q = (230, 244, 252)
        return q

    def burg(p, x, y):
        if p[0] > p[1] + 40 and p[0] > p[2] + 30:          # rote Daecher/Balken -> Eisblau
            return (clamp(p[0] * 0.35 + 30), clamp(p[0] * 0.65 + 50), clamp(p[0] * 0.9 + 60))
        if sat(p) < 40 and 60 < luma(p) < 200:              # Mauersteine -> Eisquader
            return mix(p, (196, 222, 244), 0.55)
        return p

    def tribuene(p, x, y):
        if p[0] > p[2] + 40 and p[1] > p[2] + 10 and sat(p) < 150 and luma(p) < 190:   # Holz -> Eisbloecke
            return mix(p, (176, 210, 236), 0.6)
        return p

    def deko(im, maske):
        px = im.load()
        for (x, y) in tc_kanten(maske):                     # Schneehauben auf allem, was stehenblieb
            for k in range(2):
                if y + k < TC_GROUND_Y and not maske[y + k][x]:
                    px[x, y + k] = (250, 252, 255) if k == 0 else (214, 230, 246)
        d = ImageDraw.Draw(im)
        for x in range(0, 2560, 7):                          # Eiszapfen unter der Bahnkante
            if any(a <= x < b for a, b in TC_GAPS):
                continue
            ln = 3 + (x * 13) % 7
            d.polygon([(x, 590), (x + 4, 590), (x + 2, 590 + ln)], fill=(214, 238, 252))

    sand = [(186, 210, 228), (214, 232, 244), (236, 246, 252)]
    wiese = lambda p, x, y: (244, 248, 255) if p[1] > 200 else (214, 228, 244) if p[1] > 180 else (186, 206, 230)
    return tc_umbau(base, tc_kulisse_eis(), wasser, sand, wiese, burg, tribuene, deko), wasser


def tc_kulisse_dschungel():
    rnd = random.Random(6202)
    W = 2560
    im = Image.new("RGB", (W, TC_GROUND_Y))
    px = im.load()
    d = ImageDraw.Draw(im)
    band_gradient(px, 0, 0, W, 420, [(150, 196, 170), (176, 210, 168), (208, 222, 160), (232, 226, 156)])
    add_glow(px, W, TC_GROUND_Y, 1300, 330, 260, (40, 36, 10), 0.8)
    # ferne Stufenpyramide im Dunst + Wasserfall-Klippe
    for (cx, base_y, steps, sw) in ((560, 430, 7, 150), (1880, 436, 5, 100)):
        for k in range(steps):
            hw = sw - k * (sw // steps)
            y0 = base_y - (k + 1) * 12
            d.rectangle([cx - hw, y0, cx + hw, y0 + 12], fill=(132, 150, 120))
            d.line([cx - hw, y0, cx + hw, y0], fill=(156, 172, 140))
        d.rectangle([cx - 14, base_y - steps * 12 - 14, cx + 14, base_y - steps * 12], fill=(120, 140, 110))
        d.rectangle([cx - 6, base_y - steps * 12 - 10, cx + 6, base_y - steps * 12], fill=(70, 86, 70))
    for x in range(1100, 1260):
        top = int(330 + 20 * math.sin((x - 1100) / 160 * math.pi * 0.8))
        for y in range(top, TC_GROUND_Y):
            px[x, y] = (88, 100, 80) if (x + y // 3) % 9 else (70, 82, 64)
    for x in range(1160, 1196):
        for y in range(345, TC_GROUND_Y):
            px[x, y] = (226, 244, 246) if (y + x * 3) % 7 else (180, 216, 226)
    # Schichten Dschungelkronen
    for layer, (cols, y_lo, y_hi, rr, n) in enumerate((
        (((70, 122, 86), (58, 104, 74)), 380, 430, (22, 40), 120),
        (((44, 100, 58), (34, 82, 48), (60, 120, 64)), 400, 460, (18, 34), 170),
        (((26, 76, 40), (36, 92, 46), (20, 62, 34)), 430, 490, (14, 28), 220),
    )):
        for _ in range(n):
            x, y, r = rnd.randrange(-20, W + 20), rnd.randint(y_lo, y_hi), rnd.randint(*rr)
            if 1150 < x < 1210 and layer < 2:
                continue
            d.rectangle([x - 2, y, x + 2, TC_GROUND_Y], fill=(60, 44, 32))
            d.ellipse([x - r, y - r * 2 // 3, x + r, y + r * 2 // 3], fill=rnd.choice(cols))
            d.ellipse([x - r // 2, y - r * 2 // 3, x + r // 3, y - r // 4], fill=mix(cols[0], (200, 230, 140), 0.25))
    for x0 in range(30, W, 230):
        palme(px, d, x0 + rnd.randint(-40, 40), 492, rnd.randint(46, 64), blatt=((58, 128, 52), (34, 92, 40)))
    # Waldboden mit Farnen
    for y in range(486, TC_GROUND_Y):
        for x in range(W):
            v = (x * 73856093 ^ y * 19349663) & 15
            px[x, y] = (58, 92, 40) if v > 3 else (44, 74, 32) if v > 0 else (90, 70, 40)
    for _ in range(260):
        x, y = rnd.randrange(W), rnd.randint(488, 514)
        for k in range(5):
            a = math.radians(200 + k * 35)
            d.line([x, y, x + int(math.cos(a) * 7), y + int(math.sin(a) * 5)], fill=rnd.choice([(80, 150, 60), (60, 128, 50)]))
    return im


def tc_dschungel(base):
    ramp = [(14, 50, 44), (24, 84, 70), (40, 120, 96), (90, 170, 140), (190, 230, 210)]

    def wasser(p, x, y):
        q = rampe(ramp, (luma(p) - 60) / 180)
        if (x * 11 + y * 7) % 131 == 0:
            q = (60, 140, 70)          # treibende Seerosenblaetter
        return q

    def burg(p, x, y):
        if p[0] > p[1] + 40 and p[0] > p[2] + 30:          # rote Daecher -> bemoostes Steindach
            return (clamp(p[0] * 0.30 + 40), clamp(p[0] * 0.48 + 40), clamp(p[0] * 0.26 + 30))
        if sat(p) < 40 and 50 < luma(p) < 200:
            k = luma(p) / 255
            return (clamp(150 * k + 20), clamp(160 * k + 20), clamp(118 * k + 10))
        return p

    def tribuene(p, x, y):
        return p

    def deko(im, maske):
        px = im.load()
        rnd = random.Random(6203)
        d = ImageDraw.Draw(im)
        kanten = tc_kanten(maske)
        for (x, y) in kanten:                               # Moos auf den Oberkanten
            if rnd.random() < 0.6:
                px[x, y] = rnd.choice([(70, 130, 50), (90, 150, 60)])
        lianen = [(x, y) for (x, y) in kanten if sat(px[x, y]) < 110]   # nicht ueber die Schilder
        for (x, y) in rnd.sample(lianen, min(len(lianen), 260)):   # Lianen haengen herab
            ln = rnd.randint(6, 26)
            for k in range(ln):
                yy = y + k
                if yy >= 700:
                    break
                xx = x + int(1.5 * math.sin(k * 0.5 + x))
                px[xx, yy] = (46, 110, 46) if k % 4 else (80, 150, 60)
            if rnd.random() < 0.4:
                d.rectangle([x - 1, y + ln - 1, x + 1, y + ln], fill=(230, 80, 120))
        for _ in range(140):                                # Ranken an der Burg
            x, y = rnd.randrange(TC_CASTLE[0], TC_CASTLE[2]), rnd.randrange(330, 520)
            if not maske[min(y, TC_GROUND_Y - 1)][x]:
                ln = rnd.randint(8, 30)
                for k in range(ln):
                    xx, yy = x + int(2 * math.sin(k * 0.4 + x)), y + k
                    if yy < 534 and not (yy < TC_GROUND_Y and maske[yy][xx]):
                        px[xx, yy] = (54, 118, 50) if k % 3 else (84, 150, 62)

    sand = [(98, 72, 46), (122, 92, 58), (144, 112, 72)]
    wiese = lambda p, x, y: (64, 112, 44) if p[1] > 200 else (52, 96, 38) if p[1] > 180 else (40, 80, 30)
    return tc_umbau(base, tc_kulisse_dschungel(), wasser, sand, wiese, burg, tribuene, deko), wasser


TC_FX_EIS = r"""
window.__fx = (ctx, camX) => {
  const t = performance.now() / 1000, W = ctx.canvas.width, H = ctx.canvas.height;
  // Schneefall (Bildschirmraum, leicht gegen die Kamera versetzt)
  for (let i = 0; i < 160; i++) {
    const sp = 30 + (i * 13) % 40, sz = i % 6 === 0 ? 4 : 2;
    const x = ((i * 211 - camX * 1.2 + Math.sin(t + i) * 20) % W + W) % W, y = (i * 97 + t * sp) % H;
    ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.9)' : 'rgba(214,232,250,0.8)';
    ctx.fillRect(Math.round(x), Math.round(y), sz, sz);
  }
};
"""

TC_FX_DSCHUNGEL = r"""
window.__fx = (ctx, camX) => {
  const t = performance.now() / 1000, W = ctx.canvas.width, H = ctx.canvas.height;
  // Papageien ueber den Kronen, Gluehwuermchen und Blaetter im Vordergrund
  for (let k = 0; k < 3; k++) {
    const wx = ((t * (60 + k * 15) + k * 900) % 3000) - 200, wy = 330 + k * 18 + Math.sin(t * 2 + k) * 6;
    const x = (wx - camX) * 2, y = (wy - 300) * 2, f = Math.sin(t * 10 + k) > 0 ? -4 : 2;
    if (x < -20 || x > W + 20) continue;
    ctx.fillStyle = ['#e23b3b', '#3b8ee2', '#f2c23b'][k];
    ctx.fillRect(x, y, 8, 4); ctx.fillRect(x - 8, y + f, 8, 2); ctx.fillRect(x + 6, y + f, 8, 2);
    ctx.fillStyle = '#2e9e44'; ctx.fillRect(x + 8, y, 4, 2);
  }
  for (let i = 0; i < 40; i++) {
    const ph = (t * 0.6 + i * 0.13) % 1;
    const x = ((i * 337 - camX * 2 + Math.sin(t * 0.7 + i) * 30) % W + W) % W, y = 200 + (i * 53) % 220 + Math.cos(t + i) * 10;
    if (ph < 0.5) { ctx.fillStyle = 'rgba(230,255,140,0.85)'; ctx.fillRect(Math.round(x), Math.round(y), 2, 2); }
  }
  ctx.fillStyle = 'rgba(70,140,60,0.9)';
  for (let i = 0; i < 12; i++) {
    const x = ((i * 523 + Math.sin(t + i) * 40 - camX * 2) % W + W) % W, y = (i * 71 + t * (20 + i % 5 * 6)) % H;
    ctx.fillRect(Math.round(x), Math.round(y), 4, 2);
  }
};
"""


def tc_ebene(uri, fn, ab_y):
    im = dec(uri)
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            p = px[x, y]
            if p[3] and p[2] > p[0] + 50 and p[2] > 120:
                px[x, y] = fn(p, x, ab_y + y) + (p[3],)
    return enc(im)


def takeshis_castle():
    s, m, L = lade("takeshis-castle", "burg.html", "L")
    base = dec(L["base"]).convert("RGB")
    for slug, painter, fx, title, h1 in (
        ("eisfestung", tc_eis, TC_FX_EIS, "Takeshi's Castle Eisfestung", "Takeshi's Castle: Eisfestung im Gletschertal"),
        ("dschungel", tc_dschungel, TC_FX_DSCHUNGEL, "Takeshi's Castle Dschungeltempel", "Takeshi's Castle: Tempelruine im Dschungel"),
    ):
        im, wasser = painter(base)
        if os.environ.get("SZENEN_DEBUG"):
            im.save(os.path.join(os.environ["SZENEN_DEBUG"], f"takeshis-castle-{slug}-bg.png"))
        L2 = json.loads(json.dumps(L))
        L2["base"] = enc(im)
        L2["water"]["src"] = tc_ebene(L["water"]["src"], lambda p, x, y: wasser(p, x, max(y, 600)), L["water"]["y"])
        L2["splash"]["src"] = tc_ebene(L["splash"]["src"], lambda p, x, y: wasser(p, 0, 600), 0)
        out = ersetze_json(s, m, L2)
        schreibe("takeshis-castle", slug, out, title, h1, None,
                 "ctx.drawImage(IM.base, camX, VY0, VW, VH, 0, 0, VW * S, VH * S);", "if (window.__fx) window.__fx(ctx, camX);", fx)


ALLE = {"tennis": tennis, "climbing": climbing, "speed-schach": speed_schach, "takeshis-castle": takeshis_castle}

if __name__ == "__main__":
    ziele = sys.argv[1:] or list(ALLE)
    for z in ziele:
        ALLE[z]()
