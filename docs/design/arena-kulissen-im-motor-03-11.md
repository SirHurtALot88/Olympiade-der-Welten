# Illustrierte Kulissen in der echten Battle Arena (03.11.)

Chris hat am 03.11. einen Live-Screenshot geschickt: „Wenn ich in die battle arena gehe sieht das immernoch alles ALT aus.“
Die Kulissen der Asset-Runde (`public/szenen/`, Registry `lib/foundation/discipline-scenes.ts`) liefen bis dahin nur in der
Demo-Szene (`DisciplinePixelScene`). Die zeigt der Battle Mode nicht mehr. Die echte Arena (`public/mockups/battle-mode.engine.js`)
hat ihren Boden weiter selbst gemalt: Sand, Ziegelring und Fackeln.

## Wie es jetzt läuft

1. **Generator** `python3 scripts/baue-arena-kulissen.py`:
   - liest `DISCIPLINE_SCENES` über tsx,
   - nimmt je Variante das saubere Hintergrundbild aus der Szenen-HTML (`"bg"`, ohne die Demo-Figuren aus dem Poster),
   - schneidet es auf die Leinwand zu (1240×470),
   - schreibt die Bilder nach `public/sprites/kulissen/<disziplin>/<variante>.jpg` und die Liste nach
     `public/mockups/battle-mode.kulissen.js` (`window.__ARENA_KULISSEN`).

   Die Hülle `battle-mode.html` lädt die Liste vor dem Motor. Der Next-Host übernimmt sie von dort automatisch.
2. **Arena-Chassis** (TDM, Mini-DM):
   - Der Zuschnitt ist der Spielboden samt Seitenmauern.
   - Die Demo-Hindernisse (`"objs"`: Blöcke, Banner mit den Demo-Kürzeln V-W/A-A) werden mit einem gesuchten Bodenstück
     derselben Kulisse übermalt. Gesucht wird das Stück mit der besten Randübereinstimmung im Muster.
   - Die Tesla-Spulen der Strom-Falle (schmaler als 25 px) gehören zur Falle und bleiben stehen.
3. **Bühne Wettessen**:
   - Der Zuschnitt deckt das ganze Bild ab und sitzt unten (Zelte, Publikum, Bretter).
   - `bodenWettessen()` zeichnet die Kulisse statt seines Farbverlaufs. Alles darüber bleibt unverändert.
4. **Auswahl** (`kulisseWaehlen()` im Motor, beim `reset()`):
   - Ein FNV-1a-Hash mit fmix32 läuft über Disziplin, Spielsaat (bzw. Pod-Saat), Heim- und Gast-Team-ID und Spieltag.
   - Dieselbe Begegnung zeigt dadurch immer dieselbe Kulisse, verschiedene Begegnungen wechseln.
   - Es gibt kein `rr()` und keinen Zugriff auf `seed`.
5. **Lesbarkeit**:
   - Der Generator berechnet je Bild eine Abdunklung (`dunkel`) aus der mittleren Helligkeit. Schnee bekommt viel, Lava fast
     keine, Bühnen einen Aufschlag.
   - Darüber liegen der Radialverlauf des alten Bodens, die Teamhälften und die Mittellinie.
6. **Rückfall**: Fehlen Liste oder Bild (etwa im Headless-Runner unter `file://` oder bei einem Ladefehler), zeichnet der Boden
   die alte Fassung.

Kommt eine neue Szenen-Variante dazu, reicht ein neuer Lauf des Generators. Im Motor muss nichts verdrahtet werden. So kam die
Wettessen-Variante „Festzelt“ (`bierzelt`) aus der parallelen Szenen-Runde ohne Zutun dazu.

## Anpfiff erst mit Figuren und Kulisse

Chris sah in einem TDM-Kampf bei 0:06 fünf Kämpfer noch als Baukasten-Platzhalter. Die Ursachen:

- Die PixelLab-Bilder luden „fire and forget“.
- Je Figur gingen etwa 12 Dateien gleichzeitig ins Netz.
- Die Frontpose stand dabei hinten in der Schlange.

Was sich geändert hat:

- `pixelFigurLaden()` lädt zuerst die Grundpose und den Rest erst danach.
- `reset()` meldet beide Kader an (Pod-Aufbauten ihre Pod-Kader) und fordert sie sofort an, also schon während Einlauf und
  Countdown.
- `spielLaeuft(true)` gibt den ersten Tick erst frei, wenn alle Kämpfer auf dem Feld ihre Grundpose haben und die Kulisse
  geladen ist. Die Wartezeit ist auf höchstens 4 s gedeckelt.
- Das ist eine reine Wanduhr-Verzögerung vor dem ersten Tick. Quick-Sim und Sonden laufen nicht über `spielLaeuft` und warten
  nie.
- Prüfsonde: `window.__arena.figurenStand()`.

Gemessen im echten Spiel mit gedrosseltem Netz (300 KB/s, 150 ms Latenz, Cache aus):

- Anpfiff nach 3,7 s.
- Alle Grundposen sind da, die Kulisse ist da.
- Im ersten Kampfbild steht kein Platzhalter.

Ohne Drosselung kommt der Anpfiff nach 0,2 s, weil während des Einlaufs schon alles geladen ist.

## Wertung unverändert

Der Abgleich lief vorher und nachher über dieselben Aufrufe, das Ergebnis ist byte-identisch (68 Einträge, Gesamt-Hash
`912e3896bf4e`):

- `window.__arena.spiele(d, s)` für alle 20 Disziplinen × 3 Saaten,
- `disziplinProbe` für TDM, Mini-DM und Battlefield,
- `spieleArenaDomination`,
- `spieleBahnPod` für Staffel und Takeshi.

## Offen (nächste Schritte)

- **Battlefield**:
  - Die Szene hat ihre Eroberungspunkte A/B/C an anderer Stelle als der Motor. Der Motor hat sie in einer senkrechten Reihe bei
    x=MID, y=85/235/385.
  - Gebraucht wird eine Kulisse, deren Landmarken auf dieser Reihe liegen. Zum Beispiel: Turm, Altar und Brückenkopf aus der
    Szene ausschneiden und auf die Motor-Orte setzen.
- **Gewichtheben (Sandsack-Schicht)**:
  - Die Szene ist ein vollständiger Stationsplan mit Bahnen, Silo und Rampen. Er liegt nicht deckungsgleich mit den Reihen
    von `zeichneSandsackParBuehne()`.
  - Machbar wäre, nur die Hafen- oder Oasen-Silhouette oben (Himmel, Kräne, Palmen) als Kopfstreifen zu nehmen.
- **Feldspiel** (Basketball, Football, Hockey) und **Bahn** (Spurt, Staffel, Climbing, Takeshi, Zeitfahren):
  - Beide Chassis zeichnen Linien, Bahnen und Stationen exakt nach Motor-Geometrie.
  - Eine Kulisse ginge dort nur als Umgebung außerhalb des Spielfelds (Tribüne, Landschaft) oder als Bodenmaterial unter den
    Motor-Linien.
  - Die Szenen müssten dafür ohne eingebrannte Linien vorliegen.
- **Übrige Bühnen** (Tennis, Fechten, Speed-Schach, I-Spy, Showcase, Eiskunstlauf, Breaking):
  - Sie haben eigene `boden*()`-Funktionen mit Platz- und Brettgeometrie.
  - Je Disziplin ist zu prüfen, ob die Kulisse wie bei Wettessen als Grundfläche darunter passt.
  - Der Generator braucht dafür nur einen Eintrag in `CHASSIS`, der Motor einen `kulisseZeichnen()`-Aufruf.
- **Mini-DM im Battle Mode**: Mit echtem Vierer-Pod zeigt Mini-DM das FFA-Ereignis als DOM-Ansicht (`renderMiniDmFfa`), nicht
  die Leinwand. Die Kulisse sieht man dort nur ohne Pod.
