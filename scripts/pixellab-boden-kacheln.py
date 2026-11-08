#!/usr/bin/env python3
"""PIXELLAB-BODENKACHELN FUER TAKESHI'S CASTLE (Kulissen-Nachlese 08.11.).

Die PixelLab-Szene fuer Takeshi ist ein Seitenpanorama, der Motor zeigt aber eine Route in
Draufsicht (bodenTakeshiRoute()). Deshalb kommen die neun Bodenarten der Route als eigene
PixelLab-Draufsicht-Kacheln (/v2/create-tiles-pro, square_topdown, 32 px, Blickwinkel top-down,
outline_mode "segmentation" fuer nahtlose Raender). Der Motor fuellt damit seine Flaechen ueber
ctx.createPattern(...,"repeat") — die Kachel muss also 32x32 sein und sich selbst nahtlos fortsetzen.

Chris hat die Stilwahl freigegeben ("probier ruhig und nimm das was am besten aussieht"). Probiert:
  a  freier Prompt, PixelLab-eigene Palette           (Satz b69fe2a3-…)
  c  Stilvorlage aus der PixelLab-Takeshi-Szene       (Satz 840d3cf4-…)  <- gewaehlt
     (drei 32er-Ausschnitte aus public/szenen/takeshis-castle/burg.jpg: Gras, Wasser, Sand)
  d  Prompt mit "muted natural colors"                (Satz ffdd7739-…)
Gewaehlt ist c: dieselbe helle, gesaettigte Palette wie die Takeshi-Szene, und die Nahtpruefung
(Randsprung / mittlerer Innensprung) liegt bei den gewaehlten Kacheln am niedrigsten.

  python3 -I scripts/pixellab-boden-kacheln.py bestellen <stil> [--seed N]   (API)
  python3 -I scripts/pixellab-boden-kacheln.py holen <tiles-pro-id> <stil>     (API, nur Download)
  python3 -I scripts/pixellab-boden-kacheln.py einsetzen [<stil>]               (ohne Netz)

Rohsaetze: data/generated/pixellab-boden/<stil>/tile_<n>.png (+ auftrag.json).
"""
import argparse
import base64
import io
import json
import os
import sys
import urllib.request

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROH = os.path.join(WURZEL, "data/generated/pixellab-boden")
ZIEL = os.path.join(WURZEL, "public/sprites/arena")
SZENE = os.path.join(WURZEL, "public/szenen/takeshis-castle/burg.jpg")

BESCHREIBUNG = ("1). lush green meadow grass 2). dark forest floor with moss, ferns and fallen needles "
                "3). trodden tan dirt footpath 4). grey gravel 5). wet brown mud 6). tan cobblestone pavement "
                "7). deep blue lake water with gentle ripples 8). dry yellow dead grass on a hillside "
                "9). shallow swamp water with reeds and algae")
EIS = "1). smooth frozen ice surface, pale blue with white cracks and glints 2). slippery light blue ice sheet"

STILE = {
    "a": dict(beschreibung=BESCHREIBUNG.replace(" with gentle ripples", ""), seed=5, vorlage=False),
    "c": dict(beschreibung=BESCHREIBUNG, seed=21, vorlage=True),
    "d": dict(beschreibung=BESCHREIBUNG + ", muted natural colors, Japanese countryside", seed=33, vorlage=False),
    "eis": dict(beschreibung=EIS, seed=21, vorlage=False),  # mit Vorlage malte das Modell nur Gras/Wasser/Sand nach
}
# Stilvorlage: Ausschnitte (x, y) zu 32x32 aus der Takeshi-Szene
VORLAGE = {"gras": (30, 370), "wasser": (600, 620), "sand": (900, 440)}

# Bodenart -> (Satz, Kachelnummer). Die Saetze liefern 16 Kacheln, je Bodenart meist zwei Varianten;
# genommen ist je Bodenart die mit dem kleinsten Randsprung, bei Gleichstand die ruhigere.
WAHL = {
    "c": {"boden_wiese": ("c", 0), "boden_wald": ("c", 10), "boden_pfad": ("c", 11), "boden_kies": ("c", 12),
          "boden_schlamm": ("c", 13), "boden_pflaster": ("c", 5), "boden_see": ("c", 15),
          "boden_hang": ("c", 7), "boden_sumpf": ("c", 8), "boden_eis": ("eis", 12)},
    "a": {"boden_wiese": ("a", 1), "boden_wald": ("a", 3), "boden_pfad": ("a", 5), "boden_kies": ("a", 6),
          "boden_schlamm": ("a", 9), "boden_pflaster": ("a", 11), "boden_see": ("a", 12),
          "boden_hang": ("a", 13), "boden_sumpf": ("a", 14)},
}


def nahtwert(im):
    """Randsprung (rechts->links, unten->oben) im Verhaeltnis zum mittleren Innensprung. ~1 = unsichtbar."""
    px = im.convert("RGB").load()
    w, h = im.size

    def d(a, b):
        return sum(abs(a[i] - b[i]) for i in range(3))
    innen = sum(d(px[x, y], px[x + 1, y]) for y in range(h) for x in range(w - 1)) / (h * (w - 1))
    innen += sum(d(px[x, y], px[x, y + 1]) for y in range(h - 1) for x in range(w)) / ((h - 1) * w)
    rand = sum(d(px[w - 1, y], px[0, y]) for y in range(h)) / h + sum(d(px[x, h - 1], px[x, 0]) for x in range(w)) / w
    return rand / max(innen, 1e-6)


def holen(tile_id, stil, auftrag=None):
    from pixellab_api import api
    j = api("GET", f"/tiles-pro/{tile_id}")
    d = os.path.join(ROH, stil)
    os.makedirs(d, exist_ok=True)
    for k, url in j["storage_urls"].items():
        b = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read()
        Image.open(io.BytesIO(b)).convert("RGBA").save(os.path.join(d, f"{k}.png"))
    a = dict(auftrag or {}, tiles_pro_id=tile_id, endpunkt="/v2/create-tiles-pro")
    json.dump(a, open(os.path.join(d, "auftrag.json"), "w"), indent=1, ensure_ascii=False)
    print(f"{stil}: {len(j['storage_urls'])} Kacheln -> {d}")


def bestellen(stil, seed=None):
    from pixellab_api import api, warte_job
    s = STILE[stil]
    body = {"description": s["beschreibung"], "tile_type": "square_topdown", "tile_size": 32, "tile_view": "top-down",
            "outline_mode": "segmentation", "seed": seed if seed is not None else s["seed"]}
    if s["vorlage"]:
        szene = Image.open(SZENE).convert("RGBA")
        body["style_images"] = []
        for x, y in VORLAGE.values():
            buf = io.BytesIO()
            szene.crop((x, y, x + 32, y + 32)).save(buf, "PNG")
            body["style_images"].append({"base64": base64.b64encode(buf.getvalue()).decode(), "width": 32, "height": 32})
    r = api("POST", "/create-tiles-pro", body)
    warte_job(r["background_job_id"])
    auftrag = {k: v for k, v in body.items() if k != "style_images"}
    if s["vorlage"]:
        auftrag["style_images"] = f"Ausschnitte 32x32 aus {os.path.relpath(SZENE, WURZEL)} bei {list(VORLAGE.values())}"
    holen(r["tile_id"], stil, auftrag)


def einsetzen(stil):
    for name, (satz, nr) in WAHL[stil].items():
        d = os.path.join(ROH, satz)
        if nr is None and not os.path.isdir(d):
            print(f"{name}: kein Rohsatz {satz}, bleibt alt"); continue
        if nr is None:  # beste Kachel des Satzes nach Nahtwert
            kand = sorted((nahtwert(Image.open(os.path.join(d, f))), f) for f in os.listdir(d) if f.startswith("tile_"))
            if not kand:
                print(f"{name}: kein Rohsatz {satz}, bleibt alt"); continue
            f = kand[0][1]
        else:
            f = f"tile_{nr}.png"
        p = os.path.join(d, f)
        if not os.path.exists(p):
            print(f"{name}: {p} fehlt, bleibt alt"); continue
        im = Image.open(p).convert("RGBA")
        assert im.size == (32, 32), (name, im.size)
        im.save(os.path.join(ZIEL, f"{name}.png"))
        print(f"{name}: {satz}/{f}  Naht {nahtwert(im):.2f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("befehl", choices=["bestellen", "holen", "einsetzen"])
    ap.add_argument("arg", nargs="*")
    ap.add_argument("--seed", type=int)
    a = ap.parse_args()
    if a.befehl == "bestellen":
        bestellen(a.arg[0], a.seed)
    elif a.befehl == "holen":
        holen(a.arg[0], a.arg[1], {"hinweis": "nachtraeglich geholt", **{k: v for k, v in STILE.get(a.arg[1], {}).items()}})
    else:
        einsetzen(a.arg[0] if a.arg else "c")


if __name__ == "__main__":
    main()
