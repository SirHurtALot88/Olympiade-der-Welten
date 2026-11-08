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

- ~~**Battlefield**~~ — erledigt am 07.11., s. Abschnitt „Battlefield: Landmarken auf den Motor-Orten“ unten.
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

## Battlefield: Landmarken auf den Motor-Orten (07.11.)

Die Szene hat ihre drei Punkte ebenfalls senkrecht übereinander, aber im Demo-Maßstab: y = 221,5 / 445,5 / 669,5 auf
1280×840, Abstand 224 px. Der Motor rechnet sie bei x = MID, y = 85 / 235 / 385 (Abstand 150, `ARENA_DOMINATION`).
Ein TDM-Zuschnitt hätte Turm, Altar und Brückenkopf deshalb neben die Fahnen gesetzt.

`python3 -I scripts/baue-kulisse-battlefield.py` baut die passende Kulisse, nur aus Pixeln der PixelLab-Szene
(keine API, deterministisch):

1. **Demo-Zutaten weg** (in Szenenauflösung): die eingebrannten Besitz-Ringe (Demo-Spielstand) und die gestrichelten
   Heimkreise werden an der Ringkante gespiegelt, damit die Körnung von Gras und Erde durchläuft. A/B/C-Platten
   (der Motor sagt Nord/Mitte/Süd), Demo-Fahnenmasten, Kisten, Sandsäcke, Fluss und Steg werden geflickt.
2. **Turm 26 px tiefer**: an seinem Szenenplatz ragte er bei y = −39 aus der Leinwand und läge unter der
   Vier-Team-Tafel.
3. **Gleichmäßig skaliert** mit S = 150/224. Szenen-Ort B fällt auf (MID, 235), damit liegen A auf (MID, 85) und
   C auf (MID, 385). Nichts wird verzerrt.
4. **Palisaden weg, Seiten gespiegelt**: Die Palisaden stünden bei x ≈ 220/1020 mitten in den Heimfeldern des
   Vierer-Pods. Gespiegelt wird mitten durch die Heimplätze, innen an den Demo-Bannern (V-W/A-A) vorbei. Der
   halbe Heimplatz wird so zum ganzen Rund, und die Wege laufen aus dem Bild.

Das Ergebnis liegt unter `data/generated/kulissen-quellen/battlefield/<variante>.png` (1240×470, verlustfrei).
`baue-arena-kulissen.py` übernimmt es über das neue Chassis `"quelle"`. Im Motor ändert sich nichts:
Battlefield läuft über `bodenArena()`, und dort greift `kulisseZeichnen()` schon.

Wertung: `node scripts/pruefe-wertung-fingerabdruck.mjs` (20 Disziplinen × 3 Saaten, `disziplinProbe`,
Domination, Bahn-Pod, Battlefield-Pod; 69 Einträge) ist vorher und nachher byte-identisch. Sichtprobe:
`node scripts/screenshot-kulisse.mjs battlefield <variante> 2500 <png> --pod`.

Ein erster Anlauf ließ die Ränder per PixelLab-Inpaint (`/inpaint-v3`) nachmalen. Das Ergebnis schwankte zu stark:
ein schwarzes Rechteck, eine unbemalte Sandfläche, erfundene Straßen, und unter der Maske zeichnete das Modell
Palisade und Fluss wieder nach. Deshalb der deterministische Weg.

## Batch 2: Tennis, Fechten, Speed-Schach (07.11.)

`python3 -I scripts/baue-kulisse-buehnen.py` nimmt aus jeder Szene nur die **Umgebung**: Tribüne, Mauer, Saal und
Boden als Material. Platz, Bahn und Brett zeichnet weiter der Motor aus seiner eigenen Geometrie, die Kulisse zeigt
nichts davon doppelt. Gemeinsame Werkzeuge liegen in `scripts/lib/kulissen_werkzeug.py` (Flicken, seitliches
Füllen, Linien entfernen); Battlefield nutzt sie mit.

- **Tennis** (court/riviera/dach): Oben steht ein Tribünenband. Daraus entfernt sind Anzeigetafel samt Pfosten
  (Kiti/Wurzelbert), Schiedsrichter mit Stuhl, Balljungen, TEMPO-Anzeige und die Banner V-W/A-A. Darunter liegt der
  Belag der Szene ohne Platzlinien. Beim Hartplatz liegt der blaue Belag genau im Trapez von `tennisPlatzGeometrie()`,
  der grüne Auslauf darum. `bodenTennis()` lässt mit Kulisse nur seine gemalten Flächen weg, Linien und Netz bleiben.
- **Fechten** (piste/schlosshof): Der Hintergrund der Szene endet knapp unter der Motor-Bahn. Weg sind die
  Demo-Anzeigetafel (im Schlosshof samt Torturm dahinter), die Kampfrichtertische und die Teamstreifen in Rot/Grün.
  Die Schlosshof-Banner in den Demo-Teamfarben sind auf Heim/Gast des Motors umgefärbt (orange/türkis). Der Boden
  ist der Bodenstreifen der Szene, versetzt gekachelt.
- **Speed-Schach** (park/zug): Die Szene deckt die Leinwand und ist ganz unten ausgeschnitten, ohne die beiden
  Demo-Stühle. Die Spieler stehen auf dem Boden, das Publikum sitzt dahinter. Die Variante `turniersaal` fehlt
  bewusst: Im Saal sitzen zwei eingebrannte Demo-Partien in Höhe der Motor-Spieler.
- **`bodenBuehne()`** (Fechten, Speed-Schach): Mit Kulisse fallen Verlauf und Scheinwerferkegel weg. Die Bank
  unten bleibt als halbdurchsichtiges Podest, und ein dunkler Verlauf oben hält die Kopfzeile lesbar.

Wertung: Der Fingerabdruck ist byte-identisch, Gesamt-Hash `22f04e06e285`.

## Batch 3: Showcase, Eiskunstlauf, Breaking, I-Spy (07.11.)

Gebaut mit demselben Skript (`scripts/baue-kulisse-buehnen.py`) und nach demselben Grundsatz: Die Umgebung kommt aus
der Szene, Fläche und Linien zeichnet der Motor.

- **Showcase** (buehne/festival/zirkus): Szene aus `bg` + `fg`, ohne die Demo-Jury-Ebene. Die Bühnenkante
  liegt auf der Rampe des Motors (H*0.86). `bodenShowcase()` lässt mit Kulisse Verlauf, Vorhänge, Rampenlicht
  und Publikums-Silhouetten weg. Führungssaum und Jury-Pult bleiben.
- **Eiskunstlauf** (kuer/waldsee): Die Tribüne mit Sponsorbande endet an der oberen Eiskante. Darum liegt der
  Boden der Szene, im `eisRundweg(k)` aus `kuerFlaeche()` das Eis der Szene (gleiche Form, Geraden und
  quadratische Ecken). Bande, Führungssaum, Balken, Kampfgericht, Startbereich und Kiss-and-Cry zeichnet der
  Motor.
- **Breaking** (standard/brutal): Kerker mit Publikum, Lichtkegel und der Oberfläche der Rundbühne. Unten ist
  das Bild vor dem rot/grünen Demo-Rock und dem Demo-HUD (BREAKING-Schild, ZUG-Tafel) abgeschnitten, die
  weißen Startmarken sind weg. `zeichneBreaking()` legt seinen violetten Verlauf über die Kulisse nur noch zu
  45 % deckend (`kulisseSichtbar()`).
- **I-Spy** (aztec/horror/lostplace/ruinengarten): Jeder der beiden Räume zeigt die Szene als Draufsicht, ohne
  die zwei Demo-Truhen. Die Fundorte zeichnet der Motor. `bodenSchatzsuche()` lässt Dielen, Regale und
  Lichtinseln weg, Steg und Führungssaum bleiben.

Wertung: Der Fingerabdruck ist byte-identisch, Gesamt-Hash `22f04e06e285`.

## Batch 4: Gewichtheben (Hantel-Duell), Basketball (07.11.)

- **Gewichtheben** (hafen/oase/sandsack): nur für das **live laufende Hantel-Duell**. Der Sandsack-Pfad
  (`BUEHNE_FLAGS.gewichthebenSandsack=0`) bekommt nichts, das ist mit Chris bestätigt. Die drei Szenen sind
  Sandsack-Stationspläne, brauchbar sind nur ihr Kopfstreifen (Hafen-Skyline, Wüste mit Pyramiden,
  Lagerhalle) und das Bodenmaterial. Der Kopfstreifen kommt ohne die drei Demo-Tafeln (V-W/A-A ARBEITSWERT,
  SANDSACK-SCHICHT) als Tribünenhintergrund bis H*0.34, darunter liegt der Boden der Szene. `bodenHeben()` lässt
  Verlauf, Tribünenfläche und Rückwand weg. Die mitwippenden Zuschauerreihen und die Plattform bleiben, oben
  hält ein dunkler Verlauf die Duell-Zeile lesbar. `tests/arena-kulissen.test.ts` schlägt an, sobald der
  Sandsack-Schalter umgelegt wird: dann braucht der Sandsack-Pfad seine eigene Kulisse.
- **Basketball** (parkett/streetcourt): Oben und unten liegt ein Tribünenstreifen aus der Szene (Publikum bzw.
  Häuser mit Zaun), unterhalb der Demo-Anzeigetafel und oberhalb der Demo-Bankfiguren. Im Feld des Motors
  (W*0.06..W*0.94 × 60..H-60) liegt der Belag der Szene ohne Linien, gespiegelt gekachelt und in der Helligkeit
  angeglichen. Um das Feld liegt Hallenboden bzw. Asphalt. `bodenFeldspiel()` lässt mit Kulisse (nur Basketball)
  Verlauf, Zuschauer-Sprites und Parkett-Kachel weg. Linien, Zonen, Körbe und Wurfuhr zeichnet der Motor.

Wertung: Der Fingerabdruck ist byte-identisch, Gesamt-Hash `22f04e06e285`.
