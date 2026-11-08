#!/usr/bin/env python3
"""PIXELLAB-REQUISITEN (Kulissen-Nachlese 08.11.): die Spielobjekte, die der Motor direkt auf die
Kulisse zeichnet, kommen nicht mehr aus OpenGameArt/LPC, sondern aus PixelLab.

Chris: "ja auch auf die besseren PixelLabs umstellen!" — Spurt-Stationen, Takeshi-Fallen und
Burgteile, Basketball-Korb und -Ball, Football-Ball und -Helme, Schachfiguren.

GRUNDSATZ: reiner Asset-Tausch. Jede neue Datei hat exakt die Pixelmasse der alten, und der Inhalt
sitzt in derselben Box (Alpha-Begrenzung der alten Datei innerhalb des Ausschnitts, den der Motor
liest). Der Motor zeichnet viele Kacheln mit naturalWidth/naturalHeight oder mit festen
Quell-Ausschnitten (falle_spitzen 0/96 32x32, falle_strickleiter 8/0 24x64, deko_banner 0/0 96x80,
burg_mauer k*40/8 36x56, hind_feuer fr*32, Schach SCHACH_IDX*48) — all das bleibt gueltig, ohne dass
eine Zeile im Motor sich aendert.

Ablauf (drei Schritte, nur der erste braucht die API):

  python3 -I scripts/pixellab-requisiten.py bestellen <name> [--seed N] [--kandidaten DIR]
      PixelLab /generate-image-v2 in der Zielgroesse; alle Kandidaten (4..64 je Auftrag) und ein
      Kontaktbogen landen in DIR (Default /tmp/pixellab-kandidaten/<name>/).
  python3 -I scripts/pixellab-requisiten.py waehlen <name> <index> [--kandidaten DIR]
      kopiert den gewaehlten Kandidaten nach data/generated/pixellab-requisiten/roh/<name>.png und
      vermerkt Prompt, Saat und Index in .../auswahl.json.
  python3 -I scripts/pixellab-requisiten.py einsetzen [<name> ...]
      baut aus roh/ die Dateien unter public/sprites/ — deterministisch, ohne Netz.

Herkunft je Datei: public/sprites/<ordner>/quellen.json (Eintrag "paket": "PixelLab").
"""
import argparse
import json
import os
import shutil
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROH = os.path.join(WURZEL, "data/generated/pixellab-requisiten/roh")
AUSWAHL = os.path.join(WURZEL, "data/generated/pixellab-requisiten/auswahl.json")
SPRITES = os.path.join(WURZEL, "public/sprites")

STIL = "pixel art game asset, 16-bit RPG style, clean single color dark outline"
DRAUF = "3/4 top-down view as in a classic top-down RPG"

# name -> Auftrag. datei: Ziel unter public/sprites. bereich: Ausschnitt (x,y,w,h), den der Motor
# liest (Default: ganze Datei). gen: Erzeugungsgroesse. anker: wie der Inhalt in der Box sitzt.
# "art": Sonderbau (s. einsetzen()).
AUFTRAEGE = {
    # --- Spurt-Stationen (BAHN_ART.spurt.hindernisBilder, Unterkante auf der Fusslinie) ---
    "hind_huerde": dict(datei="arena/hind_huerde.png", gen=(32, 24),
        prompt=f"athletics track hurdle seen from the front, wide white crossbar with red stripes on two dark metal legs with feet, front view, {STIL}"),
    "hind_balken": dict(datei="arena/hind_balken.png", gen=(64, 16),
        prompt=f"long narrow wooden balance beam plank lying horizontally, wood grain, {DRAUF}, {STIL}"),
    "hind_wand": dict(datei="arena/hind_wand.png", gen=(32, 64),
        prompt=f"tall wooden palisade wall of sharpened vertical logs, obstacle course wall, front view, {STIL}"),
    "hind_seil": dict(datei="arena/hind_seil.png", gen=(64, 32),
        prompt=f"two wooden posts with a thick hemp rope hanging in a curve between them, obstacle course rope, side view, {STIL}"),
    "hind_wasser": dict(art="wasser", gen=(64, 32),
        prompt=f"small rectangular water pit dug into the ground, blue water with muddy dirt banks, top-down view, {STIL}"),
    "hind_mauer": dict(datei="arena/hind_mauer.png", gen=(40, 32),
        prompt=f"low rough fieldstone wall segment, grey stones with mortar, {DRAUF}, {STIL}"),
    "hind_heu": dict(datei="arena/hind_heu.png", gen=(64, 32),
        prompt=f"rectangular golden straw hay bale lying horizontally, tied with twine, {DRAUF}, {STIL}"),
    "hind_feuer": dict(art="feuer", gen=(32, 32),
        prompt=f"small campfire, crossed logs with bright orange flames, {DRAUF}, {STIL}"),

    # --- Takeshi's Castle: Fallen ---
    "falle_tuer": dict(datei="arena/falle_tuer.png", gen=(32, 32),
        prompt=f"freestanding wooden door in a simple frame, vertical planks, iron hinges, front view, {STIL}"),
    "falle_strickleiter": dict(datei="arena/falle_strickleiter.png", bereich=(8, 0, 24, 64), gen=(24, 64),
        prompt=f"hanging rope ladder with wooden rungs, front view, {STIL}"),
    "falle_spitzen": dict(datei="arena/falle_spitzen.png", bereich=(0, 96, 32, 32), gen=(32, 32),
        prompt=f"wooden cheval de frise, crossed sharpened stakes barricade, {DRAUF}, {STIL}"),
    "falle_walze": dict(datei="arena/falle_walze.png", gen=(24, 16),
        prompt=f"wooden log lying horizontally from left to right, bark texture, round cut ends visible on both sides, side view, {STIL}"),
    "deko_rad": dict(datei="arena/deko_rad.png", gen=(32, 32), anker="mitte",
        prompt=f"wooden wagon wheel with spokes and iron rim, perfectly round, front view, {STIL}"),
    "falle_fass": dict(datei="arena/falle_fass.png", gen=(32, 64),
        prompt=f"wooden barrel standing upright with iron bands, {DRAUF}, {STIL}"),
    # --- Takeshi's Castle: Burg ---
    "burg_mauer": dict(art="mauer", datei="arena/burg_mauer.png", gen=(160, 64),
        prompt=f"straight section of a solid light grey stone brick castle curtain wall with square battlements along the top, front view, the wall runs across the full width and is cut off at the left and right edges, {STIL}"),
    "burg_turm": dict(datei="arena/burg_turm.png", gen=(72, 144),
        prompt=f"medieval round stone castle tower with crenellated top and an arched gateway at the bottom, front view, {STIL}"),
    "burg_tor": dict(datei="arena/burg_tor.png", gen=(88, 144),
        prompt=f"medieval stone castle gatehouse with two arched gate openings and crenellated top, front view, {STIL}"),
    "deko_banner": dict(datei="arena/deko_banner.png", bereich=(0, 0, 96, 80), gen=(96, 80),
        prompt=f"two wooden poles with red heraldic banners hanging between them, front view, {STIL}"),
    "deko_pranger": dict(datei="arena/deko_pranger.png", gen=(56, 76),
        prompt=f"medieval wooden pillory on a post, front view, {STIL}"),
    "deko_stock": dict(datei="arena/deko_stock.png", gen=(58, 30),
        prompt=f"medieval wooden foot stocks with leg holes, {DRAUF}, {STIL}"),
    "deko_holz": dict(datei="arena/deko_holz.png", gen=(62, 63),
        prompt=f"neat stack of chopped firewood logs, {DRAUF}, {STIL}"),
    "zaun_holz": dict(datei="arena/zaun_holz.png", gen=(32, 32),
        prompt=f"short wooden fence segment, two posts and two horizontal rails, {DRAUF}, {STIL}"),
    "baum_1": dict(datei="arena/baum_1.png", gen=(36, 62), prompt=f"tall dark green conifer pine tree, {DRAUF}, {STIL}"),
    "baum_2": dict(datei="arena/baum_2.png", gen=(32, 60), prompt=f"slim green spruce tree, {DRAUF}, {STIL}"),
    "baum_3": dict(datei="arena/baum_3.png", gen=(30, 59), prompt=f"narrow green fir tree, {DRAUF}, {STIL}"),
    "baum_4": dict(datei="arena/baum_4.png", gen=(30, 42), prompt=f"small young pine tree, {DRAUF}, {STIL}"),

    # --- Basketball ---
    "korb_topdown": dict(art="korb", datei="basketball/korb_topdown.png", gen=(36, 28),
        prompt=f"basketball hoop seen from directly above: white backboard as a horizontal bar at the top, orange rim ring with white net below it, top-down view, {STIL}"),
    "ball": dict(datei="basketball/ball.png", gen=(32, 32), anker="mitte",
        prompt=f"orange basketball with black seams, round, {STIL}"),
    # --- Football ---
    "ball_football": dict(datei="football/ball_football.png", gen=(16, 16), anker="mitte",
        prompt=f"brown american football with white laces, oval, {STIL}"),
    "helmet_white1": dict(datei="football/helmet_white1.png", gen=(19, 19), anker="mitte",
        prompt=f"white american football helmet with blue stripe and face mask, side view, {STIL}"),
    "helmet_white2": dict(datei="football/helmet_white2.png", gen=(21, 19), anker="mitte",
        prompt=f"white american football helmet with blue stripe and face mask, three-quarter view, {STIL}"),
    "helmet_white3": dict(datei="football/helmet_white3.png", gen=(26, 22), anker="mitte",
        prompt=f"white american football helmet with blue stripe and grey face mask, front three-quarter view, {STIL}"),
    # --- Speed-Schach: sechs Figuren in einer Reihe, damit sie aus einem Guss sind ---
    "schach": dict(art="schach", gen=(288, 48),
        prompt=f"row of six ivory white chess pieces side by side, evenly spaced, from left to right: small round pawn, castle tower rook, horse head knight, bishop with pointed mitre, queen with a spiked crown, tallest king with a cross on top, front view, {STIL}"),

    # --- Takeshi's Castle: Kulissen-QS 08.11. (Rahmen statt Material, Rang 1). Drei NEUE
    # Requisiten (kein Sprite-Tausch wie oben, art="neu": kein altes Format zu treffen,
    # Ziel ist die eigene gen-Box) fuer die Draufsicht-Route: ein Torii am Routenanfang,
    # Kirschbaeume entlang des Wegs, Tribuenenbloecke an zwei, drei Stellen. Alle drei im
    # selben DRAUF-Stil wie baum_1..4/zaun_holz, damit die Karte EINE Perspektive haelt
    # (docs/design/kulissen-qualitaets-audit-08-11.md Abschnitt 4.1: "Perspektive
    # vereinheitlichen" -- gewaehlter Weg: 3/4-Sicht durchhalten, nicht die Fallen-
    # Piktogramme auf strenge Draufsicht umstellen, s. Batch-13-Notiz).
    "takeshi_torii": dict(art="neu", datei="arena/takeshi_torii.png", gen=(84, 64),
        prompt=f"a wooden red japanese torii shrine gate, two upright pillars and a curved crossbeam on top, standalone, {DRAUF}, {STIL}"),
    "takeshi_kirschbaum": dict(art="neu", datei="arena/takeshi_kirschbaum.png", gen=(40, 58),
        prompt=f"blooming japanese cherry blossom tree with a round pink and white flower crown, {DRAUF}, {STIL}"),
    "takeshi_tribuene": dict(art="neu", datei="arena/takeshi_tribuene.png", gen=(72, 46),
        prompt=f"small wooden spectator grandstand bleacher stand full of tiny cheering fans in colourful clothes, {DRAUF}, {STIL}"),
}

# Alpha-Begrenzung der ALTEN LPC/Kenney-Datei innerhalb des gelesenen Ausschnitts (gemessen am 08.11.
# vor dem Tausch). Fest eingetragen, damit ein zweiter Lauf von `einsetzen` nicht die neue Datei
# vermisst und die Box wandert. In diese Box wird der PixelLab-Inhalt gesetzt.
ALTE_BOX = {
    'hind_huerde': (0, 3, 32, 26), 'hind_balken': (0, 0, 64, 10), 'hind_wand': (0, 0, 32, 64),
    'hind_seil': (12, 0, 64, 32), 'hind_mauer': (0, 3, 40, 27), 'hind_heu': (4, 2, 56, 30),
    'hind_wasser': (9, 0, 58, 32),  # l (9..32) + r (0..26) nebeneinander
    'falle_tuer': (0, 32, 32, 64), 'falle_strickleiter': (4, 0, 24, 64), 'falle_spitzen': (0, 0, 32, 32),
    'falle_walze': (5, 8, 28, 22), 'deko_rad': (0, 0, 32, 32), 'falle_fass': (3, 6, 28, 59),
    'burg_mauer': (0, 0, 160, 64), 'burg_turm': (14, 11, 83, 150), 'burg_tor': (9, 5, 96, 150),
    'deko_banner': (0, 2, 96, 73), 'deko_pranger': (5, 7, 61, 82), 'deko_stock': (5, 0, 63, 30),
    'deko_holz': (2, 1, 64, 64), 'zaun_holz': (0, 1, 32, 26), 'baum_1': (0, 0, 36, 62),
    'baum_2': (0, 0, 32, 60), 'baum_3': (0, 0, 30, 59), 'baum_4': (0, 0, 30, 42),
    'korb_topdown': (14, 0, 50, 27), 'ball': (0, 0, 32, 32), 'ball_football': (0, 0, 14, 16),
    'helmet_white1': (0, 0, 19, 19), 'helmet_white2': (0, 0, 21, 19), 'helmet_white3': (0, 0, 26, 22),
}


# ------------------------------------------------------------------ Bestellen / Waehlen
def kand_dir(args, name):
    return os.path.join(args.kandidaten or "/tmp/pixellab-kandidaten", name)


def bestellen(args):
    from pixellab_api import api, warte_job, bild_aus
    for name in args.namen:
        a = AUFTRAEGE[name]
        w, h = a["gen"]
        prompt = args.prompt or a["prompt"]
        body = {"description": prompt, "image_size": {"width": w, "height": h}, "no_background": True,
                "seed": args.seed}
        r = api("POST", "/generate-image-v2", body)
        j = warte_job(r["background_job_id"])
        ims = [bild_aus(x) for x in j["last_response"]["images"]]
        d = kand_dir(args, name)
        os.makedirs(d, exist_ok=True)
        for i, im in enumerate(ims):
            im.save(os.path.join(d, f"{i:02d}.png"))
        json.dump({"prompt": prompt, "seed": args.seed, "gen": [w, h], "job": r["background_job_id"]},
                  open(os.path.join(d, "auftrag.json"), "w"), indent=1)
        kontaktbogen(ims, os.path.join(d, "bogen.png"))
        print(f"{name}: {len(ims)} Kandidaten -> {d}/bogen.png")


def kontaktbogen(ims, ziel):
    from PIL import ImageDraw
    w = max(i.width for i in ims)
    h = max(i.height for i in ims)
    sc = max(1, min(4, 160 // max(w, h)))
    n = len(ims)
    sp = min(n, 8 if w * sc < 200 else 4)
    zl = (n + sp - 1) // sp
    cw, ch = w * sc + 6, h * sc + 16
    bogen = Image.new("RGBA", (sp * cw, zl * ch), (70, 96, 70, 255))
    dr = ImageDraw.Draw(bogen)
    for k, im in enumerate(ims):
        x, y = (k % sp) * cw, (k // sp) * ch
        for yy in range(0, h * sc, 8):
            for xx in range(0, w * sc, 8):
                if (xx // 8 + yy // 8) % 2:
                    dr.rectangle([x + 3 + xx, y + 14 + yy, x + 3 + xx + 7, y + 14 + yy + 7], fill=(84, 112, 84, 255))
        bogen.alpha_composite(im.resize((im.width * sc, im.height * sc), Image.NEAREST), (x + 3, y + 14))
        dr.text((x + 3, y + 1), str(k), fill=(255, 255, 255, 255))
    bogen.save(ziel)


def waehlen(args):
    name, idx = args.namen[0], int(args.namen[1])
    d = kand_dir(args, name)
    auftrag = json.load(open(os.path.join(d, "auftrag.json")))
    os.makedirs(ROH, exist_ok=True)
    shutil.copy(os.path.join(d, f"{idx:02d}.png"), os.path.join(ROH, f"{name}.png"))
    aw = json.load(open(AUSWAHL)) if os.path.exists(AUSWAHL) else {}
    aw[name] = dict(auftrag, kandidat=idx, endpunkt="/v2/generate-image-v2")
    json.dump(dict(sorted(aw.items())), open(AUSWAHL, "w"), indent=1, ensure_ascii=False)
    print(f"{name}: Kandidat {idx} -> roh/{name}.png")


# ------------------------------------------------------------------ Einsetzen
def zuschnitt(im):
    """Auf die Alpha-Begrenzung beschneiden; Halbtransparenz (Kanten der Freistellung) haerten."""
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a >= 128 else 0)
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def einpassen(inhalt, bw, bh):
    """Inhalt in eine Box bw x bh: verkleinern, wenn er nicht passt; vergroessern nur um ganze
    Faktoren (Pixelraster bleibt), sonst unveraendert."""
    w, h = inhalt.size
    if w > bw or h > bh:
        f = min(bw / w, bh / h)
        return inhalt.resize((max(1, round(w * f)), max(1, round(h * f))), Image.NEAREST)
    k = min(bw // w, bh // h)
    if k >= 2:
        return inhalt.resize((w * k, h * k), Image.NEAREST)
    # fast passend (>= 85 % je Achse) bleibt pixelgenau, sonst sanft auf die Box ziehen
    if w >= 0.85 * bw or h >= 0.85 * bh:
        return inhalt
    f = min(bw / w, bh / h)
    return inhalt.resize((round(w * f), round(h * f)), Image.NEAREST)


def setze(name, a, canvas, quelle):
    W, H = canvas.size
    bereich = a.get("bereich", (0, 0, W, H))
    bx0, by0, bx1, by1 = ALTE_BOX[name]
    bw, bh = bx1 - bx0, by1 - by0
    inh = einpassen(zuschnitt(quelle), bw, bh)
    ox = bereich[0] + bx0 + (bw - inh.width) // 2
    if a.get("anker") == "mitte":
        oy = bereich[1] + by0 + (bh - inh.height) // 2
    else:
        oy = bereich[1] + by1 - inh.height
    # alter Inhalt im gelesenen Ausschnitt wird geloescht, der Rest der Datei bleibt leer
    canvas.alpha_composite(inh, (ox, oy))
    return canvas


def roh(name):
    p = os.path.join(ROH, f"{name}.png")
    if not os.path.exists(p):
        return None
    return Image.open(p).convert("RGBA")


def baue_standard(name, a):
    q = roh(name)
    if q is None:
        return False
    alt = Image.open(os.path.join(SPRITES, a["datei"]))
    neu = Image.new("RGBA", alt.size, (0, 0, 0, 0))
    setze(name, a, neu, q)
    neu.save(os.path.join(SPRITES, a["datei"]))
    return True


def baue_wasser(name, a):
    """Der Motor setzt hind_wasser_l bei x-32 und hind_wasser_r bei x: beide zusammen sind ein
    64x32-Feld. Der Graben sitzt in derselben Box wie der alte (ALTE_BOX, ueber beide Haelften)."""
    q = roh(name)
    if q is None:
        return False
    voll = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    bx0, by0, bx1, by1 = ALTE_BOX[name]
    # Wie die alten LPC-Kacheln: Ufer nur links und rechts, oben und unten offen. Der Motor setzt
    # das Feld in jede Bahn, uebereinander ergibt das einen durchgehenden Graben quer ueber alle
    # Bahnen statt einzelner Becken. Genommen wird ein waagerechtes Band aus der Mitte des Beckens
    # (Wasser mit Seitenufern), gespiegelt senkrecht gekachelt -> oben und unten nahtlos.
    roh_ = zuschnitt(q)
    roh_ = roh_.resize((bx1 - bx0, roh_.height), Image.NEAREST)
    y0, y1 = round(roh_.height * 0.38), round(roh_.height * 0.62)
    band = roh_.crop((0, y0, roh_.width, y1))
    paar = Image.new("RGBA", (band.width, band.height * 2))
    paar.paste(band, (0, 0))
    paar.paste(band.transpose(Image.FLIP_TOP_BOTTOM), (0, band.height))
    inh = Image.new("RGBA", (band.width, by1 - by0))
    # Wasserflaeche: die nahtlose PixelLab-Seekachel (dieselbe wie boden_see in Takeshi), die
    # Ufer (je 6 Spalten) aus dem Band des Beckens.
    see = Image.open(os.path.join(WURZEL, "data/generated/pixellab-boden/c/tile_15.png")).convert("RGBA")
    for x in range(0, inh.width, 32):
        for y in range(0, inh.height, 32):
            inh.paste(see, (x, y))
    ufer = Image.new("RGBA", (band.width, inh.height))
    for y in range(0, inh.height, paar.height):
        ufer.paste(paar, (0, y))
    inh.paste(ufer.crop((0, 0, 6, inh.height)), (0, 0))
    inh.paste(ufer.crop((band.width - 6, 0, band.width, inh.height)), (band.width - 6, 0))
    voll.alpha_composite(inh, (bx0, by0))
    voll.crop((0, 0, 32, 32)).save(os.path.join(SPRITES, "arena/hind_wasser_l.png"))
    voll.crop((32, 0, 64, 32)).save(os.path.join(SPRITES, "arena/hind_wasser_r.png"))
    return True


def baue_feuer(name, a):
    """Fuenf Bilder zu 32x32 nebeneinander (Motor: fr=floor(rennT*8)%5). roh/hind_feuer_<k>.png
    sind die Bilder einer PixelLab-Animation (/animate-with-text-v3) des gewaehlten Feuers."""
    bilder = [roh(f"hind_feuer_{k}") for k in range(5)]
    if any(b is None for b in bilder):
        return False
    blatt = Image.new("RGBA", (160, 32), (0, 0, 0, 0))
    # gemeinsame Box ueber alle Bilder, damit das Feuer nicht springt
    boxen = [b.split()[3].point(lambda v: 255 if v >= 128 else 0).getbbox() for b in bilder]
    x0 = min(b[0] for b in boxen); y0 = min(b[1] for b in boxen)
    x1 = max(b[2] for b in boxen); y1 = max(b[3] for b in boxen)
    w, h = x1 - x0, y1 - y0
    f = min(1.0, 32 / w, 32 / h)
    for k, b in enumerate(bilder):
        t = b.copy()
        px = t.load()
        for yy in range(t.height):
            for xx in range(t.width):
                r, g, bl, al = px[xx, yy]
                px[xx, yy] = (r, g, bl, 255 if al >= 128 else 0)
        t = t.crop((x0, y0, x1, y1))
        if f < 1:
            t = t.resize((max(1, round(w * f)), max(1, round(h * f))), Image.NEAREST)
        blatt.alpha_composite(t, (k * 32 + (32 - t.width) // 2, 32 - t.height))
    blatt.save(os.path.join(SPRITES, "arena/hind_feuer.png"))
    return True


def baue_mauer(name, a):
    """160x64 (der Motor kachelt sie waagerecht mit naturalWidth). Ist das Rohbild breiter, wird der
    160er-Ausschnitt gesucht, dessen linke und rechte Randspalte am besten zueinander passen; ein
    160er-Rohbild (Zinnen im gleichmaessigen Raster, Mauer laeuft an beiden Raendern aus dem Bild)
    wird unveraendert genommen."""
    q = roh(name)
    if q is None:
        return False
    q = q.convert("RGBA")
    if q.height != 64:
        q = q.resize((round(q.width * 64 / q.height), 64), Image.NEAREST)
    px = q.load()

    def spalte_diff(xa, xb):
        s = 0
        for y in range(64):
            pa, pb = px[xa, y], px[xb, y]
            s += sum(abs(pa[i] - pb[i]) for i in range(4))
        return s
    best = (0, 0)
    for x0 in range(0, q.width - 161):
        d = spalte_diff(x0, x0 + 160) + spalte_diff(x0 + 1, x0 + 161)
        if best is None or d < best[0]:
            best = (d, x0)
    x0 = best[1]
    neu = q.crop((x0, 0, x0 + 160, 64))
    neu.save(os.path.join(SPRITES, a["datei"]))
    return True


SCHACH = ["bauer", "turm", "springer", "laeufer", "dame", "koenig"]


def baue_schach(name, a):
    """Sechs Figuren (Reihenfolge SCHACH_IDX p/r/n/b/q/k = Bauer/Turm/Springer/Laeufer/Dame/Koenig),
    je Zelle 48x48 unten buendig zentriert, Zeile 0 und (unbenutzt) Zeile 1 gleich.
    Rohbilder roh/schach_<figur>.png: Bauer bis Laeufer aus EINEM Reihenbild (gleicher Massstab),
    Dame und Koenig einzeln mit dem Reihenbild als Stilvorlage (in der Reihe waren sie oben
    abgeschnitten). Ein gemeinsamer Massstab haelt die Groessenfolge (Koenig am hoechsten).
    Schwarz ist dieselbe Zeichnung, die helle Fuellung abgedunkelt — wie beim alten Schnitt
    (buehne-schach-assets-schneiden.mjs)."""
    figs = [roh(f"schach_{f}") for f in SCHACH]
    if any(f is None for f in figs):
        return False
    figs = [zuschnitt(f) for f in figs]
    f = min(1.0, 45 / max(x.height for x in figs), 46 / max(x.width for x in figs))
    weiss = Image.new("RGBA", (288, 96), (0, 0, 0, 0))
    for k, fig in enumerate(figs):
        if f < 1:
            fig = fig.resize((max(1, round(fig.width * f)), max(1, round(fig.height * f))), Image.NEAREST)
        for zeile in (0, 1):
            weiss.alpha_composite(fig, (k * 48 + (48 - fig.width) // 2, zeile * 48 + 47 - fig.height))
    weiss.save(os.path.join(SPRITES, "buehne/schach_weiss.png"))
    schwarz = weiss.copy()
    px = schwarz.load()
    for y in range(96):
        for x in range(288):
            r, g, b, al = px[x, y]
            if al:
                l = (r * 299 + g * 587 + b * 114) / 1000
                if l > 70:  # Fuellung und Glanz ebenholzfarben, Umriss bleibt
                    t = (l - 70) / 185
                    px[x, y] = (int(44 + 50 * t), int(38 + 40 * t), int(34 + 32 * t), al)
    schwarz.save(os.path.join(SPRITES, "buehne/schach_schwarz.png"))
    return True


def baue_korb(name, a):
    """Der Ballflug zielt auf korbX, und das Sprite haengt mit drawImage(...,-28,-20,56,56) daran:
    massgeblich ist deshalb, wo der RING im Bild sitzt, nicht die Box. Der Ringmittelpunkt (orange
    Pixel) wird pixelgenau auf den des alten Kenney-Korbs gelegt (31,6 / 13,4 im 64er-Bild),
    ohne Skalierung; was oben ueber den Rand ragt (Oberkante des Bretts), faellt weg."""
    q = roh(name)
    if q is None:
        return False
    q = zuschnitt(q)
    px = q.load()
    pts = [(x, y) for y in range(q.height) for x in range(q.width)
           if px[x, y][3] and px[x, y][0] > 180 and 60 < px[x, y][1] < 170 and px[x, y][2] < 90]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    neu = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    neu.alpha_composite(q, (round(31.6 - cx), round(13.4 - cy)))  # alpha_composite schneidet am Rand
    neu.save(os.path.join(SPRITES, a["datei"]))
    return True


def baue_neu(name, a):
    """Brandneue Requisiten ohne Vorgaenger-Datei (kein ALTE_BOX-Eintrag noetig): der Rohkandidat
    wird auf seine Alpha-Begrenzung beschnitten, in die eigene gen-Box eingepasst und mittig
    (anker="mitte") oder unten buendig (Default, wie baum_1..4/zaun_holz) auf eine neue,
    transparente Leinwand genau dieser Box gesetzt."""
    q = roh(name)
    if q is None:
        return False
    bw, bh = a["gen"]
    inh = einpassen(zuschnitt(q), bw, bh)
    neu = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ox = (bw - inh.width) // 2
    oy = (bh - inh.height) // 2 if a.get("anker") == "mitte" else bh - inh.height
    neu.alpha_composite(inh, (ox, oy))
    os.makedirs(os.path.join(SPRITES, os.path.dirname(a["datei"])), exist_ok=True)
    neu.save(os.path.join(SPRITES, a["datei"]))
    return True


BAUER = {"korb": baue_korb, "wasser": baue_wasser, "feuer": baue_feuer, "mauer": baue_mauer, "schach": baue_schach,
         "neu": baue_neu}


def einsetzen(args):
    namen = args.namen or list(AUFTRAEGE)
    for name in namen:
        a = AUFTRAEGE[name]
        ok = BAUER.get(a.get("art"), baue_standard)(name, a)
        print(f"{name}: {'gesetzt' if ok else 'kein Rohbild, bleibt alt'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("befehl", choices=["bestellen", "waehlen", "einsetzen"])
    ap.add_argument("namen", nargs="*")
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--prompt")
    ap.add_argument("--kandidaten")
    args = ap.parse_args()
    {"bestellen": bestellen, "waehlen": waehlen, "einsetzen": einsetzen}[args.befehl](args)


if __name__ == "__main__":
    main()
