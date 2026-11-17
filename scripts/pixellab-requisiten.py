#!/usr/bin/env python3
"""PIXELLAB-REQUISITEN (Kulissen-Nachlese 08.11.): die Spielobjekte, die der Motor direkt auf die
Kulisse zeichnet, kommen nicht mehr aus OpenGameArt/LPC, sondern aus PixelLab.

Chris: "ja auch auf die besseren PixelLabs umstellen!" — Spurt-Stationen, Takeshi-Fallen und
Burgteile, Basketball-Korb und -Ball, Football-Ball und -Helme, Schachfiguren.

GRUNDSATZ: reiner Asset-Tausch. Jede neue Datei hat exakt die Pixelmasse der alten, und der Inhalt
sitzt in derselben Box (Alpha-Begrenzung der alten Datei innerhalb des Ausschnitts, den der Motor
liest). Der Motor zeichnet viele Kacheln mit naturalWidth/naturalHeight oder mit festen
Quell-Ausschnitten (falle_spitzen 0/96 32x32, falle_strickleiter 8/0 24x64, deko_banner 0/0 96x80,
burg_mauer k*40/8 36x56, hind_feuer fr*32, Schach SCHACH_IDX*48) — all das bleibt gueltig, ohne dass
eine Zeile im Motor sich aendert.

Ablauf (drei Schritte, nur der erste braucht die API):

  python3 -I scripts/pixellab-requisiten.py bestellen <name> [--seed N] [--kandidaten DIR]
      PixelLab /generate-image-v2 in der Zielgroesse; alle Kandidaten (4..64 je Auftrag) und ein
      Kontaktbogen landen in DIR (Default /tmp/pixellab-kandidaten/<name>/).
  python3 -I scripts/pixellab-requisiten.py waehlen <name> <index> [--kandidaten DIR]
      kopiert den gewaehlten Kandidaten nach data/generated/pixellab-requisiten/roh/<name>.png und
      vermerkt Prompt, Saat und Index in .../auswahl.json.
  python3 -I scripts/pixellab-requisiten.py einsetzen [<name> ...]
      baut aus roh/ die Dateien unter public/sprites/ — deterministisch, ohne Netz.

Herkunft je Datei: public/sprites/<ordner>/quellen.json (Eintrag "paket": "PixelLab").
"""
import argparse
import json
import os
import shutil
import sys

from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROH = os.path.join(WURZEL, "data/generated/pixellab-requisiten/roh")
AUSWAHL = os.path.join(WURZEL, "data/generated/pixellab-requisiten/auswahl.json")
SPRITES = os.path.join(WURZEL, "public/sprites")

STIL = "pixel art game asset, 16-bit RPG style, clean single color dark outline"
DRAUF = "3/4 top-down view as in a classic top-down RPG"

# name -> Auftrag. datei: Ziel unter public/sprites. bereich: Ausschnitt (x,y,w,h), den der Motor
# liest (Default: ganze Datei). gen: Erzeugungsgroesse. anker: wie der Inhalt in der Box sitzt.
# "art": Sonderbau (s. einsetzen()).
AUFTRAEGE = {
    # --- Spurt-Stationen (BAHN_ART.spurt.hindernisBilder, Unterkante auf der Fusslinie) ---
    "hind_huerde": dict(datei="arena/hind_huerde.png", gen=(32, 24),
        prompt=f"athletics track hurdle seen from the front, wide white crossbar with red stripes on two dark metal legs with feet, front view, {STIL}"),
    "hind_balken": dict(datei="arena/hind_balken.png", gen=(64, 16),
        prompt=f"long narrow wooden balance beam plank lying horizontally, wood grain, {DRAUF}, {STIL}"),
    "hind_wand": dict(datei="arena/hind_wand.png", gen=(32, 64),
        prompt=f"tall wooden palisade wall of sharpened vertical logs, obstacle course wall, front view, {STIL}"),
    "hind_seil": dict(datei="arena/hind_seil.png", gen=(64, 32),
        prompt=f"two wooden posts with a thick hemp rope hanging in a curve between them, obstacle course rope, side view, {STIL}"),
    "hind_wasser": dict(art="wasser", gen=(64, 32),
        prompt=f"small rectangular water pit dug into the ground, blue water with muddy dirt banks, top-down view, {STIL}"),
    "hind_mauer": dict(datei="arena/hind_mauer.png", gen=(40, 32),
        prompt=f"low rough fieldstone wall segment, grey stones with mortar, {DRAUF}, {STIL}"),
    "hind_heu": dict(datei="arena/hind_heu.png", gen=(64, 32),
        prompt=f"rectangular golden straw hay bale lying horizontally, tied with twine, {DRAUF}, {STIL}"),
    "hind_feuer": dict(art="feuer", gen=(32, 32),
        prompt=f"small campfire, crossed logs with bright orange flames, {DRAUF}, {STIL}"),

    # --- Takeshi's Castle: Fallen ---
    "falle_tuer": dict(datei="arena/falle_tuer.png", gen=(32, 32),
        prompt=f"freestanding wooden door in a simple frame, vertical planks, iron hinges, front view, {STIL}"),
    "falle_strickleiter": dict(datei="arena/falle_strickleiter.png", bereich=(8, 0, 24, 64), gen=(24, 64),
        prompt=f"hanging rope ladder with wooden rungs, front view, {STIL}"),
    "falle_spitzen": dict(datei="arena/falle_spitzen.png", bereich=(0, 96, 32, 32), gen=(32, 32),
        prompt=f"wooden cheval de frise, crossed sharpened stakes barricade, {DRAUF}, {STIL}"),
    "falle_walze": dict(datei="arena/falle_walze.png", gen=(24, 16),
        prompt=f"wooden log lying horizontally from left to right, bark texture, round cut ends visible on both sides, side view, {STIL}"),
    "deko_rad": dict(datei="arena/deko_rad.png", gen=(32, 32), anker="mitte",
        prompt=f"wooden wagon wheel with spokes and iron rim, perfectly round, front view, {STIL}"),
    "falle_fass": dict(datei="arena/falle_fass.png", gen=(32, 64),
        prompt=f"wooden barrel standing upright with iron bands, {DRAUF}, {STIL}"),
    # --- Takeshi's Castle: Burg ---
    "burg_mauer": dict(art="mauer", datei="arena/burg_mauer.png", gen=(160, 64),
        prompt=f"straight section of a solid light grey stone brick castle curtain wall with square battlements along the top, front view, the wall runs across the full width and is cut off at the left and right edges, {STIL}"),
    "burg_turm": dict(datei="arena/burg_turm.png", gen=(72, 144),
        prompt=f"medieval round stone castle tower with crenellated top and an arched gateway at the bottom, front view, {STIL}"),
    "burg_tor": dict(datei="arena/burg_tor.png", gen=(88, 144),
        prompt=f"medieval stone castle gatehouse with two arched gate openings and crenellated top, front view, {STIL}"),
    "deko_banner": dict(datei="arena/deko_banner.png", bereich=(0, 0, 96, 80), gen=(96, 80),
        prompt=f"two wooden poles with red heraldic banners hanging between them, front view, {STIL}"),
    "deko_pranger": dict(datei="arena/deko_pranger.png", gen=(56, 76),
        prompt=f"medieval wooden pillory on a post, front view, {STIL}"),
    "deko_stock": dict(datei="arena/deko_stock.png", gen=(58, 30),
        prompt=f"medieval wooden foot stocks with leg holes, {DRAUF}, {STIL}"),
    "deko_holz": dict(datei="arena/deko_holz.png", gen=(62, 63),
        prompt=f"neat stack of chopped firewood logs, {DRAUF}, {STIL}"),
    "zaun_holz": dict(datei="arena/zaun_holz.png", gen=(32, 32),
        prompt=f"short wooden fence segment, two posts and two horizontal rails, {DRAUF}, {STIL}"),
    "baum_1": dict(datei="arena/baum_1.png", gen=(36, 62), prompt=f"tall dark green conifer pine tree, {DRAUF}, {STIL}"),
    "baum_2": dict(datei="arena/baum_2.png", gen=(32, 60), prompt=f"slim green spruce tree, {DRAUF}, {STIL}"),
    "baum_3": dict(datei="arena/baum_3.png", gen=(30, 59), prompt=f"narrow green fir tree, {DRAUF}, {STIL}"),
    "baum_4": dict(datei="arena/baum_4.png", gen=(30, 42), prompt=f"small young pine tree, {DRAUF}, {STIL}"),

    # --- Basketball ---
    "korb_topdown": dict(art="korb", datei="basketball/korb_topdown.png", gen=(36, 28),
        prompt=f"basketball hoop seen from directly above: white backboard as a horizontal bar at the top, orange rim ring with white net below it, top-down view, {STIL}"),
    "ball": dict(datei="basketball/ball.png", gen=(32, 32), anker="mitte",
        prompt=f"orange basketball with black seams, round, {STIL}"),
    # --- Football ---
    "ball_football": dict(datei="football/ball_football.png", gen=(16, 16), anker="mitte",
        prompt=f"brown american football with white laces, oval, {STIL}"),
    "helmet_white1": dict(datei="football/helmet_white1.png", gen=(19, 19), anker="mitte",
        prompt=f"white american football helmet with blue stripe and face mask, side view, {STIL}"),
    "helmet_white2": dict(datei="football/helmet_white2.png", gen=(21, 19), anker="mitte",
        prompt=f"white american football helmet with blue stripe and face mask, three-quarter view, {STIL}"),
    "helmet_white3": dict(datei="football/helmet_white3.png", gen=(26, 22), anker="mitte",
        prompt=f"white american football helmet with blue stripe and grey face mask, front three-quarter view, {STIL}"),
    # --- Speed-Schach: sechs Figuren in einer Reihe, damit sie aus einem Guss sind ---
    "schach": dict(art="schach", gen=(288, 48),
        prompt=f"row of six ivory white chess pieces side by side, evenly spaced, from left to right: small round pawn, castle tower rook, horse head knight, bishop with pointed mitre, queen with a spiked crown, tallest king with a cross on top, front view, {STIL}"),

    # --- Kulissen-Rohbilder (Batch 12, Showcase-Rework 08.11.): KEIN Sprite-Tausch. Nur roh/<name>.png;
    # scripts/baue-kulisse-buehnen.py setzt sie als Buehnenprospekt in die Szene (dort, wo die Szene
    # eine schwarze Demo-LED-Wand hat, 264x115 Szenen-px). Mit Hintergrund (hintergrund=True). ---
    "showcase_prospekt_buehne": dict(art="kulisse", hintergrund=True, gen=(264, 116),
        prompt="painted theatre stage backdrop canvas, deep blue night sky with a large pale full moon and soft drifting clouds, small stars, dark silhouette of rolling hills and a distant castle along the bottom edge, flat painted scenery look, no people, no text, pixel art, 16-bit, muted colors"),
    "showcase_prospekt_zirkus": dict(art="kulisse", hintergrund=True, gen=(264, 116),
        prompt="deep red velvet circus curtain backdrop with gold fringe at the bottom, a large golden star emblem in the center, a frame of glowing warm marquee light bulbs around the edge, warm stage light, no people, no text, pixel art, 16-bit"),

    # --- Takeshi's Castle: Kulissen-QS 08.11. (Rahmen statt Material, Rang 1). Drei NEUE
    # Requisiten (kein Sprite-Tausch wie oben, art="neu": kein altes Format zu treffen,
    # Ziel ist die eigene gen-Box) fuer die Draufsicht-Route: ein Torii am Routenanfang,
    # Kirschbaeume entlang des Wegs, Tribuenenbloecke an zwei, drei Stellen. Alle drei im
    # selben DRAUF-Stil wie baum_1..4/zaun_holz, damit die Karte EINE Perspektive haelt
    # (docs/design/kulissen-qualitaets-audit-08-11.md Abschnitt 4.1: "Perspektive
    # vereinheitlichen" -- gewaehlter Weg: 3/4-Sicht durchhalten, nicht die Fallen-
    # Piktogramme auf strenge Draufsicht umstellen, s. Batch-13-Notiz).
    "takeshi_torii": dict(art="neu", datei="arena/takeshi_torii.png", gen=(84, 64),
        prompt=f"a wooden red japanese torii shrine gate, two upright pillars and a curved crossbeam on top, standalone, {DRAUF}, {STIL}"),
    "takeshi_kirschbaum": dict(art="neu", datei="arena/takeshi_kirschbaum.png", gen=(40, 58),
        prompt=f"blooming japanese cherry blossom tree with a round pink and white flower crown, {DRAUF}, {STIL}"),
    "takeshi_tribuene": dict(art="neu", datei="arena/takeshi_tribuene.png", gen=(72, 46),
        prompt=f"small wooden spectator grandstand bleacher stand full of tiny cheering fans in colourful clothes, {DRAUF}, {STIL}"),

    # --- Climbing: Kulissen-QS 08.11. (Rahmen statt Material, Rang 2 des Audits). Drei NEUE
    # Requisiten (art="neu", wie takeshi_torii/-kirschbaum/-tribuene in Batch 13: kein altes
    # Format zu treffen, Ziel ist die eigene gen-Box) fuer die Boden-/Wandfuss-Zone, die bodenWand()
    # jetzt zeichnet (docs/design/kulissen-qualitaets-audit-08-11.md Abschnitt 4.2: "unten der
    # Boden (Matten, Sicherer, Kreidebeutel, Hallenboden ...)", "Eisfall mit ... Eiszapfen am
    # Ueberhang"). Front-/Seitenansicht wie hind_huerde/falle_tuer oben, NICHT DRAUF: die Wand ist
    # eine senkrechte Flaeche von vorn, keine Draufsicht-Karte.
    "climbing_matte": dict(art="neu", datei="arena/climbing_matte.png", gen=(48, 48),
        prompt=f"square gym crash mat pattern with padded cells and visible seams, blue and dark blue, top-down view, {STIL}"),
    "climbing_kreidebeutel": dict(art="neu", datei="arena/climbing_kreidebeutel.png", gen=(20, 26),
        prompt=f"small open climbing chalk bag pouch with a drawstring, white chalk dust visible inside, front view, {STIL}"),
    # Sicht-Audit 16.11.: statt der Strichfigur als Sicherer am Wandfuss eine Sicherungsstation OHNE
    # Person (neue Charaktere sind gesperrt, CLAUDE.md): Seilsack mit aufgeschossenem Seil und einem
    # Sicherungsgeraet am Bodenanker. Requisite, keine Figur.
    "climbing_seilsack": dict(art="neu", datei="arena/climbing_seilsack.png", gen=(32, 28),
        prompt=f"open climbing rope bag lying on the floor with a neatly coiled colorful climbing rope on top and a small metal belay device clipped to a steel floor anchor ring, no people, front view, {STIL}"),
    "climbing_eiszapfen": dict(art="neu", datei="arena/climbing_eiszapfen.png", gen=(30, 42), anker="mitte",
        prompt=f"a cluster of hanging translucent light blue ice icicles pointing downward, front view, {STIL}"),

    # --- PixelLab-Requisiten Welle 1 (Task #137, 14.11.): neue Takeshi-/Mini-DM-/Gewichtheben-
    # Requisiten, die kein vorhandenes Format tauschen, deshalb alle art="neu" wie
    # takeshi_torii/climbing_matte oben. Nur Bestellen+Waehlen in dieser Runde, "einsetzen"
    # (Motor-Integration, battle-mode.engine.js) ist ein spaeterer, separater Task.

    # 1. Truhen-/Kisten-Familie: drei Verzierungsstufen, je zu und offen/durchsucht als
    # getrennte Sprites. Nutzen: I-Spy (Notiz/Akte/Tresor-Fundorte), Takeshi als Beute-Station.
    "truhe_1_zu": dict(art="neu", datei="arena/truhe_1_zu.png", gen=(32, 30),
        prompt=f"small plain wooden treasure chest with simple dark metal corner brackets, no ornamentation, closed, {DRAUF}, {STIL}"),
    "truhe_1_offen": dict(art="neu", datei="arena/truhe_1_offen.png", gen=(32, 34),
        prompt=f"small plain wooden treasure chest with simple dark metal corner brackets, lid open, a few coins and a torn note visible inside, {DRAUF}, {STIL}"),
    # saeubern (Re-Export 17.11.): die Freistellung dieser Bestellung liess helle Rahmenreste stehen
    # (truhe_2_zu: Eckklammern am Rand, truhe_3_offen: Strich links) -- s. nur_hauptteil().
    "truhe_2_zu": dict(art="neu", datei="arena/truhe_2_zu.png", gen=(34, 32), saeubern=True,
        prompt=f"wooden treasure chest with bronze corner fittings, a small lock and carved trim, closed, {DRAUF}, {STIL}"),
    "truhe_2_offen": dict(art="neu", datei="arena/truhe_2_offen.png", gen=(34, 36),
        prompt=f"wooden treasure chest with bronze corner fittings and carved trim, lid open, a stack of documents and a few gold coins visible inside, {DRAUF}, {STIL}"),
    "truhe_3_zu": dict(art="neu", datei="arena/truhe_3_zu.png", gen=(38, 34),
        prompt=f"ornate ironbound treasure chest with gold trim, engraved panels and a heavy lock, closed, {DRAUF}, {STIL}"),
    "truhe_3_offen": dict(art="neu", datei="arena/truhe_3_offen.png", gen=(38, 40), saeubern=True,
        prompt=f"ornate ironbound treasure chest with gold trim and engraved panels, lid open, a pile of gold coins and gems visible inside, {DRAUF}, {STIL}"),

    # 2. Grube mit Absturzkante: zwei bis drei Groessen/Gefahrstufen. Nutzen: Takeshi, Mini-DM,
    # Gewichtheben "Die Grube".
    "grube_klein": dict(art="neu", datei="arena/grube_klein.png", gen=(48, 32), anker="mitte",
        prompt=f"small rectangular pit dug into the ground with a crumbling broken edge, dark shadow at the bottom, {DRAUF}, {STIL}"),
    "grube_mittel": dict(art="neu", datei="arena/grube_mittel.png", gen=(64, 40), anker="mitte",
        prompt=f"medium rectangular pit with a jagged crumbling drop edge, dark depth with a few loose rocks tumbling in, {DRAUF}, {STIL}"),
    "grube_gross": dict(art="neu", datei="arena/grube_gross.png", gen=(80, 48), anker="mitte",
        prompt=f"large deep pit with a jagged crumbling drop edge, pitch black depth with sharpened wooden stakes faintly visible at the bottom, {DRAUF}, {STIL}"),

    # 3. Strom-Kaefig/Elektrozaun-Segment: kachelbar (Ecke + Gerade), je Zustand an/aus.
    # Nutzen: Mini-DM, Takeshi.
    "kaefig_gerade_aus": dict(art="neu", datei="arena/kaefig_gerade_aus.png", gen=(32, 32), anker="mitte",
        prompt=f"straight electrified fence segment between two metal posts, dark inactive wire mesh, no glow, {DRAUF}, {STIL}"),
    "kaefig_gerade_an": dict(art="neu", datei="arena/kaefig_gerade_an.png", gen=(32, 32), anker="mitte",
        prompt=f"straight electrified fence segment between two metal posts, bright blue-white electric arcs crackling along the wire mesh, {DRAUF}, {STIL}"),
    "kaefig_ecke_aus": dict(art="neu", datei="arena/kaefig_ecke_aus.png", gen=(32, 32), anker="mitte",
        prompt=f"corner post of an electrified fence where the wire mesh turns a right angle, dark inactive, no glow, {DRAUF}, {STIL}"),
    "kaefig_ecke_an": dict(art="neu", datei="arena/kaefig_ecke_an.png", gen=(32, 32), anker="mitte",
        prompt=f"corner post of an electrified fence where the wire mesh turns a right angle, bright blue-white electric arcs crackling along the mesh, {DRAUF}, {STIL}"),

    # 4. Pendel/Walze/Fegearm: EIN Einzelbild-Requisit (die Bewegung macht der Code, keine
    # Animation bestellen). Nutzen: Takeshi, Spurt "Die Hatz" (dort heute nur prozedural
    # gezeichnet, zeichneHatzUeberlagerung() in battle-mode.engine.js).
    "falle_fegearm": dict(art="neu", datei="arena/falle_fegearm.png", gen=(84, 24),
        prompt=f"a long padded wrecking-ball style sweeper arm mounted on a pivot post, horizontal swinging boom with a thick padded knocker end, side view, {STIL}"),

    # 5. Wackelbruecke: Planke ueber einer Gefahrenzone, als zwei Einzelbilder (intakt,
    # kippend). Nutzen: Takeshi, Mini-DM-Fluchtweg.
    "bruecke_wackel_heil": dict(art="neu", datei="arena/bruecke_wackel_heil.png", gen=(64, 20), anker="mitte",
        prompt=f"single wooden plank walkway bridging a gap, straight and level, visible wood grain, {DRAUF}, {STIL}"),
    "bruecke_wackel_kipp": dict(art="neu", datei="arena/bruecke_wackel_kipp.png", gen=(64, 24), anker="mitte",
        prompt=f"single wooden plank walkway bridging a gap, tilted steeply to one side as if about to flip over, visible wood grain, {DRAUF}, {STIL}"),

    # --- PixelLab-Requisiten Welle 2 (Task #139, 14.11.), Kulissen-Material. Vor dem Bestellen
    # geprueft (docs/design/kulissen-qualitaets-audit-08-11.md):
    #   - Punkt 7 (Spurt, Abschnitt 4.3) ist bereits VOLLSTAENDIG umgesetzt (Kulissen Batch 15,
    #     PR #1364, scripts/baue-kulisse-buehnen.py _sp_*): Boegen, Geraetezeile (Rudergeraete/
    #     Schlitten), Anzeigetafel und Bodenmerkmale kommen bereits aus der schon bezahlten
    #     HYROX-Rohszene (data/generated/kulissen-quellen/spurt/kurs.png) bzw. sind reiner
    #     Vektor -- 0 Generationen verbraucht (s. Commit-Text). Deshalb HIER NICHTS NEU BESTELLT.
    #   - Punkt 10 (Battlefield Hafen) hat eine wiederverwendbare Rohszene: die Gewichtheben-
    #     Kulisse "Sandsack-Schicht Hafenkai" (public/szenen/gewichtheben/hafen.html) zeigt
    #     bereits Frachter, KRAN und Leuchtturm -- Rohquelle data/generated/kulissen-quellen/
    #     gewichtheben/hafen.png. Deshalb AUCH HIER NICHTS NEU BESTELLT, s. Bericht.

    # 8. Eiskunstlauf Waldsee/Kuer (Audit 4.4): die bestehende Waldsee-Rohszene (kulissen-
    # quellen/eiskunstlauf/waldsee.png) zeigt Tannen nur als 25px-Linie ohne Bergkette/Himmel --
    # geprueft per Bildsicht, Audit-Kritik "nicht als Linie" trifft zu, kein Zuschnitt der
    # bestehenden Szene liefert mehr Hoehe. Fuer die Kür-Halle (kuer.png) gilt dasselbe
    # Spotlight-/Eis-Problem (Kuer-Halle: kuer.png). Drei neue Requisiten, gemeinsam fuer beide
    # Varianten nutzbar.
    "eiskunst_tannen_bergkette": dict(art="neu", datei="arena/eiskunst_tannen_bergkette.png", gen=(480, 160), anker="mitte",
        prompt=f"wide landscape backdrop of a dense dark pine forest skyline in front of a tall snow-capped mountain range, soft orange and purple evening sky above, side view horizon panorama, {STIL}"),
    "eiskunst_spotlight": dict(art="neu", datei="arena/eiskunst_spotlight.png", gen=(48, 90),
        prompt=f"a single soft cold white spotlight beam cone shining downward from above, glowing, transparent falloff at the edges, front view, {STIL}"),
    "eis_kufenspuren": dict(art="neu", datei="arena/eis_kufenspuren.png", gen=(64, 64), anker="mitte",
        prompt=f"tileable pale blue ice rink surface texture with crisscrossing faint ice skate blade scratch marks, subtle cracks, {DRAUF}, {STIL}"),

    # 9. Spurt zweite Outdoor-Variante (Stadionvorplatz oder Strand, Abendlicht): komplette
    # Rohszene im selben Massstab/derselben Draufsicht wie die bestehende HYROX-Halle (kurs.png,
    # 1680x960), damit Boegen/Geraetezeile/Bodenmerkmale genauso zuschneidbar bleiben (Muster
    # Batch 15, 0 weitere Generationen fuer die Bausteine).
    "spurt_outdoor_strand": dict(art="neu", datei="arena/spurt_outdoor_strand.png", gen=(688, 384), anker="mitte",
        prompt=f"top-down view of a wide outdoor sports track on a beach at dusk, golden sand lanes between painted white lines, beach volleyball nets and a lifeguard tower in the distance, warm orange evening light with long shadows, pixel art game asset, 16-bit RPG style, clean single color dark outline"),

    # --- PixelLab-Requisiten Welle 3 (Task #140, 14.11.), NUR falls nach Welle 1+2 noch
    # Guthaben uebrig ist. Hai (14) und Stier (14) sind von Chris ausdruecklich als Requisiten
    # freigegeben (keine neue PixelLab-Figur/-Animation), s. CLAUDE.md-Auftrag.

    # 11. Breaking "Die zwoelf Pfaehle": ein schlichter Bindepfahl -- NICHT der verzierte
    # deko_pranger (der existiert schon), sondern ein nackter, robuster Holzpfosten zum
    # Festbinden (CLAUDE.md: Breaking ist Folter/Survival, keine Breakdance-Requisite).
    "breaking_pfahl": dict(art="neu", datei="arena/breaking_pfahl.png", gen=(28, 64),
        prompt=f"a plain sturdy wooden post dug into the ground, worn rope wrapped around the top for binding, front view, {STIL}"),

    # 12. Wettessen "Ekelroulette": Kotzeimer + drei Teller-Varianten.
    "wettessen_kotzeimer": dict(art="neu", datei="arena/wettessen_kotzeimer.png", gen=(28, 32),
        prompt=f"a plain metal bucket, slightly dented, front view, {STIL}"),
    "wettessen_teller_normal": dict(art="neu", datei="arena/wettessen_teller_normal.png", gen=(32, 20), anker="mitte",
        prompt=f"a round plate piled with an ordinary hearty meal, {DRAUF}, {STIL}"),
    "wettessen_teller_schleim": dict(art="neu", datei="arena/wettessen_teller_schleim.png", gen=(32, 20), anker="mitte",
        prompt=f"a round plate filled with a disgusting grey-green slimy gloop, {DRAUF}, {STIL}"),
    # Urspruenglicher Prompt ("cooked crickets and grubs") wurde von der PixelLab-API als
    # Richtlinienverstoss abgelehnt (HTTP-Antwort: "Generation failed because it is against
    # policy") -- auf eine insektenfreie Ekel-Variante umgestellt, kein zweiter Versuch mit
    # Insekten/Kreaturen-Bezug.
    "wettessen_teller_krabbler": dict(art="neu", datei="arena/wettessen_teller_krabbler.png", gen=(32, 20), anker="mitte",
        prompt=f"a round plate piled with an unappetizing grey lumpy mystery stew with visible bones, {DRAUF}, {STIL}"),

    # 13. Takeshi "Sturm auf die Burg" / Battlefield "Belagerung": Fort-Segment, Rammbock,
    # Wasserkanone.
    "takeshi_fort_segment": dict(art="neu", datei="arena/takeshi_fort_segment.png", gen=(96, 64),
        prompt=f"straight section of a rough wooden palisade fort wall made of lashed logs with a simple fighting platform on top, front view, {STIL}"),
    "takeshi_rammbock": dict(art="neu", datei="arena/takeshi_rammbock.png", gen=(64, 32),
        prompt=f"a medieval battering ram, a thick log with an iron tip hanging from a wheeled wooden frame, side view, {STIL}"),
    "takeshi_wasserkanone": dict(art="neu", datei="arena/takeshi_wasserkanone.png", gen=(40, 48),
        prompt=f"a heavy water cannon turret on a wooden tripod stand, front three-quarter view, {STIL}"),

    # 14. Football "Hai-Gasse" (Becken + Hai) und Spurt "Die Hatz" (Stier) -- Chris' ausdruecklich
    # bestaetigte Requisiten-Ausnahme fuer diese zwei Lebewesen.
    "football_becken": dict(art="neu", datei="arena/football_becken.png", gen=(64, 32), anker="mitte",
        prompt=f"a rectangular glass-walled water tank lane segment sunk into the ground, pool water visible inside, {DRAUF}, {STIL}"),
    "hai": dict(art="neu", datei="arena/hai.png", gen=(48, 20), anker="mitte",
        prompt=f"a grey shark swimming just under the water surface, seen from directly above, {STIL}"),
    "stier": dict(art="neu", datei="arena/stier.png", gen=(40, 34),
        prompt=f"an angry charging bull with lowered horns, muscular body, side view, {STIL}"),

    # --- I-Spy-Nachbesserung (17.11., Chris: "Ja mach mal ... wir verwenden nur noch neue
    # PixelLab-Assets"). Offene Punkte aus #1533, s. docs/design/ispy-darstellung-16-11/.
    # (a) Breitformat-Kulisse: EINE Halle im Seitenverhaeltnis der Leinwand (1240x470 = 2,64:1)
    # statt zweier Szenenkopien mit Naht (zwei Pavillons, Fundorte teils "auf dem Dach").
    # baue-kulisse-buehnen.py baue_ispy() liest roh/ispy_halle_<variante>.png, sonst Rueckfall.
    # Bildaufbau passend zum Motor: Rueckwand nur im obersten Streifen (darueber liegt das HUD),
    # die Fundorte stehen auf H*0,27..0,76 ueber W*0,06..0,94 -- dort freie, ruhige Bodenflaeche.
    "ispy_halle_aztec": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view of one single very wide empty courtyard of an overgrown aztec jungle temple, carved stone temple wall with dark doorways and hanging vines along the top edge only, the whole rest is open flat floor of mossy stone slabs and short jungle grass with a few small ferns at the left and right borders, warm green and ochre colours, even soft light, no buildings in the middle, no characters, no text, 16-bit RPG top-down map, pixel art"),
    "ispy_halle_horror": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view of one single very wide empty haunted crypt hall interior, dark stone back wall with iron-barred alcoves and dim candles along the top edge only, the whole rest is open flat floor of dark grey-teal cobblestones with a few scattered bones and cobwebs at the left and right borders, cold teal and grey moody light, no pillars in the middle, no characters, no text, 16-bit RPG top-down map, pixel art"),
    "ispy_halle_lostplace": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view of one single very wide empty abandoned factory hall interior, back wall with a row of broken industrial windows along the top edge only, the whole rest is open flat floor of cracked grey-green concrete tiles with moss in the cracks, a few scattered papers and debris at the left and right borders, muted grey and olive colours, no machines in the middle, no characters, no text, 16-bit RPG top-down map, pixel art"),
    "ispy_halle_ruinengarten": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view of one single very wide empty overgrown ruined garden, crumbling red brick wall with arched openings and ivy along the top edge only, the whole rest is open lawn of lush green grass with a few broken stone flagstone paths, small bushes and fallen column pieces at the left and right borders, bright warm green colours, no buildings in the middle, no characters, no text, 16-bit RPG top-down map, pixel art"),

    # (b) Moebel der Fundorte (bisher Primitive in ispyZeichne*): je ein Requisit, fuer Schreibtisch
    # und Aktenschrank zusaetzlich der durchsuchte Zustand (ersetzt das Abdimmen bei "offen").
    # KEINE Figur: der Verhoer-Fundort wird ein leerer Verhoerstuhl mit Lampe statt der Mini-Figur.
    "ispy_schreibtisch": dict(art="neu", datei="arena/ispy_schreibtisch.png", pixelgenau=True, gen=(40, 30),
        prompt=f"small old wooden writing desk with an open leather diary and an ink pot on top, {DRAUF}, {STIL}"),
    "ispy_schreibtisch_durchsucht": dict(art="neu", datei="arena/ispy_schreibtisch_durchsucht.png", pixelgenau=True, gen=(40, 30),
        prompt=f"small old wooden writing desk that has been ransacked, drawers pulled out, papers scattered on top, {DRAUF}, {STIL}"),
    "ispy_aktenschrank": dict(art="neu", datei="arena/ispy_aktenschrank.png", pixelgenau=True, gen=(28, 36),
        prompt=f"small grey metal filing cabinet with three closed drawers and handles, front view, {STIL}"),
    "ispy_aktenschrank_offen": dict(art="neu", datei="arena/ispy_aktenschrank_offen.png", pixelgenau=True, gen=(28, 36),
        prompt=f"small grey metal filing cabinet with three drawers, the drawers pulled open and files sticking out, front view, {STIL}"),
    "ispy_verhoerstuhl": dict(art="neu", datei="arena/ispy_verhoerstuhl.png", pixelgenau=True, gen=(30, 36),
        prompt=f"empty wooden interrogation chair with leather straps on the armrests under a small hanging lamp, no person, {DRAUF}, {STIL}"),
    # Neubestellung 17.11. (Chris: "3 ja"): die erste Tuer (Bogentuer im Steinrahmen, 26x40) wirkte
    # im Horror-Saal klein wie ein Grabstein. Jetzt eckig: gerader Sturz, Holzrahmen, deutlicher
    # Griff; Box 24x32, damit sie nicht an die Sterne ueber dem Fundort stoesst.
    "ispy_tuer": dict(art="neu", datei="arena/ispy_tuer.png", pixelgenau=True, gen=(24, 32),
        prompt=f"a single closed rectangular wooden door with a perfectly flat straight top edge, standing in a square brown wooden door frame, vertical wood planks, a large clearly visible shiny brass door handle on the right side, no arch, no rounded top, {DRAUF}, {STIL}"),

    # --- Welle A (17.11., Chris: "1 ja fang damit an"; Audit docs/design/pixellab-nur-neue-assets-
    # audit-17-11.md Abschnitt 4): die prozedural gemalten Motor-Kulissen (baue-szenen-varianten*.py,
    # baue-szenen-schauplaetze.py) werden PixelLab-Breitformate im I-Spy-Muster (792x300 = Seiten-
    # verhaeltnis der Leinwand). Linien, Netz, Tore, Bande zeichnet weiter der Motor; das Bild liefert
    # nur Untergrund und Rand: Deko im obersten Streifen und an den Seitenraendern, Boden frei und
    # OHNE Markierungen. baue-kulisse-buehnen.py liest roh/kulisse_<disziplin>_<variante>.png, sonst
    # bleibt der alte Bau als Rueckfall.
    "kulisse_tennis_riviera": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view of one single very wide empty sunny terrace of plain orange-red clay on the mediterranean riviera, a white stone balustrade with terracotta flower pots, dark green cypress trees, small white villas with red roofs and a strip of blue sea along the top edge only, the whole rest is open flat smooth floor of plain orange-red clay with no lines and no markings, a few small potted lemon trees at the far left and right borders, warm sunny colours, even soft light, nothing in the middle, no net, no characters, no text, 16-bit RPG top-down map, pixel art"),
    "kulisse_tennis_dach": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view of one single very wide empty rooftop sports deck on top of a skyscraper in the evening, a tall chain-link fence with the glowing windows of a dark city skyline behind it along the top edge only, the whole rest is open flat smooth floor of plain blue hard court paint with no lines and no markings, a few small grey air-conditioning units and rooftop vents at the far left and right borders, cool blue and purple colours, bright even floodlight on the floor, nothing in the middle, no net, no characters, no text, 16-bit RPG top-down map, pixel art"),
    "kulisse_basketball_streetcourt": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view of one single very wide empty outdoor street court in a city neighbourhood, a chain-link fence in front of red brick apartment buildings along the top edge and along the bottom edge, the whole rest is open flat floor of plain faded blue painted asphalt with no lines and no markings, only a narrow strip of dark grey asphalt at the far left and right borders, urban colours, even daylight, nothing in the middle, no hoops, no characters, no text, 16-bit RPG top-down map, pixel art"),
    "kulisse_hockey_bergsee": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view of one single very wide empty frozen mountain lake, a thin strip of snowy mountain peaks and small snowy pine trees along the top edge only, the whole rest is open flat smooth pale white-blue lake ice with faint scratches and no lines and no markings, only a narrow rim of snow at the far left and right borders, cold bright winter colours, even daylight, nothing in the middle, no goals, no characters, no text, 16-bit RPG top-down map, pixel art"),
    "kulisse_football_strand": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view of one single very wide empty sandy beach, a thin strip of turquoise sea with small waves, palm trees and striped beach huts along the top edge, a thin row of colourful beach umbrellas and towels along the bottom edge, the whole rest is open flat smooth light golden sand with no lines and no markings, warm sunny colours, even daylight, nothing in the middle, no goal posts, no characters, no text, 16-bit RPG top-down map, pixel art"),
    "kulisse_eiskunstlauf_waldsee": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view of one single very wide empty frozen forest lake in winter, dense snowy dark green pine forest along the top edge and along the left and right borders and a thin row of pines along the bottom edge, distant snowy mountains above the top tree line, the whole middle is open flat smooth pale blue lake ice with no lines and no markings, cold calm winter colours, even soft light, nothing in the middle, no characters, no text, 16-bit RPG top-down map, pixel art"),

    # --- Takeshi-Arenen-REMAKE (17.11., Chris: "mehrere verschiedene takeshi arenen, mit verschiedenen
    # assets ... REDESIGN als REMAKE/2D HD"; docs/design/takeshi-arenen-remake-17-11.md). KEIN Tausch der
    # alten Midoriyama-Karte: je Arena EINE gemalte Karte im Leinwandformat (792x300), auf der der WEG
    # schon gemalt ist -- die Route des Motors wird danach auf den gemalten Weg gelegt
    # (TAKESHI_ARENEN[id].route in battle-mode.engine.js), nicht umgekehrt. Start unten links, Ziel-
    # bauwerk oben rechts (Leserichtung wie bisher); unten Mitte bleibt ruhig (dort liegt das HUD-Band).
    "kulisse_takeshis_castle_eisfestung": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view game map of a wide frozen dark fantasy valley at dusk, one single wide winding road of trampled snow and grey stone slabs runs from the bottom left corner in two big smooth curves across the map to the top right corner, where it ends at the gate of a dark frozen stone fortress with glowing blue windows, the road crosses a frozen lake with cracked ice in the middle of the map, snowy dark pine trees, jagged blue ice crystals, frozen rocks and small burning torches beside the road, cold blue and violet colours with warm torch light, long soft shadows, no characters, no text, 16-bit RPG top-down map, detailed pixel art"),
    "kulisse_takeshis_castle_dschungel": dict(art="kulisse", hintergrund=True, gen=(792, 300),
        prompt="top-down view game map of a wide overgrown dark fantasy jungle ruin, one single wide winding road of mossy stone slabs and brown earth runs from the bottom left corner in two big smooth curves across the map to the top right corner, where it ends at the stairs of an ancient stepped stone temple with glowing golden braziers, the road crosses a green swamp river on a broad stone causeway in the middle of the map, dense jungle trees, giant ferns, broken stone idols, vines and small glowing mushrooms beside the road, deep green and teal colours with warm golden light, long soft shadows, no characters, no text, 16-bit RPG top-down map, detailed pixel art"),
    # Fallen-Requisiten je Arena: EIN Bogen mit fuenf Fallen in einer Reihe (Muster "schach": aus einem
    # Guss, ein Auftrag statt fuenf), Reihenfolge = die fuenf Fallen-Sub-Skills TECHNIK, WENDIGKEIT,
    # WUCHT, STEHEN, ROBUST. `einsetzen` schneidet die fuenf Stuecke an den Leerspalten auseinander
    # nach public/sprites/arena/tk_<arena>_<typ>.png (art="takeshi_bogen").
    "tk_eisfestung_fallen": dict(art="takeshi_bogen", arena="eisfestung", gen=(320, 64),
        prompt=f"sprite sheet of exactly five separate dark fantasy ice obstacle props side by side in one row, evenly spaced with clear empty gaps between them, from left to right: a low maze wall made of translucent blue ice blocks, three round flat ice floes floating in a dark water hole, a massive cracked wall of frozen ice bricks with an iron-bound gate, a narrow frosted wooden plank bridge with icicles over a dark crevasse, a cluster of sharp upward pointing ice spikes, {DRAUF}, {STIL}"),
    "tk_dschungel_fallen": dict(art="takeshi_bogen", arena="dschungel", gen=(320, 64),
        prompt=f"sprite sheet of exactly five separate dark fantasy jungle ruin obstacle props side by side in one row, evenly spaced with clear empty gaps between them, from left to right: a low maze wall of mossy carved stone blocks with glowing green runes, three round mossy stepping stones in a green swamp pool, a heavy carved stone slab door in a vine-covered stone frame, a rickety rope and wooden plank bridge over a dark pit, a row of sharpened bamboo stakes spike trap, {DRAUF}, {STIL}"),
    # Zweiter Fallen-Bogen je Arena (zweiter Durchgang, Stationen 8-14): dieselbe Reihenfolge der Sub-Skills.
    "tk_eisfestung_fallen2": dict(art="takeshi_bogen", arena="eisfestung", zweit=True, gen=(320, 64),
        prompt=f"sprite sheet of exactly five separate dark fantasy ice obstacle props side by side in one row, evenly spaced with clear empty gaps between them, from left to right: a smooth tilted slab of slippery mirror ice with cracks, two thick frozen tree logs lying side by side covered in frost, a barricade heap of big packed snow boulders, a heavy frozen iron chain hanging between two icy stone posts, a spiked ice mace ball hanging from a wooden gallows frame, {DRAUF}, {STIL}"),
    "tk_dschungel_fallen2": dict(art="takeshi_bogen", arena="dschungel", zweit=True, gen=(320, 64),
        prompt=f"sprite sheet of exactly five separate dark fantasy jungle ruin obstacle props side by side in one row, evenly spaced with clear empty gaps between them, from left to right: a square floor of carved stone pressure plates with glowing golden symbols, two thick mossy tree logs lying side by side, a barricade wall of thick thorny vines and roots, a slippery fallen tree trunk bridge over swamp water, a spiked wooden log hanging on vines from a wooden frame, {DRAUF}, {STIL}"),
    # Parallax-Ebene je Arena: das grosse Vordergrund-Requisit, das beim Heranzoomen von den unteren
    # Bildecken hereinragt. (Beide Auftraege baten zusaetzlich um ein kleines Partikel im selben Bild --
    # die Eisfestung lieferte nur die Tanne; die Partikel kommen deshalb aus dem eigenen Bogen tk_partikel.)
    "tk_eisfestung_ebene": dict(art="takeshi_ebene", arena="eisfestung", gen=(224, 96),
        prompt=f"two separate items side by side with a wide empty gap between them: on the left a very large dark pine tree branch heavily covered with white snow and hanging icicles, filling the left two thirds, on the right one single small soft white snowflake, {STIL}"),
    "tk_dschungel_ebene": dict(art="takeshi_ebene", arena="dschungel", gen=(224, 96),
        prompt=f"two separate items side by side with a wide empty gap between them: on the left a very large cluster of dark green tropical palm fronds and fern leaves with hanging vines, filling the left two thirds, on the right one single small glowing golden firefly light orb, {STIL}"),
    # Partikel beider Arenen in EINEM Reihenbild (vier Stueck): Schneeflocke und Schneewehe fuer die
    # Eisfestung, Gluehwuermchen und treibendes Blatt fuer den Dschungel. Der Motor zeichnet sie
    # vielfach und bewegt (takeshiArenaDavor()).
    "tk_partikel": dict(art="takeshi_partikel", gen=(128, 32),
        prompt=f"sprite sheet of exactly four separate tiny particle sprites side by side in one row, evenly spaced with clear empty gaps between them, from left to right: a white six-pointed snowflake, a small soft white snow puff, a small glowing golden firefly light orb, a small green drifting leaf, {STIL}"),
}

# Alpha-Begrenzung der ALTEN LPC/Kenney-Datei innerhalb des gelesenen Ausschnitts (gemessen am 08.11.
# vor dem Tausch). Fest eingetragen, damit ein zweiter Lauf von `einsetzen` nicht die neue Datei
# vermisst und die Box wandert. In diese Box wird der PixelLab-Inhalt gesetzt.
ALTE_BOX = {
    'hind_huerde': (0, 3, 32, 26), 'hind_balken': (0, 0, 64, 10), 'hind_wand': (0, 0, 32, 64),
    'hind_seil': (12, 0, 64, 32), 'hind_mauer': (0, 3, 40, 27), 'hind_heu': (4, 2, 56, 30),
    'hind_wasser': (9, 0, 58, 32),  # l (9..32) + r (0..26) nebeneinander
    'falle_tuer': (0, 32, 32, 64), 'falle_strickleiter': (4, 0, 24, 64), 'falle_spitzen': (0, 0, 32, 32),
    'falle_walze': (5, 8, 28, 22), 'deko_rad': (0, 0, 32, 32), 'falle_fass': (3, 6, 28, 59),
    'burg_mauer': (0, 0, 160, 64), 'burg_turm': (14, 11, 83, 150), 'burg_tor': (9, 5, 96, 150),
    'deko_banner': (0, 2, 96, 73), 'deko_pranger': (5, 7, 61, 82), 'deko_stock': (5, 0, 63, 30),
    'deko_holz': (2, 1, 64, 64), 'zaun_holz': (0, 1, 32, 26), 'baum_1': (0, 0, 36, 62),
    'baum_2': (0, 0, 32, 60), 'baum_3': (0, 0, 30, 59), 'baum_4': (0, 0, 30, 42),
    'korb_topdown': (14, 0, 50, 27), 'ball': (0, 0, 32, 32), 'ball_football': (0, 0, 14, 16),
    'helmet_white1': (0, 0, 19, 19), 'helmet_white2': (0, 0, 21, 19), 'helmet_white3': (0, 0, 26, 22),
}


# ------------------------------------------------------------------ Bestellen / Waehlen
def kand_dir(args, name):
    return os.path.join(args.kandidaten or "/tmp/pixellab-kandidaten", name)


def bestellen(args):
    from pixellab_api import api, warte_job, bild_aus, bild_an
    for name in args.namen:
        a = AUFTRAEGE[name]
        w, h = a["gen"]
        prompt = args.prompt or a["prompt"]
        body = {"description": prompt, "image_size": {"width": w, "height": h},
                "no_background": not a.get("hintergrund", False), "seed": args.seed}
        if args.referenz:
            # Zustandspaar (zu/durchsucht) in derselben Ansicht: der gewaehlte Rohkandidat des
            # Partners als Motiv-Referenz (generate-image-v2 reference_images).
            ref = Image.open(args.referenz).convert("RGBA")
            body["reference_images"] = [{"image": bild_an(ref), "size": {"width": ref.width, "height": ref.height},
                                         "usage_description": "same object, same camera angle and style"}]
        # Bestell-Regel 17.11.: Guthaben vorher lesen, POST genau einmal, usage.generations protokollieren.
        vorher = api("GET", "/balance").get("subscription", {}).get("generations")
        print(f"{name}: Guthaben vor der Bestellung {vorher}")
        r = api("POST", "/generate-image-v2", body, einmal=True)
        print(f"{name}: Job {r.get('background_job_id')} usage={r.get('usage')}")
        j = warte_job(r["background_job_id"])
        verbrauch = r.get("usage") or j.get("usage") or (j.get("last_response") or {}).get("usage")
        ims = [bild_aus(x) for x in j["last_response"]["images"]]
        d = kand_dir(args, name)
        os.makedirs(d, exist_ok=True)
        for i, im in enumerate(ims):
            im.save(os.path.join(d, f"{i:02d}.png"))
        json.dump({"prompt": prompt, "seed": args.seed, "gen": [w, h], "job": r["background_job_id"],
                   "usage": verbrauch, "guthaben_vorher": vorher,
                   **({"referenz": os.path.relpath(args.referenz, WURZEL)} if args.referenz else {})},
                  open(os.path.join(d, "auftrag.json"), "w"), indent=1)
        kontaktbogen(ims, os.path.join(d, "bogen.png"))
        print(f"{name}: {len(ims)} Kandidaten -> {d}/bogen.png, usage={verbrauch}")


def kontaktbogen(ims, ziel):
    from PIL import ImageDraw
    w = max(i.width for i in ims)
    h = max(i.height for i in ims)
    sc = max(1, min(4, 160 // max(w, h)))
    n = len(ims)
    sp = min(n, 8 if w * sc < 200 else 4)
    zl = (n + sp - 1) // sp
    cw, ch = w * sc + 6, h * sc + 16
    bogen = Image.new("RGBA", (sp * cw, zl * ch), (70, 96, 70, 255))
    dr = ImageDraw.Draw(bogen)
    for k, im in enumerate(ims):
        x, y = (k % sp) * cw, (k // sp) * ch
        for yy in range(0, h * sc, 8):
            for xx in range(0, w * sc, 8):
                if (xx // 8 + yy // 8) % 2:
                    dr.rectangle([x + 3 + xx, y + 14 + yy, x + 3 + xx + 7, y + 14 + yy + 7], fill=(84, 112, 84, 255))
        bogen.alpha_composite(im.resize((im.width * sc, im.height * sc), Image.NEAREST), (x + 3, y + 14))
        dr.text((x + 3, y + 1), str(k), fill=(255, 255, 255, 255))
    bogen.save(ziel)


def waehlen(args):
    name, idx = args.namen[0], int(args.namen[1])
    d = kand_dir(args, name)
    auftrag = json.load(open(os.path.join(d, "auftrag.json")))
    os.makedirs(ROH, exist_ok=True)
    shutil.copy(os.path.join(d, f"{idx:02d}.png"), os.path.join(ROH, f"{name}.png"))
    aw = json.load(open(AUSWAHL)) if os.path.exists(AUSWAHL) else {}
    aw[name] = dict(auftrag, kandidat=idx, endpunkt="/v2/generate-image-v2")
    json.dump(dict(sorted(aw.items())), open(AUSWAHL, "w"), indent=1, ensure_ascii=False)
    print(f"{name}: Kandidat {idx} -> roh/{name}.png")


# ------------------------------------------------------------------ Einsetzen
def zuschnitt(im):
    """Auf die Alpha-Begrenzung beschneiden; Halbtransparenz (Kanten der Freistellung) haerten."""
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a >= 128 else 0)
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def nur_hauptteil(im):
    """Nur die groesste zusammenhaengende Deckflaeche (8er-Nachbarschaft) behalten. Fuer Kandidaten,
    deren Freistellung helle Rahmenreste neben dem Objekt stehen liess; das Objekt selbst bleibt
    pixelgenau an seiner Stelle (Re-Export truhe_2_zu/truhe_3_offen, 17.11., ohne Neubestellung)."""
    im = im.copy()
    px = im.load()
    w, h = im.size
    # zuerst die fast weissen Reste, die vom Rand her am Objekt kleben (truhe_3_offen: der Strich
    # links beruehrt die Kontur), vom Bildrand aus wegfluten; Glanzlichter IM Objekt erreicht die
    # Flut nicht, weil die dunkle Kontur dazwischen liegt.
    def weiss(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and min(r, g, b) >= 235
    flut = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    flut = [p for p in flut if weiss(*p)]
    while flut:
        x, y = flut.pop()
        if not weiss(x, y):
            continue
        px[x, y] = (0, 0, 0, 0)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and weiss(nx, ny):
                    flut.append((nx, ny))
    gesehen, teile = set(), []
    for y0 in range(h):
        for x0 in range(w):
            if (x0, y0) in gesehen or px[x0, y0][3] == 0:
                continue
            teil, stapel = [], [(x0, y0)]
            gesehen.add((x0, y0))
            while stapel:
                x, y = stapel.pop()
                teil.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in gesehen and px[nx, ny][3] > 0:
                            gesehen.add((nx, ny))
                            stapel.append((nx, ny))
            teile.append(teil)
    teile.sort(key=len, reverse=True)
    for teil in teile[1:]:
        for x, y in teil:
            px[x, y] = (0, 0, 0, 0)
    return im


def einpassen(inhalt, bw, bh):
    """Inhalt in eine Box bw x bh: verkleinern, wenn er nicht passt; vergroessern nur um ganze
    Faktoren (Pixelraster bleibt), sonst unveraendert."""
    w, h = inhalt.size
    if w > bw or h > bh:
        f = min(bw / w, bh / h)
        return inhalt.resize((max(1, round(w * f)), max(1, round(h * f))), Image.NEAREST)
    k = min(bw // w, bh // h)
    if k >= 2:
        return inhalt.resize((w * k, h * k), Image.NEAREST)
    # fast passend (>= 85 % je Achse) bleibt pixelgenau, sonst sanft auf die Box ziehen
    if w >= 0.85 * bw or h >= 0.85 * bh:
        return inhalt
    f = min(bw / w, bh / h)
    return inhalt.resize((round(w * f), round(h * f)), Image.NEAREST)


def setze(name, a, canvas, quelle):
    W, H = canvas.size
    bereich = a.get("bereich", (0, 0, W, H))
    bx0, by0, bx1, by1 = ALTE_BOX[name]
    bw, bh = bx1 - bx0, by1 - by0
    inh = einpassen(zuschnitt(quelle), bw, bh)
    ox = bereich[0] + bx0 + (bw - inh.width) // 2
    if a.get("anker") == "mitte":
        oy = bereich[1] + by0 + (bh - inh.height) // 2
    else:
        oy = bereich[1] + by1 - inh.height
    # alter Inhalt im gelesenen Ausschnitt wird geloescht, der Rest der Datei bleibt leer
    canvas.alpha_composite(inh, (ox, oy))
    return canvas


def roh(name):
    p = os.path.join(ROH, f"{name}.png")
    if not os.path.exists(p):
        return None
    return Image.open(p).convert("RGBA")


def baue_standard(name, a):
    q = roh(name)
    if q is None:
        return False
    alt = Image.open(os.path.join(SPRITES, a["datei"]))
    neu = Image.new("RGBA", alt.size, (0, 0, 0, 0))
    setze(name, a, neu, q)
    neu.save(os.path.join(SPRITES, a["datei"]))
    return True


def baue_wasser(name, a):
    """Der Motor setzt hind_wasser_l bei x-32 und hind_wasser_r bei x: beide zusammen sind ein
    64x32-Feld. Der Graben sitzt in derselben Box wie der alte (ALTE_BOX, ueber beide Haelften)."""
    q = roh(name)
    if q is None:
        return False
    voll = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    bx0, by0, bx1, by1 = ALTE_BOX[name]
    # Wie die alten LPC-Kacheln: Ufer nur links und rechts, oben und unten offen. Der Motor setzt
    # das Feld in jede Bahn, uebereinander ergibt das einen durchgehenden Graben quer ueber alle
    # Bahnen statt einzelner Becken. Genommen wird ein waagerechtes Band aus der Mitte des Beckens
    # (Wasser mit Seitenufern), gespiegelt senkrecht gekachelt -> oben und unten nahtlos.
    roh_ = zuschnitt(q)
    roh_ = roh_.resize((bx1 - bx0, roh_.height), Image.NEAREST)
    y0, y1 = round(roh_.height * 0.38), round(roh_.height * 0.62)
    band = roh_.crop((0, y0, roh_.width, y1))
    paar = Image.new("RGBA", (band.width, band.height * 2))
    paar.paste(band, (0, 0))
    paar.paste(band.transpose(Image.FLIP_TOP_BOTTOM), (0, band.height))
    inh = Image.new("RGBA", (band.width, by1 - by0))
    # Wasserflaeche: die nahtlose PixelLab-Seekachel (dieselbe wie boden_see in Takeshi), die
    # Ufer (je 6 Spalten) aus dem Band des Beckens.
    see = Image.open(os.path.join(WURZEL, "data/generated/pixellab-boden/c/tile_15.png")).convert("RGBA")
    for x in range(0, inh.width, 32):
        for y in range(0, inh.height, 32):
            inh.paste(see, (x, y))
    ufer = Image.new("RGBA", (band.width, inh.height))
    for y in range(0, inh.height, paar.height):
        ufer.paste(paar, (0, y))
    inh.paste(ufer.crop((0, 0, 6, inh.height)), (0, 0))
    inh.paste(ufer.crop((band.width - 6, 0, band.width, inh.height)), (band.width - 6, 0))
    voll.alpha_composite(inh, (bx0, by0))
    voll.crop((0, 0, 32, 32)).save(os.path.join(SPRITES, "arena/hind_wasser_l.png"))
    voll.crop((32, 0, 64, 32)).save(os.path.join(SPRITES, "arena/hind_wasser_r.png"))
    return True


def baue_feuer(name, a):
    """Fuenf Bilder zu 32x32 nebeneinander (Motor: fr=floor(rennT*8)%5). roh/hind_feuer_<k>.png
    sind die Bilder einer PixelLab-Animation (/animate-with-text-v3) des gewaehlten Feuers."""
    bilder = [roh(f"hind_feuer_{k}") for k in range(5)]
    if any(b is None for b in bilder):
        return False
    blatt = Image.new("RGBA", (160, 32), (0, 0, 0, 0))
    # gemeinsame Box ueber alle Bilder, damit das Feuer nicht springt
    boxen = [b.split()[3].point(lambda v: 255 if v >= 128 else 0).getbbox() for b in bilder]
    x0 = min(b[0] for b in boxen); y0 = min(b[1] for b in boxen)
    x1 = max(b[2] for b in boxen); y1 = max(b[3] for b in boxen)
    w, h = x1 - x0, y1 - y0
    f = min(1.0, 32 / w, 32 / h)
    for k, b in enumerate(bilder):
        t = b.copy()
        px = t.load()
        for yy in range(t.height):
            for xx in range(t.width):
                r, g, bl, al = px[xx, yy]
                px[xx, yy] = (r, g, bl, 255 if al >= 128 else 0)
        t = t.crop((x0, y0, x1, y1))
        if f < 1:
            t = t.resize((max(1, round(w * f)), max(1, round(h * f))), Image.NEAREST)
        blatt.alpha_composite(t, (k * 32 + (32 - t.width) // 2, 32 - t.height))
    blatt.save(os.path.join(SPRITES, "arena/hind_feuer.png"))
    return True


def baue_mauer(name, a):
    """160x64 (der Motor kachelt sie waagerecht mit naturalWidth). Ist das Rohbild breiter, wird der
    160er-Ausschnitt gesucht, dessen linke und rechte Randspalte am besten zueinander passen; ein
    160er-Rohbild (Zinnen im gleichmaessigen Raster, Mauer laeuft an beiden Raendern aus dem Bild)
    wird unveraendert genommen."""
    q = roh(name)
    if q is None:
        return False
    q = q.convert("RGBA")
    if q.height != 64:
        q = q.resize((round(q.width * 64 / q.height), 64), Image.NEAREST)
    px = q.load()

    def spalte_diff(xa, xb):
        s = 0
        for y in range(64):
            pa, pb = px[xa, y], px[xb, y]
            s += sum(abs(pa[i] - pb[i]) for i in range(4))
        return s
    best = (0, 0)
    for x0 in range(0, q.width - 161):
        d = spalte_diff(x0, x0 + 160) + spalte_diff(x0 + 1, x0 + 161)
        if best is None or d < best[0]:
            best = (d, x0)
    x0 = best[1]
    neu = q.crop((x0, 0, x0 + 160, 64))
    neu.save(os.path.join(SPRITES, a["datei"]))
    return True


SCHACH = ["bauer", "turm", "springer", "laeufer", "dame", "koenig"]


def baue_schach(name, a):
    """Sechs Figuren (Reihenfolge SCHACH_IDX p/r/n/b/q/k = Bauer/Turm/Springer/Laeufer/Dame/Koenig),
    je Zelle 48x48 unten buendig zentriert, Zeile 0 und (unbenutzt) Zeile 1 gleich.
    Rohbilder roh/schach_<figur>.png: Bauer bis Laeufer aus EINEM Reihenbild (gleicher Massstab),
    Dame und Koenig einzeln mit dem Reihenbild als Stilvorlage (in der Reihe waren sie oben
    abgeschnitten). Ein gemeinsamer Massstab haelt die Groessenfolge (Koenig am hoechsten).
    Schwarz ist dieselbe Zeichnung, die helle Fuellung abgedunkelt — wie beim alten Schnitt
    (buehne-schach-assets-schneiden.mjs)."""
    figs = [roh(f"schach_{f}") for f in SCHACH]
    if any(f is None for f in figs):
        return False
    figs = [zuschnitt(f) for f in figs]
    f = min(1.0, 45 / max(x.height for x in figs), 46 / max(x.width for x in figs))
    weiss = Image.new("RGBA", (288, 96), (0, 0, 0, 0))
    for k, fig in enumerate(figs):
        if f < 1:
            fig = fig.resize((max(1, round(fig.width * f)), max(1, round(fig.height * f))), Image.NEAREST)
        for zeile in (0, 1):
            weiss.alpha_composite(fig, (k * 48 + (48 - fig.width) // 2, zeile * 48 + 47 - fig.height))
    weiss.save(os.path.join(SPRITES, "buehne/schach_weiss.png"))
    schwarz = weiss.copy()
    px = schwarz.load()
    for y in range(96):
        for x in range(288):
            r, g, b, al = px[x, y]
            if al:
                l = (r * 299 + g * 587 + b * 114) / 1000
                if l > 70:  # Fuellung und Glanz ebenholzfarben, Umriss bleibt
                    t = (l - 70) / 185
                    px[x, y] = (int(44 + 50 * t), int(38 + 40 * t), int(34 + 32 * t), al)
    schwarz.save(os.path.join(SPRITES, "buehne/schach_schwarz.png"))
    return True


def baue_korb(name, a):
    """Der Ballflug zielt auf korbX, und das Sprite haengt mit drawImage(...,-28,-20,56,56) daran:
    massgeblich ist deshalb, wo der RING im Bild sitzt, nicht die Box. Der Ringmittelpunkt (orange
    Pixel) wird pixelgenau auf den des alten Kenney-Korbs gelegt (31,6 / 13,4 im 64er-Bild),
    ohne Skalierung; was oben ueber den Rand ragt (Oberkante des Bretts), faellt weg."""
    q = roh(name)
    if q is None:
        return False
    q = zuschnitt(q)
    px = q.load()
    pts = [(x, y) for y in range(q.height) for x in range(q.width)
           if px[x, y][3] and px[x, y][0] > 180 and 60 < px[x, y][1] < 170 and px[x, y][2] < 90]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    neu = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    neu.alpha_composite(q, (round(31.6 - cx), round(13.4 - cy)))  # alpha_composite schneidet am Rand
    neu.save(os.path.join(SPRITES, a["datei"]))
    return True


def baue_kulisse(name, a):
    """Kulissen-Rohbild: hier wird nichts gebaut, baue-kulisse-buehnen.py liest roh/<name>.png."""
    return roh(name) is not None


def baue_neu(name, a):
    """Brandneue Requisiten ohne Vorgaenger-Datei (kein ALTE_BOX-Eintrag noetig, uebernommen aus
    Batch 13/Takeshi): der Rohkandidat wird auf seine Alpha-Begrenzung beschnitten, in die eigene
    gen-Box eingepasst und mittig (anker="mitte") oder unten buendig (Default) auf eine neue,
    transparente Leinwand genau dieser Box gesetzt."""
    q = roh(name)
    if q is None:
        return False
    bw, bh = a["gen"]
    # pixelgenau (I-Spy-Moebel 17.11.): nur zuschneiden, nie um krumme Faktoren ziehen -- der
    # Motor skaliert beim Zeichnen ohnehin selbst, ein Zwischenschritt verschmiert nur das Raster.
    inh = zuschnitt(q) if a.get("pixelgenau") else einpassen(zuschnitt(q), bw, bh)
    if a.get("saeubern"):
        inh = nur_hauptteil(inh)
    neu = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    ox = (bw - inh.width) // 2
    oy = (bh - inh.height) // 2 if a.get("anker") == "mitte" else bh - inh.height
    neu.alpha_composite(inh, (ox, oy))
    os.makedirs(os.path.join(SPRITES, os.path.dirname(a["datei"])), exist_ok=True)
    neu.save(os.path.join(SPRITES, a["datei"]))
    return True


TAKESHI_TYPEN = ["technik", "wendigkeit", "wucht", "stehen", "robust"]


def bogen_teile(q, n):
    """Ein Reihenbild an seinen Leerspalten in genau n Stuecke teilen (von links nach rechts), jedes
    auf seine Alpha-Begrenzung beschnitten. Leerspalten unter 3 px gelten als Luecke IM Stueck (ein
    Eiszapfen neben seinem Block); sind es danach mehr als n Stuecke, werden die jeweils engsten
    Nachbarn zusammengelegt. None, wenn weniger als n Stuecke im Bild stehen."""
    q = zuschnitt(q)
    px = q.load()
    voll = [any(px[x, y][3] for y in range(q.height)) for x in range(q.width)]
    laeufe, x = [], 0
    while x < q.width:
        if voll[x]:
            x0 = x
            while x < q.width and voll[x]:
                x += 1
            if laeufe and x0 - laeufe[-1][1] < 3:
                laeufe[-1][1] = x
            else:
                laeufe.append([x0, x])
        else:
            x += 1
    while len(laeufe) > n:
        k = min(range(len(laeufe) - 1), key=lambda i: laeufe[i + 1][0] - laeufe[i][1])
        laeufe[k][1] = laeufe[k + 1][1]
        del laeufe[k + 1]
    if len(laeufe) < n:
        return None
    return [zuschnitt(q.crop((a, 0, b, q.height))) for a, b in laeufe]


def baue_takeshi_bogen(name, a):
    """Fuenf Fallen-Requisiten einer Takeshi-Arena aus EINEM Reihenbild (TECHNIK, WENDIGKEIT, WUCHT,
    STEHEN, ROBUST) -> arena/tk_<arena>_<typ>.png (zweiter Bogen: ..._<typ>_2.png), pixelgenau."""
    q = roh(name)
    if q is None:
        return False
    teile = bogen_teile(q, 5)
    if teile is None:
        print(f"{name}: keine fuenf Stuecke im Bogen gefunden")
        return False
    for typ, teil in zip(TAKESHI_TYPEN, teile):
        teil.save(os.path.join(SPRITES, f"arena/tk_{a['arena']}_{typ}{'_2' if a.get('zweit') else ''}.png"))
    return True


def baue_takeshi_ebene(name, a):
    """Vordergrund-Requisit der Parallax-Ebene einer Takeshi-Arena -> arena/tk_<arena>_vordergrund.png."""
    q = roh(name)
    if q is None:
        return False
    # nur das groesste Stueck (ein mitgeliefertes Kleinteil neben dem Requisit faellt weg)
    teile = bogen_teile(q, 2) or [zuschnitt(q)]
    max(teile, key=lambda t: t.width * t.height).save(
        os.path.join(SPRITES, f"arena/tk_{a['arena']}_vordergrund.png"))
    return True


def baue_takeshi_partikel(name, a):
    """Vier Partikel in einer Reihe -> arena/tk_eisfestung_partikel(_2).png, arena/tk_dschungel_partikel(_2).png."""
    q = roh(name)
    if q is None:
        return False
    teile = bogen_teile(q, 4)
    if teile is None:
        print(f"{name}: keine vier Stuecke im Bogen gefunden")
        return False
    for ziel, teil in zip(["eisfestung_partikel", "eisfestung_partikel_2", "dschungel_partikel", "dschungel_partikel_2"], teile):
        teil.save(os.path.join(SPRITES, f"arena/tk_{ziel}.png"))
    return True


BAUER = {"korb": baue_korb, "wasser": baue_wasser, "feuer": baue_feuer, "mauer": baue_mauer, "schach": baue_schach,
         "kulisse": baue_kulisse, "neu": baue_neu, "takeshi_bogen": baue_takeshi_bogen,
         "takeshi_ebene": baue_takeshi_ebene, "takeshi_partikel": baue_takeshi_partikel}


def einsetzen(args):
    namen = args.namen or list(AUFTRAEGE)
    for name in namen:
        a = AUFTRAEGE[name]
        ok = BAUER.get(a.get("art"), baue_standard)(name, a)
        print(f"{name}: {'gesetzt' if ok else 'kein Rohbild, bleibt alt'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("befehl", choices=["bestellen", "waehlen", "einsetzen"])
    ap.add_argument("namen", nargs="*")
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--prompt")
    ap.add_argument("--kandidaten")
    ap.add_argument("--referenz", help="PNG als Motiv-Referenz (reference_images), nur bestellen")
    args = ap.parse_args()
    {"bestellen": bestellen, "waehlen": waehlen, "einsetzen": einsetzen}[args.befehl](args)


if __name__ == "__main__":
    main()
