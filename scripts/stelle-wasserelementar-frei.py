# Stellt das WASSERELEMENTAR aus _quelle_elementals1_original.png frei.
#
# Der erste Anlauf (s. public/sprites/elementar/quellen.json, "_warum_unbearbeitet") hat
# hier aufgegeben, weil das Lila des Hintergrunds im Inneren der Figur als Gestaltungsfarbe
# noch einmal vorkommt und ein Flood-Fill dort Loecher hinterlaesst. Der Ausweg ist nicht,
# das Lila innen auch zu loeschen, sondern es UMZUFAERBEN: es ist Schattierung, keine Luft.
#
# Erkannt wird es ueber den Farbton statt ueber einen festen Wert: bei Lila liegt Rot
# mindestens auf Gruen-Hoehe und Blau deutlich darueber. Jedes echte Wasserblau des Blattes
# hat mehr Gruen als Rot und bleibt deshalb unangetastet. Nachgezaehlt: 289 Pixel.
from PIL import Image
from collections import deque
import sys

QUELLE = sys.argv[1] if len(sys.argv) > 1 else "public/sprites/elementar/_quelle_elementals1_original.png"
ZIEL = sys.argv[2] if len(sys.argv) > 2 else "public/sprites/elementar/elementarwesen_wasser.png"

src = Image.open(QUELLE).convert("RGBA")
zelle = src.crop((0, 0, 72, 88))          # oben links im 2x2-Blatt
px = zelle.load(); W, H = zelle.size
HG = (127, 0, 255)

def nah(a, b, tol):
    return sum(abs(a[i] - b[i]) for i in range(3)) <= tol

q = deque(); gesehen = set()
for x in range(W):
    for y in (0, H - 1): q.append((x, y))
for y in range(H):
    for x in (0, W - 1): q.append((x, y))
while q:
    x, y = q.popleft()
    if (x, y) in gesehen or not (0 <= x < W and 0 <= y < H): continue
    gesehen.add((x, y))
    if not nah(px[x, y], HG, 40): continue
    px[x, y] = (0, 0, 0, 0)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): q.append((x + dx, y + dy))

lila = 0
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a == 0: continue
        if r >= g and b >= g + 30:
            hell = (r + g + b) / 3 / 255
            px[x, y] = (int(14 + 46 * hell), int(70 + 120 * hell), int(130 + 110 * hell), a)
            lila += 1

aus = zelle.crop(zelle.getbbox())
leinwand = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
skal = min(64 / aus.width, 64 / aus.height)
neu = aus.resize((max(1, round(aus.width * skal)), max(1, round(aus.height * skal))), Image.NEAREST)
leinwand.paste(neu, ((64 - neu.width) // 2, 64 - neu.height), neu)
leinwand.save(ZIEL)
print(f"{ZIEL}: {neu.size[0]}x{neu.size[1]} auf 64x64 zentriert, {lila} Lilapixel umgefaerbt")
