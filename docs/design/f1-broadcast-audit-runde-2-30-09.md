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
   mindestens sieben Disziplinen zeigen diese Stellen *verschiedene Zahlen*. Im Football
   zeigt die Scoreline am Ende 9 : 6, der Schlussticker „gewinnt 10:7". Im Gewichtheben steht
   das Endergebnis schon vor dem ersten Versuch in der Kaderleiste.
2. **Vier von zwanzig Sendungen haben keinen Abspann oder gar kein Bild.** Hockey, Basketball
   und Football — die TV-typischsten Sportarten — enden ohne Endstand-Grafik mit einer
   Tickerzeile; Mini-DM hat weiterhin überhaupt keine Live-Ansicht.
3. **Das Vokabular wandert zwischen den Chassis.** Tennis und Fechten sprechen außerhalb des
   Canvas Schach („Brett 2 gewonnen", „Zug 9/10"), jede Disziplin startet mit
   „KAMPF STARTEN", Breaking zeigt „noch 5 : 4 im Rennen", Wettessen und Tennis zählen
   „0 aufgetreten", das Feldspiel „59 Spielzüge".
4. **Die Momente-Dosierung existiert nur im Kampf.** Breaking blendet praktisch jeden Zug als
   Banner ein (142 verschiedene Banner in einem Spiel), Takeshi 26 in zwei Minuten; die
   Höhepunkte im Endstand sind in fast allen Disziplinen Routinezeilen („Gram — stolpert",
   zehnmal „schlingt durch", „0:00 übernimmt die Führung").
5. **Die Chrome redet wie ein Entwicklerwerkzeug.** Absatzlange „Plan der KI"-Zeilen,
   „Simulation deterministisch — gleiche Aufstellung, gleicher Verlauf", große graue
   Bedienhinweise, Tabellen-Fußnoten, ein PR-Verweis im Mini-DM-Bild — und das Arena-Panel ist
   in jeder Disziplin 1100–1300 px hoch, man sieht Bild, Kader und Tabelle nie zugleich.

Das ist die ehrliche Kurzform: **die Einzelteile sind auf dem Weg zu 75 %, die Sendung als
Ganzes nicht**, weil sie sich zwischen den Disziplinen (und innerhalb eines Bildschirms)
widerspricht. Die gute Nachricht: fast alles davon ist Klasse A.

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
  Stand/Uhr/Bug/Callouts — insgesamt rund 230 Bilder. Mini-DM separat (kein Start-Knopf).
* **Dichte-Sonde** (MutationObserver auf `#feed` und `#bbugcallout`): Tickerzeilen und
  Banner-Einblendungen je Minute, längste Lücke ohne Banner.
* **DOM-Sonde** vor dem Start, in der Spielmitte und am Ende: Stand in Scoreline vs.
  Kaderleiste vs. Bug, Tabellenüberlauf, abgeschnittene Namen, Knopfbeschriftung.
* **Bewegungs-Sonde bei Tempo 1×:** Canvas alle 500 ms verkleinert abgetastet, Anteil
  „stehender" Bilder und längste Stillstandsstrecke.
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
| **Disziplin-HUDs aus Phase 4** | Staffel (Aktuell/Nächste + Live-Delta „+7,7 s"), Eiskunstlauf (Zwischenstand, Wiederholung, Kiss & Cry), I-Spy (Zug-Uhr, Split-Tafel), Takeshi (Fallen-Schild, „noch 10 im Rennen"), Breaking (Peinigt/Erträgt-Karten, Folterbank-Skala), Gewichtheben (Versuchstafel), Wettessen (Kopf an Kopf, Magen-Meter). Vier davon (Eiskunstlauf, Staffel, I-Spy, Hockey) sind ohne Dashboard lesbar. |
| **`.hud-in`-Einblendung** | Bug, Bahn-HUD, Zug-Uhr springen nicht mehr hart. Klein, aber richtig. |
| **Score-Kontrast / Teamfarben an der Scoreline** | Scoreline-Namen in Amber/Cyan, 20-px-Stand in der Kaderleiste — die Zwei-Seiten-Kodierung ist jetzt überall gleich und nie verwechselt (in keinem der 230 Bilder eine vertauschte Seite). |
| **Climbing-Kamera und Countdown** | Climbing ist von „unlesbar" zu „ordentlich" gekommen (Zeitlimit-Kachel, Wand-Fortschritt oben). |
| **Label-Kollisionsvermeidung Name/Status** (Kampf) | Namen und Befehle unter den Figuren überlagern sich im Kampf deutlich seltener als früher. |
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
* **Nach dem Ende** bleibt in allen Bühnen- und Bahn-Disziplinen der Knopf auf „PAUSE"
  (nur Kampf und Feldspiel schalten auf „VORBEI"), und die Wertung sagt bei
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

* **Breaking**: `feed(…,big)` für nahezu jedes „hält stand" → 142 verschiedene Bannertexte in
  einem Spiel; das Banner ist praktisch dauerhaft eingeblendet und enthält Blockzeichen-Balken
  („HP 222/400 ██████░░░░") — ein Textbalken in einer Broadcast-Grafik.
* **Takeshi**: 26 Banner in ~2 Minuten, fast alle „stürzt schwer" mit wechselnder Pointe.
* **Fechten**: zum Periodenende sechs Banner im selben Tick (eins je Bahn) — sichtbar ist nur
  das letzte.
* **Wettessen**: viermal hintereinander „Krolach — schlingt durch (107 Punkte, Durchgang n/10)".
* **Kampf selbst**: „Tidesprinter trifft Draco · 12" ist ein Banner (`grosserTreffer()`), ein
  Treffer von 12 Schaden ist kein Höhepunkt.

**Höhepunkte im Endstand** (`HIGHLIGHTS[]`) erben das: Eiskunstlauf listet zehnmal Grams
Fehler (Bild 16), Wettessen zehnmal „schlingt durch", Gewichtheben Routine-Versuche („3.
Versuch … gültig"), Climbing/Spurt/Takeshi beginnen mit „0:00 übernimmt die Führung". Die
**Zeitstempel der Bühne** laufen 0:00–0:09, weil `buehneT` die Uhr ist (s. 3.7). Die
**Szene des Spiels** gibt es nur im Kampf und dort erzählt sie das Opfer statt den Täter
(„Mehrfachausschaltung — Rhyx'Tal fällt — zurück in 9 s", Bild 02). Und die Höhepunkte-Liste
ist im Endstand in allen Chassis unten am Canvas **angeschnitten** — das Overlay ist zwar
scrollbar (DOM-Sonde: 14–205 px Überhang), aber nichts zeigt an, dass es weitergeht; im
Standbild sieht es aus wie ein Layoutfehler.

### 3.5 Bildregie: Knäuel, Etikettenstapel, leere Flächen

Die Kamera ist in 19 von 20 Disziplinen fest. Das erzeugt zwei gegenläufige Probleme:

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
  angezeigte Sekunde also 4-, 2- bzw. 1,6-mal langsamer als die echte: ein Gewichtheben dauert
  ~8 Minuten und endet bei „1:50".
* **Zwei Uhren gleichzeitig:** Wettessen (Bug „0:37", Canvas „2:48 · MINUTE 8/10", Bild 11),
  Football/Hockey/Basketball (hochzählende Gesamtuhr „3:34" plus Periodenuhr „Q3 · 0:00"). Die
  Football-Viertel-Uhr steht über mehrere Spielzüge auf 0:00, während weitergespielt wird.
* **Sudden Death** steht im Kampf als fester Zeitpunkt „Sudden Death 1:34" zwischen den
  Balken, von Sekunde null an — kein Countdown; in Battlefield „4:10" bei einem Spiel, das
  um 1:59 endet.

---

## 4. Priorisierte Punkteliste

**Klassen** wie in den 27.09.-Papieren: **A** reine Anzeige/CSS/Text, liest nur vorhandenen
Zustand, sofort baubar; **A\*** wie A, braucht eine kleine Anzeige-Buchhaltung (Merker,
Puffer); **T** greift in die Wandzeit-Taktung ein (Simulation bit-identisch, braucht
Determinismus-Beleg); **S** braucht neuen Simulations-/Spielstandszustand (Chris
entscheidet); **W** berührt Wertung/Regeln (Chris entscheidet). Abnahme für A/A\* wie immer:
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
| 8 | **Mini-DM bekommt ein Bild** — mindestens die vier Runden als animierte Ergebnis-Enthüllung (Karten decken sich rundenweise auf, Stand je Ecke zählt hoch), ohne PR-Verweis und ohne Kampf-Hilfszeile. Eine echte Vier-Ecken-Live-Grafik wäre S (neuer Rahmen). | A (Enthüllung) / S (Live) | Mini-DM | Bild 18 |

### Priorität 2 — macht es sichtbar unprofessionell

| # | Punkt | Klasse | Betrifft | Beleg |
|---|---|---|---|---|
| 9 | **Uhren angleichen:** Bühnen- und Feldspiel-Uhr mit `zeitFaktor()` skalieren wie Kampf/Bahn; je Disziplin genau eine sichtbare Uhr (Wettessen: Minuten-Uhr des Canvas *oder* Bug-Uhr; Feldspiel: Periodenuhr statt hochzählender Gesamtuhr). Football-Viertel-Uhr nicht bei 0:00 stehen lassen. | A | Gewichtheben, Hockey, Fechten, Wettessen, Feldspiel | Abschnitt 3.7 |
| 10 | **Höhepunkte kuratieren:** `HIGHLIGHTS` nach Momentart filtern (wie `KAMPF_KIND_PRIORITAET`), Routinezeilen und „0:00 übernimmt die Führung" raus, höchstens 6–8 Chips, damit die Liste ohne verstecktes Scrollen ins Overlay passt, Bühnen-Zeitstempel auf Sendungszeit. Szene des Spiels auch für Bühne/Bahn/Feldspiel und aus Sicht des Handelnden formulieren. | A\* | alle | Bilder 02, 16 |
| 11 | **Vokabular-Hygiene:** Startknopf je Chassis („Anpfiff", „Start", „Erste Runde"), Eröffnungs-Tickerzeile ohne „Befehle", „aufgetreten" nur bei Nacheinander-Formaten (Wettessen/Tennis/Schach/Fechten/I-Spy: „am Tisch"/„auf dem Platz"/„an den Brettern"), „Spielzüge" raus aus der Scoreline, „im Rennen" in Breaking → „noch im Ring", Feldspiel-Planzeile ohne „Ballwechsel/Züge", „KAMPFBERICHT" im Eis-Asset, Dezimalkomma in Takeshi. Phase vor dem Anpfiff „bereit" statt „läuft". Nach Spielende „VORBEI" in allen Chassis, Tabellenstatus „nicht im Ziel"/„Zeitlimit" statt „läuft". | A | alle | 3.2, 3.3 |
| 12 | **Skill-Schwebetexte im Kampf entrümpeln:** nur Crits/Ultimates/Tode als Wort, gewöhnliche Skillnamen weg oder in die Kollisionsvermeidung aufnehmen; Befehls-Etiketten („MIT DER LINIE") nur für die angewählte Figur. | A | TDM, Battlefield | Bilder 01, 03 |
| 13 | **Etiketten-Kollision auch für Bahn und Feldspiel:** dieselbe Logik wie Phase 5 für Time-Trial-Ziellinie, Takeshi-Fallen, Staffel-Wechselzone, Basketball-Knäuel; im Pulk nur Führende/Fokus beschriften. | A | 5 | Bilder 10, 12, 13 |
| 14 | **Entwicklertext aus dem Sendungsbild:** Fbar-Zusatz „Simulation deterministisch …" weg (oder nur Standalone), „Plan der KI" auf eine Zeile kürzen bzw. als einblendbare Bauchbinde zu Spielbeginn, Bedienhinweise klein und nur bei Hover/leerem Zustand, Tabellen-Fußnoten einklappbar, „LEIST/EIG"-Spalten live ausblenden (im Endstand behalten). | A | alle | alle Bilder |
| 15 | **Kompaktes Sendungslayout:** Canvas + Bug + schmale Kaderleiste müssen in 900 px passen; Ticker und Tabelle daneben oder einklappbar. Heute 1100–1310 px je Disziplin. | A | alle | DOM-Tabelle 6.3 |
| 16 | **Sieger-Banner einheitlich formulieren:** überall „SIEGER — Stand in der Disziplin-Einheit" plus *ein* sprechender Zusatz („mit 16,6 s Vorsprung", „8 : 16 Ausschaltungen"), nie „0 : 1 NACH ZEITSUMME (7:02,2 MIN GEGEN 5:21,4 MIN)"; TDM zeigt heute gar keinen Stand im Banner. | A | alle | Bilder 02, 07 |
| 17 | **Rennen-Stand als Zeitabstand:** Time-Trial und Staffel zeigen im Bug den Zeitabstand (wie das Staffel-HUD „+7,7 s") statt „0 : 1"; Tennis/Fechten/Schach einen laufenden Zwischenstand (gewonnene Plätze/Bahnen *bisher* oder Vorteil-Summe), damit die große Zahl nicht das ganze Match auf 0 : 0 steht. | A | 5 | 3.1 |
| 18 | **Breaking-Wertungstabelle läuft über** (14 Spalten, Spalten überlagern sich, rechts abgeschnitten); Takeshi ebenso („STAN…"). Spalten live reduzieren. | A | Breaking, Takeshi | Bild 14; DOM-Tabelle 6.3 |

### Priorität 3 — Politur, die den Unterschied zu „fertig" macht

| # | Punkt | Klasse | Betrifft |
|---|---|---|---|
| 19 | **Regie-Kamera** (Zoom auf die Aktion, Fable B1) für Kampf, Basketball, Spurt — löst Knäuel und leere Flächen zugleich. | T (Zoom rein darstellend, aber Klick-Trefferflächen/Taktung prüfen) | 5 |
| 20 | **Anpfiff-Moment:** 3-2-1-Countdown oder Stinger beim Start, bei Tempo ≥ 2× übersprungen (Fable A3/A4). | T | alle |
| 21 | **Showcase und Fechten füllen:** Bühne/Performer größer, Jury/Top-3-Tafel lesbar; Fechten Hauptbahn größer und höher, Nebenbahnen mit lesbarem Trefferstand. | A | 2 |
| 22 | **Schrift:** Canvas-Namen und -Status in Barlow Condensed statt IBM Plex Mono (~118 Mono-Stellen im Canvas); Gewichte 800/900 werden gezeichnet, aber nur 500–700 geladen; Mikrotext unter ~9 px (Eis-Wiederholungstitel, „Draco auf Kurs für 68", Heben-Versuchskästchen) streichen oder vergrößern. | A | alle |
| 23 | **Wertungs-Akzent spürbarer** (Phase 6 ist korrekt, aber unsichtbar): Akzent auch am Score-Bug-Rand bzw. im Einlauf-Disziplinnamen, damit die Disziplin als „Sendungsfarbe" wirkt. | A | alle |
| 24 | **Versuchstafel Gewichtheben** ragt rechts aus dem Canvas („Nächster: Lava Golem, 247 kg" abgeschnitten). | A | Gewichtheben |
| 25 | **Helles Standalone-Theme** wirkt zweigeteilt (helle Chrome, dunkler Canvas, dunkler Endstand); im Eiskunstlauf fehlt dem Bug-Mittelkasten der Hintergrund. Nur Standalone — niedrig. | A | alle |
| 26 | **Spieler des Spiels / drei Sterne** im Endstand (heute: Tidesprinter mit 10 Ausschaltungen steht nirgends hervorgehoben, im Endstand sogar durchgestrichen, weil er beim Abpfiff am Boden lag). | A\* | alle |

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
| Staffel | ● | HUD mit Live-Delta, Bein-Zeile | Wechselzone-Etiketten, Stand „0 : 1" |
| Takeshi | ◐ | schönste Kulisse, Fallen-Schild | Banner-Flut, vier Stände, Pulk-Etiketten, Dezimalpunkt |
| Gewichtheben | ○ | Versuchstafel, Duell-Leiste | Ergebnis vorab verraten, Bug über Canvas-Stand, Uhr ×¼ |
| Showcase | ◐ | X-Wand, Top-3-Tafel | leere dunkle Bühne, winzige Figur, Mikrotext |
| Eiskunstlauf | ● | Referenz: Zwischenstand, Wiederholung, Kiss & Cry | Höhepunkte = Fehlerliste, „KAMPFBERICHT" |
| Breaking | ◐ | Peinigt/Erträgt-Karten, Folterbank-Skala | Dauerbanner, „im Rennen", Tabellenüberlauf, zwei Stände |
| Wettessen | ◐ | Kopf an Kopf, Tempo-Pfeile | zwei Uhren, zwei Stände, Bug über Titel, Highlights = Wiederholung |
| Speed-Schach | ◐ | Hauptbrett + Eval-Kurve + Nebenbretter | Bug/Callout über Brett-Titel, Stand lange 0 : 0 |
| I-Spy | ● | Zug-Uhr, Split-Tafel, Split-Screen | „0 aufgetreten", Namensüberlagerung |
| Tennis | ○ | Platz-Optik mit Mini-Plätzen | spricht Schach, Stand 0 : 0 bis zum Schluss |
| Fechten | ◐ | Regie mit Fokusbahn, FIE-Tafel | spricht Schach, Vorteil widerspricht Ergebnis, leere obere Hälfte |
| Basketball | ◐ | Parkett mit Publikum, Lauf-Grafik, Viertelpause | Knäuel, kein Endstand |
| Football | ○ | Down & Distance im Bug | Stand ≠ Ergebnis, kein Endstand, Viertel-Uhr 0:00 |
| Hockey | ◐ | sauberstes Feldbild, SOG/PP im Bug | kein Endstand, Uhr ×½, „Spielzüge" |

Drei ●, sechs ○/◐-Grenzfälle mit einem harten Fehler (Stand/Ergebnis/Vokabular). Die
Gesamtwertung entsteht genau daraus: eine Übertragung wird am schwächsten Bild gemessen, das
man an einem Spieltag sieht.

---

## 6. Messanhang

### 6.1 Ereignisdichte (Dichte-Sonde, Tempo 4×, hochgerechnet auf 1×)

PLATZHALTER_DICHTE

### 6.2 Bewegung bei Tempo 1×

PLATZHALTER_BEWEGUNG

### 6.3 DOM-Befunde

PLATZHALTER_DOM

---

## 7. Abgrenzung

* **Keine Wiederholung der Fable-Ideen** (`fable-ideen-broadcast-praesentation-30-09.md`):
  Regie-Kamera (B1), Stinger/Countdown (A3/A4), Spieler des Spiels (A5), Highlight-Titel (C3)
  tauchen hier nur als Antwort auf einen Befund auf. Dessen drei Randnotizen (Callout über
  Bahn-HUD, TDM-Höhepunkte, Eiskunstlauf-Wiederholungsbox) sind in 3.4 und Punkt 10
  aufgegangen bzw. in dieser Runde bestätigt.
* **Keine Mechanik:** Punkt 1 (Football) und Punkt 8 (Mini-DM live) sind die einzigen, bei
  denen eine Chris-Entscheidung nötig sein *kann*; alles andere liest nur vorhandenen Zustand.
* **Ton** wurde nicht bewertet.
