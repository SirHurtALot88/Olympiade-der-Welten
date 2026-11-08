"""Duenner Client fuer die PixelLab-API (v2), nur Standardbibliothek + Pillow.

Der Schluessel kommt aus PIXELLAB_API_KEY; fehlt er, laeuft die Anfrage ohne Kopfzeile
(in der Cloud-Umgebung setzt der Netzwerk-Proxy den Schluessel selbst ein).

Genutzt von scripts/pixellab-requisiten.py (Kulissen-Nachlese 08.11.).
"""
import base64
import io
import json
import os
import time
import urllib.error
import urllib.request

from PIL import Image

API = "https://api.pixellab.ai/v2"


def _kopf():
    k = os.environ.get("PIXELLAB_API_KEY")
    h = {"Content-Type": "application/json"}
    if k:
        h["Authorization"] = f"Bearer {k}"
    return h


def api(method, path, body=None, timeout=180):
    data = json.dumps(body).encode() if body is not None else None
    t0 = time.time()
    versuch = 0
    while True:
        versuch += 1
        req = urllib.request.Request(API + path, data=data, method=method, headers=_kopf())
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            txt = e.read().decode(errors="replace")[:500]
            if e.code == 429 and time.time() - t0 < 30 * 60:
                time.sleep(20)
                continue
            if e.code >= 500 and versuch < 4:
                time.sleep(5 * versuch)
                continue
            raise SystemExit(f"HTTP {e.code} {path}: {txt}")
        except (urllib.error.URLError, TimeoutError) as e:
            if versuch < 4:
                time.sleep(5 * versuch)
                continue
            raise SystemExit(f"Netzfehler {path}: {e}")


def bild_aus(obj):
    """Ein PixelLab-Bildobjekt ({type:'base64', base64:...} oder rgba_bytes) -> PIL RGBA."""
    if isinstance(obj, str):
        return Image.open(io.BytesIO(base64.b64decode(obj))).convert("RGBA")
    if obj.get("type") == "rgba_bytes" or ("width" in obj and "height" in obj and obj.get("type") != "base64"):
        raw = base64.b64decode(obj["base64"])
        return Image.frombytes("RGBA", (obj["width"], obj["height"]), raw)
    b = obj.get("base64", "")
    if "," in b[:40]:
        b = b.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(b))).convert("RGBA")


def bild_an(img):
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return {"type": "base64", "base64": base64.b64encode(buf.getvalue()).decode()}


def warte_job(job_id, max_s=600):
    t0 = time.time()
    while time.time() - t0 < max_s:
        j = api("GET", f"/background-jobs/{job_id}")
        st = j.get("status")
        if st in ("completed", "succeeded", "done"):
            return j
        if st in ("failed", "error", "cancelled"):
            raise SystemExit(f"Job {job_id} fehlgeschlagen: {json.dumps(j)[:500]}")
        time.sleep(4)
    raise SystemExit(f"Job {job_id} nicht fertig nach {max_s}s")


def pixflux(beschreibung, w, h, seed=None, **opt):
    body = {"description": beschreibung, "image_size": {"width": w, "height": h}}
    body.update(opt)
    if seed is not None:
        body["seed"] = seed
    r = api("POST", "/create-image-pixflux", body)
    return bild_aus(r["image"])
