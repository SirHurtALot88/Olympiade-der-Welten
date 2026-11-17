#!/usr/bin/env python3
"""Bestellt einen Effekt bei PixelLab (POST /v2/vfx) und legt Spritesheet + JSON als Rohdatei ab.

    python3 -I scripts/pixellab-vfx.py <name> <lite|pro> <prompt-datei> [--aenderung <effect_id> <conversation-datei>]

Ergebnis (17.11., H1-Effekte, docs/design/pixellab-hud-effekte-schiri-plan-17-11.md):
  data/generated/pixellab-vfx/roh/<name>.png   Spritesheet (Raster, wie PixelLab es liefert)
  data/generated/pixellab-vfx/roh/<name>.json  Rahmen/Dauer/Anker
  data/generated/pixellab-vfx/roh/<name>.auftrag.json  Prompt, Job, effect_id, quoted/abgerechnete Generationen

Der Schluessel kommt aus dem Netzwerk-Proxy (PIXELLAB_API_KEY optional, s. scripts/lib/pixellab_api.py).
Laenger als 400 Zeichen kostet pro 1,25x -- Prompts kurz halten.
"""
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts", "lib"))
import pixellab_api as P  # noqa: E402

ROH = os.path.join(ROOT, "data", "generated", "pixellab-vfx", "roh")


def guthaben():
    return P.api("GET", "/balance")["subscription"]["generations"]


def main():
    name, artist, pfad = sys.argv[1], sys.argv[2], sys.argv[3]
    prompt = open(pfad).read().strip()
    body = {"description": prompt, "artist": artist, "name": name}
    vorher = guthaben()
    r = P.api("POST", "/vfx", body)
    print("Antwort:", json.dumps(r)[:300], flush=True)
    job = r.get("background_job_id") or (r.get("background_job_ids") or [None])[0]
    quote = r.get("quoted_generations")
    j = P.warte_job(job, max_s=900)
    lr = j.get("last_response") or {}
    os.makedirs(ROH, exist_ok=True)
    dateien = lr.get("files") or {}
    urls = dateien if isinstance(dateien, dict) else {os.path.basename(u): u for u in dateien}
    for fname, url in urls.items():
        if fname.endswith(".png") and "normals" not in fname:
            ziel = os.path.join(ROH, name + ".png")
        elif fname.endswith(".json"):
            ziel = os.path.join(ROH, name + ".json")
        else:
            continue
        with urllib.request.urlopen(url, timeout=120) as f:
            open(ziel, "wb").write(f.read())
    nachher = guthaben()
    info = {"prompt": prompt, "artist": artist, "job": job, "effect_id": lr.get("effect_id"),
            "quoted": quote, "generationen_abgerechnet": vorher - nachher,
            "canvas": lr.get("canvas"), "frames": lr.get("frames"), "fps": lr.get("fps"),
            "loop": lr.get("loop"), "anchor": lr.get("anchor"), "message": lr.get("message"),
            "edit_url": lr.get("edit_url")}
    json.dump(info, open(os.path.join(ROH, name + ".auftrag.json"), "w"), indent=1, ensure_ascii=False)
    print(json.dumps({k: v for k, v in info.items() if k != "prompt"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
