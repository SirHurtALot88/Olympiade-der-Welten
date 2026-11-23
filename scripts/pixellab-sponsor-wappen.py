#!/usr/bin/env python3
"""Sponsor-Wappen (22.11.): Wappen der Dachmarken, die in den aktiven Spielstaenden unter Vertrag stehen.

    flock /tmp/pixellab-bestell.lock python3 -I scripts/pixellab-sponsor-wappen.py bestelle <brandId> [<brandId> ...]
    python3 -I scripts/pixellab-sponsor-wappen.py guthaben
    python3 -I scripts/pixellab-sponsor-wappen.py liste

Chris, 22.11.: „generier nur die Sponsorenwappen, die gerade genutzt werden“. Stil der drei Probe-Wappen aus
scripts/pixellab-gm-portraets.py (LOGO_STIL): Wappenschild mit Metallrand, leeres Banner, eigenes Sinnbild, Farben an das
Vorbild angelehnt, kein kopiertes Logo. Das Wappen traegt KEINE Schrift; der Spielname steht in der App als Text daneben
(so kann auf dem Wappen nie ein anderer Name stehen als im Spiel).

Endpunkt /v2/create-image-pixflux, 96x96, no_background. Je Wappen genau EIN POST, KEINE Wiederholung (jede Ausnahme
bricht den Lauf ab; der Auftrag gilt als verbraucht). Ein Ziel, das schon existiert, wird uebersprungen. Reserve 150
Generationen: darunter bestellt das Skript nicht. Schluessel aus PIXELLAB_API_KEY oder (Cloud) aus dem Netzwerk-Proxy.
Requisiten/UI-Bilder, keine Figuren und keine Animationen. Herkunft: public/sprites/sponsoren/quellen.json.
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
ZIEL = os.path.join(WURZEL, "public", "sprites", "sponsoren")
STIL = ("heraldic sponsor crest, pointed shield shape with a thick riveted steel border, empty ribbon banner below the shield, "
        "flat bold shapes, centered, pixel art badge, 16-bit RPG style, clean dark outline, no text, no letters")

# Zweiter Auftrag nach einem Fehlgriff (bewusst, von Hand, mit geaendertem Sinnbild): eigener Saat-Versatz.
SAAT_VERSATZ = {"sennheiser-audio": 200, "fiat-automobili": 100, "trumpf-lasertechnik": 100, "reebok-athletics": 100, "hp-hardware": 200}

# brandId -> (Spielname, Sinnbild). Reihenfolge = Saat (6000 + Platz).
# Block 1: Vertraege im Spielstand new-game-1795114260527-nzr0z9 (Chris, Saison 1), Block 2: zusaetzlich
# new-game-1785412846578-h0z7cl (zweiter aktiver Spielstand).
WAPPEN = [
    ("evonik-materials", "Evonix Materials", "glowing violet hexagonal crystal with a small molecule of three linked spheres on a deep purple field"),
    ("sennheiser-audio", "Sennhauser Audio", "silver studio microphone with blue sound wave rings on a bright teal field"),
    ("kuka-automation", "Kuxa Automation", "orange industrial robot arm with a gripper claw on a light grey field with an orange band"),
    ("porsche-holding", "Porschen Holding", "black rearing horse on a golden field with red and black stripes at the sides"),
    ("rewe-united", "Rewo United", "red shopping basket filled with a carrot, an apple and a bread loaf on a white field with a red band"),
    ("hannover-rueck", "Hannober Rück", "open blue umbrella sheltering a small grey stone tower on a navy blue and white field"),
    ("hilti-befestigung", "Hilto Befestigung", "red power hammer drill with a steel drill bit on a white field with a red band"),
    ("miele-hausgeraete", "Miela Hausgeräte", "white front loading washing machine with a round glass door and soap bubbles on a dark red field"),
    ("wdr-sport", "WRD Sportpartner", "broadcast television camera on a tripod with a silver referee whistle on a blue field"),
    ("schaeffler-antrieb", "Schäffner Antrieb", "steel ball bearing ring inside a green gear wheel on a white and green field"),
    ("hella-fahrzeuglicht", "Hellix Fahrzeuglicht", "round car headlight shining bright yellow light beams on a dark blue field"),
    ("mahle-motoren", "Mahlke Motoren", "steel engine piston with connecting rod on a blue field with an orange stripe"),
    ("toom-werkstadt", "Tumm Werkstatt", "crossed hammer and wrench above a small workbench on a green field with a red band"),
    ("basf-chemie", "BASK Chemie Partner", "glass laboratory flask with bubbling bright blue liquid on a white and blue field"),
    ("deichmann-schuhe", "Deichmeier Schuhe", "brown leather ankle boot with laces on a green and white field"),
    ("hermes-paket", "Hermos Paket", "brown parcel box with two white feathered wings on a light blue field"),
    ("conrad-elektronik", "Konradin Elektronik", "green circuit board chip with a yellow lightning bolt on a blue field"),
    ("webasto-comfort", "Webasco Comfort", "orange flame and white snowflake side by side on a field split into dark blue and light blue"),
    ("trumpf-lasertechnik", "Trumpfel Lasertechnik", "bright red laser beam hitting a steel gear wheel with yellow sparks on a royal blue field"),
    ("montblanc-writing", "Montblanko Writing", "golden fountain pen nib below a white snowy mountain peak on a midnight blue field"),
    ("leica-kamera", "Leiko Kamera", "silver vintage rangefinder photo camera with a round lens on a red field"),
    ("fressnapf-tierbedarf", "Fresstrog Tierbedarf", "pet food bowl with a white bone and a paw print above it on a green field"),
    ("dr-oetker", "Dr. Oedeker Gastronomie", "white chef hat above a whisk and a wobbly pudding on a red field with a white band"),
    ("fiat-automobili", "Fiato Automobili", "little red city car with round headlights seen from the front in the middle of a white field with a green stripe on the left and a red stripe on the right"),
    ("fischer-duebelwerke", "Fischler Dübelwerke", "grey wall plug dowel with a steel screw and a small red fish above it on a white field with a red band"),
    ("general-motors", "Generic Motors", "silver V8 engine block on a royal blue field with a white underline stripe"),
    ("penny-markt", "Pfennig Markt", "big shiny copper penny coin on a red field with a yellow band"),
    ("toyota-way", "Toyato Way Mobility", "silver compact car silhouette in front of a red rising sun disc on a white field"),
    ("hornbach-co", "Hornberg & Co", "curled ram horn above a grey mountain peak on an orange field with a black band"),
    ("deutsche-bank", "Teutonia Bank Partner", "stone bank building with columns and a gold coin above it on a deep blue field with a white diagonal stripe"),
    ("chrysler-motors", "Kreisler Motors", "muscle car front grille with a pair of silver wings on a dark blue field"),
    ("jaguar-land-rover", "Jagwar Land Roamer", "leaping spotted jaguar cat above a green hill on a dark green field"),
    # Block 2
    ("bertelsmann-content", "Bertelsmeier Content", "open book with a film strip rising out of its pages on a blue field"),
    ("douglas-beauty", "Dougall Beauty", "elegant glass perfume bottle with a golden cap on a mint turquoise field"),
    ("infineon-chips", "Infinitron Chips", "square microchip with golden pins and a glowing infinity loop on a blue field with a red corner"),
    ("prosieben-media", "ProAcht Media", "red retro television set with an eight pointed white star on its screen on a dark red field"),
    ("ferrari-corse", "Ferrali Corse", "red racing car seen from the front on a yellow field with a green white red stripe on top"),
    ("apple-core", "Apfelkern Technology", "eaten apple core with a green leaf on a light silver field"),
    ("zalando-fashion", "Zalendo Fashion", "orange clothes hanger carrying a white dress on a white field with an orange band"),
    ("renault-mobility", "Renolt Mobility", "silver faceted diamond gemstone above a black car wheel on a bright yellow field"),
    ("reebok-athletics", "Reebuk Athletics", "plain white sports sneaker without any logo next to a red dumbbell on a royal blue field with a red band"),
    ("metaworld-social", "Metaworld Social", "blue globe surrounded by three white speech bubbles on a bright blue field"),
    ("netto-markendiscount", "Nettio Markendiscount", "red shopping cart with a price tag on a yellow field with a red band"),
    ("kuehne-nagel-fracht", "Kühle & Nagel Fracht", "container cargo ship above a silver anchor on a navy blue field"),
    ("loreal-cosmetics", "LaRoyal Cosmetics", "golden lipstick with a small golden crown above it on a deep magenta field"),
    ("adobe-creative", "Abode Creative", "crossed paintbrush and pencil in front of a small white house on a bright red field"),
    ("unilever-brands", "Unilover Brands", "white heart shape made of leaves and flowers on a blue field"),
    ("nike-just-do-it", "Nikay Sportswear", "white running shoe with a feathered wing at the heel on a bright orange field"),
    ("carlsberg-brewery", "Karlsbrau Brewery", "glass beer mug with white foam and green hop leaves on a dark green field"),
    ("hp-hardware", "HQ Hardware", "beige desktop computer with monitor, keyboard and a small printer, in the middle of a royal blue field"),
    ("enbw-strom", "EnWB Strom", "white wind turbine with a yellow lightning bolt on a blue field with an orange band"),
    ("canon-imaging", "Kanon Imaging", "big camera lens with a red ring and glass reflections on a white field with a red band"),
]


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


def bestelle(brand_id):
    platz = next(i for i, w in enumerate(WAPPEN) if w[0] == brand_id)
    _, name, sinnbild = WAPPEN[platz]
    datei = brand_id + ".png"
    ziel = os.path.join(ZIEL, datei)
    if os.path.exists(ziel):
        print(f"{datei}: existiert schon, uebersprungen")
        return
    vorher = guthaben()
    if vorher - 1 < RESERVE:
        sys.exit(f"Guthaben {vorher:.1f}: Reserve {RESERVE} waere beruehrt, Abbruch")
    prompt = f"{sinnbild}, {STIL}"
    saat = 6000 + platz + SAAT_VERSATZ.get(brand_id, 0)
    body = {"description": prompt, "image_size": {"width": 96, "height": 96}, "no_background": True, "seed": saat}
    r = einmal("POST", "/create-image-pixflux", body)  # genau ein POST; jede Ausnahme bricht den Lauf ab
    b = r["image"]["base64"]
    if "," in b[:40]:
        b = b.split(",", 1)[1]
    Image.open(io.BytesIO(base64.b64decode(b))).convert("RGBA").save(ziel, "PNG", optimize=True)
    gen = (r.get("usage") or {}).get("generations")
    nachher = guthaben()
    qpfad = os.path.join(ZIEL, "quellen.json")
    q = json.load(open(qpfad))
    q[datei] = {"paket": "PixelLab", "endpunkt": "/create-image-pixflux", "groesse": "96x96",
                "bezug": f"Sponsor {brand_id} ({name}), Banner leer", "saat": saat, "generationen": gen,
                "guthaben_vorher": round(vorher, 2), "guthaben_nachher": round(nachher, 2), "prompt": prompt}
    json.dump(q, open(qpfad, "w"), indent=1, ensure_ascii=False)
    print(json.dumps({"datei": datei, "usage": r.get("usage"), "vorher": round(vorher, 2), "nachher": round(nachher, 2)}), flush=True)


def main():
    art = sys.argv[1] if len(sys.argv) > 1 else ""
    if art == "guthaben":
        print(guthaben())
    elif art == "liste":
        for b, n, _ in WAPPEN:
            print(b, "|", n, "|", "da" if os.path.exists(os.path.join(ZIEL, b + ".png")) else "fehlt")
    elif art == "bestelle":
        for b in sys.argv[2:]:
            bestelle(b)
    else:
        sys.exit("bestelle <brandId> ... | guthaben | liste")


if __name__ == "__main__":
    main()
