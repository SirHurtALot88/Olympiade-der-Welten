#!/usr/bin/env python3
"""Schickt ein Foto deiner Miniatur samt Prompt an dein lokales ComfyUI und speichert das Artwork.

Aufruf:
    python kartenschmiede_comfy.py FOTO.jpg prompt.txt
    python kartenschmiede_comfy.py FOTO.jpg prompt.txt --workflow workflow_sdxl.json --anzahl 4

Braucht nur Python 3 (keine Zusatzpakete) und ein laufendes ComfyUI (Standard: http://127.0.0.1:8188).
"""
import argparse, json, random, time, uuid, urllib.request, urllib.parse
from pathlib import Path

HIER = Path(__file__).resolve().parent


def anfrage(url, daten=None, header=None):
    req = urllib.request.Request(url, data=daten, headers=header or {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def foto_hochladen(server, foto):
    grenze = uuid.uuid4().hex
    body = (f"--{grenze}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{foto.name}\"\r\n"
            f"Content-Type: application/octet-stream\r\n\r\n").encode() + foto.read_bytes() + \
           (f"\r\n--{grenze}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n--{grenze}--\r\n").encode()
    antwort = json.loads(anfrage(f"{server}/upload/image", body, {"Content-Type": f"multipart/form-data; boundary={grenze}"}))
    return antwort["name"]


def workflow_fuellen(wf, bildname, prompt, seed):
    for knoten in wf.values():
        e = knoten["inputs"]
        if knoten["class_type"] == "LoadImage":
            e["image"] = bildname
        if knoten["class_type"] == "CLIPTextEncode" and e.get("text") == "PROMPT":
            e["text"] = prompt
        if knoten["class_type"] == "KSampler":
            e["seed"] = seed
    return wf


def warten(server, prompt_id, max_sekunden=900):
    ende = time.time() + max_sekunden
    while time.time() < ende:
        verlauf = json.loads(anfrage(f"{server}/history/{prompt_id}"))
        if prompt_id in verlauf:
            eintrag = verlauf[prompt_id]
            status = eintrag.get("status", {})
            if status.get("status_str") == "error":
                raise SystemExit(f"ComfyUI meldet einen Fehler: {json.dumps(status.get('messages', []))[:800]}")
            bilder = [b for out in eintrag.get("outputs", {}).values() for b in out.get("images", [])]
            if bilder:
                return bilder
        time.sleep(2)
    raise SystemExit("Zeitüberschreitung: ComfyUI hat nach 15 Minuten kein Bild geliefert.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("foto", type=Path, help="Foto der bemalten Mini")
    ap.add_argument("prompt", type=Path, help="Textdatei mit dem Prompt aus der Kartenschmiede")
    ap.add_argument("--workflow", type=Path, default=HIER / "workflow_flux_kontext.json")
    ap.add_argument("--server", default="http://127.0.0.1:8188")
    ap.add_argument("--anzahl", type=int, default=1, help="wie viele Varianten")
    ap.add_argument("--ziel", type=Path, default=None, help="Ordner für die Ergebnisse (Standard: neben dem Foto)")
    a = ap.parse_args()

    prompt = a.prompt.read_text(encoding="utf-8").strip()
    ziel = a.ziel or a.foto.resolve().parent
    ziel.mkdir(parents=True, exist_ok=True)
    try:
        bildname = foto_hochladen(a.server, a.foto)
    except OSError as fehler:
        raise SystemExit(f"ComfyUI unter {a.server} ist nicht erreichbar. Läuft es? ({fehler})")

    for i in range(a.anzahl):
        seed = random.randint(1, 2**31 - 1)
        wf = workflow_fuellen(json.loads(a.workflow.read_text(encoding="utf-8")), bildname, prompt, seed)
        try:
            antwort = json.loads(anfrage(f"{a.server}/prompt", json.dumps({"prompt": wf, "client_id": uuid.uuid4().hex}).encode(),
                                         {"Content-Type": "application/json"}))
        except urllib.error.HTTPError as fehler:
            raise SystemExit(f"ComfyUI lehnt den Workflow ab. Meist fehlt ein Modell, das in der JSON steht:\n{fehler.read().decode()[:1500]}")
        print(f"Variante {i + 1}/{a.anzahl} läuft (Seed {seed}) …")
        for b in warten(a.server, antwort["prompt_id"]):
            q = urllib.parse.urlencode({"filename": b["filename"], "subfolder": b.get("subfolder", ""), "type": b.get("type", "output")})
            datei = ziel / f"{a.foto.stem}_artwork_{seed}.png"
            datei.write_bytes(anfrage(f"{a.server}/view?{q}"))
            print(f"  gespeichert: {datei}")


if __name__ == "__main__":
    main()
