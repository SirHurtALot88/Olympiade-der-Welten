# Broadcast-Optik Feldspiel — NBA, NHL, NFL als Vorbild für Basketball, Hockey, Football (27.09.)

**Reine Recherche und Konzeptarbeit. Kein Code, keine Rezept- oder Konstantenänderung.** `engine.js`
meint `public/mockups/battle-mode.engine.js`, Stand `origin/main` `ebb3b99a` (27.09.). Football-
Zeilen, die mit **P1** markiert sind, beziehen sich auf den Draft-PR #1037
(`origin/football-p1-uhr-spielstand-26-09`, `09c88721`), der noch nicht auf `main` liegt.

Baut auf und wiederholt nicht:

* Runde 1 (`broadcast-praesentation-uebergreifend-recherche-06-09.md`): Score-Bug `#bbug`, Callout,
  `HIGHLIGHTS[]`, Captions; dort in 4.3 das Bild-Replay als „zu teuer" verworfen.
* Runde 2 (`broadcast-praesentation-runde-2-22-09.md`): acht Broadcast-Regeln (Abschnitt 2),
  Score-Bug-Vollausbau (Vorschlag 3, **noch nicht gebaut**: `aktualisiereBbug` `:12368` schreibt
  weiterhin nur `Score · Uhr`), Führung im Bild (Bandenlicht, Vorsprungsbalken).
* Die drei Konzeptreviews vom 26.09. (Basketball, Hockey, Football) und den UI-Bewegungs-Audit.

Die Frage dieser Runde ist enger als in Runde 2: **Welche Elemente echter NBA-, NHL- und
NFL-Übertragungen lassen sich im 2D-Motor bauen, und welche davon sind reine Anzeige?**

---

## 0. Fazit vorweg

Drei Klassen, streng getrennt, weil sie drei verschiedene Abnahmen brauchen:

* **A — nur Anzeige.** Liest den Zustand, schreibt nichts, ruft kein `rr()`. Abnahme:
  `miss-alle-disziplinen.mjs` vorher/nachher bit-identisch plus Sichtprüfung.
* **T — Anzeige mit Eingriff in den Wandzeit-Takt** (Zeitlupe, Wiederholung). Die Simulation
  läuft in festen Ticks (`loop`, `:31884`: `while(acc>=1/60) stepSim((1/60)/zf)`); geändert wird
  nur, **wie viele Ticks je gezeichnetem Frame** laufen. Die Tick-Folge und damit jedes `rr()`
  bleiben gleich. Abnahme: wie A, dazu ein Determinismus-Beleg im **Live-Modus** (Endstand
  und Boxscore mit erzwungener Zeitlupe bei jedem Wurf = ohne; Abschnitt 1.3).
* **W — berührt Wertung oder Mechanik.** Die Anzeige hätte heute nichts Wahres zu zeigen, weil
  der Zustand, den sie zeigen soll, erst von einem Mechanik-PR geschaffen wird. Gehört in den
  jeweiligen Konzeptreview-Bauplan, nicht in eine Broadcast-Runde.

| # | Vorschlag | Disziplin | Klasse | Prio | Aufwand |
|---|---|---|---|---|---|
| Q1 | **Bug-Kontextzeile Feldspiel**: Periode + Restzeit abwärts, Ballbesitz, Führende in Teamfarbe (Runde-2-Vorschlag 3, hier für die drei Feldspiele ausformuliert) | alle drei | A | **1** | klein |
| B1 | **Shot-Clock** im Bug und als Ziffer am Angriffskorb | Basketball | A | **1** | klein |
| B2 | **„Lauf"-Grafik** („10:0-Lauf Heim") | Basketball | A | **2** | klein |
| B3 | **Live-Zeitlupe beim Dunk** (Treffer steht beim Abwurf fest) | Basketball | T | **2** | klein |
| B4 | **Lower Third mit Porträt + Statline** (Freiwurf, heißer Schütze, Viertelpause) | Basketball | A | **3** | klein–mittel |
| B5 | **Wiederholung in der Viertelpause** („Play des Viertels") aus einem Bildpuffer | Basketball, Hockey | T | 4 | mittel |
| B6 | Team-Fouls / Bonus | Basketball | **W** (erst nach Review-P1b) | — | — |
| H1 | **Power-Play-Uhr** im Bug, auf dem Eis, Strafbank-Kasten, (PP)/(SH) im Ticker (= Review-T0) | Hockey | A | **1** | klein |
| H2 | **Schüsse aufs Tor** (SOG) im Bug, Fangquote im Endstand | Hockey | A | **1** | klein |
| H3 | **Torlicht + Tor-Zeitlupe** | Hockey | A + T | **2** | klein |
| H4 | **„Torwart raus"-Kennung** (T1 ist gemergt, sichtbar ist es kaum) | Hockey | A | **2** | klein |
| H5 | Puck-Schweif beim Schlagschuss (FoxTrax-Zitat), **ohne** km/h-Zahl | Hockey | A | 3 | klein |
| F1 | **Down & Distance nachschärfen** (P1 hat Band, blaue LOS, gelbe Linie): 3rd/4th-Down-Farbe, „FIRST DOWN"-Blitz, Ballbesitz im Bug | Football | A | **1** | klein |
| F2 | **Red-Zone-Grafik** (Feldfläche innerhalb der 20 getönt, Tag im Band, Red-Zone-Quote im Endstand) | Football | A | **1** | klein |
| F3 | **Telestrator-Wiederholung**: Ballweg als Pfeil, Standbild aus den gespeicherten Formationsplätzen | Football | A (3a) / T (3b) | **2** | klein / mittel |
| F4 | Drive-Summary als Lower Third | Football | A | 3 | klein |
| F5 | „Red Zone"-Slotspieler hervorheben, Play Clock, Timeouts | Football | **W** | — | — |

**Top-Reihenfolge über alle drei:** Q1 → H1+H2 → F1+F2 (mit oder direkt nach #1037) → B1 → B2 →
H3/B3 (gemeinsame Zeitlupen-Infrastruktur) → F3a → H4 → B4 → F3b → B5.

---

## 1. Ausgangslage — was heute zu sehen ist

### 1.1 Alle drei

* **Score-Bug** `#bbug` oben Mitte: Teamname links/rechts, Mitte `Score · Uhr`. Die Uhr ist
  `fsT` **aufwärts** als Gesamtzeit (`updateHudFeldspiel`, `:12394`), also „4:17" statt „Q3 0:47".
  Kein Periodenkennzeichen, kein Ballbesitz, keine Teamfarbe an der Ziffer.
* **Viertel-/Drittelpause**: Overlay mit Buzzer, sichtbar nach Wandzeit (`vpSichtbarBis`,
  `jetztMs()`), während die Simulationspause kürzer ist (`:6066`, `:12441`). Das ist der
  bestehende Präzedenzfall für „Anzeige in Wandzeit, Simulation in Ticks".
* **Highlights**: `feed(side,txt,big)`; Basketball ist seit Runde 2 teilweise nachgeschärft
  (`:11343`: big nur bei Spielzug, Dunk, Dreier oder Führungswechsel), Hockey (Tor) und Football
  (TD, FG, Sack, Turnover) waren schon richtig dosiert.
* **Porträts**: `portraet(p)` (`:21530`) lädt `/portraits/<kennung>.jpg` mit Kürzel-Rückfall —
  heute nur in der Aufstellung benutzt. `public/portraits/` enthält inzwischen ~3000 Dateien
  (der Kommentar „kein einziges Bild" an der Funktion ist veraltet).
* **Kein Bild-Replay** (`renderHighlights`, `:33267`, ausdrücklich), keine Zeitlupe.

### 1.2 Je Disziplin

| | Basketball | Hockey | Football |
|---|---|---|---|
| Live? (`ARENA_RESOLVED_DISCIPLINE_IDS`) | ja | ja | nein (Produktivschaltung offen) |
| Perioden × Dauer (Sim-s) | 4 × 90, `ZEIT_DEHNUNG` 1 | 3 × 80, `ZEIT_DEHNUNG` 2 | 4 × 70 |
| Uhr-Zustand | `fsLive.angriffSeit` gegen `schussuhr:8` (`:6070`, `:12216`) | Schussuhr 8 s (künstlich, Review T5), `strafeBis` je Spieler, `feldStaerke()` | P1: NFL-Uhr über `fkUhrSkala()`, `fkPeriodenGrenze()` |
| Im Feld gezeichnet | Parkett, Zone, Dreierlinie, Korb, Zuschauer; Team-Ring je Figur, Bewegungsschweif | Eisfläche, Bande; Strafbank-Fahrt (`strafbankZiel`, `:8201`) | Rasen, 10er-Linien, Endzonen; **P1**: blaue LOS, gelbe First-Down-Linie, Band unten `Q2 1:47 · ▶ 3rd & 8 · gegn. 34 · Drive 6 Züge, 41 Yds · TWO-MINUTE DRILL` (`zeichneFootballLage`, P1-Branch `:9878`) |
| Was fehlt, verglichen mit TV | Shot Clock, Periode, Lauf-Grafik, Spielerkarte | PP-Uhr, SOG, Torlicht, „Empty Net" | Red Zone, 3rd-Down-Hervorhebung, Wiederholung, Drive-Summary |

### 1.3 Warum Zeitlupe und Wiederholung hier billiger sind, als Runde 1 annahm

Runde 1 (4.3) verwarf das Replay, weil „Zurückspulen" einen Zustands-Schnappschuss je Tick oder
eine zweite Simulation bräuchte. Für die drei Feldspiele gibt es zwei günstigere Wege, die beide
**keinen Simulationszustand** anfassen:

1. **Der Ausgang steht vor der Animation fest.** `wirf()` würfelt `treffer` beim Abwurf und legt
   die Flugdauer fest (0,45–0,55 s, `:10478–10488`); Hockey bestimmt `hk.ausgang` (Tor, gehalten,
   geblockt) im selben Aufruf. Football löst den Snap auf und animiert danach den Ball als
   **reine Funktion von `phase`** aus `s.losX`, `zielX`, `erg` (`animiereFootballZug`, `:9140 ff.`).
   Eine Zeitlupe kann deshalb **live** laufen: Man weiß beim Abwurf, dass es ein verwandelter Dunk
   ist, und verlangsamt nur die Wandzeit des Flugs. Ein Football-Spielzug lässt sich aus einem
   gespeicherten Snap-Objekt erneut animieren, ohne eine Zeile Simulation.
2. **Ein Bildpuffer statt eines Sim-Schnappschusses.** Für eine echte Wiederholung mit Figuren
   reicht es, je **gezeichnetem** Frame festzuhalten, was `zeichneFeldspiel` liest: zwölf
   Figuren mit `x, y, _zvx, _zvy, hop`, Animationszustand und Blickrichtung, dazu `fsBall` und
   die Schwebetexte. Das sind ~1 KB je Frame, für 4 s bei 60 fps ~240 KB. Geschrieben wird im
   Zeichenpfad, nie in `stepSim`.

**Takt-Eingriff, genau benannt.** Zeitlupe heißt: `acc+=dt*speed*anzeigeTakt()` in `loop`, wobei
`anzeigeTakt()` für die Dauer des Flugs 0,35 liefert. Wiederholung heißt: Solange sie läuft,
überspringt `loop` die `stepSim`-Schleife und zeichnet aus dem Puffer. In beiden Fällen läuft
danach **dieselbe** Tick-Folge weiter. Die Sonden laufen ohnehin nicht über `loop`
(`sondenLauf`, `:35341 ff.`). Für Zeitmessungen gilt `jetztMs()`, nicht `performance.now()`.

**Pflichtbeleg vor dem Merge (Klasse T):** (a) `miss-alle-disziplinen.mjs 24 basketball hockey`
bit-identisch; (b) im Standalone-Mockup mit fester Saat ein volles Spiel zweimal — einmal
normal, einmal mit **erzwungener** Zeitlupe bei jedem Wurf und einer Wiederholung nach jedem
Korb — Endstand, Boxscore und `HIGHLIGHTS` müssen identisch sein. Scheitert (b), liest irgendein
Pfad die Wanduhr, und genau das wäre der Fund.

**Dosis.** Runde-2-Regel 8: „Eine Übertragung zeigt fünf Wiederholungen pro Spiel, nicht
hundert." Jede Zeitlupe verlängert das Spiel in Wandzeit. Deckel: höchstens eine Zeitlupe je
20 s Spielzeit und höchstens 6 je Spiel; Wiederholungen nur in toten Phasen (Periodenpause, nach
TD) oder für die 2–4 größten Momente. Beides ist über die Tempo-Taste (`speed`) ohnehin
beschleunigt und sollte beim Tempo 4× entfallen.

---

## 2. Recherche — was die drei Ligen im Fernsehen zeigen

Die Konventionen, die Runde 2 schon nennt (Score-Bug-Persistenz, gelbe Linie als „Grafik im
Spielraum", Lower Third beim Akteur), werden hier nur ergänzt.

### 2.1 NBA

* **Score-Bug**: Score und Spieluhr sind „heilig", darum herum eine zweite Ebene. Basketball-Bugs
  führen neben der Spieluhr die **Shot Clock** getrennt, die **Teamfouls** je Team und die
  **Bonus**-Kennung (NBA: ab dem fünften Teamfoul eines Viertels zwei Freiwürfe); NBC nennt die
  zweite Ebene seines neuen NBA-Pakets „game assist" (Rekorde, Quick-Stats) [SVG 2026]. Kritik an
  realen Bugs: winzige Bonus-/Timeout-Kennungen, die auf dem Handy unlesbar sind [Buggy Awards].
* **Uhr läuft abwärts je Viertel** („Q3 7:42"), nie als Gesamtzeit aufwärts.
* **Lower Third / Spielerkarte**: Kopfbild, Name, heutige Statline (PTS/REB/AST, Wurfquote), wenn
  der Spieler in den Fokus kommt — beim Einwechseln, an der Freiwurflinie, nach einem Lauf.
* **„Run"-Grafik**: „12-0 RUN" als Band, wenn eine Seite viele Punkte in Folge macht — einer der
  häufigsten NBA-Einblender, weil er Momentum ohne Tabelle erzählt.
* **Wiederholung**: Dunks, Blocks und Buzzer-Beater laufen in der nächsten Unterbrechung in
  Zeitlupe, oft aus einer zweiten Perspektive. Live wird selten verlangsamt.

### 2.2 NHL

* **Power-Play-Uhr**: im Bug als Band in der Farbe der Überzahl-Mannschaft mit ablaufender
  Strafzeit; seit 2023 zusätzlich als **virtuelle Grafik auf dem Eis** („Power Play Clock"), neben
  der **Virtual Shot Speed** über dem Tor bei Schüssen über 85 mph, beides automatisch aus Uhr-
  und Tracking-Daten ausgelöst [SMT NHL].
* **Schüsse aufs Tor (SOG)** sind der traditionelle Zusatz im Hockey-Bug; ESPN nutzt die Fläche
  rechts vom Bug für SOG, Paraden, Eiszeit [SMT ESPN, keepthescore].
* **Torlicht**: die rote Lampe hinter dem Tor ist das Tor-Signal der Halle und wird in jeder
  Übertragung mitgezeigt.
* **FoxTrax** (Fox, 1996–1998): der Puck bekam einen blauen Schweif, ab 70 mph rot — als
  Lesbarkeitshilfe gelobt, von Puristen als Spielerei verrissen [Wikipedia FoxTrax]. Lehre:
  **Schweif ja, dauernde Aufdringlichkeit nein.**
* **„Empty Net"**: beim gezogenen Torwart zeigt der Bug die Kennung, der Kommentar zählt die Uhr.

### 2.3 NFL

* **1st & Ten**: die gelbe First-Down-Linie, 1998 von Sportvision bei ESPN eingeführt
  (Ravens–Bengals, 27.09.1998), heute Standard in jeder Football-Übertragung, ergänzt um die blaue
  Line of Scrimmage [SI 2013, Wikipedia 1st & Ten]. Wichtig am Original: die Linie liegt **unter**
  den Spielern (gekeyed), nicht darüber.
* **Down & Distance** steht im Bug (heute meist eine Leiste am unteren Bildrand) neben Viertel,
  Uhr, Play Clock, Timeouts und Ballbesitz. Bei 3rd/4th Down und „& Goal" wird die Kennung
  farblich hervorgehoben; beim Erreichen der Marke blendet „1ST DOWN" auf.
* **Red Zone**: innerhalb der gegnerischen 20 markieren die Sender den Drive als „Red Zone"; die
  Red-Zone-Quote (TD je Besuch) ist eine Standard-Statistik. „NFL RedZone" heißt sogar ein ganzer
  Kanal danach.
* **Telestrator** (John Madden): Standbild + gezeichnete Pfeile für Laufwege und Blocks.
  Die moderne Fortsetzung ist **Prime Vision mit Next Gen Stats**: Routen live nachgezeichnet,
  Pre-Snap-Spieler-IDs, „offener Receiver" markiert, Ballträger-Tempo [Amazon/Hashtag Sports].
* **Drive-Summary**: „9 PLAYS · 62 YDS · 4:12" nach dem Drive.

---

## 3. Querschnitt Q1 — die Bug-Kontextzeile für alle drei Feldspiele (Klasse A, Prio 1)

Runde 2 hat den Score-Bug-Vollausbau vorgeschlagen; er ist nicht gebaut. Für die Feldspiele ist er
der Träger fast aller Vorschläge unten, deshalb hier konkret:

| | Kontextzeile unter `Score · Uhr` | Quelle im Zustand |
|---|---|---|
| Basketball | `Q3 · 0:47 · ⏱ 6 · ● Heim` | `fsLive.viertel`, `fsT` gegen Viertelgrenze, `schussuhr − angriffSeit`, Ballträger-Seite |
| Hockey | `2. Drittel · 1:12 · PP Gast 0:05 · SOG 14:11` | wie oben, `strafeBis`, `feldStaerke()`, H2 |
| Football | `Q2 · 1:47 · ▶ 3rd & 8` (Kurzfassung; das P1-Band unten bleibt die Langfassung) | P1: `fb.down`, `fb.toGo`, `fkUhrSkala()` |

Dazu wie in Runde 2: Score-Ziffer der führenden Seite in `--home`/`--away`, Führungswechsel-Blitz
(`#bbugMitte.wechsel`, 0,6 s). Die Uhr wird **abwärts je Periode** gezeigt — das ist die eine
Konvention, die alle drei Ligen teilen und die der Motor heute als einzige verletzt.

**Uhr-Skala, eine Entscheidung für Chris (Frage 9.1).** Football P1 rechnet auf NFL-Minuten hoch
(`fkUhrSkala`). Für Basketball wäre das 90 s → 12:00 (Faktor 8), dann müsste die Shot Clock
konsequent 8 s → 64 „NBA-Sekunden" zeigen — offensichtlich falsch gegen 24. Vorschlag: Basketball
und Hockey zeigen **Sim-Sekunden** (ehrlich, Shot Clock und Spieluhr im selben Maß), Football
bleibt bei der NFL-Uhr, weil dort keine zweite Uhr daneben steht.

---

## 4. Basketball

### B1 — Shot-Clock (A, Prio 1)

**Bild.** (a) Im Bug: `⏱ 6` in der Kontextzeile, die letzten 3 s rot mit Zehnteln (`2.4`), wie
Hallen-Shot-Clocks unter 5 s. (b) Im Feld: eine kleine Ziffernbox hinter dem **Angriffskorb**
(Top-Down-Ansicht: an der Grundlinie neben dem Korbträger, `korbXVon(seite)`), weil dort die echte
Shot Clock auf der Korbanlage sitzt — der Blick muss nicht nach oben.

**Zustand.** `(LIVE().schussuhr||SCHUSSUHR_BASKETBALL) − fsLive.angriffSeit`, ausgeblendet bei
Freiwurf, Viertelpause und `done`. Kein `rr()`, kein Schreiben.

**Ehrliche Einordnung.** Ein Ballbesitz dauert im Mittel 3,6 s, Zwangswürfe kommen < 0,1-mal je
Spiel vor (Basketball-Review 0.3). Die Uhr wird also fast nie rot. Sie lohnt sich trotzdem: Sie
macht das Tempo sichtbar, erklärt, warum der Motor so schnell wirft, und ist die Voraussetzung,
damit ein späteres Endspiel (Review-P5: letzter Angriff, 2-für-1) überhaupt lesbar wird.

### B2 — „Lauf"-Grafik (A, Prio 2)

**Bild.** Band unter dem Bug: `10:0-LAUF HEIM`, sobald eine Seite ≥ 8 Punkte ohne Gegenpunkte
erzielt; bleibt stehen, bis der Gegner punktet, dann einmal `Lauf beendet — 12:0`. Im Ticker ein
`feed(...,true)` bei Erreichen der Schwelle — das ist ein echter Moment und speist Runde-2-
Vorschlag 1 (seltene Highlights) mit.

**Zustand.** Aus dem Protokoll `fsZuege[0..fsZeiger]` (Punkte je Seite in Folge). Reine Lesung.
Schwelle nach Messung festlegen: bei ~85 Punkten in 6 Minuten sind 8:0 vermutlich 2–4-mal je Spiel.

### B3 — Live-Zeitlupe beim Dunk (T, Prio 2)

**Auslöser.** In `wirf()` steht `treffer` fest, bevor der Ball fliegt. Zeitlupe bei
`treffer && tier==="dunk"` **und** (Führungswechsel oder letzte 30 s eines Viertels oder
Alley-Oop); sonst nicht — die Dunk-Quote liegt bei 90,8 %, ohne Zusatzbedingung wäre jeder
zehnte Angriff eine Zeitlupe.

**Bild.** Takt 0,35 für die Flugdauer (0,45 s Sim → ~1,3 s Wandzeit), leichte Vignette, Korb
wackelt beim Treffer (ob sich eine vorhandene Wackel-Routine des Motors wiederverwenden lässt,
ist beim Bau nachzusehen), `ZEITLUPE`-Kennung klein in der Ecke.

**Warum live statt Wiederholung.** Keine Pause, kein Puffer, eine Zeile in `loop`. Die TV-
Konvention ist zwar die Wiederholung; die Live-Zeitlupe ist die 2D-gerechte Übersetzung, weil
das Bild keinen Kamerawechsel hat, der eine Wiederholung als solche kennzeichnen würde.

### B4 — Lower Third mit Porträt und Statline (A, Prio 3)

**Einwechslungen gibt es nicht** (sechs gegen sechs, keine Bank). Der TV-Anlass „Spieler kommt
ins Spiel" fällt weg; die übrigen Anlässe tragen:

1. **Freiwurflinie** (`starteFreiwuerfe`, `:10610`) — heute selten (1,9 Fouls je Spiel), wird mit
   Review-P1b häufiger.
2. **Heißer Schütze**: dritter Korb in Folge desselben Spielers oder 10./20. Punkt.
3. **Viertelpause**: die beiden Topscorer je Team im Pausen-Overlay.
4. **Fokus-Doppeln-Ziel**, wenn der Manager es setzt — erklärt, warum zwei auf einen gehen.

**Inhalt.** `portraet(p)` (vorhanden, mit Kürzel-Rückfall), Name, Slot-Rolle, heutige Statline
(Punkte, Rebounds, Assists, Würfe) aus denselben Feldern wie die Wertungstabelle. HTML-Overlay
unten links, 3 s, höchstens eine Karte je 15 s.

### B5 — Wiederholung in der Viertelpause (T, Prio 4)

Aus dem Bildpuffer (1.3) das **größte Highlight des Viertels** (Führungswechsel > Dunk > Dreier)
in 0,5× wiederholen, während das Pausen-Overlay steht; dasselbe für Hockey in der Drittelpause.
Die tote Zeit ist die TV-Stelle für Wiederholungen. Aufwand mittel, weil `zeichneFeldspiel` heute
direkt aus `FSTEAM`/`fsBall` liest und eine Lesequelle „Puffer" braucht. Erst nach B3, weil B3
die Takt-Infrastruktur und den Determinismus-Beleg schafft.

### B6 — Team-Fouls und Bonus (W, nicht jetzt)

Die NBA-Kennung würde heute **0–1 Fouls je Team und Spiel** zeigen und nie „BONUS". Der Bonus ist
eine Regel (Freiwürfe ab dem fünften Teamfoul) und damit Wertung. Beides gehört in Review-P1b
(Foul-System mit Reach-in, Teamfouls, Bonus, Foul Trouble). Die Anzeige kommt im selben PR mit —
dann kostet sie eine Zeile in Q1.

---

## 5. Hockey

### H1 — Power-Play-Uhr (A, Prio 1; = Review-T0)

**Bild, drei Stellen.** (a) Bug-Kontextzeile: Band in der Farbe der Überzahl-Mannschaft
`PP GAST 0:05`, bei zwei Strafen `5 gegen 3`. (b) **Auf dem Eis**, SMT-Vorbild: in der Angriffszone
der Überzahl eine halbtransparente, unter den Figuren gezeichnete Kreisuhr (ablaufender Ring +
Restsekunden), gezeichnet in `eisflaeche()` nach der Fläche und vor den Spielern. (c) Strafbank-
Kasten an `strafbankZiel()` mit Name, Grund und Restbalken. Ticker: Überzahltor `(PP)`,
Unterzahltor `(SH)`; im Endstand `PP 1/3` und `SH-Tore`.

**Zustand.** `max(u.strafeBis) − fsT` je Seite, `feldStaerke()`. Kein `rr()`.

**Warum zuerst.** Das Review misst, dass Überzahl heute kaum ein Vorteil ist (0,194 zu 0,196
Versuche/s). Genau deshalb braucht es die Anzeige vor Review-T2 (Special Teams): Sonst sieht
niemand, ob T2 wirkt. Die Uhr zeigt die Strafzeit in derselben Skala wie Q1 (Frage 9.1).

### H2 — Schüsse aufs Tor (A, Prio 1)

**Bild.** `SOG 14:11` in der Kontextzeile; im Endstand je Torwart Paraden/Gegentore/Fangquote
(die Spalten existieren, `:28313–28316`).

**Zustand — eine Falle.** Die naheliegende Summe `saves + gegentore` des gegnerischen Torwarts
zählt Schüsse aufs **leere** Tor nicht (Review-T1: Gegentore ins leere Tor dürfen nicht in
`u.gegentore`). Deshalb aus dem Protokoll zählen (Schüsse mit Ausgang Tor oder gehalten, je Seite),
nicht aus den Torwartfeldern. Welche `logZug`-Typen das sind, ist beim Bau nachzusehen.

**Erwartung.** Der Korridor liegt bei 37,8 Schüssen aufs Tor — der Zähler läuft schnell; das
ist gewollt, er erzählt Druck.

### H3 — Torlicht und Tor-Zeitlupe (A + T, Prio 2)

* **Torlicht (A):** rote Lampe hinter dem getroffenen Tor, 1,5 s pulsierend, plus Bandenblitz in
  Teamfarbe des Schützen. Liest den Tor-Zeitpunkt, den `feed(..., big, caption)` ohnehin setzt.
* **Zeitlupe (T):** `hk.ausgang==="tor"` steht beim Abwurf fest; Takt 0,35 für den Flug — aber
  nur bei Führungswechsel, Ausgleich oder in den letzten 30 s. Bei 9 Toren je Spiel wären es sonst
  zu viele. Dieselbe Infrastruktur wie B3.

### H4 — „Torwart raus" sichtbar machen (A, Prio 2)

T1 ist gemergt (`254a56c5`), `hockeyEndphaseSeite()` liefert die zurückliegende Seite. Sichtbar ist
heute nur, dass eine Figur zur Bank fährt. **Bild:** Kennung `TORWART RAUS` in der Kontextzeile in
Teamfarbe, das leere Tor mit einem pulsierenden Torraum-Rand, im Ticker einmal
`… nimmt den Torwart raus` als big. Das ist der dramatischste Moment, den Hockey jetzt hat, und er
läuft heute stumm.

### H5 — Puck-Schweif beim Schlagschuss (A, Prio 3)

FoxTrax-Zitat, sparsam: nur beim Schlagschuss (`schuetze.schussArt==="schlag"`) ein kurzer
Schweif, blau, bei `tier==="fern"` rot. **Keine km/h-Zahl.** Die Flugdauer ist eine Konstante
(0,45 s, gekürzt nur bei Block); eine Geschwindigkeit ließe sich nur aus der Distanz errechnen und
hinge an keinem Attribut — eine erfundene Zahl, die nach Leistung aussieht. Erst wenn die
Schusshärte mechanisch an Werte gebunden wäre (Klasse W), darf die Zahl kommen.

### Ausdrücklich nicht

* **Die Hockey-Schussuhr anzeigen.** Sie ist keine Eishockeyregel, sondern eine Tempo-Garantie
  (Review, Abschnitt 0.1 und T5). Sie sichtbar zu machen, hieße ein Kunstmittel auszustellen.
* **Momentum-Balken als Mechanik.** Als reine Anzeige aus den Schussanteilen der letzten 60 s
  ist er nach dem Review zulässig, aber hinter H1–H4.

---

## 6. Football

Football ist noch nicht live. Die Vorschläge setzen auf #1037 auf und können **im selben PR oder
direkt danach** kommen, weil `zeichneFootballLage` der Ort ist.

### F1 — Down & Distance nachschärfen (A, Prio 1)

Was P1 schon richtig macht: blaue LOS, gelbe Linie, **beide unter den Figuren** (in
`bodenFeldspiel` gezeichnet — wie das Sportvision-Original), Band mit Viertel, NFL-Uhr, Down &
Distanz, Feldposition, Drive, Tempo-Lage.

Nachschärfen:

1. **3rd/4th Down hervorheben**: das `3rd & 8`-Feld im Band orange, `4th` rot — die TV-Regel
   „die kritische Situation ist farbig". Heute ist nur die Lage-Kennung (Two-Minute) gelb.
2. **„FIRST DOWN"-Blitz** an der gelben Linie, wenn ein Spielzug die Marke überschreitet
   (`footballDownWeiter` setzt `down=1`): 1 s Text auf dem Feld, Linie springt sichtbar zur neuen
   Marke statt einfach umzuspringen (0,3 s Überblendung).
3. **Ballbesitz im Bug** (Q1): kleines Football-Symbol an der Seite im Ballbesitz. Das `▶/◀` im
   Band bleibt.
4. **Band-Länge**: vier bis fünf Teile mit `·` werden auf schmalen Bildschirmen zu lang (16 px
   Schrift, zentriert). Vorschlag: Drive-Teil nur zwischen den Snaps zeigen, während des Zugs
   nur `Q2 1:47 · 3rd & 8 · gegn. 34`.

### F2 — Red-Zone-Grafik (A, Prio 1)

**Bild.** Bei `fb.spot ≤ 20`: die Fläche zwischen gegnerischer 20 und Torlinie leicht rot getönt
(unter den Figuren, 10–12 % Deckkraft), Band-Tag `RED ZONE`, bei `toGo ≥ spot` wie in P1
`& Goal`. Einmal je Drive `feed(side,"… in der Red Zone")` (nicht big). Im Endstand je Team
**Red Zone: TD/Besuche**.

**Zustand.** `fb.spot`, `fkLosX()` für die Fläche; der Zähler „Besuche" ist ein Anzeige-Zähler,
der bei Eintritt in die Zone je Drive einmal hochzählt (im Zeichen- oder Protokollpfad, nicht in
`stepSim`).

**Nicht dazu (W, s. F5):** den Spieler auf dem Slot „Red Zone" als Anspielziel markieren. Der
Slot hat keine Spielzugfunktion (Review 0.3) — die Grafik würde eine Funktion behaupten, die der
Motor nicht hat.

### F3 — Telestrator-Wiederholung (3a: A, Prio 2 · 3b: T, Prio 3)

**Der günstige Fall im ganzen Feld.** Der Ballweg ist eine reine Funktion des Snap-Objekts
(`animiereFootballZug`), die Formationsplätze liegen in `fsLive.snap.plaetze`. Ein Telestrator
braucht also nur eine **Kopie des letzten Snaps** `{losX, zumFeld, plaetze, spielTyp, erg,
spot, puntNetto}`.

* **3a — Pfeil stehen lassen (A).** Nach TD, Interception, Fumble, Sack auf 3rd Down oder
  Raumgewinn ≥ 15 Yards bleibt der Ballweg als Telestrator-Pfeil (gestrichelt, Pfeilspitze, gelb
  bzw. weiß) über Nachlauf und Formationsphase des nächsten Snaps stehen: vom Passer über die
  Flugbahn zum Fangpunkt, beim Lauf die Laufspur. Am Ende Name + `+23 Yds`. Keine Pause, keine
  Uhr-Wirkung.
* **3b — Standbild-Wiederholung (T).** Nur nach TD und Turnover (2–5 je Spiel): Simulation hält
  in Wandzeit an (die Extrapunkt- bzw. Ballwechsel-Pause ist die natürliche Stelle), das Feld
  zeigt die Figuren auf ihren Formationsplätzen, der Ball fliegt in 0,5× erneut, der Pfeil wird
  **mitgezeichnet** (Madden-Stil: Linie wächst mit dem Ball). Dauer ~2,5 s. Kennung
  `WIEDERHOLUNG` oben links. Kein Bildpuffer nötig, weil die Ausgangsaufstellung gespeichert ist.

**Ehrlich zu „Route".** Prime Vision zeichnet echte, gelaufene Routen. Der Motor simuliert keine
Routen; die Receiver bewegen sich während des Zugs „rein optisch" (`fkEngageZiel`, Review 0.1).
Der Pfeil zeigt deshalb den **Ballweg** und den Fangpunkt. Ein stilisierter Laufweg vom
Formationsplatz des Receivers zum Fangpunkt ist zulässig, solange er nicht als Routenwahl
beschriftet wird. Echte Routenbäume setzen Review-P3 voraus.

**Voraussetzung (Review-P3, Punkt 3).** Heute kann der gezogene Passer auf dem Receiver-Platz
stehen, während der Ball aus der Mitte fliegt (Review 0.2). Eine Wiederholung stellt genau das
aus. 3b deshalb erst, wenn „das Bild folgt dem Los" gebaut ist; 3a geht sofort, weil der Pfeil an
`losX` beginnt.

### F4 — Drive-Summary (A, Prio 3)

Nach Drive-Ende ein Lower Third: `DRIVE · 9 Spielzüge · 62 Yds · 3:12 · TOUCHDOWN` (bzw. Punt,
Field Goal, Turnover). P1 führt `driveZuege` und `driveStart` schon; die Drive-Zeit ist die
Differenz der NFL-Uhr zwischen Serienbeginn und -ende. Dazu optional ein **Drive-Chart** als
schmale Leiste über dem Band: ein Strich je Spielzug, Länge = Yards.

### F5 — Was Wertung berührt oder im Motor nicht existiert (W)

* **Red-Zone-Slotspieler hervorheben**: setzt eine Slot-Funktion voraus (Review-P3/Frage 7.3).
* **Play Clock (40 s)**: die Formationsphase ist fest 0,9 s; eine Play Clock hätte nichts zu zählen.
* **Timeouts**: gibt es nicht; eine leere Kennung wäre Kulisse.
* **„Offener Receiver" (Prime Vision)**: es gibt keine Deckungsabstände je Receiver, der Pass ist
  ein Duell zweier gelosten Spieler (Review 0.1). Erst mit Review-P3 (Rusher und Decker getrennt).

---

## 7. Abnahme je Klasse

| Klasse | Pflicht | Wer |
|---|---|---|
| A | `node scripts/miss-alle-disziplinen.mjs 24 <diszi>` vorher/nachher auf drei Stellen gleich; Screenshot über `scripts/screenshot-disziplin.mjs` (Standalone-Mockup, nicht `/dev-arena`, s. Runde 2 1.3) | jeder PR |
| T | wie A, **plus** Determinismus-Beleg im Live-Modus (1.3 b); Zeitlupen- und Wiederholungszähler je Spiel ≤ Deckel; bei Tempo 4× aus | B3, B5, H3, F3b |
| W | gehört in den Mechanik-PR des jeweiligen Reviews mit voller Abnahme (rho, Pp, Korridor) | B6, F5 |

Pp-Abweichung ist für A und T per Konstruktion unverändert (kein Kanal wird gelesen, der in `wert()`
eingeht). Das gehört trotzdem einmal gemessen, wenn T gebaut wird, weil T der erste
Präsentationseingriff ist, der den `loop`-Takt anfasst.

---

## 8. Empfohlene PR-Schnitte

1. **Q1 + B1 + H1 + H2** — ein Bug-PR, alles Klasse A, alle drei Feldspiele (Football bekommt nur
   die Kurzfassung, solange #1037 offen ist).
2. **F1 + F2 + F3a** — auf #1037 aufgesetzt oder als Nachzug.
3. **B2 + H4 + H3-Torlicht** — Momente ohne Takt-Eingriff.
4. **Takt-Infrastruktur + B3 + H3-Zeitlupe** — ein PR, weil der Determinismus-Beleg einmal geführt
   wird.
5. **B4** (Lower Third mit Porträt).
6. **F3b** (nach Review-P3 Schritt 3), **B5** (Bildpuffer).

---

## 9. Offene Fragen an Chris — mit Voreinstellung

1. **Uhr in Sim-Sekunden oder hochgerechnet?** Voreinstellung: Basketball/Hockey Sim-Sekunden
   (Shot Clock und Spieluhr im selben Maß), Football NFL-Uhr wie in P1.
2. **Zeitlupe live oder nur als Wiederholung?** Voreinstellung: live beim Dunk/entscheidenden Tor
   (B3/H3), Wiederholung nur in toten Phasen (F3b, B5).
3. **Wie viele Zeitlupen je Spiel?** Voreinstellung: höchstens 6, bei Tempo 4× keine.
4. **Porträt-Karte: auch für Gegner?** Voreinstellung: ja, Topscorer beider Teams — die TV-Regel
   ist neutral.

---

## Quellen

Im Repo:

* `public/mockups/battle-mode.engine.js` (`origin/main` `ebb3b99a`): `aktualisiereBbug` `:12368`,
  `updateHudFeldspiel` `:12394`, `bodenFeldspiel` `:12587`, `zeichneFeldspiel` `:12843`, `wirf`
  `:10403` (Treffer beim Abwurf, Flugdauer `:10478`), `loeseFlugAuf` `:11271`, `starteFreiwuerfe`
  `:10610`, `strafbankZiel` `:8201`, `verhaengeStrafe` `:8253`, `hockeyEndphaseSeite` (T1),
  `animiereFootballZug` `:9140 ff.`, `portraet` `:21530`, `loop` `:31880 ff.`, `ZEIT_DEHNUNG`
  `:31804`, `jetztMs` `:22586`, `renderHighlights` `:33272`.
* P1-Branch `origin/football-p1-uhr-spielstand-26-09` (`09c88721`): `zeichneFootballLage` `:9878`.
* `docs/design/basketball-opus-konzeptreview-26-09.md`, `hockey-opus-konzeptreview-26-09.md`,
  `football-opus-konzeptreview-26-09.md` (Branch `football-konzeptreview-26-09`),
  `ui-bewegungs-audit-26-09.md`, `broadcast-praesentation-runde-2-22-09.md`,
  `broadcast-praesentation-uebergreifend-recherche-06-09.md`.

Extern (abgerufen 27.09.2026):

* [SI: The story behind football's yellow first down line (2013)](https://www.si.com/nfl/2013/07/18/nfl-birth-yellow-line)
* [Wikipedia: 1st & Ten (graphics system)](https://en.wikipedia.org/wiki/1st_%26_Ten_(graphics_system))
* [SI: Behind the NFL's yellow first down line (2015)](https://www.si.com/edge/2015/01/29/behind-nfl-yellow-first-down-line-sportsvision-technology)
* [SMT: NHL case study — Power Play Clock, Virtual Shot Speed (>85 mph)](https://smt.com/case-study/nhl/)
* [SMT: Inside the NHL on ESPN graphics package](https://smt.com/inside-the-nhl-on-espn-graphics-package-how-a-brand-new-identity-came-to-be-in-just-six-months/)
* [Wikipedia: FoxTrax (blauer Schweif, rot ab 70 mph)](https://en.wikipedia.org/wiki/FoxTrax)
* [Sports Video Group: Designing the Modern Scorebug (2026)](https://www.sportsvideo.org/2026/06/09/designing-the-modern-scorebug-how-broadcast-graphics-teams-are-rethinking-the-most-important-element-on-screen/)
* [MorganWick: The 1st Annual Buggy Awards, Part II](https://www.morganwick.com/2026/02/the-1st-annual-buggy-awards-part-ii/)
* [keepthescore: Basketball scoreboard explained (Bonus, Shot Clock)](https://keepthescore.com/blog/posts/basketball-scoreboard-explained/)
* [keepthescore: Hockey scoreboard explained](https://keepthescore.com/blog/posts/hockey-scoreboard-explained/)
* [Wikipedia: Score bug](https://en.wikipedia.org/wiki/Score_bug)
* [Wikipedia: Telestrator](https://en.wikipedia.org/wiki/Telestrator)
* [Hashtag Sports: TNF Prime Vision with Next Gen Stats](https://www.hashtagsports.com/awards/shortlist-2023/tnf-prime-vision-next-gen-stats)
* [Wikipedia: NFL RedZone](https://en.wikipedia.org/wiki/NFL_RedZone)
