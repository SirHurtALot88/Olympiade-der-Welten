#!/usr/bin/env python3
# ===================================================================================
# HANDPOSITION IN body_walk/bodyw_walk MESSEN — Grundlage fuer docs/design/sprite-handpunkte.md
#
# Auftrag: bevor jemand einen Hockeyschlaeger in die Hand einer Figur zeichnet, muss
# bekannt sein, WO GENAU die Hand sitzt, je Blickrichtung und je Bild des Laufzyklus.
# Dieses Skript zieht body_walk/bodyw_walk (576x256 = 9 Spalten x 4 Zeilen zu 64px, s.
# ANIBILDER.walk=9 und blickAus()/male() in battle-mode.engine.js) als PNG aus dem
# SPRITES-Objekt (Base64-Data-URI, roh im Skript-Text der Engine-Datei), und findet die
# Hand NICHT durch Vermutung, sondern durch Pixel-Scan: die Hand ist dort, wo die
# Silhouette am weitesten seitlich ueber den Rumpf hinausragt (Faust am Ende des
# ausgeschwungenen Arms), gemessen im Hoehenband y=36..52 (Schulter- bis Huefthoehe).
#
# ERGEBNIS, KURZ (Details/Unsicherheiten: docs/design/sprite-handpunkte.md):
#   hinten/vorn: zwei Haende, x~20 (links im Bild) und x~44 (rechts im Bild), y~47 —
#                UNVERAENDERT ueber alle 9 Laufbilder (Arme haengen in der Front-/
#                Rueckenansicht ruhig herab, nur die Beine laufen).
#   links/rechts (Profil): die sichtbare Hand WANDERT mit dem Schwung. In der
#                Ruhehaltung (Spalten 0-2, 7-8) liegt sie eng am Rumpf an und ist NICHT
#                als eigene Kontur von der Silhouette abgrenzbar (kein Fund, keine
#                Zahl geraten). Im Vollausschlag (Spalte 5 von 9) ist der Ausschlag am
#                groessten: vordere Hand x~20/41 (links/rechts), hintere Hand x~47/16.
#
# Aufruf: python3 scripts/messe-sprite-handpunkte.py [body_walk|bodyw_walk]
#   (ohne Argument: beide Blaetter)
# ===================================================================================
import re
import base64
import io
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("PIL fehlt: python3 -c \"import PIL\" muss funktionieren (s. Auftragstext).")

REPO_WURZEL = Path(__file__).resolve().parent.parent
ENGINE_DATEI = REPO_WURZEL / "public/mockups/battle-mode.engine.js"

RICHTUNGEN = ["hinten", "links", "vorn", "rechts"]  # Zeile 0..3, s. blickAus()


def lade_blatt(key: str) -> Image.Image:
    """Zieht ein 64px-Baukasten-Blatt (z.B. body_walk) als PNG aus SPRITES={...}
    in battle-mode.engine.js. Das Objekt steht komplett in einer einzigen (sehr
    langen) Zeile; ein simpler Regex auf "<key>": "data:image/png;base64,...." reicht,
    kein JS-Parser noetig (dieselbe Technik wie in scripts/erzeuge-sprite-vorschauen.mjs,
    nur ohne Browser: hier reicht das reine PNG-Blatt, keine zusammengesetzte Figur)."""
    text = ENGINE_DATEI.read_text(encoding="utf-8")
    m = re.search(r'"' + re.escape(key) + r'":\s*"data:image/png;base64,([^"]+)"', text)
    if not m:
        raise SystemExit(f"Sprite-Key {key!r} nicht in {ENGINE_DATEI} gefunden.")
    return Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert("RGBA")


def zelle(blatt: Image.Image, zeile: int, spalte: int) -> Image.Image:
    return blatt.crop((spalte * 64, zeile * 64, spalte * 64 + 64, zeile * 64 + 64))


def aussenkanten(c: Image.Image, yband=(36, 52)):
    """Liefert je (min_x, y-bei-min) und (max_x, y-bei-max) im Hoehenband — die am
    weitesten seitlich ausladenden Pixel der Silhouette in Schulter-/Huefthoehe."""
    px = c.load()
    best_min = (999, None)
    best_max = (-1, None)
    for y in range(*yband):
        xs = [x for x in range(64) if px[x, y][3] >= 10]
        if not xs:
            continue
        if min(xs) < best_min[0]:
            best_min = (min(xs), y)
        if max(xs) > best_max[0]:
            best_max = (max(xs), y)
    return best_min, best_max


def hat_eigene_kontur(c: Image.Image, seite: str, schwelle=22, yband=(40, 51)) -> tuple | None:
    """Prueft, ob auf der angegebenen Seite ("vorne"=kleines x / "hinten"=grosses x)
    ueberhaupt eine vom Rumpf GETRENNTE Flaeche existiert (nicht nur eine leicht
    gewoelbte Schulter-/Ruecken-Kontur) — per Schwellwert auf die x-Ausdehnung. Gibt
    den Flaechenschwerpunkt zurueck, oder None, wenn nichts jenseits der Schwelle liegt."""
    px = c.load()
    pkt = []
    for y in range(*yband):
        for x in range(64):
            if px[x, y][3] < 10:
                continue
            if seite == "vorne" and x <= schwelle:
                pkt.append((x, y))
            elif seite == "hinten" and x >= 63 - schwelle:
                pkt.append((x, y))
    if not pkt:
        return None
    xs = [p[0] for p in pkt]
    ys = [p[1] for p in pkt]
    return (round(sum(xs) / len(xs), 1), round(sum(ys) / len(ys), 1), len(pkt))


def messe(key: str):
    blatt = lade_blatt(key)
    print(f"=== {key} ({blatt.size[0]}x{blatt.size[1]}) ===")
    for zeilen_idx, richtung in enumerate(RICHTUNGEN):
        print(f"-- {richtung} (Zeile {zeilen_idx}) --")
        for spalte in range(9):
            c = zelle(blatt, zeilen_idx, spalte)
            mn, mx = aussenkanten(c)
            print(f"  Spalte {spalte}: Aussenkante min x={mn[0]:>2} (y={mn[1]:>2})"
                  f"   max x={mx[0]:>2} (y={mx[1]:>2})")


if __name__ == "__main__":
    keys = sys.argv[1:] or ["body_walk", "bodyw_walk"]
    for k in keys:
        messe(k)
        print()
