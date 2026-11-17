# Takeshi's Castle: Arenen-Remake (17.11.)

Chris am 17.11., wörtlich: „und wir wollten auch mehrere verschiedene takeshi arenen, mit verschiedenen
assets und so — wichtig ist dass wir die designs wirklich von pixel lab verwenden und nicht einfach die
alten hässlichen 1:1 übertragen und kopieren sondern REDESIGN als REMAKE/2D HD, verstehst du? das ist GANZ
WICHTIG, sonst sieht so was wie time trial moderner aus und spurt bleibt hässlich, das geht nicht“.

**Stand:** Zwei Arenen sind gebaut und im Motor (Frostfeste, Schlingentempel). Zwei weitere sind
entworfen und noch nicht bestellt (Schwarzmoor-Zitadelle, Aschenschlund). Alles ist reine Darstellung,
der Wertungs-Fingerabdruck bleibt `e80babacb68c (75)`. Spielwirkung je Arena ist nur vorgeschlagen
(Abschnitt 6), nicht gebaut.

Bilder: `docs/design/takeshi-arenen-17-11/` (`vorher-*` alte Karte, `nachher-<arena>-*` Remake).

## 1. Ist-Aufnahme: was an der alten Karte „alt“ wirkt

Die alte Karte („Die Route durch Midoriyama“, `bodenTakeshiRoute()` in
`public/mockups/battle-mode.engine.js`) ist eine Draufsicht auf 1240×470, die der Motor aus Kacheln,
Strichen und Ellipsen zusammensetzt. Im Motor liegt dazu:

- **eine** Route (`BAHN_ART["takeshis-castle"].route`, zwölf Wegpunkte), **eine** Geländefolge
  (`zonen`: Wiese, Kies, Steg über den See, Hang, Burghof),
- **14 Fallen-Stationen** auf festen Streckenanteilen (`hindernisse`), deren Typ aus einem von drei
  Kursen kommt (`kurse`: Nordhof, Sumpfpfad, Die Mauern, per Saat gewählt). Die Kurse ändern nur die
  Reihenfolge der fünf Sub-Skills (TECHNIK, WENDIGKEIT, WUCHT, STEHEN, ROBUST), nicht das Bild der Karte,
- **zehn Fallen-Bilder** (`fallenBild`: Wabenlabyrinth, Rutschhang, Springende Steine, Walzenlauf,
  Klopf-Klopf-Türen, Seilwand, Brückenball, Schlammgrube, Riesenräder, Stachelgasse), gezeichnet in
  `zeichneFalleTakeshi()` aus Einzel-Sprites plus Canvas-Flächen,
- Burg, Torii, Kirschbäume, Tribünen als Einzel-Sprites; der Fallen-Baukasten aus Task #137 (Gruben,
  Fegearm, Wackelbrücke, Käfig) liegt als Sprites unter `public/sprites/arena/`, ist im Takeshi-Boden aber
  nicht verbaut,
- **keine** Motor-Kulisse: `data/generated/kulissen-quellen/` und `public/sprites/kulissen/` hatten für
  Takeshi keinen Eintrag. Die drei Szenen-Varianten der Registry (`burg`, `eisfestung`, `dschungel`) liefen
  nur in der alten Demo-Szene.

Was auf den Vorher-Bildern konkret stört:

| Befund | Wo |
|---|---|
| Wiese ist eine 32er-Kachel mit sichtbarem Raster über 70 % der Fläche | Grundfläche |
| Wald, Hang und Hof sind harte, dunkle Ellipsen ohne Übergang | „Umgebungen je Zone“ |
| Der Weg ist ein gleich breiter Canvas-Strich mit schwarzem Saum, der See eine Wasserkachel mit hartem Rand | Route, See |
| Gelb-schwarzes Absperrband und Wimpelketten sind Vektorlinien neben Pixel-Sprites | Bauten |
| Kein Licht, keine Schatten in eine Richtung, keine Tiefe: alles liegt auf einer Ebene | ganze Karte |
| Bäume, Burg, Torii, Fallen stammen aus verschiedenen Aufträgen mit verschiedener Perspektive und Pixelgröße | Requisiten |
| Drei schwarze HUD-Bänder (Lower-Third, „noch N im Rennen“, Burgpunkte) decken unten 130 px der Karte ab, die Läufer laufen darüber | HUD |
| Zwölf Läufer stehen am Start auf einem Punkt, ihre Namen liegen als Stapel übereinander | Start im Pod |
| Die Folge-Kamera geht bis 3,4×, Karte und Burg werden dabei grob | Kamera |

Zum Vergleich: Zeitfahren hat elf gemalte Streckenkarten, I-Spy vier PixelLab-Hallen. Takeshi war damit
die Bahn-Disziplin mit dem größten Gefälle.

## 2. Leitidee: die Arena ist eine gemalte Karte, die Route liegt auf dem gemalten Weg

Der alte Aufbau wird nicht mit neuen Bildern nachgebaut. Stattdessen:

1. **Eine Arena ist ein gemaltes PixelLab-Kartenbild** im Leinwandformat (792×300, Draufsicht wie eine
   16-Bit-RPG-Karte). Gelände, Weg, Wasser, Bewuchs, Fackeln, Licht, Schatten und das Zielbauwerk sind
   **ein** Bild aus einem Guss.
2. **Die Route des Motors wird auf den gemalten Weg gelegt**, nicht umgekehrt. Jede Arena hat dadurch
   einen eigenen Streckenverlauf (`TAKESHI_ARENEN[id].route`, am Bild vermessen). Die Routengeometrie ist
   reine Darstellung: `u.pos` läuft weiter 0..1, die Simulation liest die Wegpunkte nie.
3. **Eigene Fallen-Requisiten je Arena**: zehn Stück (zwei je Sub-Skill, erster und zweiter Durchgang),
   bestellt als zwei Reihenbilder mit je fünf Requisiten, dazu eigene Fallen-Namen.
4. **Tiefenstaffelung in vier Ebenen:** Karte → Fallen und Läufer (nach y sortiert) → Partikel
   (Schneetreiben, Glühwürmchen; laufen mit 1,35-facher Kamerabewegung) → Vordergrund-Requisit an den
   unteren Bildecken (wächst beim Heranzoomen, läuft gegen die Kamera) → Stimmungslicht (Vignette in der
   Farbe der Arena).
5. **Eine schmale HUD-Leiste** statt dreier Bänder (Abschnitt 5).
6. **Auswahl der Arena** deterministisch aus der Saat (`kulisseWaehlen()`, derselbe Hash wie bei allen
   Kulissen, kein `rr()`). **Rückfall:** fehlt das Kartenbild (oder läuft der Headless-Runner), zeichnet
   der Motor die alte Karte mit der alten Route; fehlt ein einzelnes Fallen-Requisit, zeichnet an dieser
   Station die alte Fallen-Fassung.

## 3. Die vier Arenen

Alle vier halten die Leserichtung der Disziplin: Start unten links, Zielbauwerk oben rechts.

### 3.1 Frostfeste (`eisfestung`) — gebaut

- **Thema:** gefrorenes Hochtal in der Dämmerung, schwarze Eisfestung mit blau glühenden Fenstern.
- **Areal:** Schneeweg in zwei großen Schleifen, in der Mitte ein Damm aus Steinplatten quer über einen
  gesprungenen Eissee; Tannen, blaue Eiskristalle, Felsen, Fackeln mit warmem Lichthof.
- **Strecke:** die längste der vier (rund 1,9 k Weltpixel), zwei enge Kehren links und rechts, lange
  Gerade über den See.
- **Fallen (erster / zweiter Durchgang):** TECHNIK Spiegeleis-Irrgarten / Spiegelhang · WENDIGKEIT
  Schollensprung / Froststämme · WUCHT Frostpforte / Schneewall · STEHEN Eiszapfensteg / Eiskette ·
  ROBUST Dornenfrost / Eispendel.
- **Ebenen:** verschneite Tanne im Vordergrund, Schneeflocken als Partikel, kaltes blau-violettes Licht.

### 3.2 Schlingentempel (`dschungel`) — gebaut

- **Thema:** überwucherte Dschungelruine, Stufentempel mit goldenen Feuerschalen.
- **Areal:** Weg aus bemoosten Platten und Erde, steinerne Brücke über einen grünen Sumpffluss,
  umgestürzte Säulen, Götzenbilder, Farne, leuchtende Pilze.
- **Strecke:** kürzer und offener (rund 1,4 k Weltpixel), eine Kehre am Anfang, dann in Wellen über die
  Brücke und die Tempeltreppe hinauf.
- **Fallen:** TECHNIK Runenlabyrinth / Runenplatten · WENDIGKEIT Sumpfsteine / Moosstämme · WUCHT
  Götzentor / Dornenwall · STEHEN Lianenbrücke / Rutschstamm · ROBUST Bambusfalle / Stachelpendel.
- **Ebenen:** Palmwedel im Vordergrund, Glühwürmchen als Partikel, warmes grün-goldenes Licht.

### 3.3 Schwarzmoor-Zitadelle (`burg`) — entworfen, nicht bestellt

Das Remake des alten Burg-Parcours, damit die Variante `burg` der Registry nicht die alte Karte bleibt.

- **Thema:** Moorlandschaft im Abendnebel, schwarze Zitadelle mit roten Bannern auf einem Hügel.
- **Areal:** Bohlenweg durch Torfmoor mit Irrlichtern, Galgenbäume, Palisaden, eine Zugbrücke über den
  Burggraben als letzter Abschnitt.
- **Strecke:** mittellang, drei flache Bögen, das letzte Drittel steigt gerade auf das Tor zu.
- **Fallen:** TECHNIK Wabenhof / Fallgitter-Gasse · WENDIGKEIT Moorplanken / Rollfässer · WUCHT
  Klopftor / Rammbock-Sperre · STEHEN Zugbrücken-Balken / Schlammgraben · ROBUST Stachelgasse /
  Fegearm (der Fegearm aus Task #137 passt hier ohne neue Bestellung).
- **Ebenen:** kahle Äste im Vordergrund, Nebelschwaden als Partikel, rot-violettes Abendlicht.

### 3.4 Aschenschlund (`vulkan`, neue Variante) — entworfen, nicht bestellt

- **Thema:** Vulkanschmiede, Basaltweg zwischen Lavaströmen, Zielbauwerk ist ein Schmiedetor im Krater.
- **Areal:** schwarzer Fels, glühende Risse, Kettenbrücke über einen Lavafluss, Ambosse und Schlackehaufen.
- **Strecke:** kurz und steil, viele kurze Haken (Serpentinen zum Krater).
- **Fallen:** TECHNIK Glutgitter / Rauchkammer · WENDIGKEIT Basaltsäulen / Schlackewalzen · WUCHT
  Schmiedetor / Geröllsperre · STEHEN Kettenbrücke / Aschegrube · ROBUST Funkenregen / Hammerwerk.
- **Ebenen:** Basaltzacken im Vordergrund, Funken als Partikel, rot-oranges Glutlicht.
- Braucht zusätzlich einen Eintrag in `lib/foundation/discipline-scenes.ts` (die Kulissen-Liste ist an die
  Szenen-Registry gebunden, `tests/arena-kulissen.test.ts`).

## 4. Vier Teams im Pod

Unverändert bleibt die Pod-Größe (ein anderer Auftrag prüft sie). Gebaut ist in dieser Runde:

- **Zwischenstand je Team in Teamfarbe** in der HUD-Leiste (Abschnitt 5), für zwei Teams im Duell genauso
  wie für vier im Pod (`bahnSeitenN()`).

Vorschlag, noch nicht gebaut (würde `laeuferXY()` berühren, das auch der parallele Auftrag anfasst):

- **Startaufstellung:** vor dem Anpfiff vier Reihen hintereinander auf dem Weg, je Team eine Reihe mit
  drei Läufern nebeneinander, statt alle zwölf auf einem Punkt. Rein über den Zeichenversatz, solange
  `rennT` null ist.
- **Bahnen:** die zwölf schmalen Spuren quer zum Weg bleiben; im Pod bekäme jedes Team einen eigenen
  Streifen der Wegbreite (Team A links außen bis Team D rechts außen), damit man ein Team als Gruppe erkennt.
- **Beschriftung:** über dem Startfeld ein Schild je Team (Name, Teamfarbe), das mit dem Anpfiff
  ausblendet; im Rennen bleibt der farbige Namenszug je Läufer.

## 5. Punkte, Ausscheiden, Zwischenstand

Gebaut (`takeshiArenaHud()`): eine 30 px hohe Leiste am unteren Rand, über den Läufern gezeichnet.

- links: Name der Arena, Kurs, „noch N im Rennen“,
- Mitte: je Team ein Block mit Farbbalken, Burgpunkten (★) und einem Punkt je Läufer: Teamfarbe = im
  Rennen, Gold = im Ziel, grau durchgestrichen = ausgeschieden,
- rechts: die Regel in zwei Zeilen,
- darüber bei Bedarf das Fallen-Lower-Third mit dem Fallen-Namen der Arena.

Die Rangfolge und die Punkte je Team stehen weiter in den Team-Balken oben. Vorschlag für später: beim
Ausscheiden ein kurzer Einblender „<Name> ist raus“ in Teamfarbe am Ort des Sturzes.

## 6. Spielwirkung je Arena — Vorschlag, nicht gebaut

Muster ist die Oberflächen-Mechanik der Tennis-Plätze (Task #70, `KULISSEN_PROFILE`): die gebuchte Arena
verschiebt Gewichte in einem engen Deckel, gezeigt und gebucht ist dieselbe Arena. Für Takeshi wären das
Stellschrauben, die der Motor schon liest:

| Arena | Wirkung | Stellschraube |
|---|---|---|
| Frostfeste | rutschig: Stürze dauern länger, Balance-Fallen sind schwerer | `stolperSpanne`, `pusteHindernis.STEHEN/WENDIGKEIT` |
| Schlingentempel | eng und unübersichtlich: Fallen lesen zählt mehr, Gedränge an der Brücke teurer | `fallenKoennen` niedriger (mehr Lese-Anteil), `gedraenge.preis` |
| Schwarzmoor-Zitadelle | Grundform, keine Verschiebung | — |
| Aschenschlund | Hitze: Puste läuft schneller leer, Nehmer-Fallen härter | `pusteRegen`, `pusteHindernis.ROBUST` |

Jede dieser Verschiebungen ändert die Wertung. Sie braucht deshalb vorher die Pflichtmessungen (rho im
Einzelspiel ≥ 0,75, Pp-Abweichung ≤ 25 in zwei Saatströmen, im Duell und im Pod), eine Buchung der Arena
im Spieltag wie bei Tennis (`kulisseByDisciplineId`) und einen neuen Fingerabdruck. Die Matrix bleibt
unberührt.

## 7. Kamera

- **Folgen** (gebaut, wie bisher): Kasten um die noch Laufenden, die nächste Falle im Bild. In einer
  Arena ist der Zoom auf 2,2× gedeckelt (`maxZoom`), weil ein Kartenpixel 1,57 Leinwandpixel misst.
- **Fester Überblick** (für den geplanten Kamera-Umschalter): Zoom 1 zeigt die ganze Karte. Die Routen
  halten dafür Abstand vom oberen Team-Balken und von der HUD-Leiste, Vordergrund-Ebene und starke
  Vignette blenden bei Zoom 1 aus.
- **Läuferwahl:** Klick auf einen Läufer setzt `bahnFokus`; der Umschalter kann daraus „Folge diesem
  Läufer“ machen (Kasten nur um ihn, Zoom 2,2×). Dafür ist in den Arenen nichts weiter nötig.

## 8. Assets und Kosten

Rahmen für Takeshi: höchstens rund 150 Generationen. Maßstab aus dieser Runde: Karte 792×300 = 25 Gen.,
Reihenbild 320×64 mit fünf Requisiten = 10 Gen. Verbrauch und Stand: Abschnitt 9.

| Posten | je Arena | Gen. |
|---|---|---:|
| Karte 792×300 (Gelände, Weg, Zielbauwerk, Licht) | 1 | 25 |
| Fallen-Reihenbild, erster Durchgang (5 Requisiten) | 1 | 10 |
| Fallen-Reihenbild, zweiter Durchgang (5 Requisiten) | 1 | 10 |
| Vordergrund-Requisit | 1 | 10 |
| Partikel (ein Reihenbild für zwei Arenen) | ½ | 5 |
| **Summe je Arena** | | **60** |

Für die Arenen 3 und 4 also rund 120 Gen., dazu Reserve für eine Nachbestellung je Arena (25 Gen.).

## 9. Umsetzung (Stand dieser Runde)

Bestellt und protokolliert: siehe die Tabelle am Ende dieses Abschnitts.

**Pipeline** (ohne Netz wiederholbar, sobald die Rohbilder liegen):

```sh
python3 -I scripts/pixellab-requisiten.py einsetzen tk_eisfestung_fallen tk_eisfestung_fallen2 tk_eisfestung_ebene tk_dschungel_fallen tk_dschungel_fallen2 tk_dschungel_ebene tk_partikel
python3 -I scripts/baue-kulisse-buehnen.py takeshis-castle
python3 -I scripts/baue-arena-kulissen.py
```

- `scripts/pixellab-requisiten.py`: Aufträge `kulisse_takeshis_castle_<arena>`, `tk_<arena>_fallen`,
  `tk_<arena>_fallen2`, `tk_<arena>_ebene`, `tk_partikel`; neue Bauarten `takeshi_bogen`,
  `takeshi_ebene`, `takeshi_partikel` (Reihenbild an den Leerspalten teilen). `bestellen` liest vorher
  `/balance`, schickt den POST genau einmal (`einmal=True` in `scripts/lib/pixellab_api.py`) und schreibt
  `usage` in `auftrag.json`.
- `scripts/baue-kulisse-buehnen.py`: Disziplin `takeshis-castle` (Rohbild → Quelle 1240×470).
- `scripts/baue-arena-kulissen.py`: Chassis `takeshis-castle` mit `roh_gross: 2` (Kartenbild in doppelter
  Leinwandgröße direkt aus dem Rohbild, damit es unter der Folge-Kamera scharf bleibt), Abdunklung 0.
- Motor (`public/mockups/battle-mode.engine.js`): `TAKESHI_ARENEN`, `takeshiArena()`,
  `bodenTakeshiArena()`, `takeshiArenaDavor()`, `takeshiArenaHud()`; `routeTabelle()` und die
  Folge-Kamera lesen die Arena; 26 neue Requisiten in `A_TEILE`.
- Sichtprobe: `node scripts/zeige-takeshi-arenen.mjs <ordner> <praefix> [arena ...]` (Vier-Team-Pod,
  drei Bilder je Arena).

**Reine Darstellung:** kein neues Feld an Läuferobjekten, kein `rr()`, kein Zugriff aus `stepSpurt()` oder
`wert()`. Der Headless-Runner hat keine Kulissen-Liste und rechnet wie zuvor.

BESTELLTABELLE

## 10. Offene Punkte

OFFENE_PUNKTE
