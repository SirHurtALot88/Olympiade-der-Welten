# Alle zwanzig Disziplinen auf Top-Niveau: Fahrplan (PM, 09.11.)

Auftrag, Chris wörtlich: „ja nicht nur sagen was fehlt, opus ist doch PM, der soll mal sagen was
gemacht werden muss damit alle 20 diszis am ende auf so nem top level sind!" Dieses Dokument ist
deshalb **kein weiteres Audit**, sondern ein Bauplan: was wofür gebaut wird, in welcher
Reihenfolge, mit welchem Aufwand, und welche Entscheidungen vorher bei Chris liegen.

**Grundlage.** Drei Achsen, die der Koordinator am 09.11. selbst nachgespielt hat:

1. **Visuelle Tiefe:** übernommen aus `docs/design/kulissen-qualitaets-audit-08-11.md` (PR #1357),
   ergänzt um den Stand der offenen PRs #1359, #1362, #1363, #1364 und #1371.
2. **Interface-Lesbarkeit (neu):** Kann ein Zuschauer beim Hinsehen sagen, wer führt, wer gut und
   wer schlecht läuft und wie viel noch kommt?
3. **Zuschau-Dauer/Pacing (neu):** Wie lange dauert ein Spiel in echter Zeit, und passt das zur
   Disziplin?

Alle Zahlen zu Achse 2 und 3 habe ich selbst gemessen bzw. fotografiert (Abschnitt 1.2). Code
habe ich nicht geändert. PixelLab ist nicht angefasst, die Matrix auch nicht.

---

## 0. Kurzfassung

1. **Visuell ist die Hälfte der Arbeit schon gebaut, aber noch nicht gemergt.** Takeshi, Climbing,
   Spurt, Showcase und Breaking (Audit-Ränge 1, 2, 3, 5, 6) liegen in offenen PRs. Sie heben die
   Disziplinen von C auf etwa B bis B+. Danach bleiben visuell **Eiskunstlauf (C)** und
   **Fechten (B-)** übrig. An dieser Reihenfolge ändern die zwei neuen Achsen nichts. Sie rücken
   aber **hinter** die Lesbarkeits- und Pacing-Arbeit an den Bahn-Rennen, weil die billiger ist
   und mehr Disziplinen auf einmal hebt.
2. **Die Bühnen sind auf der Interface-Achse schon gut.** Jede Bühne hat ihre eigene Stand-Tafel:
   Eiskunstlauf „Zwischenstand", Showcase „Top 3 bisher", Gewichtheben „Duell 2 von 6",
   Speed-Schach mit Bewertungsbalken, Wettessen mit Zählern über jedem Esser. Dasselbe gilt für
   die Pod-Formate (Vier-Team-Tafel bei Takeshi, Staffel und Battlefield). **Die Lücke sitzt fast
   nur in den Einzelrennen auf der Bahn:** Spurt klassisch, Die Hatz, Climbing und mit
   Einschränkung Takeshi im Duell. Genau dort ist die Einzelplatzierung die Wertung („Punkte nach
   Rang"), und genau dort fehlt eine durchnummerierte Rangliste im Bild.
3. **Der größte Hebel ist eine generische Bahn-Rangleiste.** Sie entsteht aus der HYROX-Leiste
   (`zeichneHyroxRangleiste()`, PR #1369/#1371). Die Funktion ist zu etwa 80 % generisch. An HYROX
   hängen nur die Sortierung, die Statusspalte, die Kopfzeile und die Hervorhebung „im Bild". Wer
   diese vier Punkte als Parameter herauszieht, bekommt Spurt klassisch, Hatz und Climbing (und
   bei Bedarf Takeshi) für etwa 40–60 Zeilen je Disziplin. **Wichtig:** `bahnRangliste()` ist als
   Live-Sortierung nicht überall richtig. Bei Takeshi rutschen Ausgeschiedene nach vorn, bei HYROX
   war die Liste ein Spoiler, bei Climbing zählt die Höchstmarke. Der Sortierschlüssel muss
   deshalb ein Pflichtparameter sein (Abschnitt 3.1).
4. **Die Hatz hat drei Mängel, nicht zwei.** Das Pacing liegt bei 10:36 (zehn Läufer) bis 13:22
   (zwölf Läufer) statt 3 Minuten. Rangliste und Wellenzähler fehlen. Und das Wichtigste, im Code
   belegt: **die Positionen auf der Bahn tragen keinerlei Leistungsinformation.** Alle aktiven
   Läufer laufen im Gleichschritt (`u.pos = basis*0.92 + jitter`, der Versatz hängt an der
   Spieler-ID). „Wer gefährdet ist" kann man deshalb nicht einmal an der Bahnposition ablesen.
   HYROX hatte denselben Fehler und hat ihn mit dem „Fahrplan" (PR #1371, Stufe 1) gelöst. Dieses
   Muster ist der zweite wiederverwendbare Baustein.
5. **Pacing-Ausreißer, gemessen:** nach oben **Die Hatz** (stark) und der **Battlefield-Pod**
   (7:12, doppelt so lang wie das Duell, für dessen Länge der Faktor 5 einmal gesetzt wurde).
   Nach unten **Climbing** mit 0:48, das kürzeste Spiel aller zwanzig, obwohl seine
   Bahn-Geschwister Spurt und Staffel auf Chris' Wunsch auf etwa 3 Minuten gedehnt wurden. Lang,
   aber aus Chris' eigenen Vorgaben abgeleitet: Hockey 8:06, Gewichtheben 7:22, Basketball 6:08.
6. **Top-Niveau braucht eine vierte, nicht verhandelbare Achse: die Wertung.** Football, Hockey
   und TDM bestehen die Pflichtabnahme (rho/Pp) bis heute nicht (Abschnitt 2.4). Visuelle Politur
   dort hat geringeren Wert, solange die Disziplin nicht organisch gewertet wird. Das ist kein
   Bestandteil dieses Fahrplans, aber eine Abhängigkeit, die ich nicht verschweigen will.

**Empfohlene Reihenfolge in einem Satz:** Chris arbeitet erst die Merge-Warteschlange ab und
trifft die Format- und Dauer-Entscheidungen. Dann folgt eine kleine Fundament-Sitzung
(Sendedauer-Sonde und Zeitdehnung je Format), danach die Bahn-Rangleiste mit Ausrollung, dann die
Hatz-Nacharbeit. Parallel dazu laufen Eiskunstlauf und anschließend Fechten.

---

## 1. Bestandsaufnahme

### 1.1 Bewertungsmaßstab

| Achse | A | B | C |
|---|---|---|---|
| Visuell | Zeitfahren/TDM-Niveau oder besser (Audit-Skala) | saubere Sportübertragung ohne Atmosphäre-Extra | Textur-Tausch ohne Komposition, leer oder zu dunkel |
| Interface | Führung, gut/schlecht und Restlauf in ≤ 3 s ablesbar, durchgehend | zwei der drei Fragen beantwortet, oder nur über Umwege (DOM-Tabelle neben dem Bild, Zahlen über Köpfen ohne Sortierung) | Führung nur über nackte Position oder gar nicht ablesbar |
| Pacing | Sendedauer im vereinbarten Rahmen der Disziplin, Unterschiede ab dem ersten Fünftel sichtbar | Dauer knapp daneben oder erster Abschnitt undifferenziert | Faktor ≥ 2 daneben, oder das Bild zeigt lange nichts Unterscheidbares |

### 1.2 Wie gemessen wurde

**Dauer.** Ich habe `window.__arena.sondenLauf(n)` in Blöcken von 120 Ticks aufgerufen, bis
`window.__arena.vorbei()` wahr ist. Ein Tick entspricht bei Tempo 1× genau einer
Sechzigstelsekunde Zuschauzeit: `loop()` ruft je 1/60 echter Zeit `stepSim((1/60)/zeitFaktor())`
auf, `sondenLauf()` macht dasselbe ohne Wanduhr (Engine `:62152`, Spurt-Spitze). Ticks/60 ist
also die Sendedauer bei 1×, **ohne** Anpfiff-Countdown (1,5–3 s) und ohne Endstand-Nachlauf
(3,5 s). Gemessen wurde mit der Standard-Saat und dem Standard-Kader der Arena. Die Pods liefen
mit den vier Teams aus `data/generated/kaderfamilie-live-save.json`, wie in
`scripts/screenshot-kulisse.mjs --pod`. Engine-Stand ist die Spitze des Spurt-Stapels
(`claude/spurt-hyrox-routen-design-0911`, `14a18a72b`), die sonst auf dem Stand von `main` ist.
Takeshi und Climbing habe ich zusätzlich auf ihren PR-Zweigen gemessen und dieselben Werte
erhalten.

```js
// Kern der Sonde (Playwright, Seite /mockups/battle-mode.html)
A.setDisc(d);                      // ggf. vorher A.bahnFlags({spurtFormat:"hatz"}) bzw. A.bahnPodAnzeigen(d,pod)
let ticks=0; while(ticks<108000){ A.sondenLauf(120); ticks+=120; if(A.vorbei())break; }
return ticks/60;                   // Sendesekunden bei Tempo 1x
```

**Bilder.** Je Disziplin habe ich die Leinwand bei 30 % und 75 % der gemessenen Dauer
fotografiert, ebenfalls über `sondenLauf`, also deterministisch. Bei TDM habe ich zusätzlich in
Echtzeit über `scripts/screenshot-kulisse.mjs tdm - 60000` gegengeprüft. **Messfalle:** Im
Sonden-Modus stapeln sich in Kampf-Disziplinen die Treffer-Ringe zu einem Knäuel, in Echtzeit
nicht. Das ist ein Artefakt der Sonde und kein Befund.

### 1.3 Gemessene Sendedauer je Spiel (Tempo 1×)

| Disziplin (Format) | Chassis | `ZEIT_DEHNUNG` | Sendedauer | Bezugsgröße | Einordnung |
|---|---|---:|---:|---|---|
| Climbing | Bahn | 4,38 | **0:48** | Faktor war auf 60 s gerechnet | **Ausreißer nach unten** |
| Showcase | Bühne | – | 1:00 | ~60 s Bühnen-Standard | ok |
| Eiskunstlauf | Bühne | – | 1:02 | ~60 s | ok (12 Elemente parallel je Paar, ~5 s je Element) |
| Wettessen | Bühne | – | 1:02 | ~60 s | ok |
| Speed-Schach | Bühne | – | 1:02 | ~60 s | ok |
| Tennis | Bühne | – | 1:02 | ~60 s | ok |
| Takeshi's Castle (Duell) | Bahn | 2,17 | 1:02 | ~60 s | ok |
| Takeshi's Castle (**Pod**, Liga) | Bahn | 2,17 | 0:56 | ~60 s | ok |
| I-Spy | Bühne | – | 1:04 | ~60 s | ok |
| Mini-DM (1-gegen-1-Ansicht) | Arena | 2,86 | 1:08 | – | gewertet wird das FFA (eigene Leinwand `#mdffaCv`), **nicht gemessen** |
| Fechten | Bühne | 1,62 | 1:38 | – | ok (~16 s je Bahn, 6 Bahnen) |
| Time-Trial | Bahn | 4,38 | 1:38 | Faktor auf 60 s gerechnet | leicht lang, unkritisch (gestaffelter Start) |
| Breaking | Bühne | – | 1:46 | – | ok (~10 s je Kampf) |
| TDM | Arena | 1,88 | 3:00 | Chris: „bis zum Ende spielen" | ok |
| Staffel (**Pod**, Liga) | Bahn | 14,65 | 2:58 | Chris: ~3 min | ok |
| Staffel (Duell) | Bahn | 14,65 | 3:20 | Chris: ~3 min | ok |
| Battlefield (Duell, ungewertet) | Arena | 5,00 | 3:28 | – | – |
| Spurt klassisch | Bahn | 11,14 | 3:36 | Chris 06.09.: ~3 min (damals 3:03 gemessen) | **+20 % Drift**, leicht |
| Spurt HYROX (Flag) | Bahn | 11,14 | 3:52 | ~3 min | ok |
| Football | Feld | 1 | 4:44 | – | ok |
| Basketball | Feld | 1 | 6:08 | Chris: 4 × 1:30 | ok, so bestellt |
| **Battlefield (Pod, Liga)** | Arena | 5,00 | **7:12** | Faktor stammt vom Duell (41 Sim-s); der Pod läuft 86 Sim-s | **Ausreißer nach oben**, Chris-Frage |
| Gewichtheben | Bühne | 4 | 7:22 | Chris' Zielspanne 4–8 s je Versuch (06.09.), daraus ~7,4 min | ok, aus Chris' Vorgabe |
| Hockey | Feld | 2 | 8:06 | Faktor 2 aus Chris' Hektik-Fund, „240 s werden rund 8 Minuten" | ok, aus Chris' Vorgabe |
| **Spurt „Die Hatz" (Flag)** | Bahn | 11,14 | **10:36** (10 Läufer) / **13:22** (12 Läufer, gerechnet) | ~3 min wie Spurt | **schwerer Ausreißer** |

Die Hatz-Rechnung: `baueHatz()` (`:48581`) wirft je Welle zwei Läufer raus, bis vier übrig sind.
Die letzte Welle entscheidet Rang 1–4 auf einmal. Zwölf Läufer ergeben fünf Wellen à
`HATZ_WELLEN_DAUER=12` und vier Pausen à `HATZ_NEUORDNUNG_DAUER=3` (`:48548`), also 72 Sim-s ×
11,14 = 802 s. Zehn Läufer (Standardkader der Arena, eine Seite stellt nur vier) ergeben vier
Wellen und drei Pausen, also 57 Sim-s und gemessen 636 s. Die 13 Minuten des Koordinators gelten
für ein volles Feld.

**Abweichung zum Koordinator, offen gelassen:** Er hat Takeshi mit ~100 s und HYROX mit ~5 min
gesehen, ich messe 62 s bzw. 3:52. Countdown und Nachlauf erklären zusammen nur ~6 s. Plausibel
sind ein anderer Kader oder eine andere Feldgröße. Die Sendedauer-Sonde aus Abschnitt 3.3 würde
das in einem Lauf klären.

### 1.4 Die drei Achsen je Disziplin

„Stand nach PR" heißt: bewertet auf dem Zweig des offenen PRs (fotografiert), nicht auf `main`.

| # | Disziplin | Visuell (Audit → Stand nach PR) | Interface | Pacing | Wertung (rho/Pp) |
|---:|---|---|---|---|---|
| 1 | TDM | A/B+ | **B**: Spielstand nur in der DOM-Scorezeile, im Bild kein Stand; Kämpfe ballen sich am Rand | A (3:00) | **nicht bestanden** (rho 0,324) |
| 2 | Mini-DM (FFA) | A- | A- (laut Audit Tafeln sauber; FFA nicht selbst fotografiert) | nicht gemessen | FFA-Pfad, variabel-k unter Schranke |
| 3 | Battlefield (Pod) | A- | A-: Vier-Team-Tafel mit Rang und Punkten (`zeichneBfPodTafel`) | **C**: 7:12, und das Bild ändert sich zwischen 2:09 und 5:23 kaum | Pod gewertet (02.11.) |
| 4 | Basketball | B+ | A- (Scorebug, Uhr, Viertel) | A (so bestellt) | gewertet |
| 5 | Football | B+ | A- (Scorebug) | A | **nicht bestanden** (Pp 64,6/61,7) |
| 6 | Hockey | B+ | A- (Scorebug) | A (so bestellt) | **nicht bestanden** (rho 0,64, Pp 38,5/81,5) |
| 7 | Gewichtheben | A | A: „Duell 2 von 6", Versuchsreihe, Tafel „Nächster" | A (so bestellt) | gewertet |
| 8 | Showcase | C → **B+** (#1359) | A: „Top 3 bisher" plus „läuft" | A | gewertet |
| 9 | Eiskunstlauf | **C** (bestätigt: 90 % graues Eis, Tribüne als 8-%-Streifen) | A: Zwischenstand-Tafel, Wiederholung, „Platz 2" | A | gewertet |
| 10 | Breaking | C+ → **B** (#1359, Publikum und Pfeiler sichtbar) | A-: „Kampf 8 · noch 3:2 im Ring", Peinigt-/Erträgt-Kärtchen mit HP | A | gewertet |
| 11 | Wettessen | A+ | A: Zähler über jedem Esser, Führungszeile | A | gewertet |
| 12 | Speed-Schach | A | A: Bewertungsbalken, Uhren, Mini-Bretter mit Stand | A | gewertet |
| 13 | I-Spy | A- | **B**: Punkte und Fortschritt über jedem Kopf, aber unsortiert; Führung nur durch Vergleichen von zwölf Zahlen | A | gewertet |
| 14 | Tennis | A- | B+: „Platz 1 von 6 · Ballwechsel 3/10 · Siegchance", Bahnenreihe; Kopfzeile sehr klein | A | gewertet |
| 15 | Fechten | **B-** (bestätigt: untere 45 % leer) | B+: „Bahn 2 von 6", Ergebnis je Bahn, Mini-Bahnen unten | A | gewertet |
| 16 | Spurt klassisch (live) | C → **B-** (#1364: Bögen IN/FINISH, Lichtkegel, Tribüne; Band weiter zu 80 % blau) | **C+**: keine Rangliste im Bild; Teamstand „Punkte nach Rang (vorläufig)" und Läufertabelle nur im DOM neben dem Bild | B (+20 % Drift) | gewertet |
| 16a | Spurt HYROX (Flag) | **B+** (#1371, Halle) | **A** (Referenz) | A (3:52) | Format-Abnahme laut Format-Dokument |
| 16b | Spurt Hatz (Flag) | B- (wie klassisch) | **C**: kein Rang, kein Wellenzähler, Positionen im Gleichschritt (Abschnitt 2.1) | **C** (10:36–13:22) | Format-Abnahme laut Format-Dokument |
| 17 | Time-Trial | A- | A-: Hot-Seat, Zwischenzeiten, nummerierte Roster-Leiste 1–12 (`#ttroster`, DOM unter dem Bild) | B (1:38) | gewertet |
| 18 | Climbing | C → **B** (#1363: farbige Griffe, Spots, Sicherer am Boden) | **B-**: Höhendifferenz je Paar, „TOP 34,0 s · Platz 1", Stürze liegen sichtbar; keine Gesamtliste; im ersten Drittel kaum Unterschiede (Koordinator) | **B-** (0:48, kürzestes Spiel) | gewertet |
| 19 | Staffel (Pod) | B+ | A: Vier-Team-Tafel mit Fortschritt in %, Bein-Delta, `#bahnHud` | A | gewertet |
| 20 | Takeshi's Castle (Pod) | C → **B+** (#1362: Burgmauer, See mit Brücke, Wimpel) | B+ im Pod (Vier-Team-Tafel, „noch 16 im Rennen", Fallen-Banner); B im Duell (Burgpunkte nur je Team, Sterne je Name, keine Einzelliste) | A | gewertet |

### 1.5 Was die Tabelle sagt

- **Visuell bleiben nach dem Merge zwei echte Baustellen** (Eiskunstlauf C, Fechten B-) und eine
  Politur-Gruppe (Staffel, Feldspiele, Tennis, TDM-Basis, Spurt-Band). Die Audit-Reihenfolge
  „erst Eiskunstlauf, dann Fechten" bleibt richtig.
- **Interface: Das Muster der Lücke ist eindeutig.** Wo die Disziplin ein eigenes
  Stand-Element bekommen hat (alle Bühnen, alle Pods, Zeitfahren, HYROX), steht sie bei A/A-. Wo
  zwölf Einzelläufer frei auf einer Bahn laufen und die Einzelplatzierung direkt in die Wertung
  geht, fehlt es: Spurt klassisch, Hatz, Climbing. **Spurt klassisch ist dabei die wichtigste,
  weil sie die einzige davon ist, die heute im echten Spiel läuft.** Hatz und HYROX sind nur über
  `BAHN_FLAGS` erreichbar (`:44909`, „Die echte App setzt beides nie").
- **Pacing:** Drei Ausreißer, zwei davon sind nur Faktorfragen (Hatz, Battlefield-Pod), einer ist
  eine Geschmacksfrage mit Lesbarkeitsfolge (Climbing).

---

## 2. Befunde, die über das Audit hinausgehen

### 2.1 Die Hatz zeigt im Bild nichts von der Leistung

`baueHatz()` rechnet beim Bau des Rennens **alle** Ränge vorab aus (`u.hatzRang`). `stepSpurtHatz()`
(`:48611`) deckt sie je Welle nur noch auf. Die Bewegung dazwischen ist reine Kosmetik:

```js
const basis=w?(w.welle+frac)/gesamtWellen:1;
const jitter=((u.id*53)%37)/37*0.015;     // haengt an der Spieler-ID, nicht an der Leistung
u.pos=Math.max(0,Math.min(0.97, basis*0.92+jitter));
```

Alle aktiven Läufer bewegen sich also im Gleichschritt, gestreut nur nach ID. Die zwei, die der
Fegearm am Wellenende erwischt, sind vorher durch nichts im Bild erkennbar
(`alle-diszis-top-niveau-fahrplan-09-11/hatz-gleichschritt-30-75-prozent.jpg`: bei 30 % stehen
alle aktiven Läufer in einer Spalte am Balken). Das ist derselbe Befund wie HYROX 2.2 im
Hallen-Review („Live-Rangfolge = Endstand ab dem ersten Tick"), nur andersherum: HYROX zeigte
zu früh das Ergebnis, die Hatz zeigt es nie. **Ohne einen Fahrplan bringt eine Rangleiste für die
Hatz nichts**, weil sie nach Position sortieren müsste und die Position nichts aussagt.

### 2.2 `bahnRangliste()` taugt nicht überall als Live-Sortierung

`bahnRangliste()` (`:41401`) ist die Wertungs-Rangliste. Sie ist für das **Rennende** gebaut
(rho-/Pp-Sonden lesen sie dort). Live gibt es drei Fallen, die alle schon einmal aufgefallen und
jeweils lokal umgangen sind:

| Disziplin | Problem mit `bahnRangliste()` live | Lokale Umgehung heute |
|---|---|---|
| Takeshi | Ausgeschiedene bekommen `u.fertig=90+…` und rutschen nach vorn | Führung aus `burgwertung()` (`:43401`) in `updateHudBahn()` |
| HYROX | Unfertige nach `u.pos` ≈ 1/Zielzeit, Spoiler ab Tick 1 | eigene Sortierung in `zeichneHyroxRangleiste()` (`:49112`) nach `hyroxZustand(u).s` |
| Climbing | `u.pos` sinkt beim Abrutschen, gewertet wird `u.hoch` | Zweig `BA().climbing` in `bahnRangliste()` |
| Hatz | `u.pos` sagt nichts (2.1) | keine |

Daraus folgt eine Bauvorgabe für die generische Rangleiste: **Der Sortierschlüssel wird je
Disziplin übergeben, nicht aus `bahnRangliste()` geerbt.** `bahnRangliste()` selbst bleibt
unangetastet, sonst sind Wertung, rho und Pp betroffen.

### 2.3 Sim-Zeit-Konstanten mit Anzeigebedeutung

Im Hallen-Review stand schon ein Nebenbefund (2.4): `HYROX_CAM_SCHNITT_SEK=3,5` ist
Simulationszeit und ergibt bei `ZEIT_DEHNUNG.spurt=11,14` real ~39 s zwischen zwei
Kameraschnitten. Die Halle hat dafür eine eigene Konstante bekommen (`HYROX_HALLE_SCHNITT_SEK`,
`:48725`). Für die Bahn-Ansicht von HYROX und für jede künftige Konstante, die etwas Sichtbares
taktet (Wellendauer, Banner-Haltezeit, Kameraschnitt), gilt dasselbe. Wird der Faktor für die
Hatz geändert (Abschnitt 4, P2), ändern sich alle diese Zeiten automatisch mit. Das ist gewollt,
muss aber im Bild gegengeprüft werden.

### 2.4 Die vierte Achse: Wertung

Stand laut `data/generated/disziplin-abnahme.json` und
`lib/battle/arena-resolved-disciplines.ts` auf `main`. Außerhalb der organischen Wertung stehen
**Football** (rho 0,807, Pp 64,6/61,7), **Hockey** (rho 0,64, Pp 38,5/81,5), **TDM** (rho 0,324)
und das **Battlefield-Duell** (0,399; gewertet wird inzwischen der Pod). Für den Fahrplan heißt
das: Visuelle Politur bei Football, Hockey und TDM ist **nachrangig**, solange dort eine
Mechanikrunde aussteht. Sie ist auch riskant, weil eine spätere Mechanikrunde Zeichencode
anfassen kann. Den Mechanik-Strang führe ich unten als parallelen Strang M mit, plane ihn aber
nicht aus (eigene Fachrunden, `stand-aller-disziplinen.md`).

---

## 3. Wiederverwendbare Bausteine (die eigentlichen Hebel)

### 3.1 B1 — Generische Bahn-Rangleiste

**Was es gibt.** Für Ranglisten gibt es heute sieben eigene Lösungen:
`zeichneHyroxRangleiste()` (Leinwand, `:49112`), `#ttroster`/`renderZeitfahrenPanel()` (DOM,
`:54094`), `zeichneBahnPodTafel()` (Vier-Team-Tafel, `:59803`), `zeichneBfPodTafel()`
(`:52345`), `zeichneEisStand()` (`:34086`), die Showcase-Top-3 in `zeichneShowcase()` (`:33584`)
und `zeichneWettessenTafel()`. Die Bühnen- und Pod-Tafeln sind fertig und passen jeweils zu
ihrer Disziplin. **Sie zu vereinheitlichen empfehle ich ausdrücklich nicht**, das wäre Aufwand
ohne sichtbaren Gewinn.

**Was fehlt:** eine Liste für **Einzelrennen auf der Bahn**. Die HYROX-Leiste ist dafür die
richtige Vorlage: Kasten oben rechts, „1. Name … Status", Fertige grün, Zeilen im Kamerabild
hell, der Rest gedimmt, aber lesbar. An HYROX gebunden sind nur vier Stellen:

| Parameter | HYROX heute | Spurt klassisch | Hatz | Climbing | Takeshi (Duell, optional) |
|---|---|---|---|---|---|
| `sortierung(a,b)` | fertig nach Zeit, sonst `hyroxZustand(u).s` | fertig nach Zeit, sonst `u.pos` | aus dem Fahrplan (B4), Ausgeschiedene nach `hatzRang` unten | `u.hoch` (Höchstmarke) | `burgwertung(u)` |
| `status(u)` | L1/L2/TECH/KLET/KRAFT/✓ | Station 1–7 bzw. ✓/„liegt" | „W3", „GEFÄHRDET" (untere zwei), „RAUS", ✓ | Höhe in m / „TOP" / „STURZ" | „Falle 7/14" / „raus" |
| `kopf` | Zone der Nahkamera | „SPURT · Station 4/7" | „WELLE 3/5 · noch 8" | „ZEITLIMIT 0:32" | „Burgpunkte 24:15" |
| `imBild(u)` | `hyroxCamGruppe` | Kamerafenster `camX` | Kamerafenster | Kamerafenster `camY` | Kamerafenster `cam.zoom` |

**Aufwand:** Herauslösen plus HYROX auf die neue Funktion umstellen, pixelgleich per Screenshot-
Vergleich: etwa 120–180 Zeilen, eine halbe Sitzung. Danach je Disziplin 40–60 Zeilen
(Parameter, Platz im Bild prüfen, Überdeckung mit Kamera-Kennzeichnung und Zeitlimit-Kasten
vermeiden). **Wertungsneutral per Bauart**, weil nur gelesen und gezeichnet wird. Pflicht ist
trotzdem `scripts/pruefe-wertung-fingerabdruck.mjs` byte-identisch, wie in allen Kulissen-
Batches.

**Bauort:** auf der Spitze des Spurt-Stapels (#1371), weil `zeichneHyroxRangleiste()` erst dort
existiert. Das ist ein Grund mehr, den Stapel vorher zu mergen (Abschnitt 4, P0).

### 3.2 B2 — Zeitdehnung je Format

`zeitFaktor()` (`:53021`) liest `ZEIT_DEHNUNG[disc]`. Ein Format (Hatz, HYROX, später Grube oder
Knockout) erbt damit den Faktor des klassischen Formats, obwohl seine Sim-Länge eine ganz andere
ist. Vorschlag: ein zweiter Schlüssel `ZEIT_DEHNUNG["spurt:hatz"]` mit Rückfall auf
`ZEIT_DEHNUNG[disc]`. Dasselbe gilt für den Battlefield-Pod (`"battlefield:pod"`). Die
Sandsack-Weiche `SANDSACK_PAR_SZENE` ist schon ein Einzelfall genau dieses Musters und würde
dabei mit aufgeräumt.

**Aufwand:** etwa 10–20 Zeilen. **Wertungsneutral:** Die Sonden (`serieVon`, `bahnSerie`,
`einflussVon`, `miss-alle-disziplinen.mjs`) laufen nie durch `loop()`/`zeitFaktor()`, so steht es
im Kommentar über der Tabelle (`:52894ff.`). Bei der Hatz ist es sogar trivial: Die Ränge stehen
nach `baueHatz()` fest, bevor der erste Tick läuft. Anders als bei der Staffel-Kalibrierung
(13,86 → 14,65) kann eine feinere dt-Teilung dort keine Zufallszüge verschieben.

### 3.3 B3 — Sendedauer-Sonde mit Zielband

Die Sonde aus Abschnitt 1.2 als `scripts/miss-sendedauer.mjs [disziplin[:format]] …`, dazu
eine kleine Tabelle mit Zielbändern je Disziplin (Chris-Entscheidung E2). Ausgabe: Ist, Band,
Abweichung. Zunächst als Bericht, nicht als harte CI-Schranke. **Warum ein Fundament:** Die Hatz
wäre damit am Tag ihres PRs aufgefallen. Die +20 % Drift bei Spurt klassisch (3:03 → 3:36,
seit dem 06.09. unbemerkt) und die Kürze von Climbing ebenso. Jede Formatvariante aus
`format-varianten-brainstorm-08-11.md` (14 Kandidaten) wird dieselbe Frage aufwerfen.

**Aufwand:** etwa 100–150 Zeilen Skript, keine Engine-Zeile. Die Bausteine (`sondenLauf`,
`vorbei`, `bahnFlags`, `bahnPodAnzeigen`, `battlefieldPodAnzeigen`) existieren alle. Achtung:
Chromium stürzt beim Laden der Seite gelegentlich ab („Page crashed"). Die Sonde braucht je
Disziplin einen frischen Browser und bis zu drei Wiederholungen.

### 3.4 B4 — Fahrplan für vorab berechnete Formate

HYROX Stufe 1 (`hyroxFahrplan()`, `:48842`, PR #1371, ~200 Zeilen) bildet ein vorab berechnetes
Ergebnis rho-neutral auf einen ehrlichen Zeitverlauf ab: Wer an einer Station verliert, verliert
dort sichtbar Zeit. **Dieselbe Idee braucht jedes Format, das sein Ergebnis beim Bau würfelt**:
heute die Hatz, demnächst die Kandidaten aus dem Format-Brainstorm (Grube, Knockout, Hai-Gasse).
Für die Hatz heißt das konkret: Die Wellen-Note aus `hatzWelleScore()` bestimmt die Position
innerhalb der Welle. Die zwei Schwächsten fallen im Lauf der Welle sichtbar nach hinten, bis der
Fegearm sie holt. Der Ausgang steht damit nicht ab Tick 1 fest im Bild (Rauschen innerhalb der
Welle, Aufholen möglich), aber wer gefährdet ist, sieht man.

Ich empfehle, die Lehre als Regel festzuhalten (Handbuch, nicht CLAUDE.md): **„Ein vorab
berechnetes Format braucht einen Fahrplan, sonst ist das Live-Bild entweder ein Spoiler oder
leer."**

### 3.5 Schon vorhanden und weiter nutzbar

- **„Rahmen statt Material"** (Audit Abschnitt 4) als Kulissenrezept für Eiskunstlauf und
  Fechten. Die Rohszenen liegen unter `public/szenen/<disziplin>/`. Neue PixelLab-Assets sind
  dafür nicht nötig.
- **Pod-Tafeln** (`zeichneBahnPodTafel`, `zeichneBfPodTafel`) für jedes künftige
  Vier-Team-Format.
- **Nahkamera-Muster** (HYROX #1369). Für Spurt klassisch, Climbing und Time-Trial gibt es
  bereits mitlaufende Kameras („Kamera 3.3×"). Das ist kein offener Hebel mehr, nur bei neuen
  Formaten mitzudenken.

---

## 4. Der Fahrplan

Aufwand in **Sitzungen** (eine Sitzung ≈ ein Bau-Agent, ein PR; Bezugspunkte aus den echten
Engine-Diffs: Climbing-Wand 285 Zeilen, Takeshi 204, HYROX-Halle 368, Nahkamera 277,
HYROX-Fahrplan 196, Hatz-Format 238, Showcase/Breaking-Lichtfix 15). Die Zeilenzahlen sind
Schätzungen ±50 %.

### P0 — Chris, vor jedem neuen Bau (keine Agentenarbeit)

| | Was | Warum zuerst |
|---|---|---|
| P0.1 | **Merge-Warteschlange abarbeiten:** #1359 (Showcase/Breaking, Basis noch `8a0dad736`, also älter als `main`), #1362 (Takeshi), #1363 (Climbing), dann der Spurt-Stapel #1364 → #1367 → #1368 → #1369 → #1371 (acht Commits, linear aufeinander) | Alle Bausteine unten setzen auf diesen Zweigen auf. `battle-mode.engine.js` hat 62 000 Zeilen in einer Datei, jeder weitere offene Zweig erhöht das Konfliktrisiko. B1 kann erst auf #1371 gebaut werden. |
| P0.2 | **Entscheidungen E1–E4** (Abschnitt 5) | E1 entscheidet, ob die Hatz Priorität 2 oder geparkt ist. E2 liefert die Zielbänder für B3. |

### P1 — Fundament (1 Sitzung, ein Agent)

| Baustein | Inhalt | Aufwand | Abhängig von |
|---|---|---|---|
| B3 | Sendedauer-Sonde plus Zielband-Tabelle, erster Lauf über alle 20 und alle Formate/Pods | ~120 Zeilen Skript | E2 (Bänder; vorläufig mit der Tabelle 1.3 starten) |
| B2 | `ZEIT_DEHNUNG` je Format | ~15 Zeilen | – |
| P1.a | **Hatz-Dehnung:** Startwert 11,14 × 180/802 ≈ **2,5** (volles Feld, Ziel 3:00), mit B3 nachmessen | ~2 Zeilen | B2, E1/E2 |
| P1.b | Battlefield-Pod-Dehnung, **nur wenn Chris 7:12 zu lang findet** (Startwert 5 × 210/432 ≈ 2,4 für ~3:30) | ~2 Zeilen | B2, E2 |
| P1.c | Climbing-Dehnung, **nur wenn Chris es will** (4,38 → ~8,2 für ~1:30) | ~1 Zeile | E2 |
| P1.d | Spurt-klassisch-Drift auf 3:00 zurückholen (11,14 → ~9,3), falls E2 das Band eng fasst | ~1 Zeile | E2 |

Jede Faktoränderung: Fingerabdruck byte-identisch, `miss-alle-disziplinen.mjs 24 <diszi>`
vorher/nachher gleich, und ein Bild bei 30/75 % zur Kontrolle der Sim-Zeit-Konstanten (2.3).

### P2 — Lesbarkeit der Bahn-Einzelrennen (2 Sitzungen, nacheinander, ein Agent oder zwei hintereinander)

| Schritt | Inhalt | Aufwand | Abhängig von |
|---|---|---|---|
| P2.1 | **B1 herauslösen**, HYROX pixelgleich umstellen | ~150 Zeilen, ½ Sitzung | P0.1 |
| P2.2 | **Spurt klassisch** an B1 (das live gespielte Format zuerst) | ~50 Zeilen | P2.1 |
| P2.3 | **Climbing** an B1: Sortierung nach `u.hoch`, Status Höhe/TOP/STURZ; dazu prüfen, ob die Differenzierung im ersten Drittel mit Leiste schon reicht oder P1.c nötig ist | ~60 Zeilen | P2.1 |
| P2.4 | **Hatz-Nacharbeit**: Fahrplan (B4), Wellenzähler „WELLE 3/5 · noch 8 im Rennen", Gefahrenmarke für die unteren zwei, Leiste über B1 mit Status W/GEFÄHRDET/RAUS | ~250–300 Zeilen, 1 Sitzung | P2.1, P1.a, E1 |
| P2.5 | *(optional, E3)* Takeshi-Duell an B1 nach `burgwertung` | ~40 Zeilen | P2.1, E3 |

Die Schritte P2.1–P2.5 liegen alle im Spurt-/Bahn-HUD-Bereich der Engine (`:41400–49200`).
**Nicht parallelisieren**, sonst Konflikte.

### P3 — Visuell (parallel zu P2 möglich, anderer Engine-Bereich: `boden*()`, Kulissen, Generator)

| Schritt | Inhalt | Aufwand | Abhängig von |
|---|---|---|---|
| P3.1 | **Eiskunstlauf** „Rahmen statt Material" nach Audit 4.4: Waldsee-Horizont auf voller Höhe, Kür-Hallenrang mit Publikum, Spots auf die Läufer, Eis mit Spiegelung, Kufenspuren und Verlauf. Die gute Zwischenstand-Tafel und das Wiederholungsfenster bleiben unangetastet. | ~300–450 Zeilen plus Kulissenbild aus der vorhandenen Rohszene, 1 Sitzung | P0.1 (#1359 berührt dieselben Bühnen-Kulissenfunktionen) |
| P3.2 | **Fechten** Zuschnitt nach Audit 4.7: unter der Bahn Hofmauer mit Tor bzw. vordere Tribünenreihen und Kampfrichtertische | ~120–200 Zeilen, ½ Sitzung | P3.1 (gleicher Bereich, nacheinander) |
| P3.3 | **Staffel-Politur:** Bahnnummern, zweite Tribüne unten, Tageszeit-Ton | ~80–150 Zeilen, ½ Sitzung | – |
| P3.4 | **Spurt-Band** (Rest aus Audit 4.3): Stationsumfeld im Belag, zweite Outdoor-Variante | ~200 Zeilen plus Kulisse, 1 Sitzung | P2.2 (gleicher Bereich) und E1 (lohnt nur, wenn klassisch das Hauptformat bleibt) |

### P4 — Politur (niedrig, frei einplanbar)

- **I-Spy:** eine kleine „Top 3 bisher"-Ecke nach dem Showcase-Muster statt zwölf unsortierter
  Zahlen. ~40–60 Zeilen. Hebt das Interface von B auf A-.
- **Tennis:** Kopfzeile „Platz 1 von 6 · Ballwechsel …" größer bzw. als Tafel. ~20–40 Zeilen.
- **Feldspiele und Tennis visuell:** Tribünen aus drei Blöcken mischen, Licht je Variante (Audit
  4.8). ~100–200 Zeilen für alle zusammen. **Football und Hockey erst nach Strang M.**
- **TDM:** ein kleiner Spielstand im Bild (heute nur DOM-Scorezeile); TDM-Basis-Bodenmerkmale.
  **Erst nach Strang M.**

### Strang M — Wertung (parallel, eigene Fachrunden, hier nicht ausgeplant)

Football Pp, Hockey rho/Pp, TDM-Mechanik, Mini-DM variabel-k. Er ist Voraussetzung dafür, dass
P4 für diese Disziplinen lohnt. Siehe `docs/design/stand-aller-disziplinen.md`.

### Zeitlinie (Vorschlag)

```
Woche 1   P0 (Chris: Merges, E1-E4)
          P1  Fundament  ─────────────┐
Woche 2   P2.1 → P2.2 → P2.3          │   P3.1 Eiskunstlauf   (parallel, anderer Bereich)
Woche 3   P2.4 Hatz (falls E1 = live) │   P3.2 Fechten → P3.3 Staffel
danach    P3.4 Spurt-Band, P4 Politur nach Bedarf;  Strang M läuft unabhängig
```

**Höchstens zwei Bau-Agenten gleichzeitig an `battle-mode.engine.js`**, und zwar nur in
getrennten Bereichen (Bahn-HUD gegenüber Bühnen-Kulisse). Die Kulissen-Batches 13–15 und der
Spurt-Stapel haben gezeigt, dass mehr gleichzeitige Zweige an dieser Datei vor allem
Merge-Arbeit für Chris erzeugen.

### Was „fertig" heißt (Abnahme je Disziplin, vorgeschlagen)

1. **Visuell:** Audit-Note B+ oder besser, gemessen an den fünf Merkmalen aus Audit Abschnitt 1.
2. **Interface:** An drei beliebigen Zeitpunkten (25/50/75 %) beantwortet ein Standbild ohne DOM:
   Wer führt (Name), wer liegt hinten bzw. ist gefährdet, wie viel kommt noch (Uhr, Runde, Welle,
   Bahn n/6).
3. **Pacing:** Sendedauer laut B3 im Zielband aus E2. Bei 20 % der Dauer sind schon sichtbare
   Unterschiede im Bild.
4. **Wertung:** organisch gewertet (rho > 0,80, Pp ≤ 25), unverändert die Pflicht aus CLAUDE.md.
5. **Bei jedem Schritt:** Fingerabdruck byte-identisch, wenn nur Anzeige geändert wurde.

---

## 5. Offene Entscheidungen für Chris

**E1 — Welche Spurt-Formate gehen ins echte Spiel, und wie wird gewählt?** *(die wichtigste)*
Hatz und HYROX sind gebaut, aber nur über `BAHN_FLAGS` (Mess-/Vorschau-Schalter) erreichbar. Im
Spiel läuft immer „klassisch". Dieselbe Frage ist beim Gewichtheben-Sandsack seit Oktober offen
(Format-Brainstorm Abschnitt 6: drei Optionen, Saisonkalender, Hash oder Liga-Einstellung). Davon
hängt ab, ob die Hatz-Nacharbeit (P2.4, eine volle Sitzung) jetzt kommt oder geparkt wird. Ebenso
hängt davon ab, ob sich die Spurt-Band-Politur (P3.4) noch lohnt, wenn HYROX das Hauptformat
wird. Mein Vorschlag als Diskussionsgrundlage: HYROX als Standardformat (es ist auf allen drei
Achsen das beste), Hatz erst nach P2.4. Die Wahl zwischen den Formaten entscheidet Chris.

**E2 — Zielbänder für die Sendedauer.** Heute gibt es Einzelentscheidungen (Spurt und Staffel
~3 min, Basketball 4 × 1:30, Gewichtheben ~7 min, Hockey ~8 min), aber keine Regel. Konkret zu
entscheiden:
- Die Hatz auf ~3 min wie Spurt? (Empfehlung: ja.)
- Der Battlefield-Pod mit 7:12, so lassen oder ~3:30? Im Bild passiert zwischen Minute 2 und 5
  wenig, siehe `battlefield-pod-2-09-und-5-23.jpg`. (Empfehlung: kürzen, aber erst selbst
  ansehen.)
- Climbing mit 0:48 lassen oder auf ~1:30? Der Koordinator fand das erste Drittel undeutlich.
  (Empfehlung: erst die Rangleiste P2.3, dann neu ansehen.)
- Toleranz für Drift, z. B. ±15 % um den Zielwert?

**E3 — Generische Rangleiste: für welche Bahn-Disziplinen?** Mein Vorschlag: ja für Spurt
klassisch, Hatz und Climbing. Dort ist die Einzelplatzierung die Wertung. Nein für die Staffel,
die als Teamrennen schon Pod-Tafel, Bein-Delta und `#bahnHud` hat. **Offen ist Takeshi:** Im
Liga-Pod gibt es die Vier-Team-Tafel schon. Eine Einzelliste würde den Team-Charakter
(Burgpunkte) überlagern. Soll Takeshi bewusst teamzentriert bleiben?

**E4 — Wo die Rangliste sitzt: im Bild oder daneben?** Zeitfahren hat sie als DOM-Leiste unter
dem Bild (`#ttroster`), HYROX auf der Leinwand. Beides funktioniert, aber das Spiel sollte sich
für eine Form entscheiden. Mein Vorschlag ist die Leinwand: Sie wirkt wie eine
Fernsehübertragung, und auf kleinen Bildschirmen landet die DOM-Leiste unterhalb des
sichtbaren Bereichs.

**E5 — Visuelle Politur bei ungewerteten Disziplinen (Football, Hockey, TDM) zurückstellen?**
Empfehlung: ja, bis Strang M durch ist.

**E6 — PixelLab (nur Vorschläge, nichts bestellt).** Der Fahrplan kommt ohne neue Assets aus.
Zwei Stellen, an denen Chris über eine Freigabe nachdenken könnte:
- Ein **Fegearm-Bedroher** für die Hatz (heute ein prozeduraler roter Balken). Das ist eine
  Figur mit einer Lauf- und einer Fang-Animation. Nur sinnvoll, wenn die Hatz live geht (E1).
- In den Pod-Bildern (Battlefield, Takeshi) erscheinen für einige Spieler der Kaderfamilie
  **kahle Grundfiguren**. Ich habe nicht geprüft, ob das im echten Spiel auch passiert oder nur
  am Testkader liegt. Vor jeder Bestellung sollte das jemand untersuchen.

---

## 6. Was ich nicht geprüft habe

- **Mini-DM-FFA** habe ich weder gemessen noch fotografiert (eigene Leinwand, eigenes Skript
  `scripts/screenshot-mdffa-buehne.mjs`). Die Bewertung ist aus dem Audit übernommen.
- **Takeshi Kulissenvarianten** (Dschungel, Eisfestung) und alle Kulissenvarianten außer der
  jeweils per Hash gewählten habe ich nicht einzeln angesehen.
- **Echtes Spiel im Browser mit Login (Franky)**: nicht gemacht. Alle Bilder stammen aus
  `/mockups/battle-mode.html`, das laut `FoundationBattleArenaHost.tsx` dieselbe Hülle ist wie
  im Spiel.
- **rho/Pp der Formate Hatz und HYROX:** nicht nachgemessen. Stand siehe die jeweiligen
  Format-Dokumente.
- **Tempo 2×/4×:** Alle Dauern gelten bei 1×. Wer im Spiel standardmäßig vorspult, sieht
  entsprechend weniger. Das ändert an den Ausreißern nichts.

## Quellen

- `docs/design/kulissen-qualitaets-audit-08-11.md` (visuelle Achse, PR #1357)
- `docs/design/spurt-hyrox-routen-design-opus-09-11.md` (Fahrplan, Befunde 2.2/2.4; Zweig von
  #1371)
- `docs/design/spurt-format-die-hatz-08-11.md`, `docs/design/spurt-format-hyrox-stationen-08-11.md`
- `docs/design/format-varianten-brainstorm-08-11.md` (Abschnitt 6: Formatwahl)
- `docs/design/bahn-pod-vier-teams-01-11.md`, `docs/design/stand-aller-disziplinen.md`
- `data/generated/disziplin-abnahme.json`, `lib/battle/arena-resolved-disciplines.ts`,
  `lib/season/season-discipline-schedule.ts` (`VIERER_POD_DISCIPLINE_IDS`)
- Engine-Zeilen in diesem Dokument beziehen sich, wo nicht anders gesagt, auf
  `public/mockups/battle-mode.engine.js` am Stand `14a18a72b` (Spitze #1371). Auf `main` liegen
  dieselben Funktionen an anderen Zeilen (z. B. `ZEIT_DEHNUNG` `:51787`, `zeitFaktor` `:51852`,
  `bahnRangliste()` `:41383`, `zeichneBahnPodTafel()` `:58614`, `sondenLauf` `:60881`); die
  Hatz-/HYROX-Funktionen gibt es nur auf dem Spurt-Stapel.
- Belegbilder: `docs/design/alle-diszis-top-niveau-fahrplan-09-11/` (Hatz im Gleichschritt,
  HYROX-Leiste als Referenz, Battlefield-Pod bei 2:09 und 5:23, Eiskunstlauf Ist-Stand)
