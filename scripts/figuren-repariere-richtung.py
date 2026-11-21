#!/usr/bin/env python3
"""Ersetzt bei PixelLab EINE fehlerhafte Richtung einer bestehenden Animationsgruppe (Reparatur,
keine neue Animationsart): Richtung loeschen, mit derselben Framezahl an DIESELBE Gruppe neu
bestellen (pixminimax), auf die Jobs warten und `usage.generations` je Job ausgeben.

    PIXELLAB_API_KEY=dummy flock /tmp/pixellab-bestell.lock \
        python3 -I scripts/figuren-repariere-richtung.py <auftraege.json> [--trocken] [--protokoll <datei.json>]

<auftraege.json>: Liste von
    {"slug": "conan", "art": "treffer", "richtung": "north",
     "text": "<Aktionstext>", "subjekt": "<Nominalphrase, max. 300 Zeichen>", "pose": "<Startpose, optional>"}

Freigabe (Chris, 21.11.): "wenn die Figuren von hinten sich nach vorne drehen ist das IMMER ein Grund
es zu fixen ... fuer Fixes hast du immer ne Freigabe". Gilt fuer Reparaturen bestehender Animationen,
NICHT fuer neue Figuren oder neue Animationsarten.

Regeln: jeder POST geht genau EINMAL raus (kein Wiederholen bei Fehler; nur das Warten auf freie
Job-Slots, bei dem PixelLab nichts angenommen hat, laeuft in der Schleife). Vor dem Loeschen wird der
alte Streifen NICHT gesichert -- er liegt im Repo (public/sprites/figuren/<slug>/<art>-<richtung>.png)
und laesst sich mit `POST /save-to-asset` (kostenlos) zurueckschreiben.
Fuer Nord-Richtungen gehoert in Text UND Subjekt ausdruecklich die Rueckenansicht ("seen from behind,
back to the camera the whole time, never turns around"): ein Subjekt, das Gesicht, Brille oder Brust
beschreibt, zieht pixminimax zur Vorderseite.
"""
import argparse, json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.pixellab.ai/v2"


def key():
    k = os.environ.get("PIXELLAB_API_KEY")
    if not k:
        sys.exit("PIXELLAB_API_KEY fehlt")
    return k


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={"Authorization": f"Bearer {key()}", "Content-Type": "application/json"})
    t0, i = time.time(), -1
    while True:
        i += 1
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read()
                return json.loads(raw) if raw.strip() else {}
        except urllib.error.HTTPError as e:
            txt = e.read().decode(errors="replace")[:500]
            if e.code == 429 and "job slots" in txt and time.time() - t0 < 45 * 60:
                print("    ... keine Job-Slots frei, warte 30 s", flush=True)
                time.sleep(30)
                continue
            if method == "GET" and e.code in (429, 500, 502, 503, 504) and i < 4:
                time.sleep(10 * (i + 1))
                continue
            raise SystemExit(f"HTTP {e.code} {method} {path}: {txt}")
        except Exception:  # noqa
            if method == "GET" and i < 4:
                time.sleep(5 * (i + 1))
                continue
            raise


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("auftraege")
    ap.add_argument("--trocken", action="store_true")
    ap.add_argument("--protokoll")
    args = ap.parse_args()
    key()
    idx = json.load(open(os.path.join(ROOT, "data/generated/figuren-sprites.json")))
    laufend = []
    for a in json.load(open(args.auftraege)):
        e = idx[a["slug"]]
        cid = e["pixellabId"]
        grp = next(g for g in e["animationen"] if g["kind"] == a["art"])
        gid, frames = grp["gid"], grp["frames"] - 1  # Index zaehlt das Startbild mit
        body = {"character_id": cid, "mode": "pixminimax", "frame_count": frames,
                "action_description": a["text"], "animation_name": a["text"],
                "subject_description": a["subjekt"][:300], "directions": [a["richtung"]],
                "animation_group_id": gid}
        if a.get("pose"):
            body["initial_pose"] = a["pose"][:300]
        print(f"{a['slug']}: {a['art']}-{a['richtung']} frames={frames} gid={gid}", flush=True)
        if args.trocken:
            print("   ", json.dumps(body, ensure_ascii=False)[:600])
            continue
        api("DELETE", f"/characters/{cid}/animations/{gid}/directions/{a['richtung']}")
        r = api("POST", "/characters/animations", body)
        jobs = r.get("background_job_ids") or []
        print(f"    -> status={r.get('status')} jobs={jobs}", flush=True)
        laufend.append({"slug": a["slug"], "art": a["art"], "richtung": a["richtung"], "gid": gid, "jobs": jobs, "text": a["text"]})
    summe = 0.0
    for l in laufend:
        l["generations"] = 0.0
        for j in l["jobs"]:
            t0 = time.time()
            while True:
                s = api("GET", f"/background-jobs/{j}")
                if s.get("status") in ("completed", "failed") or time.time() - t0 > 3600:
                    break
                time.sleep(20)
            g = ((s.get("usage") or {}).get("generations")) or 0
            l["generations"] += g
            l["status"] = s.get("status")
        summe += l["generations"]
        print(f"{l['slug']}/{l['art']}-{l['richtung']}: {l.get('status')} generations={l['generations']}", flush=True)
    if laufend:
        print(f"SUMME generations={summe}")
    if args.protokoll and laufend:
        alt = json.load(open(args.protokoll)) if os.path.exists(args.protokoll) else []
        json.dump(alt + laufend, open(args.protokoll, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
