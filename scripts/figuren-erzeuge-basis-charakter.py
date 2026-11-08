#!/usr/bin/env python3
"""Erzeugt bei PixelLab eine NEUE Basis-Figur aus einer Textbeschreibung/einem Konzeptbild (die
erste Pose/das Grundbild, aus der sich Animationen ableiten) -- anders als
figuren-bestelle-animationen.py, das NUR fehlende Animationen fuer eine BEREITS EXISTIERENDE Figur
nachbestellt. Dieses Skript hier fehlte im Repo (fruehere Sitzungen haben Basis-Erzeugung offenbar
nur im Scratchpad gemacht, nie committet, s. CLAUDE.md-Auftrag vom 08.11.).

    PIXELLAB_API_KEY=... python3 -I scripts/figuren-erzeuge-basis-charakter.py <subjekte.json> <slug>
        [--trocken] [--nur-basis] [--character-id <cid>]
        [--warte-basis] [--warte-animationen] [--tag <tag>]

<subjekte.json>: {slug: {
    "beschreibung": "<Erzeugungs-Prompt, Kanon-Vorlage: '<Name>, a <Klasse> of race <Rasse>,
                      archetype <Archetyp(en)>. <reiche visuelle Beschreibung>. Full body pixel
                      art character.'>",
    "subjekt": "<kurze Nominalphrase <=300 Zeichen, fuer spaetere pixminimax-Animationen -- z.B.
                 'a knight in silver plate armour'>",
    "konzeptbild": "<lokaler Pfad zu einem Konzept-/Referenzbild, optional -- s.u.>",
    "style_character_id": "<pixellabId einer bestehenden 8-Richtungs-Figur als Stil-Anker,
                             optional, nur mit 'konzeptbild'>",
    "proportionen": {"legs_length": 1.1, ...}  (optional, CharacterProportions -- NUR im
                     Textweg ohne 'konzeptbild' nutzbar, s.u.),
    "angriff": "<optionaler Angriffstext>"  (optional, sonst Kanon-Default)}}

ZWEI Erzeugungswege, je nachdem ob 'konzeptbild' gesetzt ist:

  A) MIT 'konzeptbild' (der kanonische Weg -- so sind alle ~360 Bestandsfiguren entstanden,
     nachgewiesen per Git-Archaeologie am 08.11.: Commit 4b66f8156 "PixelLab-Figuren fuer 14
     fehlende Spieler", Commit-Text woertlich "/create-character-pro 80x80, create_from_concept
     mit rohem Portrait-JPG, template custom, kein name"; GET /characters/{id} an mehreren
     Stichproben (gram, elara, cassandra, tidesprinter, corsair) bestaetigt identisch: size 80x80,
     template_id='custom', view='low top-down', style_settings leer):

       POST /create-character-pro
         description=<beschreibung>, image_size={80,80}, method='create_from_concept',
         concept_image=<konzeptbild, base64>, template_id='custom', view='low top-down',
         style_character_id=<optional, Stil-Anker>.

     'custom' ueberspringt das 3D-Skelett (laut OpenAPI-Doku: "such a character can't use
     skeleton-based animations") -- unproblematisch, weil im ganzen Projekt ausschliesslich
     skelettfreie 'pixminimax'-Animationen bestellt werden (wie hier in Schritt 3).

     image_size ist hier KEIN fester Deckel: "The persisted rotations share a square canvas whose
     side is at least max(width, height) and may grow up to 256 pixels to fit generated content."
     80x80 angefragt ergibt bei den Bestandsfiguren nachweislich 80x80 -- aber bei ungewoehnlich
     ausladendem Inhalt (z.B. wehende Flammen/Effekte ueber den Figurenrand hinaus) KANN der
     tatsaechliche Canvas groesser werden. Deshalb --nur-basis: nach der (billigen) Basis-Erzeugung
     stoppen, GET /characters/{id} pruefen, und erst bei bestaetigter Groesse mit --character-id
     die (teureren) Animationen bestellen.

  B) OHNE 'konzeptbild' (Rueckfall -- NICHT der kanonische Weg, nur wenn kein Konzeptbild
     vorliegt): POST /create-character-with-8-directions, mode='standard', template_id='mannequin'.
     Dieser Endpunkt legt dokumentiert automatisch +40% Rand auf die angefragte Groesse (bestaetigt
     am corsair-v2-Lauf vom 08.11.: 80 angefragt -> 112 geliefert) -- fuer exakt 80x80 muesste hier
     mit einer kleineren Anfragegroesse kompensiert werden. Nur 'proportionen' (CharacterProportions)
     ist ein Feld dieses Zweigs, 'create-character-pro' hat kein solches Feld.

Nach der Basis-Figur (beide Wege): POST /characters/animations fuer die vier Kanon-
Animationsgruppen (walk/angriff/treffer/tod, je 16/16/8/16 Aktionsbilder -- ARTEN_KANON, identisch
zu figuren-bestelle-animationen.py), Richtungen south+east+north (west wird im Spiel-Motor aus Ost
gespiegelt, PixelLab-Kanon), mode='pixminimax'.

Schreibt NICHTS in data/generated/figuren-sprites.json und ruehrt keine bestehende Figur an -- das
bleibt ein separater, manueller Schritt. Der Schluessel wird nur auf Vorhandensein geprueft und nie
ausgegeben.
"""
import argparse, base64, json, os, sys, time, urllib.request, urllib.error

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


def b64_image(pfad):
    ext = os.path.splitext(pfad)[1].lower().lstrip(".")
    fmt = "jpeg" if ext in ("jpg", "jpeg") else ext or "png"
    with open(pfad, "rb") as f:
        return {"type": "base64", "format": fmt, "base64": base64.b64encode(f.read()).decode("ascii")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("subjekte")
    ap.add_argument("slug")
    ap.add_argument("--trocken", action="store_true", help="nur den Plan zeigen, keine kostenpflichtigen Calls")
    ap.add_argument("--nur-basis", action="store_true", help="nach der Basis-Figur stoppen (vor den Animationen) -- impliziert --warte-basis")
    ap.add_argument("--character-id", default=None, help="Basis-Figur NICHT neu anlegen, sondern mit dieser bestehenden character_id direkt die Animationen bestellen")
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

    cid = args.character_id
    if not cid:
        kanonisch = bool(s.get("konzeptbild"))
        if kanonisch:
            basis_body = {
                "description": s["beschreibung"],
                "image_size": {"width": 80, "height": 80},
                "method": "create_from_concept",
                "concept_image": b64_image(s["konzeptbild"]),
                "template_id": "custom",
                "view": "low top-down",
            }
            if s.get("style_character_id"):
                basis_body["style_character_id"] = s["style_character_id"]
            endpoint = "/create-character-pro"
            print(f"{args.slug}: Basis-Figur anlegen -- KANONISCHER WEG (create-character-pro, create_from_concept, wie alle ~360 Bestandsfiguren)")
        else:
            basis_body = {
                "description": s["beschreibung"],
                "image_size": {"width": 80, "height": 80},
                "mode": "standard",
                "view": "low top-down",
                "template_id": "mannequin",
            }
            if s.get("proportionen"):
                basis_body["proportions"] = {"type": "custom", **s["proportionen"]}
            endpoint = "/create-character-with-8-directions"
            print(f"{args.slug}: Basis-Figur anlegen -- RUECKFALL (kein 'konzeptbild' in {args.subjekte}, NICHT der kanonische Weg -- Canvas wird vermutlich +40% zu gross)")
        print(f"  beschreibung: {s['beschreibung']!r}")
        log_body = {k: v for k, v in basis_body.items() if k not in ("description", "concept_image")}
        print(f"  endpoint={endpoint} body (ohne description/concept_image): {json.dumps(log_body)}")
        if args.trocken:
            print("--trocken: kein Call gesendet.")
            return

        r = api("POST", endpoint, basis_body)
        cid = r["character_id"]
        print(f"  -> character_id={cid} status={r.get('status')} usage={r.get('usage')} job={r.get('background_job_id')}")

        if args.tag:
            try:
                api("PATCH", f"/characters/{cid}/tags", {"tags": [args.tag]})
                print(f"  tag gesetzt: {args.tag}")
            except SystemExit as e:
                print(f"  WARNUNG: Tag setzen fehlgeschlagen ({e}) -- character_id bleibt gueltig")
    else:
        print(f"{args.slug}: nutze bestehende character_id={cid} (keine neue Basis-Figur)")

    warte_basis = args.warte_basis or args.warte_animationen or args.nur_basis
    d = None
    if warte_basis:
        print("  warte auf Basis-Figur (status=='completed') ...")
        t0 = time.time()
        while time.time() - t0 < 20 * 60:
            d = api("GET", f"/characters/{cid}")
            if d.get("status") == "completed":
                break
            if d.get("status") == "failed":
                sys.exit(f"Basis-Figur fehlgeschlagen: {json.dumps(d)[:500]}")
            time.sleep(20)
        if not d or d.get("status") != "completed":
            sys.exit(f"Basis-Figur nach 20 min nicht fertig (status={d.get('status') if d else None}), character_id={cid} bleibt bestehen -- spaeter mit GET /characters/{cid} weiterverfolgen")
        print(f"  fertig: size={d.get('size')} rotation_urls fuer {sorted(k for k, v in d['rotation_urls'].items() if v)}")
        groesse = d.get("size") or {}
        if groesse.get("width") != 80 or groesse.get("height") != 80:
            print(f"  ACHTUNG: Canvas ist {groesse}, NICHT 80x80 -- vor den Animationen pruefen/entscheiden!")
    else:
        print("  (kein --warte-basis: Animationen werden sofort bestellt, auch wenn die Basis noch verarbeitet -- die API erlaubt das laut Doku, da character_id sofort gueltig ist)")

    if args.nur_basis:
        print(f"\n--nur-basis: gestoppt. character_id={cid}")
        print("Weiter mit: ... --character-id " + cid + " --warte-animationen")
        return

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
