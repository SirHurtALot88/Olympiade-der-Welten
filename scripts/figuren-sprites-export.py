#!/usr/bin/env python3
"""
Exportiert die PixelLab-Spielfiguren (Live-API) ins Spiel.

    PIXELLAB_API_KEY=... python3 -I scripts/figuren-sprites-export.py [--cache <ordner>]

Ergebnis:
  public/sprites/figuren/<slug>/{south,east,west,north}.png        Grundposen
  public/sprites/figuren/<slug>/<name>-{south,east}.png             je Animation ein Streifen
  data/generated/figuren-sprites.json                               Index fuer lib/data/figurenSprites.ts
  data/generated/figuren-sprites-animationsarten.json               animation_group_id -> Art (bleibt stabil)

Zuordnung Figur -> Spieler: ein Tag der Figur ist der Namens-Slug der Spieler-ID
(`player-0001-umbros` -> Tag `umbros`, so legt der PixelLab-Kanon die Figuren an). Figuren mit
`superseded` im Tag sind ersetzt und werden ausgelassen. Ohne passenden Tag zaehlt der Name
(vor dem ersten Komma). Bei mehreren Figuren je Slug gewinnt: getaggt > mehr Animationen > neuer.

Animationsart (walk/angriff/tod/treffer): PixelLab kennt nur den auf ~37 Zeichen gekuerzten
Aktionstext als Label. Reihenfolge: (1) gespeicherte Art aus der Arten-Datei, (2) Schluesselwoerter
im Label, (3) Bildanalyse des Sued-Streifens (letztes Bild deutlich flacher = K.o., stark
wechselnde Breite = Aktion, sonst Gehen). Alles, was nicht aus (1) kommt, ist eine Schaetzung und
wird so im Index markiert (`quelle`). Wer eine Art korrigiert, traegt sie in die Arten-Datei ein.

PNGs werden verlustfrei auf eine Palette reduziert, wenn sie <= 256 Farben haben (halbiert die Groesse).
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "sprites", "figuren")
INDEX = os.path.join(ROOT, "data", "generated", "figuren-sprites.json")
ARTEN = os.path.join(ROOT, "data", "generated", "figuren-sprites-animationsarten.json")
PORTRAIT_MAP = os.path.join(ROOT, "data", "generated", "player-portrait-map.json")
API = "https://api.pixellab.ai/v2"
ROTS = ["south", "east", "west", "north"]
ANIM_DIRS = ["south", "east"]

WALK = ["walks", "walk ", "waddle", "strides", "stride ", "inches forward", "glides", "glide ", "marches",
        "crawls", "slithers", "hops forward", "moves forward", "steps forward", "trudges", "lumbers",
        "shuffles", "floats forward", "drifts forward", "rolls forward", "skitters", "prowls",
        "stomps forward", "gallops", "trots", "limps", "sways forward", "paces", "strolls", "ambles",
        "creeps forward", "stalks forward", "hurries forward", "skates forward"]
DEATH = ["dies", "death", "dying", "collapse", "crumple", "struck down", "fatally", "slump", "crumble",
         "falls backward", "falls back", "falls to", "falls down", "falls over", "topple", "keels",
         "dissolves", "shatters", "fades away", "goes limp", "lifeless", "perish", "swallow", "closes over",
         "defeated", "expires", "withers", "wilts", "disintegrat", "sinks to", "drops dead", "knocked out",
         "crashes to", "stumbles and", "stumbles backward", "staggers on", "curls into", "curls up", "shudders"]
RECOIL = ["recoil", "flinch", "reels back", "is hit", "takes a hit"]


def api_get(path, key):
    req = urllib.request.Request(API + path, headers={"Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read())


def list_characters(key):
    out, offset = [], 0
    while True:
        chars = api_get(f"/characters?limit=100&offset={offset}", key).get("characters", [])
        if not chars:
            return out
        out.extend(chars)
        offset += 100


def label_kind(label):
    t = label[7:] if label.startswith("custom-") else label
    t = t.lower()
    if any(k in t for k in RECOIL):
        return "treffer"
    if any(k in t for k in DEATH):
        return "tod"
    if any(k in t for k in WALK):
        return "walk"
    return None


def frame_kind(frames):
    hs, ws = [], []
    for im in frames:
        b = im.getchannel("A").point(lambda a: 255 if a > 20 else 0).getbbox()
        hs.append(b[3] - b[1] if b else 0)
        ws.append(b[2] - b[0] if b else 0)
    if not hs or max(hs) == 0:
        return "angriff"
    if hs[-1] < 0.68 * max(hs[0], 1):
        return "tod"
    nonzero = [w for w in ws if w > 0] or [1]
    if max(ws) > 1.35 * min(nonzero):
        return "angriff"
    return "walk"


def palettize(path):
    im = Image.open(path).convert("RGBA")
    cols = im.getcolors(256)
    if cols is None:
        return
    colors = [c for _, c in cols]
    lut = {c: i for i, c in enumerate(colors)}
    pal = Image.new("P", im.size)
    pal.putdata([lut[px] for px in im.getdata()])
    flat = [v for c in colors for v in c[:3]]
    pal.putpalette(flat + [0] * (768 - len(flat)))
    alpha = bytes(c[3] for c in colors)
    tmp = path + ".tmp.png"
    pal.save(tmp, optimize=True, transparency=alpha)
    if list(Image.open(tmp).convert("RGBA").getdata()) == list(im.getdata()) and os.path.getsize(tmp) < os.path.getsize(path):
        os.replace(tmp, path)
    else:
        os.remove(tmp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=os.path.join(ROOT, ".figuren-cache"), help="Download-Zwischenspeicher")
    args = ap.parse_args()
    key = os.environ.get("PIXELLAB_API_KEY")
    if not key:
        sys.exit("PIXELLAB_API_KEY fehlt.")
    os.makedirs(args.cache, exist_ok=True)

    def fetch(url):
        name = url.split("/pixellab-characters/")[-1].split("?")[0].replace("/", "_")
        p = os.path.join(args.cache, name)
        if os.path.exists(p) and os.path.getsize(p) > 0:
            return p
        last = None
        for i in range(5):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "oly-figuren-export"}), timeout=40) as r:
                    data = r.read()
                with open(p + ".part", "wb") as f:
                    f.write(data)
                os.replace(p + ".part", p)
                return p
            except Exception as e:  # noqa: BLE001
                last = e
                time.sleep(2 * (i + 1))
        raise last

    slugs = set()
    for pid in json.load(open(PORTRAIT_MAP)):
        m = re.match(r"^player-\d+-(.+)$", pid)
        if m:
            slugs.add(m.group(1))
    arten = json.load(open(ARTEN)) if os.path.exists(ARTEN) else {}

    best = {}
    for c in list_characters(key):
        tags = c.get("tags") or []
        if any("superseded" in t for t in tags):
            continue
        slug = next((t for t in tags if t in slugs), None)
        tagged = slug is not None
        if not slug:
            s = re.sub(r"[^a-z0-9]+", "-", re.sub(r"[’']", "-", c["name"].split(",")[0].strip().lower())).strip("-")
            slug = s if s in slugs else None
        if not slug:
            continue
        score = (1 if tagged else 0, c.get("animation_count", 0), c.get("updated_at", ""))
        if slug not in best or score > best[slug][0]:
            best[slug] = (score, c["id"])

    with ThreadPoolExecutor(6) as ex:
        details = dict(zip(best, ex.map(lambda cid: api_get(f"/characters/{cid}", key), [v[1] for v in best.values()])))

    jobs = []
    for d in details.values():
        jobs += [u for r, u in d["rotation_urls"].items() if r in ROTS and u]
        for a in d.get("animations", []):
            for dd in a["directions"]:
                if dd["direction"] in ANIM_DIRS:
                    jobs += dd["frames"]
    print("Downloads:", len(jobs))
    with ThreadPoolExecutor(24) as ex:
        list(ex.map(fetch, jobs))

    index = {}
    for slug, d in sorted(details.items()):
        od = os.path.join(OUT, slug)
        os.makedirs(od, exist_ok=True)
        rots = []
        for r in ROTS:
            u = d["rotation_urls"].get(r)
            if u:
                Image.open(fetch(u)).convert("RGBA").save(os.path.join(od, f"{r}.png"), optimize=True)
                rots.append(r)
        anims, used = [], {}
        for a in d.get("animations", []):
            dirs = {dd["direction"]: dd["frames"] for dd in a["directions"] if dd["direction"] in ANIM_DIRS and dd["frames"]}
            if not dirs:
                continue
            gid = a.get("animation_group_id")
            kind, quelle = arten.get(gid), "gespeichert"
            if not kind:
                kind, quelle = label_kind(a["animation_type"]), "label"
            if not kind:
                first = dirs.get("south") or next(iter(dirs.values()))
                kind, quelle = frame_kind([Image.open(fetch(u)).convert("RGBA") for u in first]), "bild"
            arten.setdefault(gid, kind)
            used[kind] = used.get(kind, 0) + 1
            name = kind if used[kind] == 1 else f"{kind}{used[kind]}"
            frames = 0
            for dirn, urls in dirs.items():
                ims = [Image.open(fetch(u)).convert("RGBA") for u in urls]
                w, h = ims[0].size
                sheet = Image.new("RGBA", (w * len(ims), h))
                for i, im in enumerate(ims):
                    sheet.paste(im, (i * w, 0))
                sheet.save(os.path.join(od, f"{name}-{dirn}.png"), optimize=True)
                frames = len(ims)
            anims.append({"name": name, "kind": kind, "frames": frames, "dirs": sorted(dirs), "quelle": quelle})
        index[slug] = {"pixellabId": d["id"], "canvas": d["size"]["width"], "rotationen": rots, "animationen": anims}
        for f in os.listdir(od):
            if f.endswith(".png"):
                palettize(os.path.join(od, f))

    json.dump(index, open(INDEX, "w"), ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    json.dump(arten, open(ARTEN, "w"), ensure_ascii=False, indent=0, sort_keys=True)
    print("Figuren:", len(index))


if __name__ == "__main__":
    main()
