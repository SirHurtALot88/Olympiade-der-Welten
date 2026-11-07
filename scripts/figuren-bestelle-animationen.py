#!/usr/bin/env python3
"""Bestellt bei PixelLab die FEHLENDEN Animationen einer bestehenden Figur (Kanon: pixminimax,
walk/angriff/tod 16 (+Startbild = 17), treffer 8 (= 9), Richtungen south/east/north).

    PIXELLAB_API_KEY=... python3 -I scripts/figuren-bestelle-animationen.py <subjekte.json> <slug> [slug ...]
        [--trocken] [--warte] [--arten <arten-datei>]

<subjekte.json>: {slug: {"subjekt": "<eine Nominalphrase, reich>", "angriff": "<Aktionstext>"}}.
Fehlt "angriff", wird ein generischer Angriff aus dem Subjekt gebaut.

Regeln:
  - Hat die Figur fuer eine Art schon eine Gruppe (Arten-Datei gid->Art) mit Sued/Ost, aber ohne
    Nord, wird NORD an DIESE Gruppe angehaengt (animation_group_id), damit S/E/N im Index eine
    Gruppe bleiben. Fehlt der Gruppe Sued oder Ost, wird auch das angehaengt.
  - Fehlt die Art ganz, wird eine neue Gruppe mit allen drei Richtungen angelegt; die neue gid
    kommt sofort mit ihrer Art in die Arten-Datei (quelle "gespeichert" beim Export).
  - Haengt eine Richtung an eine BESTEHENDE Gruppe an, deren Framezahl von der Kanon-Framezahl
    der Art abweicht (eine fruehere Bestellung kann z. B. 8 statt 16 verwendet haben), wird die
    neue Richtung mit der Framezahl der Gruppe bestellt, nicht mit dem Kanonwert (07.11.:
    roddox-harthelm bekam sonst Nord mit 17 Bildern an eine Sued/Ost-Gruppe mit nur 9 Bildern --
    figuren-sprites-export.py fuehrt pro Gruppe nur EINE 'frames'-Zahl, das haette Sued/Ost beim
    Anzeigen verzerrt/zerschnitten dargestellt).
  - --trocken zeigt nur die Bestellungen. --warte pollt, bis alle bestellten Richtungen Frames haben.
Der Schluessel wird nur auf Vorhandensein geprueft und nie ausgegeben.

Bis 07.11. lebte dieses Skript nur im Scratchpad mehrerer Sitzungen (nie committet) -- jetzt im
Repo, damit der Framezahl-Fix und kuenftige Korrekturen nicht wieder verloren gehen.
"""
import argparse, json, os, re, sys, time, urllib.request, urllib.error

VERBEN = r"\b(lunges|swings|draws|thrusts|slashes|raises|unleashes|sweeps|strikes|fires|shoots|casts|hurls|throws|bites|spits|breathes|whips|kicks|rears|holds|grips|stomps|slams|punches|stabs|summons|sends|calls|charges|leaps|pounces|snaps|flings|releases|conjures|blasts|smashes|lashes)\b"

ROOT = "/home/user/Olympiade-der-Welten"
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
            txt = e.read().decode(errors="replace")[:400]
            if e.code == 429 and "job slots" in txt:
                # PixelLab begrenzt gleichzeitige Jobs ("Available: 0, needed: 3"). Nicht abbrechen,
                # sondern warten, bis laufende Jobs fertig sind — bis zu 45 Minuten.
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


import threading
_LOCK = threading.Lock()


def merke_art(pfad, gid, art):
    """Arten-Datei frisch laden, Eintrag setzen, zurueckschreiben — nie die In-Memory-Kopie
    dumpen (so gingen am 07.11. zwei Eintraege verloren, als Export und Bestellung parallel liefen)."""
    with _LOCK:
        a = json.load(open(pfad))
        if a.get(gid) != art:
            a[gid] = art
            json.dump(a, open(pfad, "w"), ensure_ascii=False, indent=0, sort_keys=True)


def fehlend(detail, arten):
    """-> {art: {"gid": gid|None, "dirs": [fehlende Richtungen]}}"""
    vorhanden = {}
    for a in detail.get("animations", []):
        art = arten.get(a.get("animation_group_id"))
        if not art:
            continue
        dirs = {d["direction"] for d in a["directions"] if d.get("frames")}
        alt = vorhanden.get(art)
        # Die Gruppe mit den meisten Richtungen zaehlt (ein Doppel kann unvollstaendig sein).
        if not alt or len(dirs) > len(alt["dirs"]):
            vorhanden[art] = {"gid": a.get("animation_group_id"), "dirs": dirs, "frames": a["directions"][0].get("frame_count"),
                              "label": (a.get("animation_type") or "")[7:] if (a.get("animation_type") or "").startswith("custom-") else (a.get("animation_type") or "")}
    out = {}
    for art, _, _ in ARTEN_KANON:
        v = vorhanden.get(art)
        if not v:
            out[art] = {"gid": None, "dirs": list(DIRS)}
        else:
            miss = [d for d in DIRS if d not in v["dirs"]]
            if miss:
                out[art] = {"gid": v["gid"], "dirs": miss, "label": v.get("label", ""), "frames": v.get("frames")}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("subjekte")
    ap.add_argument("slugs", nargs="+")
    ap.add_argument("--trocken", action="store_true")
    ap.add_argument("--warte", action="store_true")
    ap.add_argument("--arten", default=os.path.join(ROOT, "data/generated/figuren-sprites-animationsarten.json"))
    args = ap.parse_args()
    key()
    subj = json.load(open(args.subjekte))
    idx = json.load(open(os.path.join(ROOT, "data/generated/figuren-sprites.json")))
    arten = json.load(open(args.arten))
    bestellt = []  # (slug, cid, gid, art, dirs)
    for slug in args.slugs:
        cid = idx[slug]["pixellabId"]
        d = api("GET", f"/characters/{cid}")
        if slug not in subj:
            # Rueckfall: der Erzeugungs-Prompt des Charakters selbst, wenn er reich genug ist
            # (Batch-Figuren vom 02.11.: Koerperbau, Material, Farbe). Die Schablone des
            # Erst-Exports ("Name, a Class of race X ... Full body pixel art character.") reicht nicht.
            p = (d.get("prompt") or "").strip()
            if len(p) < 150 or "archetype" in p.lower() and len(p) < 220:
                sys.exit(f"{slug}: kein Eintrag in {args.subjekte} und PixelLab-Prompt zu duenn ({len(p)} Zeichen): {p[:120]!r}")
            p = p.replace("Full body pixel art character.", "").replace("full body pixel art character", "").strip(" ,.")
            subj[slug] = {"subjekt": p[:300]}
            print(f"{slug}: Subjekt aus PixelLab-Prompt ({len(p)} Zeichen)")
        plan = fehlend(d, arten)
        if not plan:
            print(f"{slug}: nichts zu bestellen")
            continue
        auftraege = []
        for art, p in plan.items():
            frames = next(f for a, f, _ in ARTEN_KANON if a == art)
            if p.get("gid") and p.get("frames"):
                # API-GET liefert 'frame_count' als GELIEFERTE Gesamtzahl (inkl. Startbild);
                # der Bestell-Body will dagegen die AKTIONS-Framezahl (ARTEN_KANON-Werte wie
                # 16/8 sind das, PixelLab haengt beim Liefern ein Startbild an -> 17/9 total).
                bestehende_aktion = p["frames"] - 1
                if bestehende_aktion != frames:
                    # Eine bestehende Gruppe kann von einer frueheren Bestellung mit abweichender
                    # Framezahl stammen (07.11.: roddox-harthelm hatte 8 statt 16 bei Sued/Ost --
                    # eine neu bestellte Richtung mit der Kanon-Zahl haette den Export verzerrt,
                    # weil figuren-sprites-export.py pro Gruppe nur EINE 'frames'-Zahl fuehrt).
                    # Die bestehende Framezahl der Gruppe gewinnt, damit alle Richtungen passen.
                    print(f"    {art}: bestehende Gruppe liefert {p['frames']} total statt Kanon {frames + 1} -- bestelle mit frame_count={bestehende_aktion} statt {frames}", flush=True)
                    frames = bestehende_aktion
            # Je Art darf subjekte.json den Kanontext ersetzen (z. B. "tod" fuer Panzertiere, die
            # beim Standardtext nur absinken: "kippt auf den Ruecken, Beine nach oben").
            text = subj[slug].get(art) or next(t for a, _, t in ARTEN_KANON if a == art)
            if not text and p.get("gid") and p.get("label") and re.search(VERBEN, p["label"].lower()):
                # Nord an eine bestehende Angriffsgruppe anhaengen: PixelLab kennt den Originaltext nur
                # auf ~37 Zeichen gekuerzt (kein GET dafuer, 422 ohne action_description). Das Verb
                # daraus ("draws the curved...", "lunges forward a...") ist besser als ein fremder Hieb.
                text = p["label"].strip().rstrip(",.") + "... completing the same attack forward, then returning to the starting pose"
            if not text:
                text = "lunges forward and swings a heavy strike at an enemy in front, then returns to the starting pose"
            body = {
                "character_id": cid, "mode": "pixminimax", "frame_count": frames,
                "action_description": text, "animation_name": text,
                "subject_description": subj[slug]["subjekt"][:300],
                "directions": p["dirs"],
            }
            if p["gid"]:
                body["animation_group_id"] = p["gid"]
            print(f"{slug}: {art:8} {'+' if p['gid'] else 'NEU'} {p['dirs']} frames={frames}" + (f" gid={p['gid']}" if p["gid"] else ""), flush=True)
            if args.trocken:
                continue
            auftraege.append((art, p, body))

        def sende(auftrag):
            art, p, body = auftrag
            r = api("POST", "/characters/animations", body)
            gid = r.get("animation_group_id") or p["gid"]
            print(f"    {slug}/{art} -> gid={gid} status={r.get('status')} jobs={len(r.get('background_job_ids', []))}", flush=True)
            if gid:
                merke_art(args.arten, gid, art)
            return (slug, cid, gid, art, p["dirs"])

        if auftraege:
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(1) as ex:
                bestellt.extend(ex.map(sende, auftraege))
    if args.warte and bestellt:
        print("warte auf Frames ...")
        offen = {(s, c, g, a, tuple(ds)) for s, c, g, a, ds in bestellt}
        t0 = time.time()
        while offen and time.time() - t0 < 3600:
            time.sleep(45)
            fertig = set()
            for cid in {c for _, c, _, _, _ in offen}:
                d = api("GET", f"/characters/{cid}")
                hab = {(a.get("animation_group_id"), dd["direction"]) for a in d.get("animations", []) for dd in a["directions"] if dd.get("frames")}
                for o in offen:
                    if o[1] == cid and all((o[2], dr) in hab for dr in o[4]):
                        fertig.add(o)
            offen -= fertig
            print(f"  fertig: {len(bestellt) - len(offen)}/{len(bestellt)}  ({int(time.time() - t0)} s)", flush=True)
        if offen:
            print("NICHT fertig:", sorted(offen))


if __name__ == "__main__":
    main()
