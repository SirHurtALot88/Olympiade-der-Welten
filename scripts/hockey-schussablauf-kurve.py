#!/usr/bin/env python3
"""
Kurvenbild fuer den HOCKEY-SCHUSSABLAUF (public/mockups/battle-mode.engine.js,
HOCKEY_SCHUSS/hockeySchussPhase). Reine Abnahme-Grafik, kein Teil des Spiels: zeichnet
schlaegerWinkel und koerperDrehung gegen t fuer beide Schussarten, damit sich per Auge
pruefen laesst, dass keine Kurve an einer Phasengrenze springt oder abknickt (genau die
Sorge, die der Auftrag benennt).

Die Formel hier ist eine 1:1-Portierung von hockeySchussPhase() aus dem Engine-Code
(dieselben Konstanten, dieselbe smoothstep-Funktion) — kein zweites, unabhaengiges
Modell, s. Kommentar im Engine-Code selbst fuer die Quellenlage der Zeiten.

Nur PIL, kein matplotlib (nicht installiert in dieser Umgebung) — deshalb Achsen,
Gitter und Kurven von Hand gezeichnet statt ueber eine Plot-Bibliothek.
"""
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------------
# 1:1-Abschrift von HOCKEY_SCHUSS und hockeySchussPhase() aus battle-mode.engine.js.
# Bei einer Aenderung dort MUSS diese Kopie mitgezogen werden, sonst zeigt das Bild
# eine andere Kurve als die, die tatsaechlich im Spiel laeuft.
HOCKEY_SCHUSS = {
    "handgelenk": {
        "ausholen": dict(dauer=0.12, schlaegerVon=-8, schlaegerBis=-55, koerperVon=0, koerperBis=-12),
        "schuss":   dict(dauer=0.10, schlaegerVon=-55, schlaegerBis=15, koerperVon=-12, koerperBis=8),
        "halten":   dict(dauer=0.20, schlaegerVon=15, schlaegerBis=40, koerperVon=8, koerperBis=18),
    },
    "schlag": {
        "ausholen": dict(dauer=0.42, schlaegerVon=-8, schlaegerBis=-100, koerperVon=0, koerperBis=-25),
        "schuss":   dict(dauer=0.14, schlaegerVon=-100, schlaegerBis=20, koerperVon=-25, koerperBis=15),
        "halten":   dict(dauer=0.26, schlaegerVon=20, schlaegerBis=55, koerperVon=15, koerperBis=30),
    },
}


def smooth(u):
    u = 0.0 if u < 0 else (1.0 if u > 1 else u)
    return u * u * (3 - 2 * u)


def hockey_schuss_phase(t, art):
    d = HOCKEY_SCHUSS[art]
    tt = max(0.0, t)
    t1 = d["ausholen"]["dauer"]
    t2 = t1 + d["schuss"]["dauer"]

    def werte(seg, lokal):
        u = smooth(lokal)
        return (seg["schlaegerVon"] + (seg["schlaegerBis"] - seg["schlaegerVon"]) * u,
                seg["koerperVon"] + (seg["koerperBis"] - seg["koerperVon"]) * u)

    if tt < t1:
        lokal = tt / t1
        phase = "ausholen"
        seg = d["ausholen"]
    elif tt < t2:
        lokal = (tt - t1) / d["schuss"]["dauer"]
        phase = "schuss"
        seg = d["schuss"]
    else:
        lokal = min(1.0, (tt - t2) / d["halten"]["dauer"])
        phase = "halten"
        seg = d["halten"]
    winkel, drehung = werte(seg, lokal)
    return phase, winkel, drehung


# ---------------------------------------------------------------------------------
# Bild aufbauen: zwei Panels (Handgelenk- / Schlagschuss) uebereinander, je zwei
# Kurven (Schlaeger, Koerper) plus vertikale Marker an den Phasengrenzen.
W, H = 1180, 960
PAD_L, PAD_R, PAD_T = 90, 40, 50
PANEL_H = 380
GAP = 90

img = Image.new("RGB", (W, H), "white")
dr = ImageDraw.Draw(img)

try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    font_b = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
    font_s = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
except Exception:
    font = font_b = font_s = ImageFont.load_default()

FARBE_SCHLAEGER = (196, 30, 58)   # rot
FARBE_KOERPER = (30, 90, 200)     # blau
FARBE_GRENZE = (170, 170, 170)
FARBE_ACHSE = (60, 60, 60)

dr.text((W / 2 - 230, 12), "Hockey-Schussablauf — schlaegerWinkel & koerperDrehung vs. t",
        fill=(20, 20, 20), font=font_b)

panels = [("handgelenk", "Handgelenkschuss (0,42s gesamt — kurzes Ausholen, SCHUSS_NAH-Profil)"),
          ("schlag", "Schlagschuss (0,82s gesamt — langes Ausholen, SCHUSS_FERN-Profil)")]

for i, (art, titel) in enumerate(panels):
    top = PAD_T + i * (PANEL_H + GAP)
    plot_w = W - PAD_L - PAD_R
    plot_h = PANEL_H - 40

    d = HOCKEY_SCHUSS[art]
    t1 = d["ausholen"]["dauer"]
    t2 = t1 + d["schuss"]["dauer"]
    t3 = t2 + d["halten"]["dauer"]
    t_max = t3 * 1.15  # etwas Rand nach dem Ende zeigen (eingefrorener Wert)

    y0 = top + 25          # oberer Rand des Plotbereichs
    y1 = y0 + plot_h        # unterer Rand
    x0 = PAD_L
    x1 = PAD_L + plot_w

    dr.text((x0, top - 20), titel, fill=(20, 20, 20), font=font)

    # Wertebereich fuer die y-Achse: beide Kurven beider Arten teilen sich denselben
    # Bereich (-110..65 Grad), damit die zwei Panels optisch vergleichbar bleiben.
    y_min, y_max = -112, 65

    def to_xy(t, wert):
        x = x0 + (t / t_max) * plot_w
        y = y1 - (wert - y_min) / (y_max - y_min) * plot_h
        return x, y

    # Rahmen + Nulllinie
    dr.rectangle([x0, y0, x1, y1], outline=FARBE_ACHSE, width=1)
    zx, zy = to_xy(0, 0)
    dr.line([(x0, zy), (x1, zy)], fill=(225, 225, 225), width=1)
    dr.text((x1 + 6, zy - 7), "0°", fill=(140, 140, 140), font=font_s)

    # Phasengrenzen als vertikale Linien + Beschriftung
    for grenze, name in [(0, "ausholen"), (t1, "schuss"), (t2, "halten"), (t3, "(halten endet)")]:
        gx, _ = to_xy(grenze, 0)
        dr.line([(gx, y0), (gx, y1)], fill=FARBE_GRENZE, width=1)
        dr.text((gx + 3, y1 + 6), f"{grenze:.2f}s\n{name}", fill=(110, 110, 110), font=font_s)

    # x-Achsen-Ticks (0.1s-Raster)
    tick = 0.0
    while tick <= t_max:
        gx, _ = to_xy(tick, 0)
        dr.line([(gx, y1), (gx, y1 + 4)], fill=FARBE_ACHSE, width=1)
        tick += 0.1

    # Kurven abtasten (400 Punkte) — fein genug, dass ein echter Knick im Bild sichtbar
    # waere und nicht durch grobe Segmentierung verschluckt wird.
    n = 400
    pts_schlaeger, pts_koerper = [], []
    for k in range(n + 1):
        t = t_max * k / n
        _, winkel, drehung = hockey_schuss_phase(t, art)
        pts_schlaeger.append(to_xy(t, winkel))
        pts_koerper.append(to_xy(t, drehung))
    dr.line(pts_schlaeger, fill=FARBE_SCHLAEGER, width=3, joint="curve")
    dr.line(pts_koerper, fill=FARBE_KOERPER, width=3, joint="curve")

# Legende
ly = H - 26
dr.line([(PAD_L, ly), (PAD_L + 30, ly)], fill=FARBE_SCHLAEGER, width=3)
dr.text((PAD_L + 38, ly - 8), "schlaegerWinkel (Grad)", fill=(20, 20, 20), font=font)
dr.line([(PAD_L + 260, ly), (PAD_L + 290, ly)], fill=FARBE_KOERPER, width=3)
dr.text((PAD_L + 298, ly - 8), "koerperDrehung (Grad)", fill=(20, 20, 20), font=font)

out_path = "scripts/hockey-schussablauf-kurve.png"
img.save(out_path)
print("geschrieben:", out_path)

# ---------------------------------------------------------------------------------
# Textkontrolle zusaetzlich zum Bild: Wert unmittelbar links/rechts jeder
# Phasengrenze, damit ein Sprung (Wertdifferenz) nicht nur im Bild, sondern auch
# als Zahl auffaellt. Ein "Knick" (Steigungswechsel) ist am Bild leichter zu sehen
# als an dieser Tabelle — deshalb zusaetzlich das Bild, nicht nur diese Probe.
print()
print("Grenzwert-Kontrolle (schlaegerWinkel links/rechts jeder Phasengrenze):")
for art in ("handgelenk", "schlag"):
    d = HOCKEY_SCHUSS[art]
    t1 = d["ausholen"]["dauer"]
    t2 = t1 + d["schuss"]["dauer"]
    t3 = t2 + d["halten"]["dauer"]
    for grenze in (t1, t2, t3):
        eps = 1e-6
        _, wl, _ = hockey_schuss_phase(grenze - eps, art)
        _, wr, _ = hockey_schuss_phase(grenze + eps, art)
        diff = abs(wl - wr)
        status = "OK" if diff < 0.01 else "SPRUNG!"
        print(f"  {art:12s} t={grenze:.3f}s  links={wl:8.3f}  rechts={wr:8.3f}  diff={diff:.5f}  {status}")
