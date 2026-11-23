#!/usr/bin/env python3
"""Vorstands-Portraets (Budget-Gespraech, 22.11.): statische Portraets je Vorstands-Charakter bei PixelLab.

    flock /tmp/pixellab-bestell.lock python3 -I scripts/pixellab-vorstand-portraets.py <slug>

Endpunkt /v2/create-image-pixflux, 192x224, EIN POST je Aufruf, KEINE Wiederholung (auch nicht bei 5xx oder
Netzfehler: dann Abbruch und Bericht). Ergebnis: public/portraits/vorstand/<slug>.png, Eintrag in
public/portraits/vorstand/quellen.json mit Prompt, Saat und usage.generations aus der Antwort.
Der Schluessel kommt aus PIXELLAB_API_KEY oder (Cloud-Umgebung) aus dem Netzwerk-Proxy.
Keine Figuren, keine Animationen. Reserve 150 Generationen: darunter bestellt das Skript nicht.
"""
import base64
import io
import json
import os
import sys
import urllib.request

from PIL import Image

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIEL = os.path.join(WURZEL, "public", "portraits", "vorstand")
API = "https://api.pixellab.ai/v2"
RESERVE = 150
GROESSE = (192, 224)
STIL = ("bust portrait, head and shoulders, facing the viewer, dark boardroom background with warm lamp light, "
        "detailed pixel art character portrait, 2D HD RPG style, rich shading, clean dark outline")

# slug -> Charakter (lib/finance/vorstand-gespraech.ts:35), Rasse (data/generated/oly-player-stats.json), Saat, Prompt
AUFTRAEGE = {
    "antreiber-orc": dict(charakter="antreiber", rasse="Orc", saat=2211,
        prompt=f"stern ambitious orc club chairman, green skin, tusks, slicked back black hair, sharp dark suit with a crimson red tie, intense demanding stare, arms crossed, {STIL}"),
    "kaufmann-dwarf": dict(charakter="kaufmann", rasse="Dwarf", saat=2212,
        prompt=f"shrewd dwarf merchant club chairman, braided grey beard with gold rings, fine dark waistcoat with a golden yellow tie and gold pocket watch chain, calm weighing look, slight knowing smile, {STIL}"),
    "kassenwart-construct": dict(charakter="kassenwart", rasse="Construct", saat=2213,
        prompt=f"cautious brass clockwork construct robot treasurer, round head with two round glowing teal lens eyes like spectacles, riveted metal face, dark accountant suit with a teal tie, holding a ledger book close, {STIL}"),
}


def kopf():
    h = {"Content-Type": "application/json"}
    k = os.environ.get("PIXELLAB_API_KEY")
    if k:
        h["Authorization"] = f"Bearer {k}"
    return h


def einmal(method, pfad, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + pfad, data=data, method=method, headers=kopf())
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read())


def guthaben():
    return einmal("GET", "/balance")["subscription"]["generations"]


def main():
    slug = sys.argv[1]
    a = AUFTRAEGE[slug]
    ziel = os.path.join(ZIEL, slug + ".png")
    if os.path.exists(ziel):
        sys.exit(f"{ziel} existiert schon, es wird nichts doppelt bestellt")
    vorher = guthaben()
    if vorher - 1 < RESERVE:
        sys.exit(f"Guthaben {vorher:.1f}: Reserve {RESERVE} waere beruehrt, Abbruch")
    body = {"description": a["prompt"], "image_size": {"width": GROESSE[0], "height": GROESSE[1]},
            "no_background": False, "seed": a["saat"]}
    r = einmal("POST", "/create-image-pixflux", body)  # genau ein POST
    b = r["image"]["base64"]
    if "," in b[:40]:
        b = b.split(",", 1)[1]
    os.makedirs(ZIEL, exist_ok=True)
    Image.open(io.BytesIO(base64.b64decode(b))).convert("RGB").save(ziel, "PNG", optimize=True)
    gen = (r.get("usage") or {}).get("generations")
    nachher = guthaben()
    qpfad = os.path.join(ZIEL, "quellen.json")
    q = json.load(open(qpfad)) if os.path.exists(qpfad) else {}
    q[slug + ".png"] = {"paket": "PixelLab", "endpunkt": "/create-image-pixflux", "groesse": f"{GROESSE[0]}x{GROESSE[1]}",
                        "charakter": a["charakter"], "rasse": a["rasse"], "saat": a["saat"], "generationen": gen,
                        "guthaben_vorher": round(vorher, 2), "guthaben_nachher": round(nachher, 2), "prompt": a["prompt"]}
    json.dump(q, open(qpfad, "w"), indent=1, ensure_ascii=False)
    print(json.dumps({"slug": slug, "usage": r.get("usage"), "vorher": vorher, "nachher": nachher}))


if __name__ == "__main__":
    main()
