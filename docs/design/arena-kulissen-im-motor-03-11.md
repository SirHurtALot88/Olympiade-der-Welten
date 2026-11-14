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
- ~~**Mini-DM im Battle Mode**~~ — erledigt am 08.11., s. Batch 9. Mit echtem Vierer-Pod zeigt Mini-DM das FFA-Ereignis als DOM-Ansicht (`renderMiniDmFfa`), nicht
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

## Batch 5: Football, Hockey (07.11.)

- **Football** (feld/strand): Oben und unten liegt ein Tribünen- bzw. Strandstreifen aus der Szene, ohne
  Anzeigetafel samt Pfosten, Torstange, Kettenmasten und die Demo-Kettencrew. Im Feld des Motors
  (W*0.04..W*0.96 × 50..H-50) liegt der Belag der Szene ohne Linien (Rasen bzw. Sand), um das Feld der
  Seitenstreifen der Szene. Yard-Linien, Zahlen und Endzonen zeichnet der Motor.
- **Hockey** (eis/bergsee): Oben liegt das Publikum bzw. die Berge, drumherum Hallenboden bzw. Schnee. Im
  `RINK`-Rundweg liegt das Eis der Szene: die ganze Spielfläche, ohne Stern-Logo und mit allen Linien,
  Kreisen und Schriftzügen herausgenommen. `eisflaeche()` lässt mit Kulisse nur seine Eisfüllung weg. Bande,
  Linien, Kreise und Tore zeichnet der Motor. Die Abdunklung ist fest auf 0,06 gesetzt (`dunkel_fest` im
  Generator), sonst würde das Eis grau.
- `bodenFeldspiel()` ruft `kulisseZeichnen()` jetzt für alle Feldspiele auf. Ohne Kulissenliste bleibt es der
  alte Boden.

Wertung: Der Fingerabdruck ist byte-identisch, Gesamt-Hash `22f04e06e285`.

## Batch 6: Spurt, Staffel (07.11.)

Bahn-Chassis. Die Kulisse liefert nur Umgebung und Belag. Bahnlinien, Stationen und Hürden zeichnet weiter der
Motor aus `HUERDEN_N()`/`camX()` bzw. `bahnPfad()`, also aus genau den Werten, mit denen das Rennen rechnet.

- **Spurt** (kurs): HYROX-Halle der Szene. Oben und unten liegt Publikum, im Bahnband `H*0.14..H*0.94` der blaue
  Laufbahnbelag der Schleife (das Stück zwischen den Pfeilen, gespiegelt gekachelt). Die Stationen der Szene
  (Schlitten, Rudergeräte …) kommen nicht mit. `bodenSpurtGerade()` lässt mit Kulisse Rasen, Bäume,
  Bahnfüllung und Zaun weg.
- **Staffel** (arena): Stadion der Szene. Überall liegt Rasen, oben die Tribüne, im Bahnring von `bahnPfad()`
  (Außenradius 288, 6 Bahnen à 26, Stauchung 0,57) der türkise Tartan der Szene ohne Linien, im Innenfeld der
  gestreifte Rasen. Die Variante `stabwechsel` ist dasselbe Stadion in Nahsicht und kommt deshalb nicht dazu.
  Der Belag wechselt damit von Ziegelrot zum Türkis des PixelLab-Assets.

Wertung: Der Fingerabdruck ist byte-identisch, Gesamt-Hash `22f04e06e285`. Er enthält `spiele` für Spurt und
Staffel über je 3 Saaten sowie den Bahn-Pod für Staffel.

## Batch 7: Climbing; Staffel in Ziegelrot (07.11.)

- **Staffel**: Der Tartan der Szene ist auf das klassische Ziegelrot `#b5442f` umgefärbt, den bisherigen
  Motor-Ton. Die Körnung bleibt, nur der Farbton wechselt. Entschieden mit Chris: Laufbahnen sind rot.
- **Climbing** (wand/fels/eis): Die Kulisse ist nur das **Wandmaterial** der Szene. Griffe, Bolzen und Volumen
  sind über einen laufenden Median entlang der Maserung herausgenommen (Eis senkrecht, Fels waagerecht,
  Hallenwand beides), danach kommt die feine Körnung zurück. Das Bild ist eine senkrecht nahtlose Kachel
  (obere Hälfte plus gespiegelte Kopie). `kulisseZeichnen(versatzY)` zeichnet sie mit dem Kamera-Versatz der
  Wand, so läuft sie mit, während die Griffe wandern. Überhang-Schatten, Bahnen, Griffe
  (`BA().hindernisse`/`HUERDEN_TYP`) und Sicherung zeichnet der Motor.
- **Takeshi's Castle: noch nicht.** Die Szene ist ein Seitenpanorama. Der Motor zeigt eine Route in Draufsicht
  mit Zoomkamera, und ihr Gelände (Wiese, Wald, Pfad, Kies, Schlamm, Pflaster, See, Hang, Sumpf) besteht aus
  LPC-Kacheln (OpenGameArt). Aus dem Panorama lässt sich keine Draufsicht schneiden. Dafür braucht es neue
  PixelLab-Draufsicht-Kacheln, siehe Bericht an Chris.

Wertung: Der Fingerabdruck ist byte-identisch, Gesamt-Hash `22f04e06e285`.

## Batch 8: Zeitfahren (08.11.)

Die Zeitfahren-Szenen sind anders gebaut als alle bisherigen: keine eingebetteten Bilder in einer HTML,
sondern je Streckenkarte vier Parallax-Ebenen als PNG (`far`, `mid`, `course`, `front`, 4000 px breit,
432..760 px hoch), elf Varianten (Standard + 10 Karten). Sie sind eine **Seitenansicht mit eingebranntem
Demo-Profil**: die Strasse in `course.png` steigt und faellt nach der Demo-Strecke, nicht nach
`BAHN_ART["time-trial"].gelaende`. Deshalb ein eigenes Skript, `python3 -I scripts/baue-kulisse-zeitfahren.py`.

Die Kulisse bringt kein Profil mit. Sichtbar bleibt allein das Profil aus `gelaende`, das
`bodenZeitfahren()` schon zeichnete: Zonen-Toenung mit Schraffur und Glyphen auf der Bahn, die
Hoehensilhouette (`ZF_HUEGEL_PX`) im Kopfstreifen. `gelaendeFaktor()`/`gelaendeZehrFaktor()` sind nicht
angefasst.

- **Kopfstreifen** (0..H*0.14): Panorama der Karte aus `far` + `mid` (Alpen, Kueste, Windpark,
  Weinberge, Strade-Bianche-Felder, Vulkan, Tafelberge …), ohne Strasse und ohne `front` (Zwischenzeit-
  Tafeln, Schilder). Bezug ist die Zeile, ab der `mid` dicht wird, nicht die Strasse (die liegt je Karte
  zwischen y = 152 und 662). Das linke, ausgemalte Startbild jeder `far`-Ebene (bis x ~ 800) geht mit
  harter Kante ins wiederholte Band ueber und bleibt deshalb weg; das Band wird auf 0,25 verkleinert und
  gespiegelt fortgesetzt. Darunter ein 8 px Grasrand der Karte. Die Hoehensilhouette des Motors liegt davor.
- **Bahnband** (H*0.14..H*0.94): Asphalt der Karte aus dem flachen Stueck hinter der Startrampe
  (x 350..478, zwischen den beiden weissen Randlinien im Abstand 34 px; die Hoehe sucht das Skript je
  Karte), Mittelstriche entfernt, Zeilen/Spalten in der Helligkeit angeglichen, doppelt gross, gespiegelt
  gekachelt. So bekommt jede Karte ihren eigenen Belag (Vulkan dunkler, Wueste sandig).
- **Fussstreifen** (H*0.94..H): Grasrand unter der Strasse der Karte.
- **Motor**: kein neuer Aufruf. `bodenZeitfahren()` ruft `bodenSpurtGerade()`, und dort greift
  `kulisseZeichnen()` seit Batch 6 schon (Rasen, Baeume und Zaun fallen mit Kulisse weg). Nur ein
  Kommentar ist dazugekommen.
- **Test**: `tests/arena-kulissen.test.ts` prueft alle elf Varianten (Registry = Kulissenliste, Quelle
  1240x470), das Band H*0.14/H*0.94 in Motor und Skript, und dass `gelaendeFaktor()`/
  `gelaendeZehrFaktor()` keine Kulisse kennen.

Sichtprobe: `node scripts/screenshot-kulisse.mjs time-trial <variante>` fuer alle elf, ohne Seitenfehler.

Wertung: Der Fingerabdruck ist byte-identisch, Gesamt-Hash `22f04e06e285`.

**Stand nach Batch 8:** 18 von 20 Disziplinen haben eine PixelLab-Kulisse im Motor. Offen sind nur
Mini-DM im Vierer-Pod (DOM-Tabelle, wartet auf Chris) und Takeshi's Castle (Seitenpanorama gegen
Draufsicht-Route, braucht neue Draufsicht-Kacheln, wartet auf Chris).

## Batch 9: Mini-DM im Vierer-Pod auf der Leinwand (08.11.)

Chris zu der Frage aus PR #1351 („Tabelle behalten und Kulisse dahinter, oder umbauen?“): „umbauen“. Mini-DM-FFA
zeigte bis dahin im Vierer-Pod nur DOM-Karten und Tabellen (`renderMiniDmFfa`), die Leinwand samt Kulisse war
ausgeblendet. Jetzt hat das FFA eine eigene Leinwand.

- **`mdffaBuehne`** (Motor, vor `reset()` deklariert) zeichnet auf `#mdffaCv` (1240×470, in `battle-mode.html`
  oberhalb der Eckkarten) einen Vier-Ecken-Kampf vor der Mini-DM-Kulisse (PixelLab, dieselbe Wahl über
  `kulisseWaehlen`). Ecke 1 steht oben, 2 rechts, 3 unten und 4 links, die Farben sind die Eckfarben der Karten.
  Die PixelLab-Figuren drehen sich zur Mitte. Beim Schlag stoßen sie aufs Ziel vor (Angriffs-Animation), beim
  Treffer zucken sie, nach K.o. oder Finisher läuft die Tod-Animation. Eingeblendet werden Schaden, Schwachstelle,
  Zange, daneben, ausgewichen, angeschlagen, hält stand, FINISHER und K.O. Das Zweckbündnis erscheint als
  gestrichelte Linie mit Zielring auf dem Gejagten. Der Ring zieht sich sichtbar zu. Je Ecke gibt es ein Schild
  mit Stand-Balken, eine Punktetafel und einen Rundentitel. Zum Endstand stehen alle wieder auf und tragen ihre
  Platzierung #1 bis #4.
- **Reine Anzeige:** Die Bühne wird von genau den Stellen in `renderMiniDmFfa()` angestoßen, die auch die
  DOM-Karten fortschreiben (`einlauf`, `titel`, `runde`, `takt`, `rundenEnde`, `punkte`, `endstand`, `abbau`). Sie
  liest nur das fertige Ereignis (`runde.takte[].ereignisse/stand/pakt`). Es gibt kein `rr()` und keinen Zugriff
  auf Saat, Formkarten oder Mutatoren. Die Uhr ist `performance.now()`, nicht die Spielzeit. Das
  Zwei-Seiten-Chassis (`build`/`draw`/`MOTOREN["mini-dm"]`) ist unberührt. Ein eigener N=4-Zeichner daneben
  vermeidet genau das Risiko, das der Kopfkommentar von `renderMiniDmFfa()` beschreibt.
- Die Eckkarten, der Ticker und die Rundentafeln bleiben unter der Leinwand als Boxscore.
- Sichtprobe: `node scripts/screenshot-mdffa-buehne.mjs [präfix] [variante]` (Einlauf, Runde 1, Endstand).
- Test: `tests/arena-kulissen.test.ts` prüft, dass die Bühne vor `reset()` steht, nichts aus der Simulation
  anfasst und alle Anstöße verdrahtet sind.

Wertung: Der Fingerabdruck ist byte-identisch, Gesamt-Hash `22f04e06e285`.

## Batch 10: Requisiten von OpenGameArt/LPC auf PixelLab (08.11.)

Chris: „ja auch auf die besseren PixelLabs umstellen!“ Die Spielobjekte, die der Motor direkt auf die Kulisse
zeichnet, kamen bis dahin aus OpenGameArt (LPC, Kenney, Catacomb Chess). Jetzt sind sie PixelLab-Erzeugnisse:

- **Spurt-Stationen**: Hürde, Balken, Palisade, Seil, Wassergraben (l/r), Bruchsteinmauer, Strohballen,
  Feuersprung (fünf Bilder aus einer PixelLab-Animation, `/animate-with-text-v3`).
- **Takeshi's Castle**: Tür, Strickleiter, Spanischer Reiter, Walze, Wagenrad, Fass; Burgmauer, Turm, Torhaus,
  Bannerstange, Pranger, Fußblock, Holzstapel; dazu Zaun und die vier Nadelbäume der Routenkarte.
- **Basketball**: Korb (Draufsicht) und Ball. **Football**: Ball und die drei Helme (geladen, im Motor derzeit
  nicht gezeichnet). **Speed-Schach**: die sechs Figuren, Weiß und Schwarz.

**Reiner Asset-Tausch, keine Zeile im Motor geändert.** Der Motor zeichnet viele Kacheln mit
`naturalWidth/naturalHeight` oder mit festen Quell-Ausschnitten (`falle_spitzen` 0/96 32×32, `falle_strickleiter`
8/0 24×64, `deko_banner` 0/0 96×80, `burg_mauer` k·40/8 36×56, `hind_feuer` fr·32, Schach `SCHACH_IDX·48`).
Deshalb hat jede neue Datei exakt die Pixelmaße der alten, und der Inhalt sitzt in derselben Box: der
Alpha-Begrenzung der alten Datei innerhalb des Ausschnitts, den der Motor liest (fest eingetragen als
`ALTE_BOX`, damit ein zweiter Lauf nicht wandert). Zwei Stellen brauchten mehr als die Box:

- **Korb**: Der Ballflug zielt auf `korbX`, das Sprite hängt mit `drawImage(…,-28,-20,56,56)` daran. Der
  Ringmittelpunkt des PixelLab-Korbs liegt pixelgenau auf dem des alten Kenney-Korbs (31,6 / 13,4 im 64er-Bild).
- **Wassergraben**: Die alten LPC-Kacheln hatten Ufer nur links und rechts; übereinander gesetzt (eine je Bahn)
  ergaben sie einen durchgehenden Graben. Ein erster Tausch mit einem rundum umrandeten PixelLab-Becken sah aus
  wie zwölf einzelne Kästen. Jetzt: Ufer aus dem Becken, Wasser aus der nahtlosen PixelLab-Seekachel
  (Batch 11), oben und unten offen.

Ablauf (`scripts/pixellab-requisiten.py`, API-Client `scripts/lib/pixellab_api.py`):

1. `bestellen <name>`: `/v2/generate-image-v2` in der Zielgröße, freigestellt. Je nach Größe 4 bis 64
   Kandidaten pro Auftrag (10 Generationen).
2. `waehlen <name> <index>`: Kandidat nach `data/generated/pixellab-requisiten/roh/`, Prompt, Saat, Job-ID und
   Index nach `auswahl.json`.
3. `einsetzen`: baut `public/sprites/…` aus `roh/`, ohne Netz und deterministisch.

Nachgebessert nach der Sichtprobe: Die Hürde ist jetzt frontal statt schräg (schräg schrumpfte sie in der
32×23-Box auf ein Strichmännchen), die Walze liegt waagerecht, und Dame und König sind einzeln mit dem
Reihenbild als Stilvorlage erzeugt (in der Sechserreihe waren sie oben abgeschnitten).

`scripts/arena-assets-schneiden.mjs` und `scripts/buehne-schach-assets-schneiden.mjs` überschreiben Dateien,
die `quellen.json` als `"paket": "PixelLab"` führt, nicht mehr (mit `--lpc` schon, zum Vergleich). Herkunft je
Datei: `public/sprites/<ordner>/quellen.json`, die frühere LPC-Quelle steht dort unter `vorher`.

Nicht getauscht, weil keine Requisiten: die Flächentexturen `boden_sand/stein/erde`, `bahn_ocker`, `rasen`,
`mauer_ziegel` (Rückfall-Boden von TDM und Spurt, Trittsteine und Schlammgrube in Takeshi), die TDM-Fackel, der
Deko-Adler und das Basketball-Publikum.

Wertung: Der Fingerabdruck ist byte-identisch, Gesamt-Hash `22f04e06e285`.

## Batch 11: Takeshi's Castle — PixelLab-Draufsicht-Kacheln für die Route (08.11.)

Bisher der einzige offene Punkt neben Mini-DM (Batch 7: „Seitenpanorama gegen Draufsicht-Route“). Die Route
durch Midoriyama (`bodenTakeshiRoute()`) füllt ihre Flächen mit `ctx.createPattern(…,"repeat")` aus neun
Bodenkacheln. Die sind jetzt PixelLab-Draufsicht-Kacheln (`/v2/create-tiles-pro`, `square_topdown`, 32 px,
Blickwinkel top-down, `outline_mode: "segmentation"` für nahtlose Ränder): Wiese, Wald, Pfad, Kies, Schlamm,
Pflaster, See, Hang, Sumpf, dazu das Eis der Slip-Way-Falle. Route, Zonen, Fallen und Kamera sind unangetastet.

Chris hat die Stilwahl freigegeben („probier ruhig und nimm das was am besten aussieht“). Probiert wurden drei
Sätze zu je 16 Kacheln, im Motor nebeneinander fotografiert:

| Satz | Ansatz | Ergebnis |
|---|---|---|
| a | freier Prompt, PixelLab-Palette | Wiese mit sichtbarem Kachelraster, Wald fast schwarz |
| **c** | **Stilvorlage: drei 32er-Ausschnitte (Gras, Wasser, Sand) aus der PixelLab-Takeshi-Szene** | **gewählt** |
| d | Prompt „muted natural colors“ | Pfad und Hang mit eingebrannten Mustern, See mit Streifen |

Satz c trägt dieselbe helle, gesättigte Palette wie die Takeshi-Szene, und seine Ränder sind am ruhigsten
(Randsprung geteilt durch mittleren Innensprung: 0,1 bis 1,6; ab etwa 2 sieht man die Naht). Fürs Eis malte
das Modell mit Vorlage nur Gras, Wasser und Sand nach; das Eis kommt deshalb aus einem Satz ohne Vorlage.

`python3 -I scripts/pixellab-boden-kacheln.py einsetzen c` setzt die Wahl (`WAHL` im Skript) ohne Netz; die
drei Rohsätze liegen unter `data/generated/pixellab-boden/{a,c,d,eis}/`.

Sichtprobe: `node scripts/screenshot-kulisse.mjs takeshis-castle - 100` (Übersicht) und `… - 3500` (Zoom).

Wertung: Der Fingerabdruck ist byte-identisch, Gesamt-Hash `22f04e06e285`.

**Stand nach Batch 11:** 20 von 20 Disziplinen zeigen PixelLab-Grafik im Motor: 19 mit Kulisse, Takeshi
mit PixelLab-Bodenkacheln und PixelLab-Fallen auf seiner Draufsicht-Route. Dazu sind alle Requisiten, die der
Motor auf die Kulissen zeichnet, PixelLab statt OpenGameArt.

## Batch 15: Spurt — "Rahmen statt Material" für Rang 3 des Audits (08.11.)

`docs/design/kulissen-qualitaets-audit-08-11.md` (PR #1357), Rang 3 (Showcase/Breaking in PR #1359, Takeshi's
Castle in PR #1362, Climbing in PR #1363 bereits erledigt), Befund wörtlich: „Das Bild ist zu 80 % ein
einfarbig blaues Band mit zwölf parallelen Linien; oben und unten je 6 % gekacheltes Publikum. […] Keine
Tiefe, kein Licht, kein Horizont, kein einziges Gerät der HYROX-Halle (Schlitten, Rudergeräte, Bögen
IN/OUT/FINISH, Anzeigetafel, Lichtkegel stehen alle in der Rohszene). Das Vorher-Bild (Erdbahn, Zaun,
Baumreihe) hatte mehr Charakter. Das ist exakt der Fall 'alte Komposition, neue Textur'." Batch 6 (07.11.)
hatte von der HYROX-Rohszene (`public/szenen/spurt/hyrox.jpg`) nur den Asphalt und zwei 40-px-Publikumsstreifen
genommen — alles andere aus der Szene (Schlitten, Rudergeräte, Kettlebell-Racks, Anzeigetafel, die drei Bögen,
die Scheinwerferkegel über der Wall-Ball-Station) blieb ungenutzt. Band-Geometrie (`H*0.14..H*0.94`), zwölf
Bahnen, Stationen aus `HUERDEN_N()`/`camX()`, `BAHN_ART.spurt.hindernisse`/`.hindernisBilder` — **alles
unangetastet**, wie bei jedem Batch dieser Reihe. Der Rework ändert nur, was auf und um das Band gezeichnet
wird, und holt die Halle über zwei getrennte Wege ins Bild:

### Kopfstreifen/Fußstreifen (`scripts/baue-kulisse-buehnen.py`, `baue_spurt()`), statisch

Der Kopfstreifen (0..`H*0.14`) bekommt drei Ebenen statt der alten 40-px-Publikumszeile:

- **Fern:** ein gemaltes Hallendach mit Trägern und vier Lichtbändern — reiner Vektor, die Szene zeigt in
  Draufsicht keine Decke. Die Farben (`#16171D`→`#242830`, Lichtband `#F2EFE6`) wurden unabhängig von
  `docs/design/einsatzliste-gesamtkonzept-visuell-08-11.md` Abschnitt 3.2 gewählt (ein Konzeptdokument für
  einen ganz anderen Screen, die Einsatzliste) — dass dessen "HALLE"-Stimmung für Spurt HYROX wörtlich
  "Hallendach mit Trägern #2B2F36 und vier Lichtbändern #F2EFE6" fordert, deckt sich zufällig mit dieser
  Entscheidung und bestätigt sie im Nachhinein, statt sie vorzugeben.
- **Mitte:** die Tribüne der Szene (`SP_PUBLIKUM_OBEN`, wie bisher), plus die Anzeigetafel der Szene
  (`SP_ANZEIGETAFEL`, "FINISH"-Uhr samt Lautsprecher-Sockel) als eigenes, höheres Landmark rechts außen — sie
  hängt bewusst bis in die Gerätezeilen-Ebene herunter, wie in der Rohszene.
- **Vorne, knapp über der Bahn:** eine Gerätezeile aus einer Reihe Rudergeräten (`SP_RUDER_ROW`) und
  Schlitten-Symbolen (`SP_SLED`, Gewichtsscheibe inklusive), auf 72 % Helligkeit abgedunkelt, damit sie als
  Silhouette liest statt als zweite Grundfläche. Erste Anläufe skalierten die komplette Zwei-Reihen-Geräte-
  zeile (700×232 Szenen-px) auf 24 Leinwand-px herunter — ein Faktor 9,7, bei dem aus den Geräten Matsch
  wurde. Eine einzelne, enger geschnittene Reihe (576×98) bei Faktor 3,3 blieb als Rudergerät erkennbar; das
  ist der Unterschied zwischen "Textur" und "Requisit", den der Audit-Befund selbst beschreibt.

Der Fußstreifen (`H*0.94..H`) bekommt eine Sponsoren-Bande (fünf farbige Vektor-Segmente mit hellem
Platzhalter-Logo, kein Vorbild in der Szene — dieselbe Idee wie die Bandenschilder bei Tennis/Football) und
sechs kleine Betreuer-Silhouetten (Vektor, Kopf+Schulterschräge+Beine, ~12 px hoch) **statt eines zweiten
Publikumsstreifens** — der Audit sagt das wörtlich ("kein zweites Publikum"). Das Bahnband selbst bleibt beim
blauen Loop-Belag aus Batch 6 (`SP_BELAG`, gespiegelt gekachelt); daran ändert dieser Batch nichts, der
Belag war nie der Vorwurf.

### Boegen, Stationsumfeld, Licht (`battle-mode.engine.js`, `bodenSpurtGerade()`), dynamisch

Die Kulisse-Bilddatei ist ein statisches Vollbild, die Bahn aber scrollt/zoomt mit `cam.zoom`/`cam.cx` (ein
enges Feld zieht die Kamera heran — `camView()`, s. Kommentar dort). Alles, was an einer Welt-Position
(Start, Ziel, eine Station) stehen und mit der Kamera mitlaufen muss, kann deshalb NICHT im PNG liegen —
das zeichnet, wie schon bei jeder Hürden-/Mauer-/Wasser-Kachel zuvor, der Motor selbst, bei `camX(h)`:

- **Bögen an Start und Ziel** (Audit wörtlich): der IN-Bogen (gelb-schwarz) bei `camX(0)`, der FINISH-Bogen
  (rot) bei `camX(1)`. Erster Stand skalierte auf die volle Bandhöhe (alle zwölf Bahnen übereinander) —
  Chris, 08.11., zu genau diesem Stand: „komsiche riesige Tore! Das sieht richtig weird aus." Nachgebessert
  noch am selben Tag: Höhe auf `min(Bandhöhe, 32 % der Leinwandhöhe)` gedeckelt, Position unverändert am
  oberen Bandrand — der Bogen liest jetzt als Landmark am Rand, nicht als Rohr quer durchs ganze Bild. Beide
  Sprites sind **nicht bei PixelLab bestellt** —
  die Rohszene führt sie bereits (Audit: "stehen alle in der Rohszene") —, sondern per Kettenflutung
  freigestellt (`kulissen_werkzeug.freistellen()`, neu in diesem Batch: wächst vom Bildrand über ähnlich
  gefärbte Nachbarn nach innen, jeder Schritt gegen den zuletzt akzeptierten Nachbarn statt gegen den
  Randwert — toleriert JPEG-Rauschen, bleibt an echten Kanten stehen, kennt die Hintergrundfarbe vorher nicht,
  weder Hallenboden-Grau noch Bahn-Blau). `scripts/baue-kulisse-buehnen.py --spurt-requisiten` schreibt sie
  nach `public/sprites/arena/spurt_bogen_{in,finish}.png`, zwei neue `A_TEILE`-Einträge.
- **Stationsumfeld im Belag** (Audit wörtlich, alle sieben `BAHN_ART.spurt.hindernisBilder`-Typen bedacht,
  nicht nur die vier Beispiele des Audits): nasse Pfütze+helle Spritzer am Wassergraben, Kiesbett um die
  Bruchsteinmauer, Mattenstreifen unter der Hürde, Sägemehl-Landefläche unter dem Balken, festgetretener
  Sandwall vor der Palisade, ausgetretener Erdpfad unter dem Seil, lose Strohhalme um den Strohballen —
  jeweils in Bahnbreite (`oben..unten`), seedbasiert verteilt (`bodenSaat(i*<primzahlartig>+k)`, an den
  Stationsindex `i` gehängt, rein kosmetisch, kein `rr()`). Dieselbe Idee auch am Feuersprung: ein russiger
  Fleck hinter der Ziellinie, nur wenn `BA().feuerZiel` (U3) UND die Kulisse aktiv ist.
- **Scheinwerferkegel** (Audit: "wie Gewichtheben") auf jede der sieben Stationen: ein schmaler, nach unten
  breiter werdender Verlauf von der Traverse auf die Bahn, niedrige Deckkraft (16 % an der Spitze, 0 am
  Bahnrand) — dieselbe Lehre wie Batch 12/14 ("Licht gezielt, nicht flächig", Chris' Breaking/Showcase-
  Befund): Läufer, Ringe und Namen bleiben lesbar, es entsteht ein hell/dunkel-Rhythmus entlang der Bahn
  statt des gleichförmigen Blaus, das der Audit bemängelte.

Alle drei Blöcke stehen hinter derselben Weiche `if(mitKulisse&&BA().spurt)`: `bodenSpurtGerade()` bedient
als Fallback auch Staffel (Warteschlange), Climbing (Fallback) und Takeshi ohne Route — deren Kulissen und
Stationstypen sind etwas ganz anderes, die Weiche verhindert, dass ein HYROX-Bogen auf einem Stadion-Rasen
landet. Ohne Kulisse (Bild lädt nicht, Headless-Runner) bleibt der alte, gezeichnete Boden bit-identisch —
nichts in diesem Batch rührt den `!mitKulisse`-Zweig an.

### PixelLab-Verbrauch: null Generationen

Alle neuen Pixel dieses Batches kommen entweder aus der bereits bezahlten Rohszene (Bögen, Anzeigetafel,
Gerätezeile — reine Schnitt-/Freistell-Arbeit) oder aus reinem Vektor (Hallendach, Sponsoren-Bande,
Betreuer, Stationsumfeld, Lichtkegel). `GET /balance` vor und nach diesem Batch: unverändert 2265
Generationen (Stand nach Batch 14). Das ist kein Zufall, sondern der Kern des Audit-Befunds für Spurt: Der
Rohszene fehlte nie Material, nur der Schnitt.

### Grenzen (ehrlich, wie bei jedem Batch)

- **Nur eine Variante.** Das Audit nennt explizit eine zweite, outdoor spielende Kurs-Variante (Stadion-
  vorplatz oder Strand bei Abendlicht) als nächsten Schritt, "damit Spurt wie Zeitfahren je Begegnung
  wechselt. Eine einzige Variante fällt gegen elf Zeitfahren-Karten sofort ab." Dieser Batch liefert sie
  **bewusst nicht**: Die Halle solide zu Ende zu bringen (Kopfstreifen-Komposition, zwei neue Motor-
  Requisiten, sieben Stationsumfelder, Lichtkegel, alles gegenprobiert) war für sich schon ein voller
  Durchgang; eine zweite, komplett neue Außenszene hätte ein eigenes Rohbild (keine Vorlage in der
  bestehenden Szenen-Sammlung — anders als bei den Bögen gäbe es hier nichts freizustellen, sondern eine
  echte PixelLab-Bestellung mit eigener Horizont-/Lichtstimmung) und eine zweite komplette
  Kopf-/Fußstreifen-Komposition gebraucht, mit eigenem Pp-Vergleich zur Halle. Lieber eine Variante fertig
  und geprüft als zwei halbfertige — dieselbe Abwägung, die der Audit selbst für den Umsetzungsauftrag nahelegt
  (Abschnitt 5: "Reihenfolge-Empfehlung … erst … dann Spurt … dann Climbing"), nur eine Ebene tiefer, innerhalb
  dieses einen Batches. Offen für eine Folge-Runde.
- **Die Gerätezeile ist eine Wiederholung aus zwei Motiven** (Rudergerät, Schlitten), nicht die volle
  Motiv-Vielfalt der Halle (Kettlebell-Racks fielen durch, s. oben — sie lesen bei 30 px Höhe nur als dünner
  dunkler Strich, nicht als Gerät). Mit mehr Zeit ließe sich ein drittes, kompakteres Motiv (z. B. ein
  Wandball) ergänzen.
- **Die Anzeigetafel zeigt eine eingebrannte Demo-Zeit** ("FINISH 1:02:37") aus der Rohszene. Bei der
  gewählten Größe (~60 px) ist der Text ohnehin kaum lesbar, wirkt aber aus der Nähe (`cam.zoom` hoch) als
  Zahl, die nichts mit dem laufenden Rennen zu tun hat — dieselbe Klasse Schwäche wie die Zwischenzeit-Tafeln,
  die Batch 8 (Zeitfahren) bei der Kopfstreifen-Übernahme bewusst ausließ. Für Spurt ist das Bild zu klein,
  um es zu stören; ein größerer Zoomgrad könnte es zeigen.
- **Die Betreuer- und Sponsoren-Elemente haben kein Vorbild in der Szene** (reiner Vektor, wie die Volumen/
  Kreidespuren bei Climbing Batch 14) — die Rohszene liefert an dieser Stelle nichts Passendes.

Sichtprobe (echte Leinwand, `node scripts/screenshot-kulisse.mjs spurt kurs <ms> <png>`): `docs/design/
kulissen-rework-spurt-08-11/spurt-kurs-{vorher,nachher,nachher-8s}.png` (100 ms: volle Übersicht mit beiden
Bögen und allen sieben Stationen; 8000 ms: Rennen in Fahrt, Kamera auf 2,8×, IN-Bogen in der Kurve) sowie
`spurt-kurs-ohne-kulisse.png` (`--ohne-kulisse`, der alte Erdbahn/Zaun/Baumreihe-Maßstab aus dem Audit).

Tests: `npx vitest run tests/arena-kulissen.test.ts` grün (14/14).

Wertung: Fingerabdruck vor und nach diesem Batch gemessen — byte-identisch, Gesamt-Hash `22f04e06e285`
(69 Einträge). Reine Zeichenänderung: `HUERDEN_N()`, `camX()`, `BAHN_ART.spurt.hindernisse`/
`.hindernisBilder` und jede Simulationsfunktion (`bauSpurt`/`stepSpurt`) stehen Wort für Wort wie vorher.
