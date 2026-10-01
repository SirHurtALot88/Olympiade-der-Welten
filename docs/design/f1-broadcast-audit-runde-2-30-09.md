# F1-Broadcast-Audit, Runde 2 (30.09.)

**Reiner Audit, kein Code.** Neuauflage des holistischen Qualitäts-Audits vom 27.09. mit
derselben Leitfrage: *Sieht und fühlt sich die Live-Arena an wie eine moderne Sport- oder
Esport-Übertragung — würde man das gerne schauen, auch wenn die Figuren selbst notwendig
basic animiert sind?* Bewertet wird die **Sendung als Ganzes** über alle 20 Disziplinen: ob
die visuelle Sprache konsistent ist, ob Bewegung sinnvoll eingesetzt wird, wo tote Momente
entstehen, ob Farben und Zahlen überall dasselbe bedeuten — nicht, ob einzelne Features
existieren.

Grundlage: `main` bei `b7195138` (Arena-Dateien unverändert seit `24a8e1e1`, also nach
Phase 4 #1066–#1071, Phase 5 #1073–#1076 und Phase 6 #1077). Belegbilder liegen in
`docs/design/f1-broadcast-audit-runde-2-30-09/` (20 JPEGs, Dateinamen = Befund).

---

## 0. Verdikt

**Rund 60 % auf dem Weg zu einer modernen Übertragung** (27.09.: ~55 %).

Die fünf Punkte Zuwachs sind echt und sichtbar: der Endstand ist ein Sendungsbild geworden,
die Disziplin-HUDs aus Phase 4 (Staffel-Delta, Fallen-Schild, FIE-Tafel, Versuchstafel,
Kiss & Cry, Split-Tafel, Qual-Skala) machen einzelne Disziplinen richtig gut, und Eiskunstlauf
und Staffel würde man tatsächlich so im Fernsehen akzeptieren. Mehr als fünf Punkte sind es
nicht, weil die Arbeit seit dem 27.09. fast ausschließlich **in die Tiefe einzelner
Disziplinen** ging, während die Schwächen, die eine Übertragung *als Ganzes* unglaubwürdig
machen, unverändert stehen oder beim Durchspielen aller 20 erst sichtbar werden:

1. **Der Stand hat keine eine Wahrheit.** In jeder Disziplin steht er drei- bis viermal im
   Bild (Scoreline, Score-Bug 40 px darunter, Kaderleiste, teils noch im Canvas) — und in
   sechs Disziplinen zeigen diese Stellen *verschiedene Größen* unter demselben „a : b". Im Football
   zeigt die Scoreline am Ende 9 : 6, der Schlussticker „gewinnt 10:7". Im Gewichtheben steht
   das Endergebnis schon vor dem ersten Versuch in der Kaderleiste.
2. **Vier von zwanzig Sendungen haben keinen Abspann oder gar kein Bild.** Hockey, Basketball
   und Football — die TV-typischsten Sportarten — enden ohne Endstand-Grafik mit einer
   Tickerzeile; Mini-DM hat weiterhin überhaupt keine Live-Ansicht.
3. **Das Vokabular wandert zwischen den Chassis.** Tennis und Fechten sprechen außerhalb des
   Canvas Schach („Brett 2 gewonnen", „Zug 9/10"), jede Disziplin startet mit
   „KAMPF STARTEN", Breaking zeigt „noch 5 : 4 im Rennen", Wettessen und Tennis zählen
   „0 aufgetreten", das Feldspiel „59 Spielzüge".
4. **Die Sendung hat kein gemeinsames Tempo.** Bei echter Zuschaugeschwindigkeit steht das
   Banner in Breaking 92 % der Sendezeit (195 verschiedene Texte), in Takeshi 82 %, in
   Hockey 7 %; der Ticker schreibt im TDM 449 Zeilen je Minute, in der Staffel 4,5.
   Gewichtheben zeigt 95 % der Zeit ein Standbild, bis zu 30 s am Stück; Staffel, Spurt und
   Time-Trial haben 17–22 s völlige Stille. Die Höhepunkte im Endstand sind in fast allen
   Disziplinen Routinezeilen („Gram — stolpert", zehnmal „schlingt durch", „0:00 übernimmt
   die Führung").
5. **Die Chrome redet wie ein Entwicklerwerkzeug.** Absatzlange „Plan der KI"-Zeilen,
   „Simulation deterministisch — gleiche Aufstellung, gleicher Verlauf", große graue
   Bedienhinweise, Tabellen-Fußnoten, ein PR-Verweis im Mini-DM-Bild — und das Arena-Panel ist
   in jeder Disziplin 1100–1320 px hoch, man sieht Bild, Kader und Tabelle nie zugleich.

Das ist die ehrliche Kurzform: **die Einzelteile sind auf dem Weg zu 75 %, die Sendung als
Ganzes nicht**, weil sie sich zwischen den Disziplinen (und innerhalb eines Bildschirms)
widerspricht. Die gute Nachricht: fast alles davon ist Klasse A.

**Wie die 60 % zustande kommen** (grobe Gewichtung, damit die Zahl nachprüfbar ist):

| Dimension | Gewicht | 27.09. (Schätzung aus den Phase-5/6-Befunden) | 30.09. | Begründung heute |
|---|---:|---:|---:|---|
| Einzelbild je Disziplin (Szene, Disziplin-HUD) | 25 % | 60 | 72 | Phase-4-HUDs; drei Disziplinen sendungsreif, vier fallen ab |
| Rahmen: Einlauf, Anpfiff, Endstand | 15 % | 45 | 62 | Endstand-Redesign; Feldspiel ohne Endstand, Mini-DM ohne Bild, kein Anpfiff-Moment |
| Konsistenz: Stand, Zahlen, Vokabular, Farben | 20 % | 50 | 50 | Teamfarben/Akzent besser, dafür Stand-Widersprüche und Vokabular-Wanderung jetzt über alle 20 belegt |
| Dramaturgie: Momente, Tempo, Stille | 20 % | 50 | 52 | Kampf gut dosiert; Bühne/Bahn zwischen Dauerbanner und Stille, Höhepunkte Routine |
| Grafikpaket/Chrome: Lesbarkeit, Entwicklertext, Layout | 20 % | 55 | 60 | Kontrast, `.hud-in`; Entwicklertext, Seitenhöhe, Etikettenstapel unverändert |
| **Gewichtet** | | **≈ 53** | **≈ 60** | |

Die Spalte 27.09. ist eine Rückrechnung, kein Messwert (die alte Liste liegt nicht vor); sie
landet bei ≈ 53 und damit nahe an den damals genannten ~55 %.

---

## 1. Wie geprüft wurde

* **Alle 20 Disziplinen**, echter HTTP-Server über `public/` (nicht `file://`), Chromium
  (`/opt/pw-browsers/chromium-1194`), 1300 × 900, **Produktionsmodus** wie im Host
  (`FoundationBattleArenaHost.tsx` setzt `data-theme="dark"` und `.im-spiel`, Seitengrund
  `#0B1018`). Barlow Condensed aus `apps/kartenschmiede/fonts` eingespielt, weil Google Fonts
  im Container nicht lädt; IBM Plex fehlt dadurch (Systemersatz) — Laufweiten der
  Mono-Beschriftungen können minimal abweichen, Aussagen über Layout/Überlappung sind davon
  nicht betroffen.
* **Verlauf über Zeit, nicht Einzelbilder:** je Disziplin Einlauf, Anpfiff, dann alle 6–8 s
  ein Bild des gesamten Arena-Panels (Zeitraffer 4×) bis zum Endstand, dazu ein Protokoll von
  Stand/Uhr/Bug/Callouts — insgesamt 219 Bilder. Mini-DM separat (kein Start-Knopf).
* **DOM-Sonde** vor dem Start, in der Spielmitte und am Ende: Stand in Scoreline vs.
  Kaderleiste vs. Bug, Tabellenüberlauf, abgeschnittene Namen, Knopfbeschriftung.
* **Sonde bei Tempo 1× über das ganze Spiel** (echte Zuschaugeschwindigkeit): alle 500 ms
  Canvas verkleinert abgetastet (stehende Bilder, längster Stillstand), Sichtbarkeit und Text
  von `#bbugcallout` (Banner-Anteil, verschiedene Banner), neue Zeilen in `#feed`
  (Tickerdichte, längste völlige Stille). Ein vorheriger Durchlauf im 4×-Zeitraffer wurde für
  Zeitangaben verworfen (s. 6.1).
* **Helles Standalone-Theme** als Stichprobe (TDM, Eiskunstlauf, Hockey, Takeshi) — im Spiel
  selbst nie sichtbar, weil der Host dunkel erzwingt.
* **Nicht bewertet:** Ton (headless ohne Audioausgabe).
* **Zur alten Liste:** Der Audit vom 27.09. liegt nicht als Dokument im Repo (nur die sechs
  Chassis-Recherchen auf den `broadcast-*-recherche-27-09`-Branches); rekonstruierbar sind
  seine Punkte nur aus den Commit-/PR-Texten von Phase 5 (Endstand-Illusion, „fast nichts
  animiert", Score-Kontrast, Teamfarben, Leinwandskalierung, Label-Kollision) und Phase 6
  (Punkt 9, Wertungs-Akzent). Diese Runde ist deshalb bewusst eine eigenständige Bewertung.

---

## 2. Was seit dem 27.09. wirklich besser geworden ist

| Verbesserung | Wirkung im Gesamtbild |
|---|---|
| **Endstand im Nacht-Look** mit Sieger-Verlauf in Teamfarbe, Boxscore-Tafeln, Höhepunkte als Chips (Phase 5) | Größter Einzelgewinn. Kampf, Bühne und Bahn enden jetzt mit einem Bild, das nach Sendung aussieht, und alle drei Chassis nutzen *dasselbe* Layout — das ist echte Konsistenz. |
| **Disziplin-HUDs aus Phase 4** | Staffel (Aktuell/Nächste + Live-Delta „+7,7 s"), Eiskunstlauf (Zwischenstand, Wiederholung, Kiss & Cry), I-Spy (Zug-Uhr, Split-Tafel), Takeshi (Fallen-Schild, „noch 10 im Rennen"), Breaking (Peinigt/Erträgt-Karten, Folterbank-Skala), Gewichtheben (Versuchstafel), Wettessen (Kopf an Kopf, Magen-Meter), Hockey (SOG, Powerplay im Bug). Eiskunstlauf, Staffel, I-Spy und Hockey sind damit ohne das Dashboard darunter lesbar. |
| **`.hud-in`-Einblendung** | Bug, Bahn-HUD, Zug-Uhr springen nicht mehr hart. Klein, aber richtig. |
| **Score-Kontrast / Teamfarben an der Scoreline** | Scoreline-Namen in Amber/Cyan, 20-px-Stand in der Kaderleiste — die Zwei-Seiten-Kodierung ist jetzt überall gleich und nie verwechselt (in keinem der 219 Bilder eine vertauschte Seite). |
| **Climbing-Kamera und Countdown** | Climbing ist von „unlesbar" zu „ordentlich" gekommen (Zeitlimit-Kachel, Wand-Fortschritt oben). |
| **Label-Kollisionsvermeidung Name/Status** (Kampf) | Namen und Befehle unter den Figuren bleiben außerhalb des dichten Pulks lesbar. Skill-Schwebetexte sind davon nicht erfasst, Bahn und Feldspiel gar nicht (3.5). |
| **Wertungs-Akzent je Disziplin** (Phase 6) | Korrekt gebaut, aber ehrlich: ein 3-px-Streifen und Unterstriche fallen beim Zuschauen nicht auf. Konsistenzgewinn für Kenner, kein Broadcast-Gewinn. |
| **Einlauf** | Über alle 20 identisch aufgebaut (Wappen, Platz, Disziplin-Rang, Aufstellung mit Eignung) — gutes Gerüst. |

---

## 3. Die großen Linien (holistisch)

### 3.1 Ein Stand, drei bis vier Zahlen — und nicht immer dieselbe

Jede Disziplin zeigt den Stand gleichzeitig in der **Scoreline** (`#score`, über dem Canvas),
im **Score-Bug** (`#bbugMitte`, 40 px darunter *im* Canvas — eine wörtliche Wiederholung) und
in der **Kaderleiste** (`#kmitte`); Gewichtheben, Speed-Schach und Takeshi malen zusätzlich
einen eigenen Stand in den Canvas. Eine Übertragung hat genau *einen* Score-Bug. Schlimmer ist,
dass die Stellen verschiedene Größen zeigen, weil `#kmitte` (Kaderleiste, `battle-mode.engine.js`
~Z. 37760) je Chassis eine eigene Formel hat:

| Disziplin | Scoreline / Bug | Kaderleiste | Was der Zuschauer sieht |
|---|---|---|---|
| TDM / Battlefield | Ausschaltungen 6 : 11 | Lebende 5 : 6 | dazu im Bug „6 : 5" Überzahl — **größer : kleiner**, also gegenläufig zur Kaderleiste direkt darunter (`aktualisiereBbug()` ~Z. 12673) |
| Gewichtheben | gewonnene Duelle 1 : 0 | Sinclair-Summe 2244 : 1812 | Kaderleiste zeigt die **Endwerte schon im Einlauf** (Bild 05) — Ergebnis verraten |
| Wettessen | `wettessenAnzeigeSumme` 2745 : 2507 | `summe` 3070 : 2753 | Kaderleiste läuft der Scoreline voraus (Bild 11) |
| Breaking | Verbliebene 5 : 4 | Qualpunkte 5539 : 3947 | zwei völlig verschiedene Größen mit demselben „:" |
| Football | `fsBisher()` 9 : 6 | 9 : 6 | Ticker/Callout mit `fsPunkte`: „gewinnt **10:7**", „Ende 2. Viertel — Stand **10:0**" bei Scoreline 9 : 0 (Bild 08) — die Extrapunkte fehlen der Anzeige |
| Time-Trial / Staffel | 0 : 1 (wer führt) | 0 : 1 | ein Rennen, dessen Stand „0 : 1" heißt; die eigentliche Information (Zeitabstand) steht nur im Bahn-HUD |
| Spurt / Climbing | Rangpunkte „34 · 21" | „34 : 21" | ein Stand **vor dem Start** (aus den Startpositionen), in Scoreline und Kaderleiste mit verschiedenem Trennzeichen |
| Tennis / Fechten | 0 : 0 bis kurz vor Schluss | 0 : 0 | die große Zahl bewegt sich das ganze Match nicht; die Spannung steckt in „Vorteil"-Werten im Kleingedruckten |

**Warum das die Gesamtwirkung am stärksten drückt:** Die Zahl in der Mitte ist das Erste, was
man ansieht, und das Einzige, was man sich merkt. Solange sie sich zwischen zwei Stellen
desselben Bildschirms widerspricht, wirkt alles andere unzuverlässig.

### 3.2 Anfang und Ende der Sendung fehlen an den wichtigsten Stellen

* **Feldspiel hat keinen Endstand.** Hockey, Basketball, Football hören bei der Schlusssirene
  mitten im Bild auf; kein Sieger-Banner, kein Boxscore-Overlay, keine Szene des Spiels, keine
  drei Sterne (Bilder 08, 09). Der Grund steht im Code (`stepFeldspielLive`, ~Z. 12005:
  „finish()/renderEndstand() sind Kampf-spezifisch … deshalb hier keine Weiterleitung") —
  seit Phase 5 gibt es aber einen generischen Endstand, den Bühne und Bahn längst nutzen.
* **Mini-DM hat keine Live-Ansicht** (Bild 18): vier Karten, zwei Tabellen, ein Absatz
  „Begründung: PR-Beschreibung", darunter die Kampf-Hilfszeile „Gegner auf dem Feld
  anklicken", obwohl es kein Feld gibt.
* **Kein Anpfiff-Moment:** „KAMPF STARTEN" → das Einlauf-Overlay verschwindet → es läuft.
  Kein Countdown, kein Stinger; vor dem Start steht in der Scoreline bereits „0:00 · läuft".
* **Nach dem Ende** bleibt in allen 14 Bühnen- und Bahn-Disziplinen der Knopf auf „PAUSE"
  (nur Kampf und Feldspiel schalten auf „VORBEI"; DOM-Tabelle 6.3), und die Wertung sagt bei
  Nicht-Ankömmlingen weiter „läuft" / „fährt".

### 3.3 Das Vokabular wandert zwischen den Chassis

Die Engine teilt Text-Bausteine über Chassis-Grenzen hinweg, und das hört man:

* **Tennis spricht Schach** (Bild 06): Callouts „Krag'Zul: Brett 2 gewonnen (Vorteil +116)",
  Ticker „(Brett 3, Zug 9/10)", Unterzeile „10 Züge je Brett — Vorteil läuft mit",
  Tabellenspalten BRETT / ZUG / VORT — während der Canvas selbst korrekt „Platz 3 von 6 ·
  Ballwechsel 9/10" schreibt. Quelle: `battle-mode.engine.js` Z. 16697, 16768, 18577.
* **Fechten spricht Schach** (Bild 07): „(Brett 1, Zug 2/9)", „Brett 3 verloren (Vorteil
  +124)" — verloren mit positivem Vorteil, weil Treffer entscheiden, nicht Vorteil. Im
  Endstand steht „VORT +109" neben einem verlorenen Gefecht.
* **Kampf überall:** „KAMPF STARTEN" (Z. 38278) und „Aufstellung steht. Befehle sind gesetzt."
  in allen 20 Disziplinen, „KAMPFBERICHT" unter der Eisfläche (Bild 15, Quelle per Text nicht
  auffindbar — vermutlich in einem Grafik-Asset).
* **Rennen in der Folter:** Breaking-Canvas „noch 5 : 4 im Rennen" (Z. 24205, Bild 14).
* **Falsche Zähler:** „0 aufgetreten" in Wettessen, Tennis, Speed-Schach, Fechten, I-Spy (alle
  treten gleichzeitig an; Z. 18588 ersetzt pauschal „im Kampf" → „aufgetreten");
  „116 Spielzüge" im Feldspiel (Z. 12734) — eine interne Zählgröße als Team-Unterzeile.
* **Planzeile im Feldspiel:** „Ballwechsel — 24 Züge, 6 gegen 6" in Basketball/Hockey/Football.
* **Zahlenformat:** Takeshi „40.1 : 22.7", „21.1 (15.1 Sterne + 6 Ziel)" mit Dezimal*punkt*,
  überall sonst deutsches Komma („54,7 s").

### 3.4 Momente: die Dosierung existiert nur im Kampf

Die Kampf-Drossel (`kampfGrossDrosseln`, 12 s) hält TDM bei rund sieben Bannern je Spiel. Die
übrigen Chassis haben keine, und die Kriterien für „big" sind dort zu weit:

* **Breaking**: `feed(…,big)` für nahezu jedes „hält stand" → 195 verschiedene Bannertexte in
  3:30 Sendezeit, das Banner ist 92 % der Zeit eingeblendet (Tabelle 6.1) und enthält
  Blockzeichen-Balken („HP 222/400 ██████░░░░") — ein Textbalken in einer Broadcast-Grafik.
  Ein Banner, das immer steht, ist kein Moment mehr, sondern eine zweite Tickerzeile.
* **Takeshi**: 31 verschiedene Banner in 69 s, 82 % Sendezeit, fast alle „stürzt schwer"
  mit wechselnder Pointe.
* **Eiskunstlauf / Fechten**: 43 % bzw. 40 % Bannerzeit, 21 bzw. 19 Texte in 60–95 s.
* **Fechten**: zum Periodenende sechs Banner im selben Tick (eins je Bahn) — sichtbar ist nur
  das letzte.
* **Wettessen**: viermal hintereinander „Krolach — schlingt durch (107 Punkte, Durchgang n/10)".
* **Kampf selbst**: „Tidesprinter trifft Draco · 12" ist ein Banner (`grosserTreffer()`), ein
  Treffer von 12 Schaden ist kein Höhepunkt.

**Höhepunkte im Endstand** (`HIGHLIGHTS[]`) erben das: Eiskunstlauf listet zehnmal Grams
Fehler (Bild 16), Wettessen zehnmal „schlingt durch", Gewichtheben Routine-Versuche („3.
Versuch … gültig"), Climbing/Spurt/Takeshi beginnen mit „0:00 übernimmt die Führung". Weil
die Liste chronologisch ist und ungefiltert wächst, füllen im Eiskunstlauf allein die ersten
zwei Paare den sichtbaren Teil (Zeitstempel 0:00–0:09) — der spätere, entscheidende Teil des
Wettkampfs steht erst weiter unten. Die **Szene des Spiels** gibt es nur im Kampf und dort erzählt sie das Opfer statt den Täter
(„Mehrfachausschaltung — Rhyx'Tal fällt — zurück in 9 s", Bild 02). Und die Höhepunkte-Liste
ist im Endstand in allen Chassis unten am Canvas **angeschnitten** — das Overlay ist zwar
scrollbar (DOM-Sonde: 14–205 px Überhang), aber nichts zeigt an, dass es weitergeht; im
Standbild sieht es aus wie ein Layoutfehler.

### 3.5 Bildregie: Knäuel, Etikettenstapel, leere Flächen

Die Kamera ist fast überall fest (Ausnahmen: Fechten schneidet zwischen Bahnen, Climbing folgt
der Wand, Time-Trial hat ein Fokus-Panel unter dem Bild). Das erzeugt zwei gegenläufige
Probleme:

* **Knäuel mit Etikettenstapeln** — Basketball (alle zwölf unter einem Korb, Namen unlesbar,
  Bild 10), Time-Trial (Ziellinie: „Platz 2 1:02,0 min" über „HOT SEAT 38,7 s" über „GEIST"
  über „eingebrochen"/„fängt sich", Bild 13), Takeshi (zehn Läufer an einer Falle, Bild 12),
  Staffel-Wechselzone, und im Kampf die **Skill-Schwebetexte**: „Paladin Slash (aufgeladen)"
  zehnfach übereinander über Kontrollpunkt und Bug (Bild 03). Die Kollisionsvermeidung aus
  Phase 5 greift für Name/Status, nicht für die Skill-Namen, und im Bahn-/Feldspiel-Chassis
  gar nicht.
* **Leere Flächen** — Showcase (winzige Figur auf dunkler Bühne, Bild 19), Fechten (obere
  Canvas-Hälfte leer, Nebenbahnen winzig), Spurt (das Feld hängt als Säule an einem Hindernis,
  der Rest der Strecke ist leer), Kampf (Gefecht klebt am Rand und wird unten abgeschnitten,
  Bild 03).

Eine Übertragung löst beides mit derselben Maßnahme: eine Regie-Kamera, die auf die Aktion
zoomt (Fable-Idee B1), und Etiketten nur für die, die gerade im Fokus sind.

### 3.6 Die Chrome redet wie ein Entwicklerwerkzeug

Was eine TV-Grafik nie zeigt, hier aber in jeder Disziplin dauerhaft steht:

* Fbar rechts: „Simulation deterministisch — gleiche Aufstellung, gleicher Verlauf".
* „Plan der KI" / „Rennpläne" als zweizeiliger Fließtext-Absatz über der Scoreline.
* Bedienhinweise in 16-px-Grau, größer als die Tabellenschrift: „Keine Ansage. Gegner auf dem
  Feld … anklicken …", „Rennplan-Ansage — eigenen Läufer … anklicken", „Kein Fokus …".
* Befehls-Etiketten im Kampf-Canvas unter jeder Figur („MIT DER LINIE", „FLANKE", „VERFOLGEN").
* Tabellen-Fußnoten („„Getankt" ist der Rohschaden vor Abzug …") und Leistungs-/Eignungs-
  prozente („LEIST 33 %", „EIG") in der Live-Tabelle.
* Kaderleisten-Stats in gesperrter Mono-Schrift („K 1 T 0 B 1") — kaum lesbar.
* **Seitenhöhe:** das Arena-Panel misst in jeder Disziplin 1100–1310 px. Bei 900 px Viewport
  (plus Host-Kopf) sieht man Canvas, Kaderleiste, Ticker und Tabelle nie gleichzeitig; die
  Tabelle — die in Tennis/Fechten/Schach die eigentliche Spannung trägt — liegt immer
  unterhalb.

### 3.7 Uhren

* **Die Bühnen- und Feldspiel-Uhr tickt langsamer als die Wirklichkeit.** Kampf und Bahn
  zeigen `t·zeitFaktor()` bzw. `rennT·zeitFaktor()` (seit dem Arena-Zeit-Fix 27.09.); Bühne
  (`updateHudBuehne`: `buehneT`) und Feldspiel (`updateHudFeldspiel`: `fsT`) zeigen die rohe
  Simulationszeit. Bei `ZEIT_DEHNUNG` gewichtheben 4 / hockey 2 / fechten 1,62 läuft die
  angezeigte Sekunde also 4-, 2- bzw. 1,6-mal langsamer als die echte — gemessen: Gewichtheben
  7:11 Sendezeit, Uhr endet bei „1:50"; Hockey 7:50 Sendezeit, Uhr endet bei „4:00"; Fechten
  1:35, Uhr endet bei „0:59".
* **Zwei Uhren gleichzeitig:** Wettessen (Bug „0:37", Canvas „2:48 · MINUTE 8/10", Bild 11),
  Football/Hockey/Basketball (hochzählende Gesamtuhr „3:34" plus Periodenuhr „Q3 · 0:00"). Die
  Football-Viertel-Uhr steht über mehrere Spielzüge auf 0:00, während weitergespielt wird.
* **Sudden Death** steht im Kampf als fester Zeitpunkt „Sudden Death 1:34" zwischen den
  Balken, von Sekunde null an — kein Countdown; in Battlefield „4:10" bei einem Spiel, das
  um 1:59 endet.

### 3.8 Tempo und Stille: zwei Extreme, keine Mitte

Bei Tempo 1× (Tabellen 6.1/6.2) zerfallen die 20 Sendungen in drei Gruppen, und keine davon
fühlt sich wie Fernsehen an:

* **Dauerlaut** — Breaking (Banner 92 %), Takeshi (82 %), Eiskunstlauf (43 %), Fechten
  (40 %). Wenn immer etwas eingeblendet ist, ist nichts mehr wichtig.
* **Log statt Kommentar** — TDM 449 Tickerzeilen je Minute (7,5 je Sekunde), Battlefield 172,
  Eiskunstlauf 142, Schach/Tennis ~122. Kein Mensch liest das mit; der Ticker ist ein
  Debug-Protokoll im Sendungsbild. Im Fernsehen gibt es Play-by-Play für *Ereignisse*, nicht
  für jeden Treffer.
* **Stumm** — Staffel (4,5 Zeilen je Minute, 85 s ohne Banner, 22 s völlige Stille),
  Spurt (19 s), Time-Trial (17 s, dazu 23,5 s stehendes Bild), Hockey (88 s ohne Banner),
  Gewichtheben (95 % Standbild, 30 s am Stück). Das sind die „toten Momente" aus der
  Leitfrage — nicht, weil nichts passiert, sondern weil die Grafik in diesen Strecken nichts
  erzählt (Positionskämpfe, Abstände, Rundenzeiten, Versuchsuhr wären da).

Die Gegenmittel sind dieselben wie in 3.4: eine gemeinsame Dosierung (Zielband in 6.1) plus
„Füllgrafiken" für stille Strecken, die nur vorhandenen Zustand lesen (Abstand zum
Führenden, Zwischenzeit, Versuchsuhr).

---

## 4. Priorisierte Punkteliste

**Klassen** wie in den 27.09.-Papieren: **A** reine Anzeige/CSS/Text, liest nur vorhandenen
Zustand, sofort baubar; **A\*** wie A, braucht eine kleine Anzeige-Buchhaltung (Merker,
Puffer); **T** greift in die Wandzeit-Taktung ein (Simulation bit-identisch, braucht
Determinismus-Beleg); **S** braucht neuen Simulations-/Spielstandszustand (Chris
entscheidet); **W** berührt Wertung/Regeln (Chris entscheidet). Eine eigene Klasse „B"
kennen die 27.09.-Papiere nicht; was im Auftrag als B gemeint ist (braucht Chris' Zustimmung,
berührt aber nicht die Wertung), ist hier **T** bzw. **S**. Ohne Zustimmung baubar sind
also A und A\*; T, S und W brauchen Chris. Abnahme für A/A\* wie immer:
`node scripts/miss-alle-disziplinen.mjs 24 <disziplin>` vorher/nachher bit-identisch plus
Sichtprüfung.

Sortiert nach Wirkung auf das Gesamtbild, nicht nach Aufwand.

### Priorität 1 — widerspricht sich oder fehlt ganz

| # | Punkt | Klasse | Betrifft | Beleg |
|---|---|---|---|---|
| 1 | **Football: angezeigter Stand ≠ Ergebnis.** Scoreline/Kaderleiste lesen `fsBisher().team`, Schlussticker und Viertel-Callouts `fsPunkte` — die Extrapunkte fehlen der Anzeige (9 : 6 vs. „gewinnt 10:7"). Zuerst klären, **welche Zahl zählt** (wenn die Wertung eine der beiden nutzt, ist es W; ist es nur die Anzeige, A). | A (ggf. W klären) | Football | Bild 08; `stepFeldspielLive` ~Z. 12017 vs. `updateHudFeldspiel` ~Z. 12747 |
| 2 | **Gewichtheben verrät das Ergebnis vor dem Start.** `#kmitte` und die Kaderleisten-Werte zeigen die fertigen Sinclair-Summen schon im Einlauf. Auf die enthüllten Versuche umstellen (wie Eiskunstlauf es schon tut). | A | Gewichtheben | Bild 05; `#kmitte` ~Z. 37760 |
| 3 | **Ein Stand je Bildschirm.** Die Kaderleisten-Mitte zeigt dieselbe Größe wie die Scoreline — oder eine klar anders beschriftete (z. B. „Lebende 5 v 6", „Σ 2244 kg"); nie zwei unbeschriftete „a : b" verschiedener Bedeutung. Überzahl im Bug in Seitenreihenfolge („5 v 6"). Betrifft Kampf, Gewichtheben, Wettessen, Breaking. | A | 6 Disziplinen | Bilder 01, 04, 11, 14 |
| 4 | **Endstand fürs Feldspiel.** Den Phase-5-Endstand (Sieger-Verlauf, Boxscore je Seite aus `boxscoreSerie`/`WERTUNG`-Daten, Höhepunkte) auch nach der Schlusssirene von Hockey/Basketball/Football zeigen. | A | 3 | Bilder 08, 09 |
| 5 | **Tennis und Fechten entschachen.** Ticker-, Callout-, Unterzeilen- und Spaltentexte je Duell-Art aus `BB()` ziehen: Tennis „Platz/Ballwechsel/Punkt", Fechten „Bahn/Gang/Treffer". Im Fechten statt „Vorteil" den Trefferstand in Callout und Endstand. | A | 2 | Bilder 06, 07; Z. 16697, 16768, 18577 |
| 6 | **Score-Bug nicht über Canvas-eigene Stände legen.** Gewichtheben („1:0" im Canvas unter dem Bug), Speed-Schach („1:2" + Brett-Titel), Wettessen (Titel „WETTESSEN"): entweder die Canvas-Kopfzeile weglassen, wenn der Bug steht, oder beide zu einer Grafik zusammenziehen. | A | 3 | Bilder 04, 11, 20 |
| 7 | **Banner-Dosis für alle Chassis.** Eine gemeinsame Drossel wie `kampfGrossDrosseln` (Abstand + Prioritätsausnahmen) auch für Bühne/Bahn; „big" in Breaking nur für Aufgabe/Stufenwechsel/Rekord, in Takeshi nur für Ausscheiden/Zieleinlauf/Führungswechsel; gleichzeitige Banner (Fechten-Periodenende) zu einem Sammelbanner bündeln. Keine Blockzeichen im Banner. | A\* | Breaking, Takeshi, Fechten, Wettessen, Kampf | Bild 14; Dichte-Tabelle 6.1 |
| 8 | **Ticker entschlacken:** gewöhnliche Treffer/Pässe/Heilungen nicht in den sichtbaren Ticker (TDM 449 Zeilen/min), nur Ereignisse (Ausschaltung, Tor, Wechsel, Rekord); der volle Verlauf gehört in einen einklappbaren „Protokoll"-Reiter. Zielband ≤ 30 Zeilen/min. | A | Kampf, Eiskunstlauf, Schach, Tennis, Takeshi | Tabelle 6.1 |
| 9 | **Mini-DM bekommt ein Bild** — mindestens die vier Runden als animierte Ergebnis-Enthüllung (Karten decken sich rundenweise auf, Stand je Ecke zählt hoch), ohne PR-Verweis und ohne Kampf-Hilfszeile. Eine echte Vier-Ecken-Live-Grafik wäre S (neuer Rahmen). | A (Enthüllung) / S (Live) | Mini-DM | Bild 18 |

### Priorität 2 — macht es sichtbar unprofessionell

| # | Punkt | Klasse | Betrifft | Beleg |
|---|---|---|---|---|
| 10 | **Uhren angleichen:** Bühnen- und Feldspiel-Uhr mit `zeitFaktor()` skalieren wie Kampf/Bahn; je Disziplin genau eine sichtbare Uhr (Wettessen: Minuten-Uhr des Canvas *oder* Bug-Uhr; Feldspiel: Periodenuhr statt hochzählender Gesamtuhr). Football-Viertel-Uhr nicht bei 0:00 stehen lassen. | A | Gewichtheben, Hockey, Fechten, Wettessen, Feldspiel | Abschnitt 3.7 |
| 11 | **Höhepunkte kuratieren:** `HIGHLIGHTS` nach Momentart filtern (wie `KAMPF_KIND_PRIORITAET`), Routinezeilen und „0:00 übernimmt die Führung" raus, höchstens 6–8 Chips, damit die Liste ohne verstecktes Scrollen ins Overlay passt; Zeitstempel mit derselben Skalierung wie die Uhr aus Punkt 10. Szene des Spiels auch für Bühne/Bahn/Feldspiel und aus Sicht des Handelnden formulieren. | A\* | alle | Bilder 02, 16 |
| 12 | **Vokabular-Hygiene:** Startknopf je Chassis („Anpfiff", „Start", „Erste Runde"), Eröffnungs-Tickerzeile ohne „Befehle", „aufgetreten" nur bei Nacheinander-Formaten (Wettessen/Tennis/Schach/Fechten/I-Spy: „am Tisch"/„auf dem Platz"/„an den Brettern"), „Spielzüge" raus aus der Scoreline, „im Rennen" in Breaking → „noch im Ring", Feldspiel-Planzeile ohne „Ballwechsel/Züge", „KAMPFBERICHT" im Eis-Asset, Dezimalkomma in Takeshi. Phase vor dem Anpfiff „bereit" statt „läuft". Nach Spielende „VORBEI" in allen Chassis, Tabellenstatus „nicht im Ziel"/„Zeitlimit" statt „läuft". | A | alle | 3.2, 3.3 |
| 13 | **Skill-Schwebetexte im Kampf entrümpeln:** nur Crits/Ultimates/Tode als Wort, gewöhnliche Skillnamen weg oder in die Kollisionsvermeidung aufnehmen; Befehls-Etiketten („MIT DER LINIE") nur für die angewählte Figur. | A | TDM, Battlefield | Bilder 01, 03 |
| 14 | **Etiketten-Kollision auch für Bahn und Feldspiel:** dieselbe Logik wie Phase 5 für Time-Trial-Ziellinie, Takeshi-Fallen, Staffel-Wechselzone, Basketball-Knäuel; im Pulk nur Führende/Fokus beschriften. | A | 5 | Bilder 10, 12, 13 |
| 15 | **Entwicklertext aus dem Sendungsbild:** Fbar-Zusatz „Simulation deterministisch …" weg (oder nur Standalone), „Plan der KI" auf eine Zeile kürzen bzw. als einblendbare Bauchbinde zu Spielbeginn, Bedienhinweise klein und nur bei Hover/leerem Zustand, Tabellen-Fußnoten einklappbar, „LEIST/EIG"-Spalten live ausblenden (im Endstand behalten). | A | alle | alle Bilder |
| 16 | **Kompaktes Sendungslayout:** Canvas + Bug + schmale Kaderleiste müssen in 900 px passen; Ticker und Tabelle daneben oder einklappbar. Heute 1098–1320 px je Disziplin. | A | alle | DOM-Tabelle 6.3 |
| 17 | **Sieger-Banner einheitlich formulieren:** überall „SIEGER — Stand in der Disziplin-Einheit" plus *ein* sprechender Zusatz („mit 16,6 s Vorsprung", „8 : 16 Ausschaltungen"), nie „0 : 1 NACH ZEITSUMME (7:02,2 MIN GEGEN 5:21,4 MIN)"; TDM zeigt heute gar keinen Stand im Banner. | A | alle | Bilder 02, 07 |
| 18 | **Rennen-Stand als Zeitabstand:** Time-Trial und Staffel zeigen im Bug den Zeitabstand (wie das Staffel-HUD „+7,7 s") statt „0 : 1"; Tennis/Fechten/Schach einen laufenden Zwischenstand (gewonnene Plätze/Bahnen *bisher* oder Vorteil-Summe), damit die große Zahl nicht das ganze Match auf 0 : 0 steht. | A | 5 | 3.1 |
| 19 | **Tote Strecken füllen:** Gewichtheben zwischen den Versuchen (95 % Standbild, bis 30 s) mit sichtbarer Versuchsuhr, Hantel-Ladeanzeige und Kurz-Wiederholung des letzten Versuchs aus vorhandenem Zustand; Staffel/Spurt/Time-Trial in stillen Strecken (17–22 s ohne Signal) eine rotierende Bauchbinde „Abstand zum Führenden / Zwischenzeit / Positionskampf". | A / A\* | Gewichtheben, Staffel, Spurt, Time-Trial | Tabellen 6.1, 6.2 |
| 20 | **Breaking-Wertungstabelle läuft über** (14 Spalten, Spalten überlagern sich, rechts abgeschnitten); Takeshi ebenso („STAN…"). Spalten live reduzieren. | A | Breaking, Takeshi | Bild 14; DOM-Tabelle 6.3 |

### Priorität 3 — Politur, die den Unterschied zu „fertig" macht

| # | Punkt | Klasse | Betrifft |
|---|---|---|---|
| 21 | **Regie-Kamera** (Zoom auf die Aktion, Fable B1) für Kampf, Basketball, Spurt — löst Knäuel und leere Flächen zugleich. | T (Zoom rein darstellend, aber Klick-Trefferflächen/Taktung prüfen) | 5 |
| 22 | **Anpfiff-Moment:** 3-2-1-Countdown oder Stinger beim Start, bei Tempo ≥ 2× übersprungen (Fable A3/A4). | T | alle |
| 23 | **Showcase und Fechten füllen:** Bühne/Performer größer, Jury/Top-3-Tafel lesbar; Fechten Hauptbahn größer und höher, Nebenbahnen mit lesbarem Trefferstand. | A | 2 |
| 24 | **Schrift:** Canvas-Namen und -Status in Barlow Condensed statt IBM Plex Mono (~118 Mono-Stellen im Canvas); Gewichte 800/900 werden gezeichnet, aber nur 500–700 geladen; Mikrotext unter ~9 px (Eis-Wiederholungstitel, „Draco auf Kurs für 68", Heben-Versuchskästchen) streichen oder vergrößern. | A | alle |
| 25 | **Wertungs-Akzent spürbarer** (Phase 6 ist korrekt, aber unsichtbar): Akzent auch am Score-Bug-Rand bzw. im Einlauf-Disziplinnamen, damit die Disziplin als „Sendungsfarbe" wirkt. | A | alle |
| 26 | **Versuchstafel Gewichtheben** ragt rechts aus dem Canvas („Nächster: Lava Golem, 247 kg" abgeschnitten). | A | Gewichtheben |
| 27 | **Helles Standalone-Theme** wirkt zweigeteilt (helle Chrome, dunkler Canvas, dunkler Endstand); im Eiskunstlauf fehlt dem Bug-Mittelkasten der Hintergrund. Nur Standalone — niedrig. | A | alle |
| 28 | **Spieler des Spiels / drei Sterne** im Endstand (heute: Tidesprinter mit 10 Ausschaltungen steht nirgends hervorgehoben, im Endstand sogar durchgestrichen, weil er beim Abpfiff am Boden lag). | A\* | alle |

---

## 5. Disziplin-Steckbriefe

Einschätzung „sendungsreif" in drei Stufen: ● trägt schon, ◐ auf dem Weg, ○ fällt ab. Jeweils
das Stärkste und das, was den Eindruck am meisten kostet.

| Disziplin | | Stärkstes | Kostet am meisten |
|---|---|---|---|
| TDM | ◐ | Arena-Optik, Pips im Bug, einheitlicher Endstand | drei Stände mit zwei Bedeutungen, Skill-Texte, Szene/Höhepunkte ohne Story |
| Mini-DM | ○ | echte FFA-Ergebnisse | keine Live-Ansicht, Entwicklertext |
| Battlefield | ◐ | Kontrollpunkt klein und ehrlich im Bug | Skillnamen-Stapel, Kampf am Canvasrand, „Sudden Death 4:10" |
| Spurt | ◐ | Hindernis-Streckenband, Wassergraben-Captions | Feld als Säule, viel leere Strecke, Stand „19 · 36" ohne Einheit |
| Time-Trial | ◐ | Fokus-Panel mit Zwischenzeiten, Hot Seat | Etikettenstapel an der Ziellinie, Stand „0 : 1", Banner-Text |
| Climbing | ◐ | Zeitlimit-Kachel, Wand-Fortschritt | 12 kleine Figuren, „PAUSE"/„läuft" nach dem Ende |
| Staffel | ● | HUD mit Live-Delta, Bein-Zeile | Wechselzone-Etiketten, Stand „0 : 1", bis 22 s völlige Stille |
| Takeshi | ◐ | schönste Kulisse, Fallen-Schild | Banner-Flut, vier Stände, Pulk-Etiketten, Dezimalpunkt |
| Gewichtheben | ○ | Versuchstafel, Duell-Leiste | Ergebnis vorab verraten, 95 % Standbild über 7 min, Bug über Canvas-Stand, Uhr ×¼ |
| Showcase | ◐ | X-Wand, Top-3-Tafel | leere dunkle Bühne, winzige Figur, Mikrotext |
| Eiskunstlauf | ● | Referenz: Zwischenstand, Wiederholung, Kiss & Cry | Banner 43 % der Zeit, Höhepunkte = Fehlerliste, „KAMPFBERICHT" |
| Breaking | ◐ | Peinigt/Erträgt-Karten, Folterbank-Skala | Banner 92 % der Zeit, „im Rennen", Tabellenüberlauf, zwei Stände |
| Wettessen | ◐ | Kopf an Kopf, Tempo-Pfeile | zwei Uhren, zwei Stände, Bug über Titel, Highlights = Wiederholung |
| Speed-Schach | ◐ | Hauptbrett + Eval-Kurve + Nebenbretter | Bug/Callout über Brett-Titel, Stand lange 0 : 0 |
| I-Spy | ● | Zug-Uhr, Split-Tafel, Split-Screen | „0 aufgetreten", Namensüberlagerung |
| Tennis | ○ | Platz-Optik mit Mini-Plätzen | spricht Schach, Stand 0 : 0 bis zum Schluss |
| Fechten | ◐ | Regie mit Fokusbahn, FIE-Tafel | spricht Schach, Vorteil widerspricht Ergebnis, leere obere Hälfte |
| Basketball | ◐ | Parkett mit Publikum, Lauf-Grafik, Viertelpause | Knäuel, kein Endstand |
| Football | ○ | Down & Distance im Bug | Stand ≠ Ergebnis, kein Endstand, Viertel-Uhr 0:00 |
| Hockey | ◐ | sauberstes Feldbild, SOG/PP im Bug | kein Endstand, Uhr ×½, „Spielzüge" |

Drei ●, dreizehn ◐, vier ○ — und die vier ○ fallen jeweils an einem *harten* Fehler ab
(Stand ≠ Ergebnis, Ergebnis vorab verraten, falsche Sportart im Text, kein Bild), nicht an
fehlendem Feinschliff. Die Gesamtwertung entsteht genau daraus: eine Übertragung wird am
schwächsten Bild gemessen, das man an einem Spieltag sieht.

---

## 6. Messanhang

### 6.1 Banner, Ticker, Stille — Tempo 1×, ganzes Spiel

Alle 500 ms abgetastet: ist `#bbugcallout` sichtbar, wie viele neue Tickerzeilen kamen dazu.
„Stille" = keine Banner-Einblendung **und** keine neue Tickerzeile. Vier Browser parallel;
die Dauern decken sich mit `ZEIT_DEHNUNG` (TDM 186 s gemessen vs. 95 s × 1,88 = 179 s).
Eine erste Messung im 4×-Zeitraffer wurde verworfen: 4× schafft nicht 4 Schritte je Frame,
die hochgerechneten Dauern waren bis zu doppelt zu lang.

| Disziplin | Dauer 1× | Banner sichtbar | versch. Bannertexte | Ticker-Zeilen / min | längste Strecke ohne Banner | längste völlige Stille |
|---|---:|---:|---:|---:|---:|---:|
| TDM | 3:06 | 11 % | 8 | **449** | 28 s | 10 s |
| Battlefield | 2:08 | 7 % | 4 | 172 | 78 s | 3 s |
| Spurt | 3:33 | 13 % | 9 | 14 | 44 s | **19 s** |
| Time-Trial | 1:59 | 26 % | 11 | 42 | 21 s | **17 s** |
| Climbing | 1:20 | 12 % | 4 | 58 | 58 s | 9 s |
| Staffel | 2:53 | 8 % | 5 | **4,5** | **85 s** | **22 s** |
| Takeshi | 1:09 | **82 %** | 31 | 123 | 4 s | 3 s |
| Gewichtheben | 7:11 | 12 % | 18 | 12 | 34 s | 6 s |
| Showcase | 0:58 | 28 % | 7 | 61 | 16 s | 1 s |
| Eiskunstlauf | 1:00 | 43 % | 21 | 142 | 14 s | 1 s |
| Breaking | 3:30 | **92 %** | **195** | 89 | 15 s | 1 s |
| Wettessen | 0:52 | 26 % | 5 | 17 | 26 s | 6 s |
| Speed-Schach | 1:00 | 17 % | 7 | 123 | 37 s | 1 s |
| I-Spy | 0:59 | 38 % | 6 | 96 | 11 s | 1 s |
| Tennis | 1:01 | 12 % | 6 | 122 | 54 s | 1 s |
| Fechten | 1:35 | 40 % | 19 | 78 | 20 s | 1 s |
| Basketball | 6:11 | 22 % | 18 | 58 | 53 s | 5 s |
| Football | 4:39 | 8 % | 8 | 33 | 43 s | 3 s |
| Hockey | 7:50 | 7 % | 9 | 46 | **88 s** | 7 s |

Lesart: Der Anteil sichtbarer Banner-Zeit streut zwischen den Disziplinen um den Faktor 13
(7 % bis 92 %), die Tickerdichte um den Faktor 100 (4,5 bis 449 Zeilen je Minute). Es gibt
keine gemeinsame Vorstellung davon, wie oft die Sendung „laut" wird. Zielband als
Vorschlag: Banner 8–20 % der Sendezeit, 2–6 verschiedene Banner je Minute, Ticker ≤ 30
Zeilen je Minute im sichtbaren Bereich, keine Strecke über ~10 s ohne jedes Signal.

### 6.2 Bewegung bei Tempo 1×

Canvas alle 500 ms auf 155 × 59 verkleinert; ein Bild gilt als „stehend", wenn sich weniger
als 1 % der Pixel spürbar ändern. **Vorbehalt:** kleine Figuren (Staffel-Oval, Spurt) fallen
bei der Verkleinerung fast weg — die Werte sind für großflächige Szenen aussagekräftig, für
Szenen mit sehr kleinen Figuren eine Untergrenze der gefühlten Bewegung.

| Disziplin | stehende Bilder | längster Stillstand | bewegter Bildanteil Ø |
|---|---:|---:|---:|
| **Gewichtheben** | **95 %** | **30 s** | 0,2 % |
| Speed-Schach | 76 % | 5,5 s | 0,6 % |
| Staffel | 50 % | 15 s | 1,0 % |
| Tennis | 48 % | 1 s | 1,5 % |
| Showcase | 30 % | 2,5 s | 13,6 % |
| Time-Trial | 20 % | 23,5 s | 13,5 % |
| Football | 19 % | 1 s | 3,4 % |
| Wettessen | 17 % | 1,5 s | 1,6 % |
| Eiskunstlauf | 7 % | 1 s | 2,5 % |
| Fechten | 6 % | 0,5 s | 1,9 % |
| Basketball | 4 % | 4,5 s | 4,9 % |
| Spurt | 1 % | 1 s | 7,6 % |
| TDM, Battlefield, Climbing, Takeshi, Breaking, I-Spy, Hockey | 0 % | ≤ 0,5 s | 3,5–43,5 % |

Gewichtheben ist damit die toteste Sendung: 7 Minuten, davon 95 % Standbild, bis zu einer
halben Minute ohne jede Bildänderung zwischen zwei Versuchen — und die Uhr darüber tickt
nur jede vierte Sekunde (3.7). Im Fernsehen läuft in dieser Zeit die Versuchsuhr, die Hantel
wird geladen, der Heber kreidet sich ein, die Wiederholung des letzten Versuchs läuft.

### 6.3 DOM-Befunde

Gemessen je Disziplin vor dem Start, nach ~9 s (4×) und nach dem Spielende. „kmitte" ist die
Kaderleisten-Mitte, „Namen ✂" die Zahl abgeschnittener Namen in der Kaderleiste (von 12),
„Überlauf" der horizontale Tabellenüberhang links/rechts in px, „Endstand ↕" der verborgene
Scroll-Überhang des Endstand-Overlays.

| Disziplin | vor Start: Scoreline / kmitte | Mitte: Scoreline / kmitte | Ende: Knopf | Panel px | Namen ✂ | Überlauf | Endstand ↕ |
|---|---|---|---|---:|---:|---|---:|
| TDM | 0 : 0 / 6 : 6 | 1 : 0 / 6 : 5 (Bug zusätzlich „6 : 5") | Vorbei | 1220 | 7 | – | 95 |
| Battlefield | 0 : 0 / 4 : 4 | 0 : 0 / 4 : 4 | Vorbei | 1118 | 4 | – | 14 |
| Spurt | **34 · 21** / 34 : 21 | 23 · 32 / 23 : 32 | **Pause** | 1182 | 5 | – | – |
| Time-Trial | 0 : 0 / 0 : 0 | 0 : 0 / 0 : 0 | **Pause** | **1320** | 7 | – | 160 |
| Climbing | **57 · 21** / 57 : 21 | 25 · 53 / 25 : 53 | **Pause** | 1268 | 7 | – | 63 |
| Staffel | 0 : 0 / 0 : 0 | 0 : 1 / 0 : 1 | **Pause** | 1182 | 7 | – | 63 |
| Takeshi | 0 : 0 / 0 : 0 | 46.5 : 22.6 / 46.5 : 22.6 | **Pause** | 1182 | 7 | 25 / 0 | 174 |
| Gewichtheben | 0 : 0 / **2244 : 1812** | 0 : 0 / **2244 : 1812** | **Pause** | 1110 | 7 | – | – |
| Showcase | 0 : 0 / 0 : 0 | 263 : 175 / gleich | **Pause** | 1110 | 7 | – | 174 |
| Eiskunstlauf | 0 : 0 / 0 : 0 | 1829 : 685 / gleich | **Pause** | 1110 | 7 | – | 174 |
| Breaking | 6 : 6 / 0 : 0 | 6 : 6 / **2057 : 870** | **Pause** | 1098 | 7 | **72** / 8 | 205 |
| Wettessen | 0 : 0 / 0 : 0 | 1523 : 1356 / **1857 : 1634** | **Pause** | 1098 | 7 | – | 83 |
| Speed-Schach | 0 : 0 / 0 : 0 | 0 : 0 / 0 : 0 | **Pause** | 1098 | 7 | – | 51 |
| I-Spy | 0 : 0 / 0 : 0 | 724 : 566 / gleich | **Pause** | 1098 | 7 | – | 83 |
| Tennis | 0 : 0 / 0 : 0 | 0 : 0 / 0 : 0 | **Pause** | 1098 | 7 | – | 19 |
| Fechten | 0 : 0 / 0 : 0 | 0 : 0 / 0 : 0 | **Pause** | 1098 | 7 | – | 98 |
| Basketball | 0 : 0 / 0 : 0 | 2 : 4 / gleich | Vorbei | 1131 | 7 | – | kein Endstand |
| Football | 0 : 0 / 0 : 0 | 0 : 0 / 0 : 0 | Vorbei | 1131 | 7 | – | kein Endstand (Ende 9 : 6, Ticker 10:7) |
| Hockey | 0 : 0 / 0 : 0 | 0 : 0 / 0 : 0 | Vorbei | 1131 | 7 | – | kein Endstand |

Dazu in **allen 19**: Phase vor dem Anpfiff „läuft", Knopf „Kampf starten". Spurt und Climbing
zeigen vor dem Start einen Stand aus den Startpositionen und trennen ihn in der Scoreline mit
„·", in der Kaderleiste mit „:" — dieselbe Zahl in zwei Schreibweisen.

---

## 7. Abgrenzung

* **Keine Wiederholung der Fable-Ideen** (`fable-ideen-broadcast-praesentation-30-09.md`):
  Regie-Kamera (B1), Stinger/Countdown (A3/A4), Spieler des Spiels (A5), Highlight-Titel (C3)
  tauchen hier nur als Antwort auf einen Befund auf. Dessen drei Randnotizen (Callout über
  Bahn-HUD, TDM-Höhepunkte, Eiskunstlauf-Wiederholungsbox) sind in 3.4 und Punkt 11
  aufgegangen bzw. in dieser Runde bestätigt.
* **Keine Mechanik:** Punkt 1 (Football) und Punkt 9 (Mini-DM live) sind die einzigen, bei
  denen eine Chris-Entscheidung nötig sein *kann*; alles andere liest nur vorhandenen Zustand.
* **Ton** wurde nicht bewertet.

## Bildverzeichnis

Alle Bilder: Produktionsmodus (dunkel, `.im-spiel`), 1300 px breit, gesamtes Arena-Panel.

* **Bild 01** — [01-tdm-mitte-skilltexte-drei-staende.jpg](f1-broadcast-audit-runde-2-30-09/01-tdm-mitte-skilltexte-drei-staende.jpg): tdm mitte skilltexte drei staende
* **Bild 02** — [02-tdm-endstand-szene-hoehepunkte.jpg](f1-broadcast-audit-runde-2-30-09/02-tdm-endstand-szene-hoehepunkte.jpg): tdm endstand szene hoehepunkte
* **Bild 03** — [03-battlefield-skillnamen-stapel.jpg](f1-broadcast-audit-runde-2-30-09/03-battlefield-skillnamen-stapel.jpg): battlefield skillnamen stapel
* **Bild 04** — [04-gewichtheben-bug-ueber-canvas-stand.jpg](f1-broadcast-audit-runde-2-30-09/04-gewichtheben-bug-ueber-canvas-stand.jpg): gewichtheben bug ueber canvas stand
* **Bild 05** — [05-gewichtheben-einlauf-kaderleiste-verraet-ergebnis.jpg](f1-broadcast-audit-runde-2-30-09/05-gewichtheben-einlauf-kaderleiste-verraet-ergebnis.jpg): gewichtheben einlauf kaderleiste verraet ergebnis
* **Bild 06** — [06-tennis-schachvokabular.jpg](f1-broadcast-audit-runde-2-30-09/06-tennis-schachvokabular.jpg): tennis schachvokabular
* **Bild 07** — [07-fechten-endstand-brett-zug-vorteil.jpg](f1-broadcast-audit-runde-2-30-09/07-fechten-endstand-brett-zug-vorteil.jpg): fechten endstand brett zug vorteil
* **Bild 08** — [08-football-ende-9-6-gegen-10-7-kein-endstand.jpg](f1-broadcast-audit-runde-2-30-09/08-football-ende-9-6-gegen-10-7-kein-endstand.jpg): football ende 9 6 gegen 10 7 kein endstand
* **Bild 09** — [09-hockey-ende-kein-endstand.jpg](f1-broadcast-audit-runde-2-30-09/09-hockey-ende-kein-endstand.jpg): hockey ende kein endstand
* **Bild 10** — [10-basketball-knaeuel.jpg](f1-broadcast-audit-runde-2-30-09/10-basketball-knaeuel.jpg): basketball knaeuel
* **Bild 11** — [11-wettessen-zwei-uhren-zwei-staende.jpg](f1-broadcast-audit-runde-2-30-09/11-wettessen-zwei-uhren-zwei-staende.jpg): wettessen zwei uhren zwei staende
* **Bild 12** — [12-takeshi-ueberlagerung-vier-staende.jpg](f1-broadcast-audit-runde-2-30-09/12-takeshi-ueberlagerung-vier-staende.jpg): takeshi ueberlagerung vier staende
* **Bild 13** — [13-time-trial-etikettenhaufen.jpg](f1-broadcast-audit-runde-2-30-09/13-time-trial-etikettenhaufen.jpg): time trial etikettenhaufen
* **Bild 14** — [14-breaking-im-rennen-tabellenueberlauf.jpg](f1-broadcast-audit-runde-2-30-09/14-breaking-im-rennen-tabellenueberlauf.jpg): breaking im rennen tabellenueberlauf
* **Bild 15** — [15-eiskunstlauf-referenz.jpg](f1-broadcast-audit-runde-2-30-09/15-eiskunstlauf-referenz.jpg): eiskunstlauf referenz
* **Bild 16** — [16-eiskunstlauf-hoehepunkte-nur-fehler.jpg](f1-broadcast-audit-runde-2-30-09/16-eiskunstlauf-hoehepunkte-nur-fehler.jpg): eiskunstlauf hoehepunkte nur fehler
* **Bild 17** — [17-staffel-hud-referenz.jpg](f1-broadcast-audit-runde-2-30-09/17-staffel-hud-referenz.jpg): staffel hud referenz
* **Bild 18** — [18-mini-dm-keine-liveansicht.jpg](f1-broadcast-audit-runde-2-30-09/18-mini-dm-keine-liveansicht.jpg): mini dm keine liveansicht
* **Bild 19** — [19-showcase-leere-buehne.jpg](f1-broadcast-audit-runde-2-30-09/19-showcase-leere-buehne.jpg): showcase leere buehne
* **Bild 20** — [20-speed-schach-bug-ueber-canvas.jpg](f1-broadcast-audit-runde-2-30-09/20-speed-schach-bug-ueber-canvas.jpg): speed schach bug ueber canvas
