"""GEMEINSAME WERKZEUGE FUER DIE MOTOR-KULISSEN (Kulissen-Integration 07.11.).

Benutzt von scripts/baue-kulisse-battlefield.py und scripts/baue-kulisse-buehnen.py. Alles arbeitet
nur mit Pixeln der PixelLab-Szenen (public/szenen/), deterministisch, ohne API.

- lade_szenenbilder(): alle eingebetteten Bilder einer Szenen-HTML (`"name":"data:image/..."`).
- flicken(): ein Rechteck mit dem Bodenstueck derselben Szene zumalen, dessen Umrandung am besten
  passt (Verfahren wie hindernisse_zumalen() in baue-arena-kulissen.py).
- linien_entfernen(): helle, ungesaettigte Linien (Spielfeld-/Platzlinien) aus einer Flaeche nehmen,
  jedes Linienpixel nimmt das naechste freie Pixel quer zur Linie.
"""

from __future__ import annotations

import base64
import io
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

WURZEL = Path(__file__).resolve().parent.parent.parent
QUELLEN = WURZEL / "data" / "generated" / "kulissen-quellen"
LW, LH = 1240, 470


def lade_szenenbilder(pfad: Path) -> dict[str, Image.Image]:
    s = pfad.read_text(encoding="utf-8")
    aus: dict[str, Image.Image] = {}
    for name, b64 in re.findall(r'"([A-Za-z_]+)"\s*:\s*"data:image/[a-z]+;base64,([A-Za-z0-9+/=]{2000,})"', s):
        if name not in aus:
            aus[name] = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")
    return aus


def ueberlappt(a, b) -> bool:
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def flicken(bild: Image.Image, ziele, verboten, bereich, ring: int = 8, schritt: int = 3) -> Image.Image:
    """Jedes Zielrechteck bekommt das Bodenstueck gleicher Groesse, dessen Umrandung (8-px-Ring) am
    besten passt — verglichen vor allem im Muster (Bild minus Unschaerfe), wie hindernisse_zumalen()
    in baue-arena-kulissen.py. Quellen duerfen kein Ziel und nichts aus `verboten` beruehren."""
    bild = bild.convert("RGB")
    roh = np.asarray(bild, dtype=np.float32)
    weich = np.asarray(bild.filter(ImageFilter.GaussianBlur(6)), dtype=np.float32)
    arr = (roh - weich) + 0.35 * weich
    aus = bild.copy()
    bx0, by0, bx1, by1 = bereich
    sperre = list(ziele) + list(verboten)
    for x0, y0, x1, y1 in ziele:
        w, h = x1 - x0, y1 - y0
        innen = np.ones((h + 2 * ring, w + 2 * ring), bool)
        innen[ring:ring + h, ring:ring + w] = False
        hh, ww = arr.shape[:2]

        def umrandung(px, py):
            ys0, xs0 = py - ring, px - ring
            if ys0 < 0 or xs0 < 0 or ys0 + h + 2 * ring > hh or xs0 + w + 2 * ring > ww:
                pad = np.pad(arr, ((ring, ring), (ring, ring), (0, 0)), mode="edge")
                return pad[ys0 + ring: ys0 + ring + h + 2 * ring, xs0 + ring: xs0 + ring + w + 2 * ring][innen]
            return arr[ys0: ys0 + h + 2 * ring, xs0: xs0 + w + 2 * ring][innen]

        ziel = umrandung(x0, y0)
        best, quelle = None, None
        for qy in range(by0 + ring, by1 - h - ring, schritt):
            for qx in range(bx0 + ring, bx1 - w - ring, schritt):
                q = (qx - ring, qy - ring, qx + w + ring, qy + h + ring)
                if any(ueberlappt(q, o) for o in sperre):
                    continue
                dd = float(np.mean((umrandung(qx, qy) - ziel) ** 2))
                if best is None or dd < best:
                    best, quelle = dd, (qx, qy)
        if quelle is None:
            print(f"    WARNUNG: kein freies Bodenstueck fuer {(x0, y0, x1, y1)}", file=sys.stderr)
            continue
        qx, qy = quelle
        stueck = bild.crop((qx - ring, qy - ring, qx + w + ring, qy + h + ring))
        kern = Image.new("L", stueck.size, 0)
        ImageDraw.Draw(kern).rectangle((ring, ring, ring + w - 1, ring + h - 1), fill=255)
        maske = Image.composite(kern, kern.filter(ImageFilter.GaussianBlur(ring / 2)), kern)
        aus.paste(stueck, (x0 - ring, y0 - ring), maske)
    return aus


def seitlich_fuellen(bild: Image.Image, ziele, rand: int = 4) -> Image.Image:
    """Fuellt jedes Rechteck mit dem gleich grossen Streifen direkt links daneben (weich eingeblendet).
    Fuer schmale, hohe Stoerer vor einem Hintergrund, der waagerecht weiterlaeuft (Publikum, Stadt,
    Mauer) — dort waehlt flicken() nach dem Rand gern ein Stueck mit ganz anderem Motiv."""
    aus = bild.convert("RGB").copy()
    for x0, y0, x1, y1 in ziele:
        w = x1 - x0
        stueck = aus.crop((x0 - w - rand, y0 - rand, x0 + rand, y1 + rand))
        kern = Image.new("L", stueck.size, 0)
        ImageDraw.Draw(kern).rectangle((rand, rand, stueck.width - rand - 1, stueck.height - rand - 1), fill=255)
        aus.paste(stueck, (x0 - rand, y0 - rand), kern.filter(ImageFilter.GaussianBlur(rand / 2)))
    return aus


def linien_maske(bild: Image.Image, hell: int = 40, saett: int = 60) -> np.ndarray:
    """Pixel, die deutlich heller als ihre Umgebung und fast weiss sind (Platz-/Feldlinien)."""
    a = np.asarray(bild.convert("RGB"), dtype=np.int32)
    weich = np.asarray(bild.convert("RGB").filter(ImageFilter.GaussianBlur(5)), dtype=np.int32)
    helligkeit = a.mean(axis=2)
    saettigung = a.max(axis=2) - a.min(axis=2)
    m = (helligkeit - weich.mean(axis=2) > hell) & (saettigung < saett) & (helligkeit > 150)
    # Linienkanten (Antialiasing) mitnehmen
    return np.asarray(Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(3))) > 0


def linien_entfernen(bild: Image.Image, maske: np.ndarray, schritte=(4, 6, 9, 13)) -> Image.Image:
    """Jedes Maskenpixel nimmt das naechste freie Pixel senkrecht oder waagerecht daneben (erst
    senkrecht: waagerechte Linien; dann waagerecht: steile Linien). Erhaelt die Koernung."""
    a = np.asarray(bild.convert("RGB")).copy()
    hh, ww = maske.shape
    offen = maske.copy()
    yy, xx = np.nonzero(offen)
    for d in schritte:
        for dy, dx in ((d, 0), (-d, 0), (0, d), (0, -d)):
            if not offen.any():
                break
            yy, xx = np.nonzero(offen)
            qy, qx = np.clip(yy + dy, 0, hh - 1), np.clip(xx + dx, 0, ww - 1)
            frei = ~maske[qy, qx]
            a[yy[frei], xx[frei]] = a[qy[frei], qx[frei]]
            offen[yy[frei], xx[frei]] = False
    return Image.fromarray(a)


def speichere_quelle(disziplin: str, variante: str, bild: Image.Image) -> Path:
    ziel = QUELLEN / disziplin / f"{variante}.png"
    ziel.parent.mkdir(parents=True, exist_ok=True)
    assert bild.size == (LW, LH), bild.size
    bild.convert("RGB").save(ziel, optimize=True)
    return ziel
