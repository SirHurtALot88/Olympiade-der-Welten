#!/usr/bin/env python3
"""Restguthaben-Bestellung 24.11.: Feier/Meisterfoto, Icon-Paket, Breaking-Foltergeraete, Hockey, Wettessen.

    flock /tmp/pixellab-bestell.lock python3 -I scripts/pixellab-restguthaben.py bestelle <name> [<name> ...]
    flock /tmp/pixellab-bestell.lock python3 -I scripts/pixellab-restguthaben.py vfx <name> [<name> ...]
    python3 -I scripts/pixellab-restguthaben.py guthaben
    python3 -I scripts/pixellab-restguthaben.py liste

Je Auftrag genau EIN POST (/v2/create-image-pixflux bzw. /v2/vfx), KEINE Wiederholung: jede Ausnahme bricht ab.
Reserve 0 (Chris, 24.11.). Keine Figuren, keine Animationen, keine Zuschauer. Nur Dateien, kein Einbau.
Herkunft: public/sprites/<ordner>/quellen.json.
"""
import base64
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

from PIL import Image

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.pixellab.ai/v2"
RESERVE = 0
SPR = os.path.join(WURZEL, "public", "sprites")
HEUTE = "2026-11-24"

STIL = "pixel art game asset, 2D HD remake look, 16-bit RPG style, clean dark outline, rich shading, no text, no letters"
ICON = "single game UI icon, centered, front view, pixel art, 16-bit RPG item style, clean dark outline, rich shading, no text, no letters, no numbers"

# name -> (ordner, breite, hoehe, prompt, saat, zweck)
A = {}


def add(name, ordner, w, h, prompt, saat, zweck, stil=STIL):
    A[name] = (ordner, w, h, f"{prompt}, {stil}", saat, zweck)


# --- 1. Feier / Meisterfoto ---
F = "feier"
add("pokal-liga1", F, 128, 128, "tall golden champion trophy cup with two big handles, a small globe on top, on a dark marble base with a plain gold plate, front view, shining", 8101, "Saisonende-Feier: Pokal Liga 1")
add("schale-liga2", F, 128, 128, "large shallow round silver championship salver dish tilted upright toward the viewer on a small black pedestal foot, wide engraved laurel rim, polished silver with a blue sapphire in the centre, seen from slightly above, looks like a big platter not a drum", 8112, "Saisonende-Feier: Meisterschale Liga 2")
add("podest", F, 192, 112, "winners podium in three clearly different heights: tall block in the middle with the number 1, medium block on the left with the number 2, short low block on the right with the number 3, the middle block is twice as tall as the right one, white marble with golden silver and bronze top plates, front view, no objects on top", 9211, "Saisonende-Feier: Siegerpodest 1/2/3", stil=STIL.replace("no letters", "numerals 1 2 3 only"))
add("buehne-banner", F, 400, 224, "festive victory celebration stage backdrop, wide dark arena hall with spotlights from above, a large empty red and gold banner hanging from the ceiling in the centre, red curtains on both sides, polished wooden stage floor in front, warm golden light, empty stage without any people", 8104, "Saisonende-Feier: Buehne/Hintergrund fuer das Meisterfoto", stil="pixel art background scene, 2D HD remake look, 16-bit RPG style, rich shading, no text, no letters, no people")
FS = STIL
add("lorbeerkranz", F, 96, 96, "golden laurel wreath circle with a red ribbon bow at the bottom, front view", 9101, "Feier: Lorbeerkranz")
add("sektflasche", F, 64, 64, "champagne bottle spraying foam from the neck, dark green glass with gold foil, 3/4 view", 9102, "Feier: Sektflasche")
add("roter-teppich", F, 192, 64, "red carpet runway lying on the floor receding diagonally in perspective, seen from above at a steep angle, with golden stanchion posts and velvet ropes along both sides", 9214, "Feier: Roter Teppich")
add("siegermedaille", F, 64, 64, "gold winner medal on a red white ribbon, front view", 9104, "Feier: Siegermedaille")
add("feier-banner", F, 160, 96, "wide empty red banner with golden fringe and gold border hanging from two poles, no text, front view", 9105, "Feier: leeres Banner fuer den Teamnamen")
add("scheinwerfer", F, 64, 96, "stage spotlight lamp on a black tripod stand, pointing up, bright warm light, 3/4 view", 9106, "Feier: Scheinwerfer")
V = {}


def vfx(name, ordner, artist, prompt, zweck):
    V[name] = (ordner, artist, prompt, zweck)


vfx("konfetti", F, "lite", "dense heavy confetti shower, hundreds of large bright red gold blue green pink paper pieces and streamers falling and spinning across the whole frame, celebration, transparent background", "Saisonende-Feier: Konfetti")
vfx("feuerwerk", F, "lite", "firework rocket explosion in the night sky, golden and red sparks bursting outward and fading, transparent background", "Saisonende-Feier: Feuerwerk")

# --- 2. Icon-Paket ---
AW = "icons/awards"
AWS = ("single award emblem, polished gold metal with bright highlights and deep shading, centered, front view, "
       "pixel art game icon, 16-bit RPG item style, clean dark outline, no text, no letters, no numbers")
add("award-captain", AW, 96, 96, "golden captain armband badge with a single raised star and two small chevrons below it, dark blue enamel stripe", 8201, "Award Captain (ersetzt kapitaen-Look nicht, Ergaenzung)", stil=AWS)
add("award-comeback", AW, 96, 96, "golden phoenix bird rising with spread wings out of orange flames, round golden ring frame behind it", 8202, "Award Comeback", stil=AWS)
add("award-fanliebling", AW, 96, 96, "calm simple golden heart shaped medal with a clean raised outline, hanging on a short ribbon, restrained and elegant, no extra objects", 8203, "Award Fan-Liebling (ruhiger als erste Fassung)", stil=AWS)
add("award-team-neuling", AW, 96, 96, "golden shield badge with a young green sprout leaf rising from a small golden star, small ribbon below", 8204, "Team-Award Bester Neuling (Team)", stil=AWS)
add("award-team-aufsteiger", AW, 96, 96, "golden arrow pointing steeply up through a golden ring, two small steps below, shining", 8205, "Team-Award Aufsteiger", stil=AWS)
add("award-team-abwehr", AW, 96, 96, "golden fortress shield with a stone wall pattern and a single big keystone, solid and heavy", 8206, "Team-Award Abwehr/Bollwerk", stil=AWS)
add("award-team-konstanz", AW, 96, 96, "golden balance scale in perfect equilibrium on a small pedestal, steady and calm", 8207, "Team-Award Konstanz", stil=AWS)
AU = "icons/ausruestung"
for i, (n, p) in enumerate([("schuhe", "athletic running shoe sneaker in red and white"), ("handschuhe", "pair of sturdy leather sports gloves"),
                            ("helm", "protective sports helmet with visor, blue"), ("trikot", "team jersey shirt in red with a plain white collar"),
                            ("schienbeinschoner", "pair of shin guards, black with white straps"), ("guertel", "wide leather champion belt with a golden buckle"),
                            ("brille", "sports goggles with orange tinted lenses"), ("stirnband", "sweatband headband in white with a blue stripe"),
                            ("rucksack", "sports backpack in green with straps"), ("trinkflasche", "sports water bottle with a blue cap")]):
    add(n, AU, 64, 64, p, 8300 + i, "Icon Ausruestung", stil=ICON)
EK = "icons/kabine"
for i, (n, p) in enumerate([("teller", "plate with a healthy meal of chicken, rice and broccoli"), ("proteinshake", "protein shake in a tall bottle with a lid"),
                            ("obstkorb", "wicker basket full of fresh fruit, apples, oranges and bananas"), ("spind", "tall metal locker with a door and vents, dark green"),
                            ("bank", "wooden locker room bench"), ("massageliege", "massage table with a folded white towel")]):
    add(n, EK, 64, 64, p, 8400 + i, "Icon Essens-Abo/Kabine", stil=ICON)
PF = "icons/postfach"
for i, (n, p) in enumerate([("brief", "sealed letter envelope with a red wax seal"), ("vertrag", "contract paper scroll with a pen and a red seal"),
                            ("verletzung", "red cross medical bandage plaster on a bone"), ("transfer", "two arrows swapping left and right in a circle, golden coin in the middle"),
                            ("vorstand", "board room chair, high backed dark leather executive chair"), ("sponsor", "handshake over a golden coin")]):
    add(n, PF, 64, 64, p, 8500 + i, "Icon Postfach", stil=ICON)
FK = "icons/formkarten"
KS = "single playing card design, centered, front view, pixel art, 16-bit RPG style, clean dark outline, rich shading, no text, no letters, no numbers"
add("kartenruecken", FK, 64, 96, "card back with an ornate golden pattern of a laurel wreath around a star on a deep dark blue background and a golden border", 8601, "Formkarten Kartenrueckseite", stil=KS)
add("karte-pow", FK, 64, 96, "full card with solid saturated red background filling the whole card, a large golden clenched fist motif in the middle, ornate golden border and plain empty corners without any digits or symbols", 8622, "Formkarte POW (rot, Kraft)", stil=KS)
add("karte-spe", FK, 64, 96, "card face with a green background and a large golden winged boot, golden border, green theme", 8603, "Formkarte SPE (gruen, Tempo)", stil=KS)
add("karte-men", FK, 64, 96, "full card with solid saturated blue background filling the whole card, one large open golden eye with a bright blue iris in the middle, ornate golden border and plain empty corners without any digits", 9212, "Formkarte MEN (blau, Geist)", stil=KS)
add("karte-soc", FK, 64, 96, "full card with solid saturated yellow background filling the whole card, two golden hands clasped together in a handshake in the middle, ornate golden border and plain empty corners without any digits", 9213, "Formkarte SOC (gelb, Gemeinschaft)", stil=KS)
GB = "icons/gebaeude"
GEB = [("power-gym", "power gym building with giant dumbbells on the roof, red accents"), ("agility-track", "athletics agility track with hurdles and a small green pavilion"),
       ("mind-lab", "mind laboratory building with a glowing blue brain dome"), ("social-studio", "social studio building with yellow stage lights and a round sofa lounge"),
       ("trainingszentrum", "large training centre complex with a flag and a gym hall"), ("recovery-center", "recovery centre building with a red cross sign and a pool"),
       ("scouting-office", "scouting office building with a telescope tower"), ("analytics-room", "analytics room building with a big monitor wall showing charts"),
       ("fan-shop", "fan shop kiosk with a striped awning and jerseys on display"), ("arena-upgrade", "stadium grandstand with tiered seats and floodlight masts"),
       ("academy", "youth academy school building with a small flag"), ("specialist-wing", "specialist wing annex building with a golden star emblem above the door")]
for i, (n, p) in enumerate(GEB):
    add(n, GB, 64, 64, p + ", small isometric building icon", 8700 + i, "Icon Gebaeude", stil=ICON)

# --- 3. Breaking: Folterwerkzeuge (Namen werden vor der Bestellung gegen den Code geprueft) ---
BR = "arena/breaking"
BRS = "pixel art game prop, 2D HD remake look, 16-bit RPG style, clean dark outline, rich shading, no text, no letters, lying flat on the ground seen from a 3/4 top-down view"
BRL = [("strick", "coiled hemp rope with a noose loop"), ("rute", "bundle of thin wooden switch rods tied together"), ("peitsche", "black braided leather whip with several thin lashes fanned out and a short wooden handle"),
       ("daumenschraube", "iron thumbscrew press with a screw handle"), ("zange", "heavy iron pincers tongs"), ("brandeisen", "long iron rod with a wooden handle and a flat square branding head at the tip glowing bright orange red hot, no pan, no bowl"),
       ("keil", "heavy iron wedge and a wooden mallet"), ("nagelkeule", "thick wooden club with many sharp iron nails sticking out of its head"), ("saege", "large rusty two handed saw with wooden handles"),
       ("vorschlaghammer", "heavy sledgehammer with a thick wooden handle")]
for i, (n, p) in enumerate(BRL):
    add("folter-" + n, BR, 64, 64, p, 8750 + i + (100 if n in ("peitsche", "nagelkeule") else 0) + (200 if n == "brandeisen" else 0), "Breaking: Folterwerkzeug " + n.upper(), stil=BRS)

# --- 4./5. Hockey, Wettessen ---
HK = "arena/hockey"
add("hockey-tor", HK, 128, 96, "ice hockey goal with a red frame and white net, seen from the front at a slight angle, standing on ice", 8801, "Hockey: Tor", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("hockey-strafbank", HK, 128, 64, "penalty box bench for ice hockey, a long wooden bench inside a small glass enclosure with a door, 3/4 top-down view", 8802, "Hockey: Strafbank", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("hockey-puck", HK, 32, 32, "single black rubber ice hockey puck with a white highlight, 3/4 view", 8803, "Hockey: Puck", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 view"))
WE = "arena/wettessen"
add("bankettafel", WE, 192, 112, "long banquet table covered with a white cloth and loaded with big dishes of food, roast, bread, fruit, wooden benches on both sides, 3/4 top-down view", 8901, "Wettessen: Bankettafel", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("menueschild", WE, 96, 64, "standing wooden menu board sign with a chalkboard and a golden frame, drawings of food on it, no writing, front view", 8902, "Wettessen: Menueschild", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "front view"))

add("breaking-pfahl", BR, 96, 128, "heavy wooden torture post with iron shackles and chains hanging from it, dark stained ground around its base, stone dungeon yard, 3/4 top-down view", 9001, "Breaking: Pfahl/Folterplatz", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 view"))
add("wettessen-eimer", WE, 64, 64, "dented metal bucket standing on the floor, grey metal with a rope handle", 9002, "Wettessen: Eimer", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 view"))
add("eis-kufenspuren", HK, 192, 64, "scratched ice surface decal with white curved skate blade scratch marks, top-down view, pale blue ice", 9003, "Hockey: Kufenspuren-Decal", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "top-down view"))
add("hockey-schiedsrichter-pfeife", HK, 32, 32, "silver referee whistle on a black lanyard cord", 9004, "Hockey: Pfeife", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 view"))


# --- Welle B Rest, Welle C, Feier 2, Stadion, Embleme-Stufen, Vielfalt (Chris-Auftrag 24.11. nachmittags) ---
add('zf-warnschild', 'arena/zeitfahren', 48, 64, 'yellow road warning sign on a post with a black exclamation mark triangle, no text', 9301, 'Zeitfahren: Warnschild', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('zf-leitpfosten', 'arena/zeitfahren', 32, 64, 'white roadside guide post with a red reflector band and a black top', 9302, 'Zeitfahren: Leitpfosten', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('zf-startpodest', 'arena/zeitfahren', 128, 64, 'wooden time trial start ramp platform with a short ramp and railings, bicycle race start', 9303, 'Zeitfahren: Startpodest', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('zf-zwischenzeit-tor', 'arena/zeitfahren', 160, 96, 'intermediate time checkpoint gate arch over the road, steel frame truss with a timing sensor box and flags, no text', 9304, 'Zeitfahren: Zwischenzeit-Tor', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('wettessen-flaschen', 'arena/wettessen', 64, 64, 'two squeeze bottles standing side by side, one red ketchup and one yellow mustard, no labels text', 9305, 'Wettessen: Ketchup/Senf', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('wettessen-wimpelkette', 'arena/wettessen', 192, 48, 'string of colourful triangular bunting pennant flags hanging in a curve, red yellow blue green', 9306, 'Wettessen: Wimpelkette', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('climbing-griffsatz', 'arena/climbing', 128, 64, 'set of six colourful climbing wall holds, bolt-on resin hand holds of different shapes in red yellow blue green orange, arranged in two rows, flat on neutral background', 9307, 'Climbing: Griffsatz', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('climbing-volumen', 'arena/climbing', 96, 96, 'large geometric climbing wall volume, a big faceted blue polygon shape bolted to the wall with bolt holes, front view', 9308, 'Climbing: Volumen', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('showcase-jurypult', 'arena/showcase', 160, 80, 'talent show judges desk with a long dark wooden table, three big red golden buzzer buttons and small desk lamps, no text', 9309, 'Showcase: Jury-Pult', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('showcase-zielscheibe', 'arena/showcase', 64, 64, 'archery target board with red white rings and a few arrows stuck in it on a wooden stand', 9310, 'Showcase: Zielscheibe', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('showcase-felsbrocken', 'arena/showcase', 64, 64, 'big heavy grey boulder rock with cracks and moss', 9311, 'Showcase: Felsbrocken', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('heben-silo', 'arena/gewichtheben', 64, 96, 'tall round metal grain silo tower with a conical roof and rivets', 9312, 'Gewichtheben: Silo', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('heben-rampe', 'arena/gewichtheben', 128, 64, 'wooden loading ramp slope with planks and side rails leading up to a platform', 9313, 'Gewichtheben: Rampe', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('heben-sack', 'arena/gewichtheben', 64, 64, 'heavy burlap sandbag sack tied at the top with rope, lying', 9314, 'Gewichtheben: Sandsack', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('heben-hantel', 'arena/gewichtheben', 128, 48, 'heavy barbell with big black iron weight plates and a steel bar, lying horizontally', 9315, 'Gewichtheben: Hantel', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'side view'))
add('heben-plattform', 'arena/gewichtheben', 160, 64, 'weightlifting platform, wooden lifting platform with a rubber centre and red border, flat low', 9316, 'Gewichtheben: Plattform', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('takeshi-trittsteine', 'arena/takeshi', 128, 64, 'row of round grey stepping stones sticking out of murky water, mossy stone pillars', 9317, 'Takeshi: Trittsteine', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('tennis-netz', 'arena/tennis', 160, 64, 'tennis net on two posts, white tape on top and a green mesh net, front view', 9318, 'Tennis: Netz', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('schachuhr', 'arena/schach', 64, 48, 'chess clock with two dials and two push buttons on a wooden case', 9319, 'Speed-Schach: Schachuhr', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('kiss-and-cry', 'arena/eiskunst', 128, 80, 'kiss and cry bench area for figure skating, a small padded bench with a low glass barrier and a small plain sign board, no text', 9320, 'Eiskunstlauf: Kiss-and-Cry', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('battlefield-fahnenmast', 'arena/battlefield', 48, 96, 'tall flagpole with a plain red banner waving, small stone base', 9321, 'Battlefield: Fahnenmast', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('kampfrichterlampen', 'arena/gewichtheben', 96, 48, 'set of three round judges lights in a row on a bar, one white and two red, referee lamps', 9401, 'Kampfrichterlampen', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('spurt-kopfstreifen', 'arena/spurt', 400, 64, 'running stadium upper strip, long wide row of advertising boards with a plain roof edge, abstract coloured panels, no text, seen from the front', 9402, 'Spurt: Kopfstreifen Breitformat', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('spurt-fussstreifen', 'arena/spurt', 400, 64, 'running track bottom strip, long wide row of low barrier boards in front of the track with small cheer banners, abstract coloured panels, no text', 9403, 'Spurt: Fussstreifen Breitformat', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", 'front view'))
add('geraet-hockeyschlaeger', 'arena/handgeraete', 64, 64, 'ice hockey stick, long wooden shaft with a curved blade', 9410, 'Handgeraet hockeyschlaeger', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('geraet-kufe', 'arena/handgeraete', 64, 64, 'single ice skate with a long steel blade', 9411, 'Handgeraet kufe', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('geraet-staffelstab', 'arena/handgeraete', 64, 64, 'relay baton, a short smooth red cylinder stick', 9412, 'Handgeraet staffelstab', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('geraet-tennisschlaeger', 'arena/handgeraete', 64, 64, 'tennis racket with a white string frame', 9413, 'Handgeraet tennisschlaeger', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('geraet-degen', 'arena/handgeraete', 64, 64, 'fencing epee sword with a bell guard', 9414, 'Handgeraet degen', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('geraet-showcase-bogen', 'arena/handgeraete', 64, 64, 'curved wooden bow with a bowstring', 9415, 'Handgeraet showcase-bogen', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('geraet-zeitfahr-weste', 'arena/handgeraete', 64, 64, 'cycling aero vest jersey in yellow', 9416, 'Handgeraet zeitfahr-weste', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('geraet-spikes', 'arena/handgeraete', 64, 64, 'pair of track running spike shoes', 9417, 'Handgeraet spikes', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('geraet-mikrofon', 'arena/handgeraete', 64, 64, 'retro stage microphone with a grill head', 9418, 'Handgeraet mikrofon', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('geraet-lupe', 'arena/handgeraete', 64, 64, 'magnifying glass with a wooden handle', 9419, 'Handgeraet lupe', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add("buehne-liga2", F, 400, 224, "festive silver victory celebration stage backdrop, wide dark arena hall with cool blue and silver spotlights, a large empty silver and blue banner hanging from the ceiling in the centre, dark blue curtains on both sides, polished stone stage floor, calm cold light, empty stage without any people", 9501, "Feier: zweite Buehne fuer Liga 2 (Silber/Blau)", stil="pixel art background scene, 2D HD remake look, 16-bit RPG style, rich shading, no text, no letters, no people")
add("stadion-grund", "stadion", 400, 224, "small basic football arena exterior with one low stand, simple fence and few floodlights, modest, seen from the front at a slight angle, evening sky, wide scene", 9510+0, "Stadion-Aussenansicht Ausbaustufe 1", stil="pixel art background scene, 2D HD remake look, 16-bit RPG style, rich shading, no text, no letters, no people")
add("stadion-ausgebaut", "stadion", 400, 224, "medium sized arena exterior with a tall double tier grandstand roof, large floodlight masts and a ticket entrance, seen from the front at a slight angle, evening sky, wide scene", 9510+1, "Stadion-Aussenansicht Ausbaustufe 2", stil="pixel art background scene, 2D HD remake look, 16-bit RPG style, rich shading, no text, no letters, no people")
add("stadion-voll", "stadion", 400, 224, "huge modern arena exterior with full ring grandstand, glass VIP lodge boxes along the upper level, giant roof and many floodlights, flags, seen from the front at a slight angle, evening sky, wide scene", 9510+2, "Stadion-Aussenansicht Ausbaustufe 3", stil="pixel art background scene, 2D HD remake look, 16-bit RPG style, rich shading, no text, no letters, no people")
add('viel-fackel', 'arena/vielfalt', 96, 96, 'standing wall torch on an iron stand with a burning flame', 9600, 'Vielfalt Kulissen-Requisit fackel', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-faesser', 'arena/vielfalt', 64, 64, 'pile of three wooden barrels', 9601, 'Vielfalt Kulissen-Requisit faesser', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-kisten', 'arena/vielfalt', 64, 64, 'stack of wooden crates', 9602, 'Vielfalt Kulissen-Requisit kisten', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-sandsaecke', 'arena/vielfalt', 96, 96, 'low wall of stacked sandbags', 9603, 'Vielfalt Kulissen-Requisit sandsaecke', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-stacheldraht', 'arena/vielfalt', 64, 64, 'roll of barbed wire fence', 9604, 'Vielfalt Kulissen-Requisit stacheldraht', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-lagerfeuer', 'arena/vielfalt', 64, 64, 'campfire with logs and glowing flames', 9605, 'Vielfalt Kulissen-Requisit lagerfeuer', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-zelt', 'arena/vielfalt', 96, 96, 'small military canvas tent', 9606, 'Vielfalt Kulissen-Requisit zelt', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-sandsackbunker', 'arena/vielfalt', 64, 64, 'small bunker made of sandbags and a metal sheet', 9607, 'Vielfalt Kulissen-Requisit sandsackbunker', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-wrack', 'arena/vielfalt', 64, 64, 'broken rusty car wreck', 9608, 'Vielfalt Kulissen-Requisit wrack', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-ruinensaeule', 'arena/vielfalt', 96, 96, 'broken ancient stone column ruin', 9609, 'Vielfalt Kulissen-Requisit ruinensaeule', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-kakteen', 'arena/vielfalt', 64, 64, 'group of desert cactus plants', 9610, 'Vielfalt Kulissen-Requisit kakteen', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-felsgruppe', 'arena/vielfalt', 64, 64, 'group of grey boulders', 9611, 'Vielfalt Kulissen-Requisit felsgruppe', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-baumstumpf', 'arena/vielfalt', 96, 96, 'big cut tree stump with roots', 9612, 'Vielfalt Kulissen-Requisit baumstumpf', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-schild-pfeil', 'arena/vielfalt', 64, 64, 'wooden signpost with an arrow, no text', 9613, 'Vielfalt Kulissen-Requisit schild-pfeil', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))
add('viel-ambosse', 'arena/vielfalt', 64, 64, 'blacksmith anvil with a hammer', 9614, 'Vielfalt Kulissen-Requisit ambosse', stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", '3/4 top-down view'))

add("viel-takeshi-holzbruecke", "arena/vielfalt", 64, 64, 'rickety wooden rope bridge segment with plank deck', 9700, "Vielfalt takeshi: holzbruecke", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-takeshi-pendelaxt", "arena/vielfalt", 64, 64, 'big swinging axe pendulum on a wooden frame', 9701, "Vielfalt takeshi: pendelaxt", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-takeshi-fahnenreihe", "arena/vielfalt", 64, 64, 'three tall castle banners on poles in red and gold', 9702, "Vielfalt takeshi: fahnenreihe", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-takeshi-steintor", "arena/vielfalt", 64, 64, 'small stone castle gate arch with a wooden door', 9703, "Vielfalt takeshi: steintor", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-takeshi-schlammpfuetze", "arena/vielfalt", 64, 64, 'puddle of brown mud with bubbles', 9704, "Vielfalt takeshi: schlammpfuetze", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-takeshi-kanone", "arena/vielfalt", 64, 64, 'small iron cannon on a wooden carriage', 9705, "Vielfalt takeshi: kanone", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-minidm-deckung-kiste", "arena/vielfalt", 64, 64, 'metal military cover crate with yellow stripes', 9706, "Vielfalt minidm: deckung-kiste", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-minidm-neonrohr", "arena/vielfalt", 64, 64, 'vertical glowing neon tube light on a stand, cyan', 9707, "Vielfalt minidm: neonrohr", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-minidm-jersey-barriere", "arena/vielfalt", 64, 64, 'concrete jersey barrier block', 9708, "Vielfalt minidm: jersey-barriere", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-minidm-fass-explosiv", "arena/vielfalt", 64, 64, 'red explosive barrel with a hazard symbol, no text', 9709, "Vielfalt minidm: fass-explosiv", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-minidm-medipack", "arena/vielfalt", 64, 64, 'medical supply box with a red cross on a stand', 9710, "Vielfalt minidm: medipack", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-minidm-stahlfass", "arena/vielfalt", 64, 64, 'stack of two steel oil drums', 9711, "Vielfalt minidm: stahlfass", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-battlefield-sandsack-mauer", "arena/vielfalt", 64, 64, 'curved defensive wall of sandbags with a mounted machine gun', 9712, "Vielfalt battlefield: sandsack-mauer", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-battlefield-panzersperre", "arena/vielfalt", 64, 64, 'czech hedgehog anti tank steel cross obstacle', 9713, "Vielfalt battlefield: panzersperre", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-battlefield-funkmast", "arena/vielfalt", 64, 64, 'small radio mast with antenna and a crate', 9714, "Vielfalt battlefield: funkmast", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-battlefield-kratertrichter", "arena/vielfalt", 64, 64, 'bomb crater in dry earth with scorched rim', 9715, "Vielfalt battlefield: kratertrichter", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-battlefield-stacheldraht-zaun", "arena/vielfalt", 64, 64, 'short fence section of barbed wire on wooden posts', 9716, "Vielfalt battlefield: stacheldraht-zaun", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))
add("viel-battlefield-munitionskiste", "arena/vielfalt", 64, 64, 'green military ammunition crate open with shells', 9717, "Vielfalt battlefield: munitionskiste", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 top-down view"))

add("viel-battlefield-wachturm", "arena/vielfalt", 64, 96, "small wooden military watchtower with a sandbag platform", 9801, "Vielfalt battlefield: Wachturm", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 view"))
add("viel-takeshi-fackelwand", "arena/vielfalt", 64, 64, "short stone castle wall segment with a burning torch mounted on it", 9802, "Vielfalt takeshi: Fackelwand", stil=BRS.replace("lying flat on the ground seen from a 3/4 top-down view", "3/4 view"))


def kopf():
    h = {"Content-Type": "application/json"}
    k = os.environ.get("PIXELLAB_API_KEY")
    if k:
        h["Authorization"] = f"Bearer {k}"
    return h


def einmal(method, pfad, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + pfad, data=data, method=method, headers=kopf())
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} {pfad}: {e.read().decode(errors='replace')[:600]}")


def guthaben():
    return einmal("GET", "/balance")["subscription"]["generations"]


def qlesen(ordner):
    p = os.path.join(SPR, ordner, "quellen.json")
    return (json.load(open(p)) if os.path.exists(p) else {}), p


def bestelle(name):
    ordner, w, h, prompt, saat, zweck = A[name]
    os.makedirs(os.path.join(SPR, ordner), exist_ok=True)
    datei = f"{name}.png"
    ziel = os.path.join(SPR, ordner, datei)
    if os.path.exists(ziel):
        print(f"{ordner}/{datei}: existiert schon, uebersprungen")
        return
    vorher = guthaben()
    if vorher < RESERVE + 2:
        sys.exit(f"Guthaben {vorher:.1f} zu knapp, Abbruch")
    body = {"description": prompt, "image_size": {"width": w, "height": h}, "no_background": not name.startswith(("buehne", "karte")), "seed": saat}
    r = einmal("POST", "/create-image-pixflux", body)  # genau ein POST
    b = r["image"]["base64"]
    if "," in b[:40]:
        b = b.split(",", 1)[1]
    Image.open(io.BytesIO(base64.b64decode(b))).convert("RGBA").save(ziel, "PNG", optimize=True)
    gen = (r.get("usage") or {}).get("generations")
    nachher = guthaben()
    q, qp = qlesen(ordner)
    q[datei] = {"paket": "PixelLab", "endpunkt": "/v2/create-image-pixflux", "groesse": f"{w}x{h}", "zweck": zweck, "saat": saat, "datum": HEUTE,
                "generationen": gen, "guthaben_vorher": round(vorher, 2), "guthaben_nachher": round(nachher, 2), "prompt": prompt}
    json.dump(q, open(qp, "w"), indent=1, ensure_ascii=False)
    print(json.dumps({"datei": f"{ordner}/{datei}", "usage": r.get("usage"), "vorher": round(vorher, 2), "nachher": round(nachher, 2)}), flush=True)


def vfx_bestelle(name):
    ordner, artist, prompt, zweck = V[name]
    os.makedirs(os.path.join(SPR, ordner), exist_ok=True)
    ziel = os.path.join(SPR, ordner, f"{name}.png")
    if os.path.exists(ziel):
        print(f"{name}: existiert schon, uebersprungen")
        return
    vorher = guthaben()
    r = einmal("POST", "/vfx", {"description": prompt, "artist": artist, "name": name})  # genau ein POST
    job = r.get("background_job_id") or (r.get("background_job_ids") or [None])[0]
    lr = {}
    t0 = time.time()
    while time.time() - t0 < 900:
        j = einmal("GET", f"/background-jobs/{job}")
        if j.get("status") in ("completed", "succeeded", "done"):
            lr = j.get("last_response") or {}
            break
        if j.get("status") in ("failed", "error", "cancelled"):
            sys.exit(f"Job fehlgeschlagen: {json.dumps(j)[:400]}")
        time.sleep(4)
    dateien = lr.get("files") or {}
    urls = dateien if isinstance(dateien, dict) else {os.path.basename(u): u for u in dateien}
    for fname, url in urls.items():
        if fname.endswith(".png") and "normals" not in fname:
            z = ziel
        elif fname.endswith(".json"):
            z = os.path.join(SPR, ordner, f"{name}.json")
        else:
            continue
        with urllib.request.urlopen(url, timeout=120) as f:
            open(z, "wb").write(f.read())
    nachher = guthaben()
    q, qp = qlesen(ordner)
    q[f"{name}.png"] = {"paket": "PixelLab", "endpunkt": "/v2/vfx", "artist": artist, "zweck": zweck, "datum": HEUTE, "job": job,
                        "quoted": r.get("quoted_generations"), "generationen": round(vorher - nachher, 3),
                        "canvas": lr.get("canvas"), "frames": lr.get("frames"), "fps": lr.get("fps"), "loop": lr.get("loop"), "prompt": prompt}
    json.dump(q, open(qp, "w"), indent=1, ensure_ascii=False)
    print(json.dumps({"vfx": name, "quoted": r.get("quoted_generations"), "abgerechnet": round(vorher - nachher, 3), "nachher": round(nachher, 2)}), flush=True)


def main():
    art = sys.argv[1] if len(sys.argv) > 1 else ""
    if art == "guthaben":
        print(guthaben())
    elif art == "liste":
        for n, v in A.items():
            print(n, v[0], v[1:3])
        for n, v in V.items():
            print("vfx", n, v[0])
    elif art == "bestelle":
        for n in sys.argv[2:]:
            bestelle(n)
    elif art == "vfx":
        for n in sys.argv[2:]:
            vfx_bestelle(n)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
