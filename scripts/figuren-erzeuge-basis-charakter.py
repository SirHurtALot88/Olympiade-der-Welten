#!/usr/bin/env python3
"""Erzeugt bei PixelLab eine NEUE Basis-Figur aus einer Textbeschreibung (die erste Pose/das
Grundbild, aus der sich Animationen ableiten) -- anders als figuren-bestelle-animationen.py, das
NUR fehlende Animationen fuer eine BEREITS EXISTIERENDE Figur nachbestellt. Dieses Skript hier
fehlte im Repo (fruehere Sitzungen haben Basis-Erzeugung offenbar nur im Scratchpad gemacht, nie
committet, s. CLAUDE.md-Auftrag vom 08.11.) -- jetzt fuer den Corsair-Koerperform-Kandidaten
geschrieben und als eigenstaendiges, wiederverwendbares Werkzeug committet.

    PIXELLAB_API_KEY=... python3 -I scripts/figuren-erzeuge-basis-charakter.py <subjekte.json> <slug>
        [--trocken] [--warte-basis] [--warte-animationen] [--tag <tag>]

<subjekte.json>: {slug: {"beschreibung": "<Erzeugungs-Prompt fuer die Basis-Figur, reich, frei>",
                         "subjekt": "<kurze Nominalphrase <=300 Zeichen, fuer spaetere
                                      pixminimax-Animationen -- z.B. 'a knight in silver plate
                                      armour'>",
                         "proportionen": {"legs_length": 1.1, ...}  (optional, CharacterProportions),
                         "angriff": "<optionaler Angriffstext>"  (optional, sonst Kanon-Default)}}

Ablauf, Kanon wie bei den ~360 bestehenden Figuren im Projekt (nachgemessen per GET
/characters/{id} an mehreren Stichproben am 08.11.: alle zeigen size 80x80, directions=8,
view='low top-down'):

  1. POST /create-character-with-8-directions  (mode='standard' -- Template-Skelett-Erzeugung,
     1 Generation, nicht 'pro' mit 10-25 Generationen/Richtung -- s. OpenAPI-Beschreibung des
     Feldes 'mode'). Canvas 80x80, template_id='mannequin' (humanoid), view='low top-down'.
  2. GET /characters/{character_id} pollen, bis status=='completed' (rotation_urls stehen erst
     dann; die Basis-Erzeugung ist selbst schon ein Background-Job).
  3. POST /characters/animations fuer die vier Kanon-Animationsgruppen (walk/angriff/treffer/tod,
     je 16/16/8/16 Aktionsbilder -- ARTEN_KANON, identisch zu figuren-bestelle-animationen.py),
     Richtungen south+east+north (west wird im Spiel-Motor aus Ost gespiegelt, PixelLab-Kanon),
     mode='pixminimax'.
  4. Optional --warte-animationen: pollen, bis alle vier Gruppen Frames in allen drei Richtungen
     haben.

Schreibt NICHTS in data/generated/figuren-sprites.json und ruehrt keine bestehende Figur an --
das bleibt bewusst ein separater, manueller Schritt (Export/Download fuer einen einzelnen neuen
Kandidaten ist nicht derselbe Pfad wie figuren-sprites-export.py, das nur echte Spieler-Slugs
kennt). Der Schluessel wird nur auf Vorhandensein geprueft und nie ausgegeben.
"""
import argparse, json, os, sys, time, urllib.request, urllib.error

API = "https://api.pixellab.ai/v2"
DIRS = ["south", "east", "north"]
ARTEN_KANON = [
    ("walk", 16, "walks forward with a steady stride, arms swinging naturally, then returns to the starting pose"),
    ("angriff", 16, None),
    ("treffer", 8, "recoils backward sharply as if struck by a heavy hit, flinching, then steadies"),
    ("tod", 16, "is struck down, staggers, collapses to the ground and dies, lying still"),
]


def key():
    k = os.environ.get("PIXELLAB_API_KEY")
    if not k:
        sys.exit("PIXELLAB_API_KEY fehlt")
    return k


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    t_start = time.time()
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={"Authorization": f"Bearer {key()}", "Content-Type": "application/json"})
    i = -1
    while True:
        i += 1
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            txt = e.read().decode(errors="replace")[:600]
            if e.code == 429 and "job slots" in txt:
                if time.time() - t_start > 45 * 60:
                    raise SystemExit(f"HTTP 429 nach 45 min Warten: {txt}")
                print("    ... keine Job-Slots frei, warte 30 s", flush=True)
                time.sleep(30)
                continue
            if e.code in (429, 500, 502, 503, 504) and i < 4:
                time.sleep(10 * (i + 1))
                continue
            raise SystemExit(f"HTTP {e.code} {method} {path}: {txt}")
        except Exception as e:  # noqa
            if i < 4:
                time.sleep(5 * (i + 1))
                continue
            raise


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("subjekte")
    ap.add_argument("slug")
    ap.add_argument("--trocken", action="store_true", help="nur den Plan zeigen, keine kostenpflichtigen Calls")
    ap.add_argument("--warte-basis", action="store_true", help="pollen, bis die Basis-Figur status=='completed' ist")
    ap.add_argument("--warte-animationen", action="store_true", help="pollen, bis alle vier Gruppen fertig sind (impliziert --warte-basis)")
    ap.add_argument("--tag", default=None, help="Tag, das der neuen Figur per PATCH gesetzt wird (nur Organisation, keine Spielanbindung)")
    args = ap.parse_args()
    key()
    subj = json.load(open(args.subjekte))
    if args.slug not in subj:
        sys.exit(f"{args.slug}: kein Eintrag in {args.subjekte}")
    s = subj[args.slug]
    if "beschreibung" not in s or "subjekt" not in s:
        sys.exit(f"{args.slug}: braucht 'beschreibung' und 'subjekt' in {args.subjekte}")

    basis_body = {
        "description": s["beschreibung"],
        "image_size": {"width": 80, "height": 80},
        "mode": "standard",
        "view": "low top-down",
        "template_id": "mannequin",
    }
    if s.get("proportionen"):
        basis_body["proportions"] = {"type": "custom", **s["proportionen"]}
    print(f"{args.slug}: Basis-Figur anlegen")
    print(f"  beschreibung: {s['beschreibung']!r}")
    print(f"  body (ohne description): {json.dumps({k: v for k, v in basis_body.items() if k != 'description'})}")
    if args.trocken:
        print("--trocken: kein Call gesendet.")
        return

    r = api("POST", "/create-character-with-8-directions", basis_body)
    cid = r["character_id"]
    print(f"  -> character_id={cid} status={r.get('status')} usage={r.get('usage')} job={r.get('background_job_id')}")

    if args.tag:
        try:
            api("PATCH", f"/characters/{cid}/tags", {"tags": [args.tag]})
            print(f"  tag gesetzt: {args.tag}")
        except SystemExit as e:
            print(f"  WARNUNG: Tag setzen fehlgeschlagen ({e}) -- character_id bleibt gueltig")

    warte_basis = args.warte_basis or args.warte_animationen
    if warte_basis:
        print("  warte auf Basis-Figur (status=='completed') ...")
        t0 = time.time()
        d = None
        while time.time() - t0 < 20 * 60:
            d = api("GET", f"/characters/{cid}")
            if d.get("status") == "completed":
                break
            if d.get("status") == "failed":
                sys.exit(f"Basis-Figur fehlgeschlagen: {json.dumps(d)[:500]}")
            time.sleep(20)
        if not d or d.get("status") != "completed":
            sys.exit(f"Basis-Figur nach 20 min nicht fertig (status={d.get('status') if d else None}), character_id={cid} bleibt bestehen -- spaeter mit GET /characters/{cid} weiterverfolgen")
        print(f"  fertig: rotation_urls fuer {sorted(k for k, v in d['rotation_urls'].items() if v)}")
    else:
        print("  (kein --warte-basis: Animationen werden sofort bestellt, auch wenn die Basis noch verarbeitet -- die API erlaubt das laut Doku, da character_id sofort gueltig ist)")

    bestellt = []
    for art, frames, default_text in ARTEN_KANON:
        text = s.get(art) or default_text or "lunges forward and swings a heavy strike at an enemy in front, then returns to the starting pose"
        body = {
            "character_id": cid, "mode": "pixminimax", "frame_count": frames,
            "action_description": text, "animation_name": text,
            "subject_description": s["subjekt"][:300],
            "directions": DIRS,
        }
        print(f"{args.slug}: {art:8} NEU {DIRS} frames={frames}", flush=True)
        rr = api("POST", "/characters/animations", body)
        gid = rr.get("animation_group_id")
        print(f"    {args.slug}/{art} -> gid={gid} status={rr.get('status')} jobs={len(rr.get('background_job_ids', []))}", flush=True)
        bestellt.append((art, gid, frames))

    print("\nZusammenfassung:")
    print(json.dumps({"character_id": cid, "animationen": [{"art": a, "gid": g, "frames": f} for a, g, f in bestellt]}, indent=2))

    if args.warte_animationen:
        print("warte auf Animations-Frames ...")
        offen = {(a, g) for a, g, _ in bestellt}
        t0 = time.time()
        while offen and time.time() - t0 < 3600:
            time.sleep(45)
            d = api("GET", f"/characters/{cid}")
            hab = {(a.get("animation_group_id"), dd["direction"]) for a in d.get("animations", []) for dd in a["directions"] if dd.get("frames")}
            fertig = {(a, g) for a, g in offen if all((g, dr) in hab for dr in DIRS)}
            offen -= fertig
            print(f"  fertig: {len(bestellt) - len(offen)}/{len(bestellt)}  ({int(time.time() - t0)} s)", flush=True)
        if offen:
            print("NICHT fertig:", sorted(offen))
        else:
            print("alle Animationsgruppen fertig.")


if __name__ == "__main__":
    main()
