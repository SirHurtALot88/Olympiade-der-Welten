#!/usr/bin/env python3
"""ARENA-KULISSEN FUER DEN BATTLE-MODE-MOTOR (03.11.).

Chris, nach einem Live-Screenshot aus dem Battle Mode: "ich dachte du hast das ingame? Wenn ich in
die battle arena gehe sieht das immernoch alles ALT aus." Die illustrierten Kulissen der
Asset-Runde (public/szenen/<disziplin>/<variante>.html, Registry lib/foundation/discipline-scenes.ts)
liefen nur in der Demo-Szene (DisciplinePixelScene), die der Battle Mode gar nicht mehr zeigt. Die
echte Arena (public/mockups/battle-mode.engine.js) malte ihren Boden weiter prozedural: Sand,
Ziegelring, Fackeln.

Dieses Skript baut die Bruecke, damit der Motor dieselben Kulissen als Hintergrund zeichnen kann:

  1. Liest DISCIPLINE_SCENES (ueber tsx, also immer die aktuelle Registry — kommt eine Variante
     dazu, reicht ein neuer Lauf dieses Skripts, niemand muss sie im Motor verdrahten).
  2. Nimmt je Variante das SAUBERE Hintergrundbild aus der Szenen-HTML (`"bg"`: ohne die
     Demo-Figuren Kiti, Wurzelbert …, die im Standbild `poster` eingebrannt sind).
  3. Schneidet den Spielboden auf das Seitenverhaeltnis der Leinwand (1240x470) zu und malt die
     Hindernisse der Demo-Szene (`"objs"`: Steinbloecke, Team-Banner, Tesla-Spulen) mit Boden
     derselben Kulisse zu. Der Motor kennt diese Hindernisse nicht — Kaempfer liefen sonst
     sichtbar durch Mauern, und die Banner trugen die Demo-Teamkuerzel (V-W, A-A).
  4. Schreibt die Bilder nach public/sprites/kulissen/<disziplin>/<variante>.jpg und die Liste
     nach public/mockups/battle-mode.kulissen.js (setzt window.__ARENA_KULISSEN).

Reine Anzeige-Daten: der Motor liest sie nur beim Zeichnen des Bodens, nie in der Simulation.
Welche Variante ein Spiel zeigt, entscheidet der Motor deterministisch aus Saat und Paarung
(kulisseWaehlen() in battle-mode.engine.js) — ohne rr(), ohne Einfluss auf die Wertung.

Gebaut: das Arena-Chassis (bodenArena: TDM, Mini-DM), Buehnen mit Grundflaeche (Wettessen) und
Chassis "quelle" (07.11.): eine Kulisse, die ein eigenes Bestellskript schon passend zur
Motor-Geometrie gebaut hat (Battlefield: scripts/bestelle-kulisse-battlefield.py), wird nur
uebernommen. Andere Chassis (Feldspiel, Bahn, uebrige Buehnen) brauchen eine Kulisse, deren
Linien/Stationen zur Motor-Geometrie passen — s. docs/design/arena-kulissen-im-motor-03-11.md.

Neu bauen nach jeder neuen Szenen-Variante:
    python3 scripts/baue-arena-kulissen.py
"""

from __future__ import annotations

import base64
import io
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

WURZEL = Path(__file__).resolve().parent.parent
SZENEN = WURZEL / "public"
ZIEL_BILDER = WURZEL / "public" / "sprites" / "kulissen"
ZIEL_JS = WURZEL / "public" / "mockups" / "battle-mode.kulissen.js"

# Leinwand des Motors (public/mockups/battle-mode.html, <canvas id="cv" width=1240 height=470>).
LW, LH = 1240, 470

# WELCHES CHASSIS ZEICHNET WELCHE DISZIPLIN (Spiegel von zeichneBoden() im Motor) und wie die
# Kulisse dafuer zugeschnitten wird. Gebaut sind "arena" (bodenArena: Boden samt Seitenmauern,
# Hindernisse zugemalt) und "buehne" (eine Buehnen-Disziplin, deren eigener Boden nur eine
# Grundflaeche malt und die Kulisse darunter legen kann: deckender Zuschnitt, `y_anteil` sagt,
# wie weit unten der Ausschnitt sitzt — 0 oben, 1 unten). Die anderen stehen hier, damit der
# Lauf sagt, was offen ist, statt still nichts zu tun.
CHASSIS = {
    "tdm": {"art": "arena"},
    "mini-dm": {"art": "arena"},
    # Wettessen: Sitzreihe und Tafel liegen im unteren Drittel der Leinwand — der Ausschnitt
    # nimmt Zelte und Publikum (Mitte/oben) und die Buehnenbretter (unten), nicht das
    # WETTESSEN-Schild ganz oben (der Motor hat sein eigenes Schild, s. bodenWettessen()).
    "wettessen": {"art": "buehne", "y_anteil": 1.0, "dunkel_plus": 0.08},
    # Battlefield: die drei Eroberungspunkte der Szene liegen in anderem Massstab und Ausschnitt
    # als die des Motors (ARENA_DOMINATION.orte: senkrechte Reihe bei x=MID, y=85/235/385) — ein
    # Zuschnitt wie bei TDM setzte Turm, Altar und Brueckenkopf neben die Fahnen. Die passende
    # Kulisse baut scripts/bestelle-kulisse-battlefield.py (Szene auf Ortsabstand skaliert,
    # Demo-Ringe/-Banner/-Kisten weg, Raender per PixelLab nachgemalt) nach
    # data/generated/kulissen-quellen/battlefield/<variante>.png; hier wird sie nur uebernommen.
    "battlefield": {"art": "quelle"},
    # Gewichtheben (Sandsack-Schicht): die Szene ist ein vollstaendiger Stationsplan (Bahnen,
    # Silo, Rampen), der nicht deckungsgleich mit den Reihen des Motors liegt.
    "gewichtheben": {"art": "buehne-stationsplan"},
    # Batch 2 (07.11.): Umgebung aus der Szene, Demo-Zutaten weg, Flaeche nach Motor-Geometrie —
    # gebaut von scripts/baue-kulisse-buehnen.py.
    "tennis": {"art": "quelle"},
    "fechten": {"art": "quelle"},
    "speed-schach": {"art": "quelle"},
    # Batch 3 (07.11.), ebenfalls aus scripts/baue-kulisse-buehnen.py.
    "showcase": {"art": "quelle"},
    "eiskunstlauf": {"art": "quelle"},
    "breaking": {"art": "quelle"},
    "i-spy": {"art": "quelle"},
}
CHASSIS_GEBAUT = {"arena", "buehne", "quelle"}
# Fertige Motor-Kulissen aus einem eigenen Bestellskript (Chassis "quelle"): schon 1240x470.
QUELLEN = WURZEL / "data" / "generated" / "kulissen-quellen"

# DAS LAYOUT DER ARENA-SZENEN (TDM, Mini-DM: alle 1280x790, gleicher Grundriss). Spielboden
# innerhalb der Mauern, und der Ausschnitt, der auf die Leinwand kommt: die volle Bodenbreite
# samt der beiden Seitenmauern (x 150..1130), mittig um den Bodenmittelpunkt (640/475), in der
# Hoehe so viel, wie das Leinwand-Seitenverhaeltnis zulaesst. Tribuene und Anzeigetafel oben
# fallen weg — die Anzeigetafel traegt Demo-Namen (Kaijo x Draco), und auf der Leinwand ist
# jeder Pixel Spielflaeche.
ARENA_LAYOUT = {
    "groesse": (1280, 790),
    "boden": (178, 218, 1102, 732),
    "ausschnitt_x": (150, 1130),
    "mitte_y": 475,
}
# Rand um jedes Hindernis: der Schlagschatten faellt nach rechts unten.
RAND_L, RAND_O, RAND_R, RAND_U = 4, 4, 12, 12


def lade_registry() -> dict:
    code = (
        'import {DISCIPLINE_SCENES} from "./lib/foundation/discipline-scenes.ts";'
        "console.log(JSON.stringify(DISCIPLINE_SCENES));"
    )
    aus = subprocess.run(
        ["npx", "tsx", "-e", code], cwd=WURZEL, check=True, capture_output=True, text=True
    ).stdout
    return json.loads(aus.strip().splitlines()[-1])


def lade_szene(demo_pfad: Path) -> tuple[Image.Image | None, list[tuple[int, int, int, int]]]:
    """Sauberer Hintergrund + Hindernis-Rechtecke aus der Szenen-HTML (None, wenn es keinen gibt)."""
    if not demo_pfad.exists():
        return None, []
    s = demo_pfad.read_text(encoding="utf-8", errors="replace")
    m = re.search(r'"bg"\s*:\s*"data:image/[a-z]+;base64,([A-Za-z0-9+/=]+)"', s)
    if not m:
        return None, []
    bild = Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert("RGB")
    objs: list[tuple[int, int, int, int]] = []
    i = s.find('"objs":[')
    if i >= 0:
        # Die Liste endet am ersten "}]" (die base64-Strings enthalten weder "}" noch "]").
        block = s[i : s.find("}]", i) + 2]
        for x, y, w, h in re.findall(r'"x":(-?\d+),"y":(-?\d+),"w":(\d+),"h":(\d+)', block):
            objs.append((int(x), int(y), int(w), int(h)))
    return bild, objs


def ueberlappt(a, b) -> bool:
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def hindernisse_zumalen(bild: Image.Image, objs, boden) -> Image.Image:
    """Malt jedes Hindernis mit einem Bodenstueck derselben Kulisse zu.

    Das Stueck wird nicht blind daneben genommen, sondern GESUCHT: unter allen freien
    Bodenstellen gleicher Groesse diejenige, deren Umrandung am besten zur Umrandung des
    Hindernisses passt (kleinste quadratische Abweichung auf einem 8-px-Ring). So laufen
    Fugen, Eisschollen und Lavarisse moeglichst ueber die Flickkante hinweg weiter, statt an
    einer harten Rechteckkante abzubrechen. Eingesetzt wird mit weichem Rand.
    """
    import numpy as np

    # Verglichen wird vor allem das MUSTER (Bild minus seine Unschaerfe: Fugen, Gitterstaebe,
    # Risse), die Grundhelligkeit nur schwach — sonst gewinnt bei einem Gitterboden ein
    # verschobenes Stueck mit passender Beleuchtung gegen ein deckungsgleiches.
    roh = np.asarray(bild, dtype=np.float32)
    weichbild = np.asarray(bild.filter(ImageFilter.GaussianBlur(6)), dtype=np.float32)
    arr = (roh - weichbild) + 0.35 * weichbild
    aus = bild.copy()
    # Schmale Saeulen (Tesla-Spulen am Rand der Strom-Falle, unter 25 px breit) gehoeren zur
    # Falle in der Mitte und bleiben stehen; Bloecke und Banner sind breiter.
    objs = [o for o in objs if o[2] >= 25]
    rechtecke = [(x - RAND_L, y - RAND_O, x + w + RAND_R, y + h + RAND_U) for x, y, w, h in objs]
    bx0, by0, bx1, by1 = boden
    ring = 8
    for r in rechtecke:
        x0, y0, x1, y1 = r
        w, h = x1 - x0, y1 - y0

        def umrandung(px, py):
            a = arr[py - ring : py + h + ring, px - ring : px + w + ring]
            maske = np.ones(a.shape[:2], bool)
            maske[ring : ring + h, ring : ring + w] = False
            return a[maske]

        ziel = umrandung(x0, y0)
        best, quelle = None, None
        for qy in range(by0 + ring, by1 - h - ring, 2):
            for qx in range(bx0 + ring, bx1 - w - ring, 2):
                q = (qx - ring, qy - ring, qx + w + ring, qy + h + ring)
                if any(ueberlappt(q, o) for o in rechtecke):
                    continue
                # Nicht aus der Mitte (Zierkreis, Falle) kopieren.
                if ueberlappt(q, (540, 380, 740, 570)):
                    continue
                d = float(np.mean((umrandung(qx, qy) - ziel) ** 2))
                if best is None or d < best:
                    best, quelle = d, (qx, qy, qx + w, qy + h)
        if quelle is None:
            print(f"    WARNUNG: kein freies Bodenstueck fuer Hindernis {r}", file=sys.stderr)
            continue
        # Flicken samt Ring nehmen und weich einblenden: Kern (das Hindernis) voll deckend,
        # der Ring laeuft auf null aus.
        qx0, qy0 = quelle[0] - ring, quelle[1] - ring
        flicken = bild.crop((qx0, qy0, quelle[2] + ring, quelle[3] + ring))
        kern = Image.new("L", flicken.size, 0)
        ImageDraw.Draw(kern).rectangle((ring, ring, ring + w - 1, ring + h - 1), fill=255)
        weich = kern.filter(ImageFilter.GaussianBlur(ring / 2))
        maske = Image.composite(kern, weich, kern)
        # Nur auf den Boden malen: die Banner stehen direkt an der Seitenmauer, und die Mauer
        # soll Mauer bleiben.
        # Vektorisiert statt Pixel-fuer-Pixel-Python-Schleife (Opus-Review-Fund, 03.11.): nur
        # auf den Boden malen, die Mauer soll Mauer bleiben -- dieselbe Bedingung, einmal als
        # Koordinatengitter statt als zwei verschachtelte range()-Schleifen ueber jeden Pixel.
        m = np.asarray(maske).copy()
        yy, xx = np.mgrid[0 : m.shape[0], 0 : m.shape[1]]
        tx, ty = x0 - ring + xx, y0 - ring + yy
        m[(tx < bx0) | (tx >= bx1) | (ty < by0) | (ty >= by1)] = 0
        aus.paste(flicken, (x0 - ring, y0 - ring), Image.fromarray(m))
    return aus


def baue_arena(bild: Image.Image, objs) -> Image.Image:
    L = ARENA_LAYOUT
    if bild.size == L["groesse"]:
        sauber = hindernisse_zumalen(bild, objs, L["boden"])
        x0, x1 = L["ausschnitt_x"]
        breite = x1 - x0
        hoehe = round(breite * LH / LW)
        y0 = L["mitte_y"] - hoehe // 2
        aus = sauber.crop((x0, y0, x1, y0 + hoehe))
    else:
        # Unbekannter Grundriss (kuenftige Variante): mittiger Zuschnitt ohne Hindernis-Kenntnis.
        aus = deckend_zuschneiden(bild)
    return aus.resize((LW, LH), Image.LANCZOS)


def deckend_zuschneiden(bild: Image.Image, y_anteil: float = 0.5) -> Image.Image:
    w, h = bild.size
    if w / h > LW / LH:
        nb = round(h * LW / LH)
        return bild.crop(((w - nb) // 2, 0, (w - nb) // 2 + nb, h))
    nh = round(w * LH / LW)
    y0 = round((h - nh) * y_anteil)
    return bild.crop((0, y0, w, y0 + nh))


def skaliere(bild: Image.Image) -> Image.Image:
    """Auf Leinwandgroesse. Pixel-Art, die stark vergroessert wird (Buehnen-Szenen sind 640x360),
    erst ganzzahlig per naechstem Nachbarn verdoppeln und dann weich verkleinern — sonst
    verschwimmt jede Kante."""
    if LW / bild.size[0] > 1.5:
        f = int(LW / bild.size[0]) + 1
        bild = bild.resize((bild.size[0] * f, bild.size[1] * f), Image.NEAREST)
    return bild.resize((LW, LH), Image.LANCZOS)


def baue_buehne(bild: Image.Image, y_anteil: float) -> Image.Image:
    return skaliere(deckend_zuschneiden(bild, y_anteil))


def main() -> None:
    registry = lade_registry()
    tabelle: dict[str, list[dict]] = {}
    offen: list[str] = []
    for d_id in sorted(registry):
        chassis = CHASSIS.get(d_id) or {"art": None}
        if chassis["art"] not in CHASSIS_GEBAUT:
            offen.append(f"{d_id} ({chassis['art'] or 'feldspiel/buehne/bahn'})")
            continue
        eintraege = []
        for v in registry[d_id]["variants"]:
            if chassis["art"] == "quelle":
                q = QUELLEN / d_id / f"{v['id']}.png"
                if not q.exists():
                    print(f"  {d_id}/{v['id']}: keine Quelle {q.relative_to(WURZEL)}, uebersprungen")
                    continue
                fertig, objs = Image.open(q).convert("RGB"), []
                if fertig.size != (LW, LH):
                    fertig = fertig.resize((LW, LH), Image.LANCZOS)
            else:
                fertig = None
            demo = v.get("demo")
            if fertig is None:
                bild, objs = lade_szene(SZENEN / demo.lstrip("/")) if demo else (None, [])
                if bild is None:
                    print(f"  {d_id}/{v['id']}: keine saubere Kulisse in der Szene, uebersprungen")
                    continue
                fertig = baue_arena(bild, objs) if chassis["art"] == "arena" else baue_buehne(bild, chassis.get("y_anteil", 0.5))
            ziel = ZIEL_BILDER / d_id / f"{v['id']}.jpg"
            ziel.parent.mkdir(parents=True, exist_ok=True)
            fertig.save(ziel, "JPEG", quality=86, optimize=True, progressive=True)
            # Abdunklung fuer die Lesbarkeit der Kaempfer (kulisseZeichnen() im Motor): helle
            # Kulissen (Schnee, Sand) brauchen mehr, dunkle (Lava) fast keine.
            hell = sum(fertig.convert("L").resize((62, 24)).tobytes()) / (62 * 24 * 255)
            # Buehnen tragen mehr kleine Schrift direkt auf dem Bild (Zaehler, Namen, Uhr) und
            # bekommen deshalb einen Aufschlag (`dunkel_plus`).
            dunkel = round(min(0.3, max(0.06, (hell - 0.25) * 0.55)) + chassis.get("dunkel_plus", 0), 2)
            eintraege.append({"id": v["id"], "label": v["label"], "bild": f"/sprites/kulissen/{d_id}/{v['id']}.jpg", "dunkel": dunkel})
            print(f"  {d_id}/{v['id']}: {len(objs)} Hindernisse zugemalt -> {ziel.relative_to(WURZEL)} ({ziel.stat().st_size // 1024} KB)")
        if eintraege:
            tabelle[d_id] = eintraege
    kopf = (
        "// GENERIERT von scripts/baue-arena-kulissen.py — nicht von Hand bearbeiten.\n"
        "// Illustrierte Kulissen je Disziplin fuer den Boden der Battle Arena (s. kulisseWaehlen()\n"
        "// in battle-mode.engine.js). Reine Anzeige-Daten, nie in der Simulation gelesen.\n"
    )
    ZIEL_JS.write_text(
        kopf + "window.__ARENA_KULISSEN=" + json.dumps(tabelle, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    print(f"geschrieben: {ZIEL_JS.relative_to(WURZEL)} ({', '.join(f'{k}:{len(v)}' for k, v in tabelle.items())})")
    if offen:
        print("noch ohne Motor-Kulisse:", ", ".join(offen))


if __name__ == "__main__":
    main()
