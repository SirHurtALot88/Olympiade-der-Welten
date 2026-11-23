#!/usr/bin/env python3
"""GM-Portraets und Icon-Probe (22.11.): statische Bilder bei PixelLab, Stil der Vorstands-Portraets.

    flock /tmp/pixellab-bestell.lock python3 -I scripts/pixellab-gm-portraets.py gm <gmId> [<gmId> ...]
    flock /tmp/pixellab-bestell.lock python3 -I scripts/pixellab-gm-portraets.py icon <slug> [<slug> ...]
    python3 -I scripts/pixellab-gm-portraets.py guthaben

Endpunkt /v2/create-image-pixflux. Je Bild genau EIN POST, KEINE Wiederholung (auch nicht bei 5xx, Zeitablauf
oder Netzfehler: dann Abbruch des ganzen Laufs und Bericht; der Auftrag gilt als verbraucht und wird ohne
Rueckfrage nicht erneut geschickt). Bewusst NICHT ueber scripts/lib/pixellab_api.py, weil dessen api() bei 5xx
selbst wiederholt. Ein Ziel, das schon existiert, wird uebersprungen. Reserve 150 Generationen: darunter
bestellt das Skript nicht. Der Schluessel kommt aus PIXELLAB_API_KEY oder (Cloud-Umgebung) aus dem Netzwerk-Proxy.

GM: Prompt-Baustein aus data/gm-aussehen.json (scripts/gm-aussehen-erzeugen.py), 192x224, Ziel
public/portraits/gm/<gmId>.png, Herkunft public/portraits/gm/quellen.json. Statische Portraets, keine
Spielfiguren und keine Animationen.
Icon: Tabelle ICONS unten, Ziel und quellen.json im jeweiligen Ordner.
"""
import base64
import io
import json
import os
import sys
import urllib.request

from PIL import Image

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.pixellab.ai/v2"
RESERVE = 150
GM_ZIEL = os.path.join(WURZEL, "public", "portraits", "gm")
GM_GROESSE = (192, 224)
# Wie public/portraits/vorstand (Stilprobe 22.11.), nur Buero statt Sitzungssaal.
GM_STIL = ("bust portrait, head and shoulders, facing the viewer, dark manager office background with warm lamp light, "
           "detailed pixel art character portrait, 2D HD RPG style, rich shading, clean dark outline")
ICON_STIL = "single item icon, pixel art game item, 16-bit RPG style, clean dark outline"
# Eigener, einheitlicher Oly-Stil fuer Sponsoren (Chris, 22.11.): Wappenschild mit Metallrand und Banner darunter.
# Anlehnung an Farben und Form-Idee der echten Marke ist erlaubt, keine Kopie des Originallogos.
LOGO_STIL = ("heraldic sponsor crest, pointed shield shape with a thick riveted steel border, empty ribbon banner below the shield, "
             "flat bold shapes, centered, pixel art badge, 16-bit RPG style, clean dark outline")

# slug -> Ordner unter public/sprites, Groesse, Saat, Prompt, Bezug
ICONS = {
    # Ausruestung: drei der acht Familien (docs/design/zwischen-den-spieltagen-22-11.md Abschnitt 59), je eine Stufe.
    "helm-standard": dict(ordner="ausruestung", g=64, saat=31, bezug="Familie Helm, Standard (Einfacher Helm)",
        prompt=f"simple plain iron sports helmet with leather chin strap, grey steel, {ICON_STIL}"),
    "plattenpanzer-selten": dict(ordner="ausruestung", g=64, saat=32, bezug="Familie Plattenpanzer, Selten (Verstärkter Plattenpanzer)",
        prompt=f"reinforced steel plate chest armor with blue enamel trim and rivets, torso armor only, {ICON_STIL}"),
    "amulett-legendaer": dict(ordner="ausruestung", g=64, saat=33, bezug="Familie Amulett, Legendär (Herz der Qual)",
        prompt=f"legendary golden amulet on a chain with a glowing dark red heart shaped crystal wrapped in thorns, {ICON_STIL}"),
    # Essen/Trinken: eigene Objekte in Markenfarben, ohne fremdes Logo; der Name steht in der App als Text daneben.
    "energydrink-dose": dict(ordner="verpflegung", g=64, saat=41, bezug="Energy-Drink (blau-silberne Dose, Hirschkopf wie Sponsor Red Stag Energy)",
        prompt=f"slim tall energy drink can, blue and silver diagonal checker pattern with a small red stag head emblem, {ICON_STIL}"),
    "cola-dose": dict(ordner="verpflegung", g=64, saat=42, bezug="Cola (rote Dose, neutral)",
        prompt=f"soda can, plain bright red with one white horizontal band, plain without logo, water drops on it, {ICON_STIL}"),
    "doener": dict(ordner="verpflegung", g=64, saat=43, bezug="Döner",
        prompt=f"doner kebab in flatbread with sliced meat, lettuce, tomato, onion and white sauce, wrapped in paper at the bottom, {ICON_STIL}"),
    # Sponsoren: eigenes Sinnbild im Wappen, Farben an die Vorbild-Marke angelehnt, kein fremdes Logo.
    "red-stag-energy": dict(ordner="sponsoren", g=96, saat=51, bezug="Sponsor red-stag-energy (Red Stag Energy), Versuch mit Schrift im Banner",
        prompt="red stag head with big antlers in front of a yellow sun disc on a dark blue and silver field, "
               + LOGO_STIL.replace("empty ribbon banner below the shield", "ribbon banner below the shield with the words RED STAG")),
    "rainforest-commerce": dict(ordner="sponsoren", g=96, saat=52, bezug="Sponsor rainforest-commerce (Rainforest Commerce), Banner leer",
        prompt=f"green jungle tree growing out of an open brown shipping box on a black field with an orange curved stripe, {LOGO_STIL}, no text"),
    "alphasearch-global": dict(ordner="sponsoren", g=96, saat=53, bezug="Sponsor alphasearch-global (Alphasearch Global), Banner leer",
        prompt=f"golden magnifying glass over a globe on a white field divided into blue, red, yellow and green quarters, {LOGO_STIL}, no text"),
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


def bestelle(ziel_ordner, datei, prompt, groesse, saat, transparent, zusatz):
    ziel = os.path.join(ziel_ordner, datei)
    if os.path.exists(ziel):
        print(f"{datei}: existiert schon, uebersprungen")
        return
    vorher = guthaben()
    if vorher - 1 < RESERVE:
        sys.exit(f"Guthaben {vorher:.1f}: Reserve {RESERVE} waere beruehrt, Abbruch")
    body = {"description": prompt, "image_size": {"width": groesse[0], "height": groesse[1]},
            "no_background": transparent, "seed": saat}
    r = einmal("POST", "/create-image-pixflux", body)  # genau ein POST; jede Ausnahme bricht den Lauf ab
    b = r["image"]["base64"]
    if "," in b[:40]:
        b = b.split(",", 1)[1]
    os.makedirs(ziel_ordner, exist_ok=True)
    Image.open(io.BytesIO(base64.b64decode(b))).convert("RGBA" if transparent else "RGB").save(ziel, "PNG", optimize=True)
    gen = (r.get("usage") or {}).get("generations")
    nachher = guthaben()
    qpfad = os.path.join(ziel_ordner, "quellen.json")
    q = json.load(open(qpfad)) if os.path.exists(qpfad) else {}
    q[datei] = {"paket": "PixelLab", "endpunkt": "/create-image-pixflux", "groesse": f"{groesse[0]}x{groesse[1]}",
                **zusatz, "saat": saat, "generationen": gen, "guthaben_vorher": round(vorher, 2),
                "guthaben_nachher": round(nachher, 2), "prompt": prompt}
    json.dump(q, open(qpfad, "w"), indent=1, ensure_ascii=False)
    print(json.dumps({"datei": datei, "usage": r.get("usage"), "vorher": round(vorher, 2), "nachher": round(nachher, 2)}))


def main():
    art = sys.argv[1]
    if art == "guthaben":
        print(guthaben())
        return
    if art == "gm":
        gms = json.load(open(os.path.join(WURZEL, "data", "gm-aussehen.json")))["gms"]
        alle = sorted(gms)
        for gm_id in sys.argv[2:]:
            a = gms[gm_id]
            bestelle(GM_ZIEL, gm_id + ".png", f"{a['prompt']}, {GM_STIL}", GM_GROESSE, 2300 + alle.index(gm_id), False,
                     {"gmId": gm_id, "name": a["name"], "archetyp": a["archetyp"], "rasse": a["rasse"]})
    elif art == "icon":
        for slug in sys.argv[2:]:
            i = ICONS[slug]
            bestelle(os.path.join(WURZEL, "public", "sprites", i["ordner"]), slug + ".png", i["prompt"], (i["g"], i["g"]),
                     i["saat"], True, {"bezug": i["bezug"]})
    else:
        sys.exit("gm | icon | guthaben")


if __name__ == "__main__":
    main()
