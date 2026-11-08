# Kulissen-Qualitäts-Audit aller 20 Disziplinen (08.11.)

Anlass: Chris hat die Vorher/Nachher-Bilder von Spurt und Takeshi's Castle aus Batch 10/11 gesehen und
gesagt: „Die können nicht mithalten mit dem neuen Zeitfahren, TDM usw." Dieses Dokument ist ein reiner
Sicht-Audit: Für jede Disziplin wurde die echte Battle-Arena-Leinwand fotografiert
(`node scripts/screenshot-kulisse.mjs <disziplin> <variante>`, Mini-DM über
`scripts/screenshot-mdffa-buehne.mjs`, Takeshi bei 100 ms und 3500/8000 ms Zoom), zusätzlich die
Vorher-Bilder (`--ohne-kulisse`) für Spurt und Zeitfahren und die PixelLab-Rohszenen unter
`public/szenen/<disziplin>/`. Kein Code, keine Assets, keine Mechanik: Route-Geometrie, Fallen- und
Stationspositionen bleiben in allen Vorschlägen unten unangetastet.

Kurzfassung vorweg, ohne Beschönigung:

1. **Chris hat recht, und das Problem ist größer als zwei Disziplinen.** Spurt und Takeshi sind schwach,
   aber **Climbing ist mindestens genauso schwach**, und **Eiskunstlauf, Showcase (Bühne/Festival),
   Breaking und die untere Hälfte von Fechten** liegen in derselben Klasse.
2. **Die Ursache ist methodisch, nicht handwerklich.** Das Rezept aller Batches lautete „Umgebung aus
   der Szene als Material unter die Motor-Geometrie legen". Das trägt überall dort, wo die
   Motor-Geometrie selbst schon ein vollständiges Bild ist (Spielfeld mit Tribüne, Bühne mit Publikum).
   Es versagt dort, wo die Motor-Geometrie ein abstraktes Band, eine Wand oder eine Kachelkarte ist
   (Bahn-Chassis, Kletterwand, Takeshi-Route): Dann bleibt am Ende genau die alte Komposition, nur mit
   neuer Textur. Das sieht man am besten an Spurt: Das Vorher-Bild (Zaun, Baumreihe, Erdbahn) hat mehr
   Charakter als das Nachher-Bild (blaues Band zwischen zwei 6-%-Publikumsstreifen).
3. **Die PixelLab-Szenen sind nicht das Problem, sie werden nur nicht benutzt.** Die Takeshi-Rohszene
   (Kirschblüte, Torii, Berge, Tribüne, Becken mit Wackelbrücke) ist zu 0 % im Motor. Von der
   HYROX-Halle (Bögen IN/OUT/FINISH, Stationen, Lichtkegel, Anzeigetafel) landet nur der Bahnbelag im
   Spiel. Von der Climbing-Szene (farbige Griffe, Volumen, Routenfarbe) nur die Wandmaserung, ohne
   Griffe. Von Showcase (Theater mit drei Rängen) zwei schmale Seitenstreifen, der Rest ist schwarz.
4. **Die Messlatte selbst ehrlich einordnen.** Zeitfahren ist im Motor **kein** Parallax-Panorama. Es
   ist ein fester Kopfstreifen (14 % der Höhe) plus Asphaltband plus farbige Zonen. Was es gut aussehen
   lässt, sind drei Dinge: Himmel und Horizont je Karte (der Vulkan-Sonnenuntergang), ein Bodenton je
   Karte, und die Zonenfarben im Band. Das ist mit überschaubarem Aufwand auf Spurt, Staffel und
   Climbing übertragbar. Die eigentlichen Spitzenbilder des Projekts sind aber **Wettessen**,
   **Speed-Schach**, **Gewichtheben** und **TDM Lava**: dort stammt die ganze Komposition aus der Szene.

## 1. Was „Zeitfahren/TDM-Niveau" im Bild konkret ausmacht

Aus den Spitzenbildern (Wettessen Jahrmarkt/Nachtmarkt, TDM Lava, Speed-Schach Park/Zug, Gewichtheben
Hafen, Zeitfahren Vulkan/Alpen) lassen sich fünf Merkmale ablesen, die die schwachen Bilder nicht haben:

| Merkmal | Beispiel oben | Fehlt bei |
|---|---|---|
| **Horizont / Himmel** mit eigener Tageszeit je Variante | Zeitfahren Vulkan (Abendrot), Gewichtheben Hafen (Nacht, Mond), Wettessen Nachtmarkt | Spurt, Climbing, Eiskunstlauf Kür, Showcase |
| **Drei Tiefenebenen** (fern: Landschaft/Skyline; mitte: Tribüne/Zelte/Geräte; vorne: Spielfläche) | Wettessen (Riesenrad, Zelte, Publikum, Zaun, Bretter), Speed-Schach Park (Bäume, Brunnen, Bänke, Pflaster) | Spurt (zwei Ebenen, beide dünn), Climbing (eine Ebene), Takeshi (eine Ebene), Eiskunstlauf (eine Ebene) |
| **Licht als Gestaltungsmittel** (Lichtkegel, Laternen, Glut) | Gewichtheben (Scheinwerferkegel auf die Plattform), TDM Lava (Glut in den Fugen), Nachtmarkt (Lichterketten) | Spurt, Takeshi, Climbing, Eiskunstlauf, Staffel |
| **Ortsspezifische Requisiten in der Umgebung**, nicht nur auf der Spielfläche | Wettessen (Zelte, Riesenrad), Speed-Schach Zug (Abteilfenster, Sitze), Battlefield (Turm, Altar, Brückenkopf) | Spurt (keine HYROX-Geräte), Takeshi (keine Burg, kein Torii, kein Becken), Climbing (nichts außer Wand) |
| **Fläche ohne sichtbares Kachelraster** | TDM Lava/Frost, Basketball Parkett | Takeshi Wiese (Raster bei jedem Zoom sichtbar), Spurt/Staffel/Basketball Publikumsstreifen (gleiche Figurengruppe alle ~120 px) |

## 2. Alle 20 Disziplinen im Einzelnen

Skala: **A** erreicht oder übertrifft das Zeitfahren/TDM-Niveau · **B** solide, wirkt wie eine saubere
Sportübertragung, aber ohne Atmosphäre-Extra · **C** deutlich schwächer: Textur-Tausch ohne neue
Komposition, zu wenig Tiefe, oder zu dunkel/leer.

### Arena-Chassis

**TDM (basis / frost / lava)** · **A** (Lava, Frost), **B+** (Basis)
Lava ist eines der besten Bilder im Spiel: Basaltplatten mit Glut in den Fugen, dunkle Ränder, die
Figuren stehen gut. Frost ebenso. Basis ist ein gleichmäßiger Sandboden mit Mauerrand, sauber, aber
ohne Blickfang; das Radialgefälle ist das einzige Tiefenmittel. Kein Handlungsbedarf, allenfalls bei
Basis ein paar Bodenmerkmale (Abdrücke, Platten, Schatten der Fackeln).

**Mini-DM (FFA-Bühne, basis / saegewerk / strom-kaefig)** · **A-**
Rostiger Stahlboden mit Warnstreifen-Grube in der Mitte, vier Ecken, Figuren groß. Wirkt wie ein
eigener Ort. Die Figurenringe und Tafeln sind sauber. Kein Handlungsbedarf.

**Battlefield (eroberung / wuestenruine)** · **A-**
Wiese bzw. Wüstensand mit Wegenetz, Turm, Altar und Brückenkopf auf den Motor-Orten, Kakteen und
Palmen in der Wüste. Die Landmarken geben dem Bild Richtung. Schwäche: die Fläche zwischen den Wegen
ist groß und gleichförmig, kein Licht, kein Horizont (bauartbedingt Draufsicht). Kein Rework nötig.

### Bühnen

**Wettessen (jahrmarkt / nachtmarkt / bierzelt)** · **A+** — die Referenz des Projekts
Riesenrad, Zelte, Publikum, Zaun, Fackeln, Holzbretter; die Nachtvariante mit Lichterketten. Drei
Tiefenebenen, Licht, Ort. Dieses Bild ist die eigentliche Messlatte, nicht Zeitfahren.

**Speed-Schach (park / zug)** · **A**
Park mit Brunnen, Bänken, Herbstbäumen und Pflaster; Zugabteil mit Fenstern, Sitzen, rotem Teppich.
Beide wirken wie ein Ort. Die untere Zeile (sechs Bretter) liegt als dunkler Streifen darüber; passt.

**Gewichtheben (hafen / oase / sandsack)** · **A**
Hafen-Skyline bei Nacht mit Kränen, Leuchtturm und Mond, drei Lichtkegel auf die Plattform; Wüste mit
Pyramiden; Lagerhalle mit Dachbindern. Das ist genau die Zeitfahren-Idee (Horizont je Variante) plus
Licht. Gut.

**Tennis (court / riviera / dach)** · **A-**
Perspektivisches Trapez (eigene Kamera), Tribüne mit Publikum, Riviera mit Dorf und Zypressen, Rasen
mit Mähstreifen. Schwäche: die Tribüne ist ein dünner Streifen und wiederholt sich sichtbar, die
Ränder links/rechts vom Platz sind leer. Kein Rework, Politur möglich.

**I-Spy (aztec / horror / lostplace / ruinengarten)** · **A-**
Zwei Räume je als Draufsicht mit Mauern, Ranken, Wegen, Regalen und Lichtinseln. Ortsgefühl ist da.
Schwäche: die Beschriftung (FINGER 25, LOGIK 10 …) überdeckt viel, aber das ist HUD, nicht Kulisse.

**Fechten (piste / schlosshof)** · **B-**
Obere Hälfte gut (Halle mit Lichtkegeln und Tribüne, Burgmauer mit Türmen). **Untere 45 % sind leer:**
eine dunkelblaue Fläche bzw. ein flacher grüner Rasen, auf dem nur die kleinen Bahnen-2-bis-6-Figuren
stehen. Das Bild kippt nach unten weg. Ursache: Die Szene endet knapp unter der Motor-Bahn, darunter
hat die Kulisse nichts zu zeigen.

**Showcase (buehne / festival / zirkus)** · **C** (Bühne, Festival), **B** (Zirkus)
Bühne: Die Theaterszene hat drei Ränge voller Publikum, Vorhänge, Orchestergraben — im Motor sind davon
zwei schmale Seitenstreifen übrig, **der Bühnenraum ist ein schwarzes Rechteck, darüber eine schwarze
Tafel.** Der Künstler steht in einem Lichtfleck im Nichts. Festival dasselbe mit Lautsprecherwänden.
Zirkus ist der einzige brauchbare: rotes Zeltdach, Holzboden, Publikum an den Seiten. Hier wurde die
Abdunklung für die Lesbarkeit zu weit getrieben, und die Demo-LED-Wand der Szene blieb als schwarzes
Loch stehen.

**Eiskunstlauf (kuer / waldsee)** · **C**
Kür: 90 % der Fläche sind graues Eis, oben ein 8 % hoher Tribünenstreifen mit Sponsorbande. Waldsee:
oben eine helle Schneefläche mit einer dünnen dunkelgrünen Linie — von Tannen, Bergen und Abendhimmel
der Rohszene (dort ein Drittel des Bildes) ist im Motor fast nichts zu sehen. Das ist das flachste
Bild aller Bühnen. Die Eisfläche selbst hat keine Spiegelung, keine Kufenspuren-Textur, kein Licht.

**Breaking (standard / brutal)** · **C+**
Die Rohszene ist stark: Fackeln, Steinpfeiler, Publikum, Lichtkegel von oben, runde Holzbühne. Im Motor
ist das Ganze ein **dunkelvioletter Schleier**: Abdunklung des Generators plus 45 % Violett-Verlauf aus
`zeichneBreaking()`. Publikum und Pfeiler sind nur noch als Schemen zu erahnen, die Fackeln leuchten
nicht. Atmosphäre ist angelegt, aber nicht lesbar. Das ist kein Kompositions-, sondern ein
Beleuchtungsproblem und entsprechend günstig zu beheben.

### Feldspiele

**Basketball (parkett / streetcourt)** · **B+**
Sauberes Parkett mit Linien, Tribüne oben/unten; Streetcourt mit Backsteinwänden und Zaun. Wirkt wie
eine echte Halle. Schwäche: die Tribünenstreifen wiederholen sich sichtbar (gleiche Blöcke), kein
Licht. Kein Rework.

**Football (feld / strand)** · **B+**
Rasen mit Mähstreifen, Yard-Zahlen, Tribüne; Strand mit Meer, Palmen, Strandhütten. Der Strand hat
Ortsgefühl, das Feld ist Standard. Kein Rework.

**Hockey (eis / bergsee)** · **B+**
Eisfläche mit Kratzern, Bande, Tribüne; Bergsee mit Bergkette, Sonne und Schnee rundherum. Bergsee ist
die bessere Variante und zeigt, dass „Horizont statt Tribüne" auch bei Draufsicht funktioniert. Kein
Rework.

### Bahn-Chassis

**Zeitfahren (standard + 10 Karten)** · **A-** — die von Chris genannte Messlatte, mit Einschränkung
Der Kopfstreifen (Alpen, Vulkan-Abendrot, Küste mit Inseln, Weinberge) und der Bodenton je Karte tragen
das Bild. Ehrlich dazu: **86 % der Höhe sind ein graues Asphaltband mit zwölf Bahnlinien und
Zonen-Schraffur**, und der Kopfstreifen steht fest (kein Parallax im Motor; die vier Ebenen der Szene
werden zu einem Bild gebacken). Es ist deutlich besser als Spurt, weil Himmel, Horizont und Bodenton da
sind, nicht weil die Komposition grundsätzlich anders wäre. Ein echtes Parallax (fern/mitte mit
`camX` mitlaufend) wäre der nächste Schritt und ist für Spurt/Staffel genauso möglich.

**Staffel (arena)** · **B+**
Stadion-Oval mit rotem Tartan, gestreifter Rasen innen, Tribüne oben. Sauber und vollständig; die
Figuren sind klein. Schwäche: keine Bahnnummern, kein Licht, kein Horizont, Tribüne nur oben. Wirkt wie
eine ordentliche Fernsehtotale, nicht wie ein Ort. Politur reicht.

**Spurt (kurs)** · **C** — Chris' Kritik trifft zu
Das Bild ist zu 80 % ein einfarbig blaues Band mit zwölf parallelen Linien; oben und unten je 6 %
gekacheltes Publikum. Die Stationen sind 32×23-Sprites, zwölffach senkrecht wiederholt — eine Spalte
Mini-Hürden, eine Spalte Mini-Balken. Keine Tiefe, kein Licht, kein Horizont, kein einziges Gerät der
HYROX-Halle (Schlitten, Rudergeräte, Bögen IN/OUT/FINISH, Anzeigetafel, Lichtkegel stehen alle in der
Rohszene). **Das Vorher-Bild (Erdbahn, Zaun, Baumreihe) hatte mehr Charakter.** Das ist exakt der Fall
„alte Komposition, neue Textur".

**Climbing (wand / fels / eis)** · **C** — genauso schwach wie Spurt, nur weniger aufgefallen
Die Kulisse ist eine formatfüllende Materialtextur: Fels liest sich als Holzmaserung, Eis als blauer
Vorhang, Wand als grauer Beton. Die Griffe sind blasse graue Punkte (Motor), die farbigen Griffe,
Volumen und Routenfarben der Rohszene sind absichtlich herausgerechnet. **Es gibt kein Oben und kein
Unten:** kein Boden mit Matten und Sicherern, kein Himmel oder Hallendach, keine Wandkante, nichts, das
Höhe vermittelt — obwohl die Kamera mit der Wand scrollt und genau das zeigen könnte. Das ist das Bild
mit der geringsten Tiefe im ganzen Spiel.

**Takeshi's Castle (Route, PixelLab-Kacheln)** · **C** — die größte Lücke zwischen Asset und Spiel
Übersicht: 70 % einfarbige Wiesenkachel mit sichtbarem Raster, verstreute Nadelbäume, grauer Kiesweg,
See rechts oben. Zoom: besser, aber Zaunpfosten mechanisch im Takt, Kachelraster weiter sichtbar, und
**Seitenansicht-Requisiten (Tür, Wagenrad, Mauer, Turm) stehen auf einer Draufsicht-Karte** —
Perspektivbruch. Vom PixelLab-Midoriyama (Kirschblüte, Torii, Bergkette, Tribüne, Wasserbecken mit
Wackelbrücke, Wimpelketten) ist nichts im Spiel. Der Look ist RPG-Maker-Karte, nicht Fernsehshow.

## 3. Priorisierte Liste: wer braucht einen echten Kompositions-Rework

Geordnet nach Abstand zum Zeitfahren/TDM-Niveau (größte Lücke zuerst):

| Rang | Disziplin | Lücke | Art des Problems |
|---:|---|---|---|
| 1 | **Takeshi's Castle** | sehr groß | Komposition: Kachelkarte ohne Ort, Perspektivbruch, Szene ungenutzt |
| 2 | **Climbing** | sehr groß | Komposition: nur Material, kein Oben/Unten, keine Tiefe |
| 3 | **Spurt** | groß | Komposition: flaches Band, Szene ungenutzt, Vorher war besser |
| 4 | **Eiskunstlauf** | groß | Komposition: 90 % leere Fläche, Szene fast ungenutzt |
| 5 | **Showcase** (Bühne, Festival) | groß | Beleuchtung + Zuschnitt: schwarzer Bühnenraum |
| 6 | **Breaking** | mittel | Beleuchtung: Schleier über guter Szene |
| 7 | **Fechten** | mittel | Zuschnitt: untere Hälfte leer |
| 8 | Staffel | klein | Politur: Horizont, Licht, Bahnnummern |
| 9 | Basketball, Football, Hockey, Tennis | klein | Politur: Tribünen-Wiederholung, Licht |
| 10 | TDM Basis | klein | Politur: Bodenmerkmale |
| — | Wettessen, Speed-Schach, Gewichtheben, Battlefield, I-Spy, Mini-DM, TDM Lava/Frost, Zeitfahren | keine | — |

**Antwort auf Chris' Frage:** Spurt und Takeshi sind tatsächlich unter den drei schlechtesten, aber
nicht allein. Climbing ist gleichauf mit Takeshi und schlechter als Spurt, weil es nicht einmal einen
Publikumsstreifen hat. Eiskunstlauf und Showcase-Bühne sind nur deshalb weniger aufgefallen, weil dort
kein Vorher/Nachher-Bild gezeigt wurde. Sieben von zwanzig Disziplinen liegen unter dem Niveau, das
Chris erwartet; bei vieren davon (1–4) reicht kein Requisiten- oder Beleuchtungsfix, es braucht eine
neue Bildkomposition.

## 4. Rework-Konzepte (rein visuell, Geometrie unangetastet)

Gemeinsamer Grundsatz für alle Bahn- und Wand-Chassis: **„Rahmen statt Material."** Bisher lieferte die
Kulisse nur den Belag unter der Motor-Geometrie. Künftig liefert sie den Ort *um* die Motor-Geometrie
in drei Ebenen (fern: Horizont/Himmel oder Hallendach; mitte: Tribüne, Geräte, Bauten; vorne: Belag und
Stationsumfeld) und lässt das Band exakt dort, wo `bahnY()`, `camX()`, `HUERDEN_N()` und `routeXY()`
es rechnen. Nichts an diesen Funktionen ändert sich; was sich ändert, ist, was links, rechts, oben,
unten und unter dem Band zu sehen ist.

### 4.1 Takeshi's Castle (Rang 1)

Die Route (`routeTabelle`, `routeXY`, Zonen, Fallenpositionen, `cam.zoom`/`camR`) bleibt. Der Rework
betrifft, womit die Flächen gefüllt und was um die Route herum gezeichnet wird:

- **Ein Midoriyama in Draufsicht statt Kachelrasen.** Statt einer 32-px-Wiesenkachel über drei
  Leinwandbreiten eine handkomponierte Draufsicht-Karte in Szenengröße (eine Datei je Variante Burg /
  Dschungel / Eisfestung, wie bei Battlefield über `data/generated/kulissen-quellen/`), auf der die
  Route liegt: Wiese mit Blumenflecken und Trampelpfaden, Waldstücke als zusammenhängende Kronen mit
  Schlagschatten statt dunkelgrüner Kachel, der See mit Ufer, Schilf und Steg, Kirschbäume entlang des
  Weges, ein Torii am Routenanfang, die Burg als Draufsicht-Anlage mit Hof am Ende.
- **Publikum und Fernsehshow.** Tribünenblöcke (Draufsicht) an zwei, drei Stellen entlang der Route,
  Wimpelketten über dem Weg, ein Kamerakran, Absperrbänder statt des mechanischen Zaun-Takts (Zaun nur
  noch an Fallen).
- **Perspektive vereinheitlichen.** Die Fallen-Requisiten entweder als Draufsicht neu bestellen
  (Tür als Türrahmen von oben, Walze als Zylinder von oben, Turm als Rundturm von oben mit Dach) oder
  die ganze Karte konsequent als 3/4-Sicht anlegen und die Sprites so lassen. Mischen geht nicht.
- **Tiefe beim Zoom.** Eine Vordergrund-Ebene (Baumkronen, Wimpel), die bei `cam.zoom > 1` leicht
  versetzt zur Route mitläuft, plus eine Vignette am Leinwandrand. Das ist das Parallax-Mittel, das die
  Draufsicht hergibt.
- **Licht.** Nachmittagssonne mit weichen Schatten aller Bauten in eine Richtung; die Eisfestung mit
  bläulichem Licht und Schneeverwehungen an den Wegkanten.

### 4.2 Climbing (Rang 2)

Die Wand (`wandX`, `camY`, Griffe aus `BA().hindernisse`, Bahnen) bleibt. Die Kulisse wird eine
Komposition mit Oben und Unten, die mit `versatzY` scrollt:

- **Drei Zonen in der Höhe:** unten der Boden (Matten, Sicherer, Kreidebeutel, Hallenboden bzw.
  Geröll bzw. Gletscherfuß), in der Mitte die Wand, oben der Top-out (Hallendach mit Lichtbändern bzw.
  Himmel über der Schluchtkante bzw. Gipfel mit Wolken). Beim Hochscrollen wandert der Boden aus dem
  Bild und der Himmel kommt — damit ist die Höhe endlich sichtbar.
- **Die Wand als Körper, nicht als Tapete:** Wandkanten links und rechts, dahinter Halle, Schlucht
  oder Fels im Gegenlicht (ferne Ebene, mit halbem Versatz scrollend = echtes Parallax). Überhänge
  als Schattenbänder quer über die Wand, Volumen als große Dreiecke in Grau, Kreidespuren.
- **Griffe farbig je Route** (die Rohszene hat orange, grün, violett): Der Motor zeichnet die Griffe
  weiter an denselben Positionen, aber in der Routenfarbe und mit Schatten statt als graue Punkte.
  Das ist eine reine Zeichenänderung ohne Einfluss auf `hindernisse`.
- **Licht:** Hallenscheinwerfer von oben, Felsschlucht mit Sonnenstreifen, Eisfall mit blauem
  Durchlicht und Eiszapfen am Überhang.

### 4.3 Spurt (Rang 3)

Band `H*0.14..H*0.94`, zwölf Bahnen, Stationen aus `HUERDEN_N()`/`camX()` bleiben. Der Rework holt die
HYROX-Halle ins Bild:

- **Kopfstreifen mit Tiefe statt 6 % Publikum:** Hallendach mit Trägern und Lichtbändern (fern),
  Tribüne in Schrägsicht mit Publikum und Anzeigetafel (mitte), davor die Gerätezeile der Szene
  (Schlitten, Rudergeräte, Wandbälle, Sandsäcke) als Silhouetten knapp über der Bahn (vorne). Der
  Fußstreifen bekommt Bande mit Sponsoren und ein paar Betreuer, kein zweites Publikum.
- **Bögen an Start und Ziel:** Der IN-Bogen (gelb-schwarz) am Startpunkt, der FINISH-Bogen (rot) an
  der Ziellinie, genau an den x-Werten, die der Motor für Start/Ziel ohnehin kennt. Sie geben dem Band
  Anfang und Ende.
- **Stationsumfeld im Belag:** Unter jeder Station ein Bodenmerkmal in Bahnbreite — nasse Pfütze und
  Spritzer am Wassergraben, verbrannter Boden am Feuersprung, Mattenstreifen unter Hürden, Kiesbett
  um die Bruchsteinmauer. Das macht aus zwölf Mini-Sprites eine Station und verdeckt die Wiederholung.
- **Licht:** Scheinwerferkegel von oben auf jede Station (wie Gewichtheben), dadurch hell/dunkel
  Rhythmus entlang der Bahn statt gleichförmigem Blau.
- **Zweite Variante:** Ein Outdoor-Kurs (Stadionvorplatz oder Strand bei Abendlicht) mit Horizont,
  damit Spurt wie Zeitfahren je Begegnung wechselt. Eine einzige Variante fällt gegen elf
  Zeitfahren-Karten sofort ab.

### 4.4 Eiskunstlauf (Rang 4)

`kuerFlaeche()`/`eisRundweg` bleiben. Die Kulisse soll die oberen 30 % und die Eisfläche selbst
bespielen:

- **Waldsee:** Tannen, Bergkette und Abendhimmel aus der Rohszene auf voller Höhe des Tribünenstreifens
  (nicht als Linie), Laternen und Schneewehen am Rand, Spiegelung von Tannen und Himmel schwach im Eis.
- **Kür:** Hallenrang mit Publikum in Reihen, Spotlights auf die Läufer (zwei weiche Kegel, die der
  Zeichner an den Läuferpositionen setzt — reine Anzeige), Bande mit Werbung in Perspektive.
- **Eis als Material:** leichte Spiegelung, Kufenspuren-Textur, Blau-Verlauf zur Mitte statt grauer
  Fläche.

### 4.5 Showcase (Rang 5)

- Abdunklung deutlich zurücknehmen; der Bühnenboden als Holz mit Lichtpfützen statt Schwarz.
- Die schwarze LED-Wand der Szene durch einen Bühnenprospekt ersetzen (Vorhang, Sternenhimmel, beim
  Festival eine beleuchtete Rückwand).
- Die Ränge der Theaterszene in voller Breite zeigen (sie sind jetzt auf zwei Randstreifen
  beschnitten), Orchestergraben und Publikumsrücken unten als Vordergrund-Silhouette.

### 4.6 Breaking (Rang 6)

Kein Kompositionsproblem. Den Violett-Verlauf von 45 % auf etwa 20 % senken, die
Generator-Abdunklung für Breaking fest niedrig setzen (wie `dunkel_fest` bei Hockey), die Fackeln der
Szene als leuchtende Punkte durchkommen lassen, und den Lichtkegel von oben auf die Rundbühne als
Helligkeitsinsel statt als Schleier. Danach ist das Bild so stark wie die Rohszene.

### 4.7 Fechten (Rang 7)

Zuschnitt verschieben, so dass unter der Motor-Bahn Inhalt liegt: beim Schlosshof die Hofmauer mit Tor,
ein Burggraben oder eine zweite Tribünenreihe mit Rücken zum Betrachter; in der Halle die vorderen
Tribünenreihen als Silhouette und die Kampfrichtertische (ohne Demo-Figuren). Die leere Fläche ist
derzeit 45 % des Bildes.

### 4.8 Politur (Ränge 8–10)

Kein Rework, nur drei Griffe, die alle Feldspiele und Staffel gleichzeitig heben: (a) Tribünenstreifen
aus mindestens drei verschiedenen Blöcken mischen statt eines Blocks im Takt, (b) ein leichter
Lichtkegel oder Tageszeit-Ton je Variante (wie Hockey Bergsee es schon vormacht), (c) bei Staffel
Bahnnummern und eine zweite Tribünenseite unten.

## 5. Was dieser Audit nicht sagt

- Nichts hier betrifft die Simulation. Alle Vorschläge liegen in `boden*()`, `kulisseZeichnen()`,
  den Generator-Skripten und neuen Kulissenbildern. Der Fingerabdruck
  (`scripts/pruefe-wertung-fingerabdruck.mjs`) muss nach jedem Schritt byte-identisch bleiben, wie in
  allen bisherigen Batches.
- Die Lesbarkeit der Figuren, Namen und HUDs war in keinem Bild das Problem; sie darf durch mehr
  Kulisse nicht leiden. Der Weg dahin ist gezieltes Licht (Kegel auf die Spielfläche), nicht
  flächige Abdunklung — genau die hat Breaking und Showcase ins Dunkel gezogen.
- Reihenfolge-Empfehlung für die Umsetzung: erst Breaking und Showcase (billig, Beleuchtung), dann
  Spurt (Muster „Rahmen statt Material" am einfachsten Chassis entwickeln), dann Climbing (dasselbe
  Muster mit Scroll), dann Takeshi (größter Aufwand: neue Draufsicht-Karte je Variante und
  Perspektiv-Entscheidung für die Fallen), dann Eiskunstlauf und Fechten.

Sichtprobe zum Nachvollziehen: `node scripts/screenshot-kulisse.mjs spurt kurs`,
`… climbing fels`, `… takeshis-castle - 100` und `… takeshis-castle - 3500`, `… eiskunstlauf waldsee`,
`… showcase buehne`, `… breaking standard`, `… fechten schlosshof`; zum Vergleich `… wettessen
nachtmarkt`, `… time-trial etappe-vulkan`, `… tdm lava`, `… gewichtheben hafen`. Rohszenen unter
`public/szenen/<disziplin>/<variante>.jpg`.
