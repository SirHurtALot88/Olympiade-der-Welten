#!/usr/bin/env python3
"""BASKETBALL-ASSETS (Benchmark-Disziplin, 17.11.): Bestellwerkzeug nach den Bestellregeln aus
CLAUDE.md und docs/design/offene-punkte-entscheidungen-17-11.md Abschnitt 4.3.

  python3 -I scripts/pixellab-basketball-bestellen.py konto
  python3 -I scripts/pixellab-basketball-bestellen.py bestellen <name> [--kandidaten DIR]
  python3 -I scripts/pixellab-basketball-bestellen.py abholen <name> <job-id> [--kandidaten DIR]
  python3 -I scripts/pixellab-basketball-bestellen.py waehlen <name> <index> [--kandidaten DIR]

Unterschiede zu scripts/pixellab-requisiten.py `bestellen`:
  * Der POST geht GENAU EINMAL hinaus (eigene Funktion `einmal_post`, nicht `api()` aus
    scripts/lib/pixellab_api.py, das auch POSTs bei Zeitueberschreitung/5xx wiederholt). Schlaegt er
    fehl, bricht das Skript ab und nennt den Kontostand; ist er gefallen, gilt der Auftrag als
    ausgefuehrt und wird ueber `abholen` mit der Job-ID geholt. Nur GETs (Konto, Job) duerfen wiederholen.
  * Sperre /tmp/pixellab-bestell.lock (flock): nur ein Besteller zugleich.
  * Budgetbremse: Topf Basketball hoechstens TOPF Generationen (Summe der protokollierten
    `usage.generations`), Konto-Reserve RESERVE unantastbar.
  * Jeder Auftrag steht mit Kontostand vorher/nachher und `usage` im Bestellprotokoll
    data/generated/pixellab-requisiten/basketball-17-11/bestellprotokoll.json.

Der Bau der Motor-Dateien aus den gewaehlten Rohbildern: scripts/baue-basketball-assets.py (ohne Netz).
"""
import argparse
import datetime
import fcntl
import json
import os
import shutil
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROH = os.path.join(WURZEL, "data/generated/pixellab-requisiten/roh")
AUSWAHL = os.path.join(WURZEL, "data/generated/pixellab-requisiten/auswahl.json")
PROTOKOLL = os.path.join(WURZEL, "data/generated/pixellab-requisiten/basketball-17-11/bestellprotokoll.json")
SPERRE = "/tmp/pixellab-bestell.lock"
TOPF = 70.0       # Basketball-Gesamtbudget (Auftrag 17.11.)
RESERVE = 150.0   # Konto-Reserve, unantastbar (CLAUDE.md)

WELT = "dark fantasy medieval arena style"
STIL = "pixel art game asset, 16-bit RPG style, clean single color dark outline"

# name -> Auftrag. `schaetzung`: erwartete Kosten (Massstab aus den frueheren Wellen: Requisit bis
# 128 px ~10, bis 170 px ~15, Breitformat 25) -- nur fuer die Budgetbremse VOR dem Auftrag.
AUFTRAEGE = {
    # (a) Der Korb. Arena-Kamera Basketball: Draufsicht-Karte mit Figuren in 3/4-Sicht, die Koerbe
    # stehen an den Schmalseiten (korbXVon: W*0.076 / W*0.924). Bestellt wird der LINKE Korb (Brett
    # links, Ring ragt nach rechts ins Feld); der rechte ist die Spiegelung. Massstab 1:1 zu den
    # Figuren (PixelLab-Figur ~52 px hoch im Motor, HOEHEN_BEZUG).
    "bb_korb": dict(gen=(96, 128), schaetzung=10,
        prompt=("a tall basketball hoop on a stand, side view seen slightly from above, the hoop faces to the right: "
                "a heavy dark wrought iron pole on a carved stone base at the left, a rectangular weathered wooden "
                "backboard with iron bands and rivets seen at an angle, a round red-orange iron rim ring sticking out "
                "to the right of the backboard seen as an open ellipse, a white rope net hanging down from the rim, "
                f"{WELT}, 3/4 top-down view as in a classic top-down RPG, whole object visible, {STIL}")),
    # (b) Boden. Parkett-Halle als REMAKE (ersetzt die gekachelte Altkulisse parkett.jpg): gleiche
    # Bildaufteilung wie kulisse_basketball_streetcourt (Welle A): Rand oben/unten, Boden frei, keine Linien.
    "kulisse_basketball_parkett": dict(gen=(792, 300), hintergrund=True, schaetzung=25,
        prompt=("top-down view of one single very wide empty indoor arena court inside a dark fantasy castle hall, "
                "a stone grandstand wall with wooden railing, hanging heraldic banners and burning wall torches along "
                "the top edge and along the bottom edge, the whole rest is open flat floor of plain warm polished "
                "wooden plank parquet with no lines and no markings, only a narrow strip of dark grey stone tiles at "
                "the far left and right borders, warm torch light, nothing in the middle, no hoops, no characters, "
                "no text, 16-bit RPG top-down map, pixel art")),
    # Mittelkreis-Wappen: aufgemalte Bodenmarke, strenge Draufsicht (liegt flach im Mittelkreis r = H*0.09).
    "bb_wappen": dict(gen=(96, 96), schaetzung=10,
        prompt=("round painted heraldic crest emblem painted flat on a floor, seen from directly above: a dragon skull "
                "with crossed torches inside a ring border, worn faded paint in dark red and gold, perfectly circular, "
                f"flat decal without shading or perspective, top-down view, {WELT}, {STIL}")),
    # Optionales Kulissen-Detail: Rahmen der Schussuhr am Korb (zeichneShotClock zeichnet heute eine
    # 38x22-Canvas-Box an der Grundlinie); leere Schieferflaeche fuer die Motor-Ziffer.
    "bb_schussuhr": dict(gen=(48, 32), schaetzung=10,
        prompt=("small empty rectangular scoreboard sign, wide dark wrought iron frame with rivets and small corner "
                "spikes around a plain flat empty dark slate panel, no text, no numbers, no symbols, front view, "
                f"{WELT}, {STIL}")),
}


def jetzt():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def konto():
    from pixellab_api import api
    return float(api("GET", "/balance")["subscription"]["generations"])


def lade_protokoll():
    if os.path.exists(PROTOKOLL):
        return json.load(open(PROTOKOLL))
    return {"_hinweis": "Bestellprotokoll Basketball-Assets 17.11. (Topf 70 Gen., Reserve 150). Je Auftrag: Kontostand "
                        "vorher/nachher (GET /balance) und usage.generations aus der Job-Antwort. Massgeblich ist "
                        "usage; die Kontodifferenz taugt nicht, solange mehrere Agenten bestellen.",
            "auftraege": []}


def schreibe_protokoll(p):
    os.makedirs(os.path.dirname(PROTOKOLL), exist_ok=True)
    json.dump(p, open(PROTOKOLL, "w"), indent=1, ensure_ascii=False)
    open(PROTOKOLL, "a").write("\n")


def verbraucht(p):
    return sum(float(a.get("gen_usage") if a.get("gen_usage") is not None else a.get("schaetzung", 0))
               for a in p["auftraege"])


def einmal_post(pfad, body):
    """GENAU EIN POST. Keine Wiederholung, auch nicht bei Zeitueberschreitung oder 5xx."""
    from pixellab_api import API, _kopf
    req = urllib.request.Request(API + pfad, data=json.dumps(body).encode(), method="POST", headers=_kopf())
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())


def gen_aus(usage):
    if isinstance(usage, dict):
        for k in ("generations", "generations_used", "amount"):
            if isinstance(usage.get(k), (int, float)):
                return float(usage[k])
    return None


def kand_dir(args, name):
    return os.path.join(args.kandidaten or "/tmp/pixellab-kandidaten", name)


def hole(args, name, job, eintrag, p):
    from pixellab_api import warte_job, bild_aus
    j = warte_job(job, max_s=900)
    lr = j.get("last_response") or {}
    u = gen_aus(lr.get("usage")) or gen_aus(j.get("usage"))
    if u is not None:
        eintrag["gen_usage"] = u
    eintrag["usage_job"] = lr.get("usage") or j.get("usage")
    ims = [bild_aus(x) for x in (lr.get("images") or ([lr["image"]] if lr.get("image") else []))]
    d = kand_dir(args, name)
    os.makedirs(d, exist_ok=True)
    for i, im in enumerate(ims):
        im.save(os.path.join(d, f"{i:02d}.png"))
    a = AUFTRAEGE[name]
    json.dump({"prompt": eintrag["prompt"], "seed": eintrag["seed"], "gen": list(a["gen"]), "job": job},
              open(os.path.join(d, "auftrag.json"), "w"), indent=1)
    eintrag["gen_nachher"] = konto()
    eintrag["kandidaten"] = len(ims)
    schreibe_protokoll(p)
    print(f"{name}: {len(ims)} Kandidaten -> {d}; usage={eintrag.get('usage_job')}; Konto {eintrag.get('gen_vorher')} -> {eintrag['gen_nachher']}")


def bestellen(args):
    name = args.namen[0]
    a = AUFTRAEGE[name]
    with open(SPERRE, "w") as sperre:
        fcntl.flock(sperre, fcntl.LOCK_EX)
        p = lade_protokoll()
        vorher = konto()
        if verbraucht(p) + a["schaetzung"] > TOPF:
            raise SystemExit(f"Topf: {verbraucht(p)} + {a['schaetzung']} > {TOPF} -- nicht bestellt.")
        if vorher - a["schaetzung"] < RESERVE:
            raise SystemExit(f"Reserve: Konto {vorher} -- nicht bestellt.")
        w, h = a["gen"]
        body = {"description": a["prompt"], "image_size": {"width": w, "height": h},
                "no_background": not a.get("hintergrund", False), "seed": args.seed}
        eintrag = {"name": name, "datum": jetzt(), "endpunkt": "/v2/generate-image-v2", "prompt": a["prompt"],
                   "seed": args.seed, "gen": [w, h], "schaetzung": a["schaetzung"], "gen_vorher": vorher}
        p["auftraege"].append(eintrag)
        schreibe_protokoll(p)
        try:
            r = einmal_post("/generate-image-v2", body)
        except urllib.error.HTTPError as e:
            eintrag["fehler"] = f"HTTP {e.code}: {e.read().decode(errors='replace')[:300]}"
            eintrag["gen_nachher"] = konto()
            if e.code in (401, 402, 422, 429):
                eintrag["gen_usage"] = 0.0   # abgelehnt, nichts abgerechnet
            schreibe_protokoll(p)
            raise SystemExit(f"POST abgelehnt ({eintrag['fehler']}); Konto {vorher} -> {eintrag['gen_nachher']}. NICHT wiederholt.")
        except Exception as e:  # Zeitueberschreitung/Netz: NICHT wiederholen, Konto lesen
            eintrag["fehler"] = f"{type(e).__name__}: {e}"
            eintrag["gen_nachher"] = konto()
            schreibe_protokoll(p)
            raise SystemExit(f"POST ohne Antwort ({eintrag['fehler']}); Konto {vorher} -> {eintrag['gen_nachher']}. "
                             "NICHT wiederholt -- ist das Konto gefallen, gilt der Auftrag als ausgefuehrt.")
        eintrag["job"] = r.get("background_job_id")
        eintrag["usage_post"] = r.get("usage")
        u = gen_aus(r.get("usage"))
        if u is not None:
            eintrag["gen_usage"] = u
        schreibe_protokoll(p)
        hole(args, name, eintrag["job"], eintrag, p)


def abholen(args):
    name, job = args.namen[0], args.namen[1]
    p = lade_protokoll()
    eintrag = next((a for a in p["auftraege"] if a.get("job") == job), None)
    if eintrag is None:
        raise SystemExit("Job steht nicht im Protokoll.")
    hole(args, name, job, eintrag, p)


def waehlen(args):
    name, idx = args.namen[0], int(args.namen[1])
    d = kand_dir(args, name)
    auftrag = json.load(open(os.path.join(d, "auftrag.json")))
    name = args.als or name   # zweiter Treffer aus demselben Auftrag unter eigenem Namen
    os.makedirs(ROH, exist_ok=True)
    shutil.copy(os.path.join(d, f"{idx:02d}.png"), os.path.join(ROH, f"{name}.png"))
    p = lade_protokoll()
    e = next((a for a in p["auftraege"] if a.get("job") == auftrag["job"]), {})
    e["gewaehlt"] = sorted(set(([e["gewaehlt"]] if isinstance(e.get("gewaehlt"), int) else e.get("gewaehlt", [])) + [idx]))
    schreibe_protokoll(p)
    aw = json.load(open(AUSWAHL)) if os.path.exists(AUSWAHL) else {}
    aw[name] = dict(auftrag, kandidat=idx, endpunkt="/v2/generate-image-v2", datum=e.get("datum"),
                    gen_vorher=e.get("gen_vorher"), gen_nachher=e.get("gen_nachher"), gen_usage=e.get("gen_usage"))
    json.dump(dict(sorted(aw.items())), open(AUSWAHL, "w"), indent=1, ensure_ascii=False)
    print(f"{name}: Kandidat {idx} -> roh/{name}.png")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("befehl", choices=["konto", "bestellen", "abholen", "waehlen"])
    ap.add_argument("namen", nargs="*")
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--kandidaten")
    ap.add_argument("--als", help="waehlen: Rohbild unter diesem Namen ablegen")
    args = ap.parse_args()
    if args.befehl == "konto":
        p = lade_protokoll()
        print(f"Konto {konto()} Gen.; Topf Basketball verbraucht {verbraucht(p)} von {TOPF}")
    else:
        {"bestellen": bestellen, "abholen": abholen, "waehlen": waehlen}[args.befehl](args)


if __name__ == "__main__":
    main()
