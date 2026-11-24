#!/usr/bin/env python3
"""Award- und Medaillen-Embleme (24.11.): Requisiten/UI-Embleme fuer Spieler-Awards und Team-Medaillen.

    flock /tmp/pixellab-bestell.lock python3 -I scripts/pixellab-awards.py bestelle <name> [<name> ...]
    python3 -I scripts/pixellab-awards.py guthaben
    python3 -I scripts/pixellab-awards.py stufen          (Silber/Bronze lokal aus dem Gold-Emblem, 0 Generationen)

Chris, 24.11.: Spieler-Awards (MVP, Most Improved, je Klassenfarbe einer, All-Star) und Team-Medaillen, je Gold/Silber/Bronze,
"jeder mit eigenem Look". Bestellt wird je Award EIN Gold-Emblem (/v2/create-image-pixflux, no_background); Silber und Bronze
entstehen lokal durch Umfaerben der Gold-Toene (spart zwei Drittel der Generationen, die Form bleibt je Award dieselbe).
Je Emblem genau EIN POST, KEINE Wiederholung (jede Ausnahme bricht ab). Reserve 150. Keine Figuren, keine Animationen.
Herkunft: public/sprites/awards/quellen.json.
"""
import base64
import colorsys
import io
import json
import os
import sys
import urllib.request

from PIL import Image

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.pixellab.ai/v2"
RESERVE = 150
ZIEL = os.path.join(WURZEL, "public", "sprites", "awards")
STIL = ("single award emblem, polished gold metal with bright highlights and deep shading, centered, front view, "
        "pixel art game icon, 16-bit RPG item style, clean dark outline, no text, no letters, no numbers")
GROESSE = 96

# name -> (Bezug, Sinnbild, Saat)
EMBLEME = {
    "mvp": ("MVP der Saison", "golden trophy cup with two handles and a five pointed star on top wearing a small royal crown with red gems, on a dark stone base", 7001),
    "pow": ("Bester Power-Spieler (Klassenfarbe POW)", "golden clenched gauntlet fist holding up a heavy war hammer, framed by a round golden ring with a glowing red ruby enamel background, red flames", 7003),
    "medaille": ("Disziplin-Medaille der Teams", "round golden medal coin with a laurel wreath rim and a plain raised star in the middle, hanging on a short dark blue and cream striped ribbon", 7008),
    "mip": ("Most Improved Player", "golden winged arrow pointing steeply upwards over three rising steps, small sparkles, on a dark stone base, trophy statuette", 7002),
    "spe": ("Bester Speed-Spieler (Klassenfarbe SPE)", "golden winged boot with a lightning bolt, framed by a round golden ring with a glowing emerald green enamel background, green wind streaks", 7004),
    "men": ("Bester Mental-Spieler (Klassenfarbe MEN)", "golden wise owl head with an open eye above an open book, framed by a round golden ring with a glowing sapphire blue enamel background, blue stars", 7005),
    "soc": ("Bester Social-Spieler (Klassenfarbe SOC)", "golden theatre mask smiling next to a small lyre harp, framed by a round golden ring with a glowing amber and purple enamel background, confetti", 7006),
    "allstar": ("All-Star-Team der Saison", "large golden five pointed star with a smaller star inside, surrounded by an open golden laurel wreath, shield plaque", 7007),
    "meister": ("Meisterschale der Liga", "big round golden champion shield plate with engraved rings and a crown in the centre, two crossed laurel branches below", 7009),
    "pp": ("PP-Koenig der Saison", "golden royal crown with a big diamond, resting on a red velvet cushion with golden tassels", 7010),
    "spieltag": ("Spieler des Spieltags", "small round golden badge pin with a bright sunburst and a single star in the middle, short red ribbon tails below", 7011),
    "neuzugang": ("Neuzugang der Saison", "rolled parchment contract scroll with a red wax seal and a golden quill pen crossed over it, inside a golden hexagon frame with small stars", 7013),
    "eisern": ("Eiserner Spieler (alle Einsaetze)", "heavy golden anvil with a golden heart shaped shield on top and a chain link around it, solid and sturdy, on a small pedestal", 7014),
    "disziplin": ("Disziplin-Koenig", "golden torch with a bright orange flame inside a golden ring of five small circles, on a small pedestal", 7012),
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


def quellen():
    p = os.path.join(ZIEL, "quellen.json")
    return (json.load(open(p)) if os.path.exists(p) else {}), p


def bestelle(name):
    bezug, sinnbild, saat = EMBLEME[name]
    datei = f"{name}-gold.png"
    ziel = os.path.join(ZIEL, datei)
    if os.path.exists(ziel):
        print(f"{datei}: existiert schon, uebersprungen")
        return
    vorher = guthaben()
    if vorher - 2 < RESERVE:
        sys.exit(f"Guthaben {vorher:.1f}: Reserve {RESERVE} waere beruehrt, Abbruch")
    prompt = f"{sinnbild}, {STIL}"
    body = {"description": prompt, "image_size": {"width": GROESSE, "height": GROESSE}, "no_background": True, "seed": saat}
    r = einmal("POST", "/create-image-pixflux", body)  # genau ein POST; jede Ausnahme bricht den Lauf ab
    b = r["image"]["base64"]
    if "," in b[:40]:
        b = b.split(",", 1)[1]
    Image.open(io.BytesIO(base64.b64decode(b))).convert("RGBA").save(ziel, "PNG", optimize=True)
    gen = (r.get("usage") or {}).get("generations")
    nachher = guthaben()
    q, qp = quellen()
    q[datei] = {"paket": "PixelLab", "endpunkt": "/create-image-pixflux", "groesse": f"{GROESSE}x{GROESSE}", "bezug": bezug, "saat": saat,
                "generationen": gen, "guthaben_vorher": round(vorher, 2), "guthaben_nachher": round(nachher, 2), "prompt": prompt}
    json.dump(q, open(qp, "w"), indent=1, ensure_ascii=False)
    print(json.dumps({"datei": datei, "usage": r.get("usage"), "vorher": round(vorher, 2), "nachher": round(nachher, 2)}), flush=True)


def umfaerben(bild, art):
    """Gold-Toene (Farbton 20..64 Grad, gesaettigt) nach Silber bzw. Bronze; alle anderen Farben (Edelsteine, Emaille, Band) bleiben."""
    px = bild.load()
    for y in range(bild.height):
        for x in range(bild.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            grad = h * 360
            if not (20 <= grad <= 64 and s >= 0.28):
                continue
            if art == "silber":
                nh, ns, nv = 0.60, s * 0.13, min(1.0, v * 1.04 + 0.03)
            else:
                nh, ns, nv = 0.062, min(1.0, s * 0.92 + 0.04), v * 0.80
            nr, ng, nb = colorsys.hsv_to_rgb(nh, ns, nv)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return bild


def stufen():
    q, qp = quellen()
    for name in EMBLEME:
        gold = os.path.join(ZIEL, f"{name}-gold.png")
        if not os.path.exists(gold):
            continue
        for art in ("silber", "bronze"):
            datei = f"{name}-{art}.png"
            umfaerben(Image.open(gold).convert("RGBA"), art).save(os.path.join(ZIEL, datei), "PNG", optimize=True)
            q[datei] = {"paket": "abgeleitet", "aus": f"{name}-gold.png", "weg": "scripts/pixellab-awards.py stufen (Gold-Toene lokal umgefaerbt)", "generationen": 0}
        print(name, "Silber und Bronze geschrieben")
    json.dump(q, open(qp, "w"), indent=1, ensure_ascii=False)


def main():
    art = sys.argv[1] if len(sys.argv) > 1 else ""
    if art == "guthaben":
        print(guthaben())
    elif art == "stufen":
        stufen()
    elif art == "bestelle":
        for n in sys.argv[2:]:
            bestelle(n)
    else:
        sys.exit("bestelle <name> ... | guthaben | stufen")


if __name__ == "__main__":
    main()
