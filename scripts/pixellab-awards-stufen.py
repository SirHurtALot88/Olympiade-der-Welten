#!/usr/bin/env python3
"""Award-Embleme in Silber und Bronze, nativ von PixelLab (24.11., Restguthaben): zehn der Gold-Embleme aus scripts/pixellab-awards.py.

    flock /tmp/pixellab-bestell.lock python3 -I scripts/pixellab-awards-stufen.py bestelle <name> [...]

Je Stufe EIN POST (/v2/create-image-pixflux, 96x96, no_background), keine Wiederholung. Ziel: public/sprites/awards-stufen/<name>-<silber|bronze>.png
(eigener Ordner, damit es nicht mit den lokal umgefaerbten Dateien unter public/sprites/awards/ kollidiert). Herkunft: quellen.json dort.
"""
import base64, io, json, os, sys, urllib.request, urllib.error
from PIL import Image

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.pixellab.ai/v2"
ZIEL = os.path.join(WURZEL, "public", "sprites", "awards-stufen")
STIL = {"silber": "polished silver metal with bright white highlights and cool blue grey shading", "bronze": "polished bronze copper metal with warm brown highlights and deep shading"}
REST = "centered, front view, pixel art game icon, 16-bit RPG item style, clean dark outline, no text, no letters, no numbers"
# name -> (Bezug, Sinnbild, Saat)  (Sinnbild aus pixellab-awards.py; "golden" wird durch das Metall der Stufe ersetzt)
EMBLEME = {
    "mvp": ("MVP der Saison", "golden trophy cup with two handles and a five pointed star on top wearing a small royal crown with red gems, on a dark stone base", 7001),
    "mip": ("Most Improved Player", "golden winged arrow pointing steeply upwards over three rising steps, small sparkles, on a dark stone base, trophy statuette", 7002),
    "pow": ("Bester Power-Spieler (Klassenfarbe POW)", "golden clenched gauntlet fist holding up a heavy war hammer, framed by a round golden ring with a glowing red ruby enamel background, red flames", 7003),
    "spe": ("Bester Speed-Spieler (Klassenfarbe SPE)", "golden winged boot with a lightning bolt, framed by a round golden ring with a glowing emerald green enamel background, green wind streaks", 7004),
    "men": ("Bester Mental-Spieler (Klassenfarbe MEN)", "golden wise owl head with an open eye above an open book, framed by a round golden ring with a glowing sapphire blue enamel background, blue stars", 7005),
    "soc": ("Bester Social-Spieler (Klassenfarbe SOC)", "golden theatre mask smiling next to a small lyre harp, framed by a round golden ring with a glowing amber and purple enamel background, confetti", 7006),
    "meister": ("Meisterschale der Liga", "big round golden champion shield plate with engraved rings and a crown in the centre, two crossed laurel branches below", 7009),
    "medaille": ("Disziplin-Medaille der Teams", "round golden medal coin with a laurel wreath rim and a plain raised star in the middle, hanging on a short dark blue and cream striped ribbon", 7008),
    "sprung": ("Sprung der Saison (Team, Kaderstaerke-Rang)", "golden rocket shooting diagonally upwards over a golden ladder of bars getting taller, small sparkle stars, on a dark stone base", 7026),
    "allrounder": ("Allrounder der Saison (alle vier Farben)", "round golden compass medallion with four gems at the four points, one red ruby, one green emerald, one blue sapphire, one yellow topaz, a golden four pointed star in the centre", 7023),
}


def einmal(method, pfad, body=None):
    h = {"Content-Type": "application/json"}
    if os.environ.get("PIXELLAB_API_KEY"):
        h["Authorization"] = "Bearer " + os.environ["PIXELLAB_API_KEY"]
    req = urllib.request.Request(API + pfad, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} {pfad}: {e.read().decode(errors='replace')[:500]}")


def main():
    if len(sys.argv) < 3 or sys.argv[1] != "bestelle":
        sys.exit(__doc__)
    os.makedirs(ZIEL, exist_ok=True)
    qp = os.path.join(ZIEL, "quellen.json")
    q = json.load(open(qp)) if os.path.exists(qp) else {}
    for name in sys.argv[2:]:
        bezug, sinn, saat = EMBLEME[name]
        for stufe in ("silber", "bronze"):
            datei = f"{name}-{stufe}.png"
            ziel = os.path.join(ZIEL, datei)
            if os.path.exists(ziel):
                continue
            metall = "silver" if stufe == "silber" else "bronze"
            prompt = f"single award emblem, {sinn.replace('golden', metall).replace('gold ', metall + ' ')}, {STIL[stufe]}, {REST}"
            vorher = einmal("GET", "/balance")["subscription"]["generations"]
            r = einmal("POST", "/create-image-pixflux", {"description": prompt, "image_size": {"width": 96, "height": 96}, "no_background": True, "seed": saat})
            b = r["image"]["base64"]
            if "," in b[:40]:
                b = b.split(",", 1)[1]
            Image.open(io.BytesIO(base64.b64decode(b))).convert("RGBA").save(ziel, "PNG", optimize=True)
            q[datei] = {"paket": "PixelLab", "endpunkt": "/v2/create-image-pixflux", "groesse": "96x96", "bezug": bezug + " (" + stufe + ")", "saat": saat, "datum": "2026-11-24",
                        "generationen": (r.get("usage") or {}).get("generations"), "guthaben_vorher": round(vorher, 2), "prompt": prompt}
            json.dump(q, open(qp, "w"), indent=1, ensure_ascii=False)
            print(json.dumps({"datei": datei, "usage": r.get("usage")}), flush=True)


if __name__ == "__main__":
    main()
