#!/usr/bin/env python3
"""
Exportiert die PixelLab-Spielfiguren (Live-API) ins Spiel.

    PIXELLAB_API_KEY=... python3 -I scripts/figuren-sprites-export.py [--cache <ordner>] [--nur <slug> ...]

`--nur` exportiert nur die genannten Slugs und fuehrt sie in den bestehenden Index ein; alle anderen
Figuren (Ordner und Indexeintraege) bleiben unangetastet. Ohne `--nur` wird alles neu exportiert.

Ergebnis:
  public/sprites/figuren/<slug>/{south,east,west,north}.png        Grundposen
  public/sprites/figuren/<slug>/<name>-{south,east,north}.png       je Animation ein Streifen (north optional, s.u.)
  data/generated/figuren-sprites.json                               Index fuer lib/data/figurenSprites.ts
  data/generated/figuren-sprites-animationsarten.json               animation_group_id -> Art (bleibt stabil)

Zuordnung Figur -> Spieler: ein Tag der Figur ist der Namens-Slug der Spieler-ID
(`player-0001-umbros` -> Tag `umbros`, so legt der PixelLab-Kanon die Figuren an). Figuren mit
`superseded` im Tag sind ersetzt und werden ausgelassen. Ohne passenden Tag zaehlt der Name
(vor dem ersten Komma). Bei mehreren Figuren je Slug gewinnt: getaggt > mehr Animationen > neuer.

Richtungen (Chris, 06.11.: "er kann ja auch einfach von oben nach unten laufen... dass er dann nicht
seitlich gezeigt wird, sondern geradeaus"): bis 06.11. kannte der Export nur Sued+Ost (West wird im
Motor aus Ost gespiegelt, PixelLab-Kanon); fehlte eine Nord-Animation, zeigte der Motor ersatzweise
den Ost-Streifen, gespiegelt je nach Laufrichtung links/rechts -- bei reiner Nordbewegung (kein
Links/Rechts-Anteil) lief die Figur dadurch sichtbar seitwaerts nach oben. Jetzt exportiert dieses
Skript auch echte Nord-Streifen, wenn PixelLab sie liefert (`ANIM_DIRS` um "north" erweitert); ohne
Nord-Streifen bleibt die alte Ost-Naeherung als Ruecksprung (battle-mode.engine.js, zeichnePixelFigur()).

Animationsart (walk/angriff/tod/treffer): PixelLab kennt nur den auf ~37 Zeichen gekuerzten
Aktionstext als Label (`animation_type`) und einen optionalen Anzeigenamen (`display_name`).
Reihenfolge: (1) gespeicherte Art aus der Arten-Datei, (2) display_name, (3) Schluesselwoerter im
Label (Treffer, Tod, Angriff, Gehen — in dieser Reihenfolge), (4) Bildanalyse des Sued-Streifens
(letztes Bild deutlich flacher = K.o., stark wechselnde Breite = Aktion, sonst Gehen). Alles, was
nicht aus (1) kommt, ist eine Schaetzung, wird so im Index markiert (`quelle`) und am Ende des Laufs
aufgelistet. Wer eine Art korrigiert, traegt sie unter der `gid` (steht seit 07.11. im Index) in die
Arten-Datei ein und exportiert die Figur mit `--nur` neu; Streifen alter Namen werden dabei entfernt.

Die Bildanalyse (4) ist unzuverlaessig: beim Erst-Export (02.11.) hielt sie 19 Angriffe/Tode fuer
Gehen (brontar, fyrn, vorrak, darkblade, nachtschatten ...) und kann nie "treffer" liefern. Gruppen
ohne exportierbare Richtung (nur Diagonalen, oder leere `frames` = noch in Arbeit) werden nicht mehr
stumm verworfen, sondern am Ende gemeldet.

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
ANIM_DIRS = ["south", "east", "north"]

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
# Angriff (07.11.): bis dahin gab es KEINE Angriffs-Woerter — "angriff" war nur der Rueckfall der
# Bildanalyse, und die hielt Angriffe mit langem Aufholen (12 Bilder Stand, dann Hieb) fuer Gehen.
# So lagen brontar/fyrn/vorrak/suzuna/... mit falsch benannten Angriffen im Index, s.
# docs/design/figuren-reparatur-nord-07-11.md. Die Woerter stammen aus den 290 als Angriff
# bestaetigten PixelLab-Labels (lunges 30x, swings 23x, raises 16x, holds 12x, draws/thrusts 10x).
ATTACK = ["lunges", "lunge ", "swings", "swing ", "thrusts", "thrust ", "slashes", "slash ", "draws",
          "raises", "unleashes", "sweeps", "strikes", "attacks", "punches", "stabs", "smashes", "slams",
          "fires", "shoots", "casts", "hurls", "throws", "bites", "snaps at", "spits", "breathes fire",
          "spins and", "whips", "kicks", "charges and", "rears", "holds a", "stands sideways", "fencing",
          "racket", "spreads its", "opens its"]
# display_name (PixelLab-Website: eigener Anzeigename) — kurz und eindeutig, wenn gesetzt.
DISPLAY = {"walk": "walk", "gehen": "walk", "run": "walk", "attack": "angriff", "angriff": "angriff",
           "hit": "treffer", "hurt": "treffer", "treffer": "treffer", "recoil": "treffer",
           "death": "tod", "die": "tod", "tod": "tod", "ko": "tod", "k.o.": "tod"}
# Streifen-Dateien einer Figur: <name>-<richtung>.png (Grundposen heissen nur <richtung>.png).
STREIFEN = re.compile(r"^[a-z]+\d*-(" + "|".join(ANIM_DIRS) + r")\.png$")


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
    # Angriff VOR Gehen: "lunges forward and slashes" traegt kein Gehwort, "strides forward and
    # swings" ist trotzdem ein Angriff. Reine Gehlabels ("walks forward, arms swinging") treffen
    # die Angriffsverben nicht (swinging != swings).
    if any(k in t for k in ATTACK):
        return "angriff"
    if any(k in t for k in WALK):
        return "walk"
    return None


def display_kind(display_name):
    if not display_name:
        return None
    t = display_name.strip().lower()
    if t in DISPLAY:
        return DISPLAY[t]
    return label_kind(t)


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
    ap.add_argument("--nur", nargs="+", metavar="SLUG", help="nur diese Slugs exportieren, Index wird ergaenzt")
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
    if args.nur:
        # Spieler ohne Eintrag in der Portrait-Map (Portrait per Override in lib/data/mediaAssets.ts,
        # z. B. player-0154-riley-le-rouge) sind trotzdem gueltig, wenn es die Spieler-ID gibt.
        stats = os.path.join(ROOT, "data", "generated", "oly-player-stats.json")
        if os.path.exists(stats):
            slugs |= set(re.findall(r'"player-\d+-([a-z0-9-]+)"', open(stats).read()))
        unbekannt = sorted(set(args.nur) - slugs)
        if unbekannt:
            sys.exit(f"Unbekannte Slugs (nicht in player-portrait-map.json): {unbekannt}")
        slugs = set(args.nur)
    arten = json.load(open(ARTEN)) if os.path.exists(ARTEN) else {}

    best, alle = {}, {}
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
        alle.setdefault(slug, []).append((score, c["id"]))
        if slug not in best or score > best[slug][0]:
            best[slug] = (score, c["id"])
    # Der Tag entscheidet (PixelLab-Kanon) — aber ein ungetaggter Doppelgaenger mit MEHR
    # Animationen ist ein Hinweis auf einen vergessenen Tag (voidrake, 07.11.: getaggt 64px ohne
    # Animation, ungetaggt 128px-Rochen mit vieren). Nur melden, nicht umentscheiden.
    for slug, ks in alle.items():
        (score, cid) = best[slug]
        for sc, other in ks:
            if other != cid and sc[1] > score[1]:
                print(f"HINWEIS {slug}: ungetaggter Kandidat {other} hat {sc[1]} Animationen, gewaehlt {cid} mit {score[1]} (Tag gewinnt)")

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

    index = json.load(open(INDEX)) if args.nur and os.path.exists(INDEX) else {}
    geschaetzt, uebersprungen = [], []
    for slug, d in sorted(details.items()):
        if d.get("status") and d["status"] != "completed":
            print(f"WARNUNG {slug}: Charakter-Status {d['status']!r} (nicht fertig?)")
        od = os.path.join(OUT, slug)
        os.makedirs(od, exist_ok=True)
        rots = []
        for r in ROTS:
            u = d["rotation_urls"].get(r)
            if u:
                Image.open(fetch(u)).convert("RGBA").save(os.path.join(od, f"{r}.png"), optimize=True)
                rots.append(r)
        anims, used, geschrieben = [], {}, set()
        for a in d.get("animations", []):
            gid = a.get("animation_group_id")
            dirs = {dd["direction"]: dd["frames"] for dd in a["directions"] if dd["direction"] in ANIM_DIRS and dd["frames"]}
            if not dirs:
                # Frueher stumm verworfen. Jetzt sichtbar: eine Gruppe nur mit Diagonalen ist
                # normal (5-Richtungs-Erzeugung), leere `frames` heissen "noch in Arbeit".
                leer = [dd["direction"] for dd in a["directions"] if not dd["frames"]]
                uebersprungen.append((slug, gid, a["animation_type"], [dd["direction"] for dd in a["directions"]], leer))
                continue
            kind, quelle = arten.get(gid), "gespeichert"
            if not kind:
                kind, quelle = display_kind(a.get("display_name")), "display"
            if not kind:
                kind, quelle = label_kind(a["animation_type"]), "label"
            if not kind:
                first = dirs.get("south") or next(iter(dirs.values()))
                kind, quelle = frame_kind([Image.open(fetch(u)).convert("RGBA") for u in first]), "bild"
            if quelle != "gespeichert":
                geschaetzt.append((slug, gid, kind, quelle, a.get("display_name") or a["animation_type"]))
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
                datei = f"{name}-{dirn}.png"
                sheet.save(os.path.join(od, datei), optimize=True)
                geschrieben.add(datei)
                frames = len(ims)
            anims.append({"name": name, "kind": kind, "frames": frames, "dirs": sorted(dirs), "quelle": quelle, "gid": gid})
        index[slug] = {"pixellabId": d["id"], "canvas": d["size"]["width"], "rotationen": rots, "animationen": anims}
        # Streifen aus frueheren Laeufen, die es jetzt nicht mehr gibt (umbenannte Art, geloeschte
        # Gruppe), raeumen — sonst liegt neben "angriff-south.png" weiter ein totes "walk2-south.png".
        for f in os.listdir(od):
            if STREIFEN.match(f) and f not in geschrieben:
                os.remove(os.path.join(od, f))
                print(f"entfernt {slug}/{f} (Streifen ohne Gruppe)")
        for f in os.listdir(od):
            if f.endswith(".png"):
                palettize(os.path.join(od, f))

    json.dump(index, open(INDEX, "w"), ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    json.dump(arten, open(ARTEN, "w"), ensure_ascii=False, indent=0, sort_keys=True)
    print("Figuren:", len(index))
    for slug, gid, typ, dirs, leer in uebersprungen:
        print(f"uebersprungen {slug} {gid} {typ[:40]!r} Richtungen={dirs}" + (f" LEERE FRAMES={leer}" if leer else ""))
    if geschaetzt:
        print(f"\n{len(geschaetzt)} Arten GESCHAETZT (nicht aus der Arten-Datei) — bitte am Bild pruefen und ggf. in {os.path.relpath(ARTEN, ROOT)} korrigieren:")
        for slug, gid, kind, quelle, label in geschaetzt:
            print(f"  {slug:22} {kind:8} ({quelle}) {gid} {label[:50]!r}")


if __name__ == "__main__":
    main()
