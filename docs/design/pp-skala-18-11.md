# PP-Skala: Top-Spieler je Disziplin um 5 PP (18.11.)

Auftrag, Chris am 18.11., wörtlich: „Die PPs sollen weiterhin eine Darstellung der Leistung der
Spieler sein, Top-Spieler sollen in einer Diszi um die 5 PPs bekommen als Maximum — schau mal,
dass du das gebalanced bekommst! Bin da offen für Changes.“

Dieses Dokument misst den Ist-Stand, kartiert alle Abnehmer der PP, bewertet vier Varianten und
beschreibt einen abschaltbaren Prototyp der empfohlenen Variante (`OLY_PP_SKALA`, Standard AUS).
**Die Wertung im Spiel ist unverändert**, solange der Schalter nicht gesetzt ist.

---

## 0. Kurzfassung

1. **Ein PP ist heute schon fast überall dieselbe Formel**: die Impact-Kurve
   `PP = 5,5 · min(1, (s / S_krass)^γ)` mit `γ = ln 0,25 / ln(S_mittel / S_krass)`. Was sich je
   Disziplin unterscheidet, ist nur die Referenz (`S_mittel` = p50, `S_krass` = p99,5 des Rohwerts),
   und die wurde für jede Disziplin zu einem anderen Zeitpunkt, gegen einen anderen Motorstand gezogen.
2. **Gemessen** an zwei frischen Battle-Saves (32 KI-Teams, je 20 Spieltage, zusammen 9.941
   PP-Zeilen) liegt der Tagesbeste je Disziplin (Median über die Spieltage) heute zwischen **3,33
   (Tennis)** und **5,50** (sechs Disziplinen am Deckel). Ohne den alten Deckel gemessen (Diagnosemodus
   `roh`) sind es **3,00 (Spurt) bis 9,46 (Hockey)**, Basketball 8,2. In **44 von 80 Zellen** (Liga ×
   Spieltag × Disziplin) läge der Tagesbeste ohne Deckel über 5, in 12 unter 4. Bei Climbing und
   Time-Trial stehen an fast jedem Spieltag **7 bis 8 Spieler gleichauf bei 5,5**. Das sind die
   Duellsieger: der Bahn-Motor liefert dort Platzpunkte, also einen Rohwert mit nur 8 bis 12 Stufen.
3. **„Leistung 65 gegen erwartete 39“ ist keine PP-Zahl**, sondern ein Perzentil (0–100) aus der
   Form-Rechnung (`buildMatchdayLeistungDetails`, Rang des Endscores gegen Rang der Eignung). Es hängt
   nur an Rängen und ist von jeder PP-Skalierung unberührt.
4. **Empfehlung: Variante C2, „Zwei-Anker-Nachkalibrierung“.** Die Kurve wird ohne alten Deckel
   gerechnet und je Disziplin auf zwei gemessene, überall gleich definierte Anker gelegt: der
   Median-Tagesbeste → **5**, der Median-Einsatz → **1,25** (wie die Kurve es ursprünglich wollte). Danach
   wird bei 5 gedeckelt. Das ist streng monoton, die Reihenfolge innerhalb einer Disziplin bleibt.
   In der Stichprobe liegt der Tagesbeste in 93 % der Zellen zwischen 4 und 5, nie darüber;
   außerhalb der Stichprobe (anderer Save) in mindestens 79 %.
5. **Rangtreue (rho je Spiel) und Pp-Abweichung bleiben unberührt**: beide sind Eigenschaften des
   Motors (`battle-mode.engine.js`), die PP-Kurve sitzt danach in TypeScript. Probe an allen 338.378
   Spielerpaaren innerhalb der Zellen: **0 Paare umgedreht**, Spearman Eignung → PP 0,750 → 0,750. Der
   Wertungs-Fingerabdruck läuft nur über den Motor (Abschnitt 6).
6. **Was an der absoluten Skala hängt** (Abschnitt 3): Trainings-XP (`pps × 4`), die organische
   Entwicklung (`scoreContribution / 30`), Saison-MVP/Awards, Spieler des Tages (PP über d1+d2),
   Rekordbuch und ewige Tabelle (Summen über Saisons) und der PP-Saisonrang, auf den die KI-Verkaufslogik
   schaut. Board, Sponsoren, Form, Moral, Marktwert-Rang (MVS) und Tabellenpunkte hängen nur an Rängen bzw.
   an 2/1/0.
7. **Grenze jeder festen Skala**: dieselbe Disziplin streut zwischen zwei Saves stark (Basketball,
   Tagesbester ungedeckelt 4,1–5,2 gegen 7,5–8,9), je nachdem, wie stark die Stars einer Liga sind.
   Ein fester Anker trifft „Top ≈ 5“ deshalb im Mittel, nicht an jedem Spieltag. Wer das jeden Tag
   will, braucht Variante B (Tagesanker); die macht die PP aber relativ zum Spieltag.

---

## 1. Was ist ein PP heute?

### 1.1 Begriffe — vier verschiedene Größen

| Begriff | Was es ist | Skala | Wo |
|---|---|---|---|
| **Eignung** (`baseValue`, `baseDisciplineScore`) | Spielerwert für die Disziplin aus Attributen × Matrixgewicht (+ Slot/Trait/Form) | ~0–100 | `lib/lineups/legacy-score-engine.ts` |
| **Score** (`finalPlayerScore`) | Eignung nach Form, Fatigue, Verletzung, Kapitän, Mutator, Team-Power-Debuff | ~0–120 | `legacy-matchday-resolve-engine.ts` (`rawPlayerEntries`) |
| **Rohwert / Impact** (`ArenaFixtureBoxscoreEintrag.wert`) | was der Motor misst: Boxscore-Impact, Zweikampf-kg, Burgpunkte, Rangpunkte … | je Disziplin völlig verschieden (Basketball ~15–100, Showcase bis ~575, Speed-Schach bis ~1.210) | `public/mockups/battle-mode.engine.js` |
| **PP** (`pointsAwarded` → persistiert als `scoreContribution` → Ledger `basePoints`) | Leistungspunkte des Spielers für diesen Einsatz | 0–5,5 (Spurt +0,5) | s. 1.2 |
| **„Leistung 65 gegen erwartete 39“** | Perzentil des Scores gegen Perzentil der Eignung in der Disziplin | 0–100 | `lib/morale/form-moral-modifikator.ts:248` |
| **Tabellenpunkte** | 2/1/0 je Duell (Battle) bzw. Rangtabelle (Manager) | ganzzahlig (Battle) | `battle-mode-pps-duell.ts`, `rank-to-points.ts` |

`points` im Ledger ist `basePoints + mutatorPpsBonus`; im gemessenen Save war der Mutator-Aufschlag
überall 0.

### 1.2 Wo PP entstehen (je Pfad)

| Pfad | Disziplinen | Rohwert | Formel | Datei:Zeile |
|---|---|---|---|---|
| **Arena-Duell** (Feldspiel, Bühne, Bahn, Kampf) | 18 arena-aufgelöste (`ARENA_RESOLVED_DISCIPLINE_IDS`) | Boxscore-`wert` | Impact-Kurve, Referenz je Disziplin × Feldgröße (`data/generated/<d>-pps-referenz.json`), Hockey-Torwart eigene Referenz; Spurt + Stationsduelle (≤ 0,5) | `lib/resolve/battle-mode-arena-team-points.ts:1196` (`ppsAusArenaImpact`), `:1260` (`computeIndividualBoxscorePpsFromFixtureResults`), `:440` (`ppsAusStationsduellen`) |
| **Bahn-Pod** (Vier-Team-Rennen) | Staffel, Takeshi's Castle | Läuferwert im 4k-Feld | dieselbe Kurve, Pod-Referenz | `lib/resolve/bahn-pod-resolve.ts:110`, `lib/resolve/bahn-pod-matchday.ts:145` |
| **Mini-DM-FFA / Battlefield-Pod** | Mini-DM, Battlefield | Beitrag bzw. Kampfrichterwertung | dieselbe Kurve, eigene Referenz | `lib/resolve/mini-dm-pod-resolve.ts:619/787`, `mini-dm-ffa-matchday.ts:186`, `battlefield-pod-matchday.ts:155` |
| **PPS-Duell-Brücke** (Rückfall ohne Arena-Ergebnis, Mini-DM-Pod ohne Motor) | jede, deren Arena-Lauf fehlt | `finalPlayerScore` | dieselbe Kurve, Referenz `verhaeltnis-referenz.json` (`spieler.p50/p995`) | `lib/resolve/battle-mode-pps-duell.ts:337` (`ppAusSpielerScore`), Engine `legacy-matchday-resolve-engine.ts:1208`, Ledger `season-points-ledger.ts:260` (rechnet beim Lesen neu) |
| **Legacy / Manager-Modus** | alle (nur Manager-Saves) | `finalPlayerScore` | Team-Rang → `rank-to-points.json` (Rang 1: 3,3 × Feldgröße, also 6,6 … 19,9), anteilig nach Score unter den Spielern verteilt | `lib/resolve/rank-to-points.ts:155` (`distributeRankPointsToPlayers`) |

Engine: `pointsAwarded = arenaPps ?? ppsDuellPps ?? Rang-Anteil` (`legacy-matchday-resolve-engine.ts:1266`
für die Live-Bühne, `rawPlayerEntries` ~`:1305` für die persistierte Zeile, „gezeigt = gebucht“). Der
Ledger vertraut Arena-/Pod-Zeilen (`season-points-ledger.ts:276`) und rechnet PPS-Duell-Zeilen aus
`finalPlayerScore` neu.

**Legacy/Manager-Modus** ist nicht das Problem: dort verteilt ein Team auf Rang 1 im Schnitt 3,3 PP je
Spieler, der Teambeste bekommt je nach Score-Anteil ~3,5 (Feldgröße 2) bis ~5 (Feldgröße 6), für alle
Disziplinen nach derselben Tabelle. Der Rest dieses Dokuments betrifft Battle-Saves.

### 1.3 Warum die Skala trotzdem auseinanderläuft

Jede Disziplin bekommt ihre `S_mittel`/`S_krass` aus einer eigenen, einmal gezogenen Referenz. Seitdem
haben sich viele Motoren geändert (Staffel „ganze Runde“, Spurt-Kontakt, Basketball-Benchmark, I-Spy V2 …).
Nur Basketball hat einen Drift-Wächter (`tests/basketball-pps-referenz-drift.test.ts`). Wird ein Motor
großzügiger, landen viele Spieler am Deckel (Climbing, Time-Trial); wird er knapper oder misst die
Referenz auf einem anderen Kader, erreicht niemand mehr die Spitze (Tennis, Spurt). Zusätzlich hat
jede Zelle andere Spielerzahlen (40 bis 86 Einsätze je Liga und Spieltag), sodass ein p99,5-Anker je
nach Disziplin mal einmal, mal nie am Tag überschritten wird.

---

## 2. IST-Verteilung (gemessen)

**Sonde:** `scripts/miss-pp-skala.ts` (frischer Battle-Save über den Wizard-Pfad, 32 KI-Teams, Liga 1 + 2,
`runLocalMatchdayAutoRun` mit echtem Arena-Vorlauf, danach `buildSeasonPointsLedger()`), Auswertung
`scripts/werte-pp-skala-aus.mjs`. Wegwerf-SQLite unter `/tmp`, danach gelöscht. Save
`new-game-1794999566185-ees6r0`, 20 Spieltage, 4.975 PP-Zeilen, 80 Zellen.

**Zelle** = alle Einsätze einer Disziplin in einer Liga an einem Spieltag (alle 8 Duelle bzw. alle Pods
dieser Liga). „Max (Median)“ ist der Tagesbeste, gemittelt (Median) über die Zellen der Disziplin.
Jede Disziplin kam in diesem Save in 4 Zellen vor (2 Spieltage × 2 Ligen) — eine Saison, eine
Feldgröße je Disziplin; die Zahlen sind deshalb je Disziplin eine Stichprobe von 4.

| Disziplin | Quelle | Zellen | Einsätze/Zelle | Max (Median) | Max-Spanne | Top-3-Mittel | Median | Min | Zellen mit Top ≥ 5,4 | am Deckel je Zelle |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|---|
| basketball | Arena | 4 | 45,5 | 4,98 | 4,07..5,50 | 4,43 | 1,43 | 0,17 | 25 % | 0,1,0,0 |
| battlefield | Pod | 4 | 47,0 | 4,96 | 2,94..5,44 | 4,30 | 1,27 | 0,01 | 25 % | 0,0,0,0 |
| breaking | Arena | 4 | 70,5 | 4,46 | 2,10..5,19 | 3,76 | 0,75 | 0,00 | 0 % | 0,0,0,0 |
| climbing | Arena | 4 | 80,0 | **5,50** | 5,50..5,50 | 5,50 | 1,39 | 0,03 | 100 % | **8,8,8,7** |
| eiskunstlauf | Arena | 4 | 63,0 | **5,50** | 5,50..5,50 | 5,24 | 1,31 | 0,11 | 100 % | 1,1,2,1 |
| fechten | Arena | 4 | 55,5 | **3,95** | 2,60..4,46 | 3,48 | 0,68 | 0,03 | 0 % | 0,0,0,0 |
| football | Arena | 4 | 66,0 | 5,38 | 4,85..5,50 | 4,94 | 1,46 | 0,00 | 50 % | 2,2,0,0 |
| gewichtheben | Arena | 4 | 86,0 | 5,14 | 4,83..5,40 | 4,67 | 0,98 | 0,00 | 25 % | 0,0,0,0 |
| hockey | Arena | 4 | 39,5 | **5,50** | 4,15..5,50 | 4,92 | 1,31 | 0,13 | 75 % | 1,0,2,1 |
| i-spy | Arena | 4 | 71,5 | **5,50** | 5,50..5,50 | 4,92 | 1,38 | 0,14 | 100 % | 1,1,1,1 |
| mini-dm | Pod (FFA) | 4 | 77,0 | 5,42 | 5,30..5,50 | 5,26 | 1,48 | 0,00 | 50 % | 0,0,0,2 |
| showcase | Arena | 4 | 85,5 | 5,00 | 4,33..5,48 | 4,26 | 1,32 | 0,04 | 25 % | 0,0,0,0 |
| speed-schach | Arena | 4 | 63,5 | 4,95 | 4,63..5,50 | 4,52 | 1,26 | 0,03 | 25 % | 1,0,0,0 |
| spurt | Arena | 4 | 56,0 | **3,49** | 3,15..3,82 | 3,35 | 1,37 | 0,10 | 0 % | 0,0,0,0 |
| staffel | Bahn-Pod | 4 | 62,0 | **5,50** | 5,23..5,50 | 5,33 | 1,53 | 0,18 | 75 % | 4,4,2,0 |
| takeshis-castle | Bahn-Pod | 4 | 39,0 | 4,40 | 4,03..5,21 | 4,08 | 1,02 | 0,00 | 0 % | 0,0,0,0 |
| tdm | Arena | 4 | 40,0 | 5,02 | 4,25..5,50 | 4,58 | 1,33 | 0,00 | 50 % | 0,1,1,0 |
| tennis | Arena | 4 | 48,0 | **3,33** | 2,69..4,58 | 2,54 | 0,56 | 0,02 | 0 % | 0,0,0,0 |
| time-trial | Arena | 4 | 59,5 | **5,50** | 5,50..5,50 | 5,50 | 1,30 | 0,07 | 100 % | **8,8,3,6** |
| wettessen | Arena | 4 | 80,5 | 4,08 | 3,88..5,50 | 3,73 | 1,19 | 0,16 | 25 % | 1,0,0,0 |

**Spannweite des Tagesbesten über die 20 Disziplinen: 3,33 (Tennis) bis 5,50 (sechs Disziplinen am
Deckel).** Einzelne Zellen reichen von 2,10 (Breaking) bis 5,50. Der Median-Einsatz liegt fast überall bei
1,0–1,5 PP; die Unterschiede sitzen an der Spitze.

Saisonsummen (20 Spieltage, beide Ligen): bester Spieler 64,8 PP, Top-10-Mittel 48,3, Median 21,4.

Lesart: Der Mittelteil der Kurve passt (Median ≈ `0,25 × 5,5`, wie konstruiert); das Problem sind die
Anker an der Spitze. Climbing/Time-Trial/Staffel „spendieren“ den Deckel mehrfach je Tag und
können ihre Besten nicht mehr unterscheiden, Tennis/Spurt/Fechten/Wettessen/Breaking/Takeshi deckeln
ihre Besten bei 3,3–4,5.

### 2.1 Zweiter Save, ohne Deckel gemessen (`OLY_PP_SKALA=roh`)

Der Deckel 5,5 verdeckt, wie weit die Spitze wirklich streut. Der Diagnosemodus `roh` rechnet dieselbe
Kurve ohne `min(1, …)` (unterhalb des Deckels bit-gleich, Test `tests/pp-skala.test.ts`). Save
`new-game-1795003737169-pwc22d`, 20 Spieltage, 4.966 Zeilen. Er wurde nach Spieltag 5 durch Speichermangel
abgebrochen und mit `OLY_PP_SKALA_SAVE_ID` fortgesetzt; Spieltag 6 lief dabei über die PPS-Duell-Brücke
statt über die Arena (der verwaiste Vorlauf galt als ausgefallen), ebenfalls ein Produktionspfad.

| Disziplin | Einsätze/Zelle | Tagesbester ungedeckelt (Median) | Spanne | Zellen mit Tagesbestem ≥ 5,4 | Median-Einsatz |
|---|---:|---:|---|---:|---:|
| basketball | 70 | **8,23** | 7,47..8,95 | 100 % | 1,25 |
| battlefield | 55 | 4,93 | 3,19..6,61 | 25 % | 0,98 |
| breaking | 54,5 | **3,50** | 1,85..4,81 | 0 % | 0,73 |
| climbing | 75,5 | 5,50 | 5,50..5,50 | 100 % | 1,28 |
| eiskunstlauf | 40 | 4,47 | 2,45..8,19 | 50 % | 0,74 |
| fechten | 77,5 | 6,05 | 5,05..7,12 | 75 % | 1,49 |
| football | 65,5 | 5,68 | 3,58..8,60 | 50 % | 1,38 |
| gewichtheben | 40 | 5,03 | 3,26..5,81 | 50 % | 0,84 |
| hockey | 70,5 | **9,46** | 8,24..13,78 | 100 % | 1,27 |
| i-spy | 55,5 | 5,86 | 5,02..6,64 | 75 % | 1,36 |
| mini-dm | 67,5 | 5,15 | 4,46..6,15 | 25 % | 1,03 |
| showcase | 78,5 | 4,91 | 4,33..7,68 | 25 % | 1,22 |
| speed-schach | 71 | 5,42 | 5,29..6,33 | 50 % | 1,29 |
| spurt | 39 | **3,00** | 2,46..3,33 | 0 % | 1,20 |
| staffel | 53,5 | 5,50 | 5,50..5,50 | 100 % | 1,32 |
| takeshis-castle | 73,5 | 5,00 | 3,66..5,68 | 50 % | 0,53 |
| tdm | 79 | 6,31 | 6,00..6,55 | 100 % | 1,18 |
| tennis | 40 | 4,55 | 3,56..5,52 | 25 % | 1,42 |
| time-trial | 64 | 5,50 | 5,50..5,50 | 100 % | 1,45 |
| wettessen | 64 | 4,33 | 4,26..6,43 | 25 % | 1,25 |

**Ungedeckelt reicht der Tagesbeste von 3,00 (Spurt) bis 9,46 (Hockey)**, einzelne Zellen von 1,85 bis
13,78. Der Median-Einsatz streut zwischen 0,53 (Takeshi) und 1,49 (Fechten).

### 2.2 Zwei Befunde, die keine Skala behebt

- **Climbing, Time-Trial, Staffel im Duell: Platzpunkte statt Messwert.** Im Zwei-Team-Duell liefert der
  Bahn-Motor als Boxscore-`wert` die Platzierung im Lauf. In einer Liga-Zelle gibt es deshalb nur 8 bis
  12 verschiedene Werte (Climbing: 96 Einsätze, 12 Werte), und **jeder der 8 Duellsieger hat denselben
  Rohwert**. Im Vier-Team-Pod (Staffel Spieltag 16, Time-Trial Spieltag 19) sind die Werte dagegen fein
  (65 bis 68 verschiedene). Die 7 bis 8 Gleichstände am Deckel sind also ein Motor-Befund. Abhilfe ist
  ein feinerer Duell-Wert (Zeit, Vorsprung, Höhe), ein Rezept- bzw. Motorthema mit
  Fingerabdruck-Änderung und nicht Teil dieses Auftrags.
- **Dieselbe Disziplin streut zwischen Saves.** Basketball im ersten Save: Tagesbester 4,07..5,50
  (davon 3 von 4 Zellen unter dem Deckel, also echt), im zweiten Save ungedeckelt 7,47..8,95. Fechten 2,6..4,5
  gegen 5,1..7,1, Tennis 2,7..4,6 gegen 3,6..5,5. Teils ist das die Feldgröße (jede Disziplin kommt je
  Saison in zwei Feldgrößen vor; die Referenzen sind je Feldgröße eigen gezogen und unterschiedlich
  gealtert), teils die Liga: wie stark die besten Spieler einer Disziplin in DIESEM Save sind.

## 3. Abnehmer-Landkarte

„Absolut“ = der Abnehmer rechnet mit der PP-Zahl selbst (Schwellen, Summen über Disziplinen oder
Saisons, Multiplikatoren). „Rang“ = er nutzt nur die Reihenfolge innerhalb einer Disziplin bzw. Werte,
die eine monotone Umskalierung je Disziplin nicht ändert. „Keine PP“ = er liest gar keine PP.

| Abnehmer | Datei:Zeile | liest | hängt an |
|---|---|---|---|
| **Tabellenpunkte Saisonstand (Battle)** | `season-points-ledger.ts` (`tableGroupContributions`), `battle-mode-pps-duell.ts:40` | 2/1/0 je Duell | **keine PP** — seit 19.10. von Spieler-PP entkoppelt |
| Tabellenpunkte Manager-Modus | `rank-to-points.ts:155` | Σ Spieler-Anteile = Rangtabelle | keine Skalenänderung (Pfad wird nicht berührt) |
| Spieltagspunkte / Spieltagsrang | `lib/foundation/season-matchday-points.ts` | dieselbe Tabellenwährung | keine PP |
| **Spieler-Saisonsumme, Achsen-PP (Pow/Spe/Men/Soc), Spielerkarte** | `player-rating-contract.ts` (`ppsSeason`, `ppPow`…), `player-detail-drawer.ts:1237` | Σ PP über Disziplinen | **absolut** (Gewicht jeder Disziplin in der Summe) |
| PP-Saisonrang (`ppsSeasonRank`) → KI-Verkauf/Halten („Productive Elite“ ≤ 10, Ersatzgedächtnis ≤ 20) | `lib/ai/ai-sell-decision-engine.ts:47`, `ai-transfer-replacement-memory.ts:67`, `ai-transfermarkt-sell-preview-service.ts:661` | Rang der Summe | **absolut über Disziplinen** (Rang der Summe ändert sich, wenn Disziplinen anders gewichtet werden) |
| MVS (Marktwert-Rang, Sale-Factor) | `player-rating-contract.ts:265` (`buildRetoolMvsByPlayerId`), `lib/market/transfermarkt-sale-factor.ts:304` | Rang je Disziplin (Saisonsumme der Disziplin) | **Rang** — ein fester Faktor je Disziplin ändert keine Reihenfolge |
| **Trainings-XP (PPS-Bonus)** | `lib/training/player-progression-forecast.ts:144` (`pps × 4`, gedeckelt) | Saisonsumme | **absolut** |
| **Organische Entwicklung** | `lib/training/organic-season-progression.ts:691` (`scoreContribution / 30`) | PP je Einsatz | **absolut** (Skala /30 stammt aus der alten Rangtabelle bis 19,9; bei 0–5,5 kommt der Kanal ohnehin kaum über 0,2 × 0,22) |
| Leistungs-Signal Organik, Form, Board, Sponsoren | `organic-season-progression.ts:690`, `form-moral-modifikator.ts:248`, `team-season-objectives-service.ts:445`, `sponsor-objective-evaluator.ts:127` | `finalPlayerScore`, `rankInDiscipline` (nach Score!) | **keine PP** |
| Moral | `lib/morale/*` | Form-Residuum (Perzentile), Vertrag | keine PP |
| **Spieler des Tages / PP-Gewinner** (`ppWinners`) | `lib/season/matchday-mvp-scoring-service.ts:769` | PP über d1 + d2 sortiert | **absolut über Disziplinen** |
| Top-10/MVP-Kandidat je Disziplin (`isTop10`, `isMvpCandidate`, `rankInDiscipline`) | `legacy-matchday-resolve-engine.ts:1333` | `finalPlayerScore` | keine PP (Hinweis: bei Arena-Disziplinen kann der Score-Rang vom PP-Rang abweichen) |
| **Saison-Awards / Saison-MVP** | `lib/foundation/league-season-awards.ts:118` (Median-Schwelle, Max) | Saisonsumme | **absolut über Disziplinen** |
| **Rekordbuch, Hall of Fame** | `league-record-book.ts:159`, `league-records-hall-of-fame.ts` | Summen, Bestwerte | **absolut, auch über Saisons** |
| **Ewige Tabelle, Laufbahn, Allzeit-Statistik** | `eternal-player-table.ts:90`, `player-league-career-stats.ts`, `player-all-time-discipline-stats.ts` | Summen über Saisons | **absolut, über Saisons (Historie)** |
| Saison-Archiv (Snapshot) | `lib/season/season-snapshot-service.ts:393/481` | persistiert `totalPoints` je Spieler | **gespeicherte Historie** (alte Skala bleibt eingefroren) |
| Bestenliste / Leaders, Spielerverzeichnis-Perzentile | `league-leaders-service.ts`, `use-foundation-cross-tab-player-directory.ts:298` | Summen, Perzentile im Pool | Summe absolut, Anzeige rangbasiert |
| Arena-HUD / Live-Bühne / Spieltagsbericht | `DisciplineStageNativeArena.tsx:66`, `player-points-total.ts:22`, `discipline-stage-matchday-top-players.ts` | `pointsAwarded` (+ Mutator) | **Anzeige der Zahl** (zeigt automatisch die neue Skala, weil die Engine sie liefert) |
| Einsatzliste-Prognose, KI-Aufstellung | `ai-legacy-lineup-engine.ts:1648` (`totalExpectedScore`) | Score, nicht PP | keine PP |
| Punkteverhältnis D / 0–10-Ergebnis | `battle-mode-pps-duell.ts:178/434` | Seiten-Marge, Team-Score | keine Spieler-PP |
| Formatierung | `foundation-format-render-helpers.ts:526` (`formatPpsValue`, 1 Nachkommastelle) | – | Anzeige |

**Fazit Abnehmer:** Eine monotone Umskalierung je Disziplin ändert nichts an Tabelle, Form, Moral,
Board, Sponsoren, MVS/Marktwert-Rang und KI-Aufstellung. Sie ändert gewollt die **Summen über
Disziplinen** (Saison-PP, Achsen-PP, Saison-MVP, Spieler des Tages, PP-Saisonrang der KI, Trainings-XP):
heute zählt ein Climbing-Einsatz an der Spitze bis zu 65 % mehr als ein Tennis-Einsatz an der Spitze;
danach gleich viel. Und sie macht **Summen über Saisons** (Rekorde, ewige Tabelle) zwischen „vorher“ und
„nachher“ nur begrenzt vergleichbar (Abschnitt 5).

---

## 4. Varianten

Fünf Varianten, offline auf beiden Abzügen gerechnet (`werte-pp-skala-aus.mjs`). „rho“ ist hier Spearman
Eignung → PP innerhalb einer Zelle (alle Einsätze einer Liga an einem Spieltag), gemittelt über die 160
Zellen. Das ist nicht die Motor-Rangtreue je Spiel, sondern die Probe, ob die Abbildung Reihenfolgen
verschiebt. Auf dem AUS-Save rechnen die Varianten mit gedeckelten Werten (Näherung), auf dem `roh`-Save
exakt.

| Variante | Tagesbester (Median je Disziplin) | Tagesbester, kleinstes..größtes | rho vorher | rho nachher | Paare umgedreht | neue Gleichstände |
|---|---|---|---:|---:|---:|---:|
| IST (AUS gedeckelt, `roh` ungedeckelt) | 3,20..6,87 | 1,85..13,78 | 0,750 | 0,750 | 0 | 0 von 338.378 |
| A: nur Deckel 5,5 → 5 | 2,91..6,25 | 1,68..12,53 | 0,750 | 0,750 | 0 | 165 |
| B: Tagesanker (5 × PP / Tagesbester) | 5,00..5,00 | 5,00..5,00 | 0,750 | 0,750 | 0 | 163 |
| C: ein Faktor je Disziplin, Deckel 5 | 4,03..5,00 | 2,26..5,00 | 0,750 | 0,750 | 0 | 403 |
| **C2: Zwei-Anker je Disziplin, Deckel 5** | **4,23..5,00** | 2,49..5,00 | 0,750 | 0,750 | **0** | 346 |
| D: Rangtabelle (Rang 1 = 5, linear) | 4,72..5,00 | 4,44..5,00 | 0,750 | 0,750 | 0 | 0 |

Keine Variante dreht ein Paar um, alle sind je Zelle monoton. Die neuen Gleichstände (0,1 % der Paare)
liegen alle am neuen Deckel. Die Varianten unterscheiden sich darin, *was* die Zahl dann noch bedeutet.

### A — nur den Deckel auf 5 senken

`MAX` 5,5 → 5 in allen `*_INDIVIDUAL_PPS_MAX`. Ein Einzeiler, aber er verschiebt nur alles um −9 %: Tennis
landet bei 3,0, Hockey ungedeckelt weiter bei 8,6, Climbing klebt weiter am (neuen) Deckel. **Löst
Chris' Wunsch nicht.**

### B — Tagesanker: der Tagesbeste bekommt genau 5

`PP = 5 × (eigener Wert / Wert des Tagesbesten der Liga)`. Garantiert 5 für den Besten je Disziplin, Liga
und Spieltag, ohne Referenzen, drift-fest.
Nachteile: die Zahl wird **relativ zum Spieltag**. Ein mittelmäßiger Tagessieger an einem schwachen
Spieltag bekommt dieselbe 5 wie ein überragender, genau die Eigenschaft, die Chris am Perzentil-Modell
kritisiert hat („es soll nicht in jedem team duell immer ein spieler volle punktzahl bekommen“; hier pro
Liga statt pro Duell, aber dieselbe Logik). Die PP eines Spielers hängen von den anderen sieben Duellen
der Liga ab; Liga 2 bekommt dieselbe Spitze wie Liga 1; die Engine braucht dafür alle Duelle einer Liga,
bevor sie einen einzigen Spieler-PP zeigen kann. „Darstellung der Leistung“ wird zu „Darstellung des
Tagesrangs“.

### C — ein Faktor je Disziplin

`min(5, k_d × alter Wert ohne Deckel)`, `k_d = 5 / Median-Tagesbester`. Hebt bzw. senkt die Spitze
richtig, lässt aber die **Mitte** schief: wo die Spitze ein Ausreißer ist (Hockey, Basketball: der Beste
hat das 1,6- bis 2-Fache des Dritten), drückt der Faktor alle anderen mit. Median-Einsatz Basketball
1,25 → 0,78, Hockey 1,27 → 0,75. Umgekehrt treibt er bei Spurt die Mitte auf 2,11. Ein Faktor auf die
schon *gedeckelte* PP (die naheliegende Einzeilen-Lösung) könnte außerdem die Gleichstände am alten Deckel
nie mehr trennen.

### C2 — Zwei-Anker-Nachkalibrierung (empfohlen, Prototyp)

Dieselbe Kurve ohne alten Deckel (`roh = 5,5 · (s/S_krass)^γ`), dann je Disziplin:

```
R_top = Median der ungedeckelten Tagesbesten   -> 5
R_med = Median aller Einsätze der Disziplin     -> 1,25   (25 % von 5, wie die alte Kurve)
PP    = min(5, 5 · (roh / R_top)^e),   e = ln 0,25 / ln(R_med / R_top)
```

Das ist genau die Konstruktion der bestehenden Impact-Kurve (Mitte → 25 % des Maximums, Spitze → Maximum),
nur mit Ankern, die **für alle Disziplinen gleich definiert und am selben Motorstand gemessen** sind statt
p50/p99,5 einer je Disziplin zu anderer Zeit gezogenen Einzelwert-Referenz. Weil `roh` selbst ein
Potenzgesetz im Rohwert ist, ist auch das Ergebnis eins: streng monoton, Boden 0, ein Deckel.

- Spitze und Mitte werden zugleich vergleichbar (Tabelle 5.2: Tagesbester 5,00 in jeder Disziplin der
  Stichprobe, Median-Einsatz 0,73..1,78 statt 0,53..1,49; Exponent `e` je Disziplin 0,74..1,89).
- Die Zahl bleibt eine **absolute** Leistungsdarstellung: an einem starken Tag sind mehrere bei 5, an einem
  schwachen bleibt der Beste darunter.
- Wartung: zwei Zahlen je Disziplin, gezogen mit EINER Sonde für alle (`miss-pp-skala.ts` im Modus `roh`
  + `werte-pp-skala-aus.mjs --schreibe-kalibrierung`) statt 20 einzelner Referenzziehungen.

### D — Rangtabelle je Zelle

5 für den Besten, linear bis 0 für den Letzten. Gleichmäßig, wirft aber den Abstand weg: ein
Kantersieg und ein Fotofinish geben dieselben Punkte. Widerspricht „Darstellung der Leistung“.

### Bewertung

| | A | B | C | **C2** | D |
|---|---|---|---|---|---|
| Top ≈ 5 je Disziplin | nein | immer genau 5 | im Mittel | **im Mittel, Deckel 5** | immer 5 |
| Mitte vergleichbar | nein | nein | nein (Ausreißer) | **ja (1,25)** | ja |
| PP bleibt absolute Leistung | ja | nein (Tagesrang) | ja | **ja** | nein |
| Unabhängig von anderen Duellen | ja | nein | ja | **ja** | nein |
| Reihenfolge je Disziplin | bleibt | bleibt | bleibt | **bleibt** | bleibt |
| Abstände bleiben sichtbar | ja | relativ | ja | **ja** | nein |
| Wartung | keine | keine | 1 Zahl je Disziplin | **2 Zahlen je Disziplin, eine Sonde** | keine |
| Eingriff | 20 Konstanten | Engine + Ledger neu | Kurve + 6 Aufrufer | **Kurve + 6 Aufrufer, eine JSON** | wie B |

**Empfehlung: C2.** Sie erfüllt den Wortlaut („Top-Spieler um die 5 als Maximum“) und den Nebensatz
(„weiterhin eine Darstellung der Leistung“) zugleich, ist mit der bestehenden Kurve exakt verträglich und
macht nebenbei die Mitte der zwanzig Disziplinen vergleichbar. Will Chris, dass der Tagesbeste an
**jedem** Spieltag 5 bekommt, ist B die Alternative; dann aber mit dem ausdrücklichen Preis, dass
PP relativ zum Spieltag werden.

---

## 5. Prototyp `OLY_PP_SKALA` (Standard AUS)

### 5.1 Bau

- `lib/resolve/pp-skala.ts`: Schalter (`ppSkalaModus()`: `aus` | `an` | `roh`), Anker je Disziplin aus
  `data/generated/pp-skala-kalibrierung.json` (`rTop`, `rMed`; `faktor` nur zum Vergleich mit C),
  `ppAusKurveSkaliert()` (Kurve ohne Deckel → Zwei-Anker → Deckel 5; Spurt-Stationsduelle als Zuschlag
  unter demselben Deckel). Ohne Anker für eine Disziplin bleibt der alte Wert, nur bei 5 gedeckelt.
- Aufrufer, die bei AN statt der alten Kurve `ppAusKurveSkaliert()` nehmen (bei AUS betritt keiner den
  neuen Zweig, alles bit-identisch):
  `battle-mode-arena-team-points.ts` (`computeIndividualBoxscorePpsFromFixtureResults`, Feld + Torwart),
  `bahn-pod-matchday.ts`, `battlefield-pod-matchday.ts`, `mini-dm-ffa-matchday.ts`,
  `legacy-matchday-resolve-engine.ts` (PPS-Duell), `season-points-ledger.ts` (PPS-Duell-Neurechnung).
  Arena-/Pod-Zeilen vertraut der Ledger wie bisher. Sie kommen schon skaliert aus der Engine, es wird
  nicht doppelt skaliert. Live-Bühne und persistierte Zeile lesen dieselbe Map („gezeigt = gebucht“).
- `roh` ist ein reiner Messmodus (alte Skala ohne Deckel), aus dem die Anker gezogen werden. Nie im Spiel.
- `NEXT_PUBLIC_OLY_PP_SKALA` muss beim Build gleich stehen wie `OLY_PP_SKALA`: der Saisonstand rechnet
  PPS-Duell-Zeilen im Browser nach. Stünde der Browser auf AUS und der Server auf AN, wäre „gezeigt ≠
  gebucht“. Für den Prototyp reicht das; für den Ernstfall gehört die Skala-Version in den Spielstand (5.4).
- Sonde: `scripts/miss-pp-skala.ts` (frischer Save oder `OLY_PP_SKALA_SAVE_ID` zum Fortsetzen),
  Auswertung `scripts/werte-pp-skala-aus.mjs` (`--schreibe-kalibrierung`, `--kalibrierung=<datei>`).
- Tests: `tests/pp-skala.test.ts` (AUS-Erkennung, `roh` = alte Kurve unterhalb des Deckels, Anker treffen
  5 und 1,25 exakt, Deckel, Boden, Entartung, Monotonie, gültige Anker).

### 5.2 Messung vorher/nachher

**In der Stichprobe** (`roh`-Save, exakt; Anker aus beiden Saves, `R_top` nur aus den `roh`-Zellen):

| Disziplin | alt: Tagesbester | alt: am Deckel je Zelle | alt: Median-Einsatz | C2: Tagesbester (Median, Spanne) | C2: am Deckel je Zelle | C2: Top-3-Mittel | C2: Median-Einsatz |
|---|---:|---|---:|---|---|---:|---:|
| basketball | 5,50 | 2,3,3,2 | 1,25 | 5,00 (4,72..5,00) | 1,1,0,1 | 4,24 | 1,21 |
| battlefield | 4,93 | 0,0,1,0 | 0,98 | 5,00 (3,33..5,00) | 2,1,1,0 | 4,52 | 1,05 |
| breaking | 3,50 | 0,0,0,0 | 0,73 | 5,00 (3,06..5,00) | 1,3,1,0 | 4,27 | 1,20 |
| climbing | 5,50 | 3,5,8,8 | 1,28 | 5,00 (5,00..5,00) | 3,5,8,8 | 5,00 | 1,37 |
| eiskunstlauf | 4,47 | 0,0,0,2 | 0,74 | 5,00 (3,31..5,00) | 0,1,3,4 | 4,86 | 0,86 |
| fechten | 5,50 | 4,2,0,1 | 1,49 | 5,00 (4,46..5,00) | 4,2,0,1 | 4,42 | 1,52 |
| football | 4,89 | 0,0,3,4 | 1,38 | 5,00 (3,98..5,00) | 0,1,8,7 | 4,70 | 1,18 |
| gewichtheben | 4,98 | 0,0,1,1 | 0,84 | 5,00 (3,68..5,00) | 0,1,2,1 | 4,51 | 0,98 |
| hockey | 5,50 | 4,9,1,5 | 1,27 | 5,00 (4,90..5,00) | 1,2,0,1 | 4,62 | 1,23 |
| i-spy | 5,50 | 1,1,0,1 | 1,36 | 5,00 (4,48..5,00) | 1,1,0,1 | 4,15 | 1,29 |
| mini-dm | 5,15 | 0,0,1,0 | 1,03 | 5,00 (4,41..5,00) | 0,1,4,2 | 4,89 | 1,07 |
| showcase | 4,91 | 1,0,0,0 | 1,22 | 5,00 (4,82..5,00) | 1,0,1,1 | 4,71 | 1,24 |
| speed-schach | 5,42 | 0,0,0,1 | 1,29 | 5,00 (4,91..5,00) | 1,0,1,1 | 4,71 | 1,29 |
| spurt | 3,00 | 0,0,0,0 | 1,20 | 5,00 (3,78..5,00) | 2,4,0,1 | 4,59 | 1,00 |
| staffel | 5,50 | 4,4,3,1 | 1,32 | 5,00 (5,00..5,00) | 4,4,3,1 | 5,00 | 0,99 |
| takeshis-castle | 5,00 | 0,1,0,0 | 0,53 | 5,00 (4,11..5,00) | 4,1,2,0 | 4,82 | 0,73 |
| tdm | 5,50 | 1,2,2,2 | 1,18 | 5,00 (4,94..5,00) | 0,1,1,1 | 4,71 | 1,17 |
| tennis | 4,55 | 1,0,0,0 | 1,42 | 5,00 (4,39..5,00) | 3,1,2,0 | 4,49 | 1,78 |
| time-trial | 5,50 | 8,8,7,8 | 1,45 | 5,00 (5,00..5,00) | 8,8,7,8 | 5,00 | 1,39 |
| wettessen | 4,33 | 0,0,1,0 | 1,25 | 5,00 (4,97..5,00) | 1,1,3,0 | 4,43 | 1,31 |

Zusammengefasst je Zelle (Tagesbester zwischen 4 und Deckel):

| | Tagesbester in [4; Deckel] | unter 4 | über 5 | Zellen mit ≥ 3 am Deckel | Median-Einsatz je Zelle |
|---|---:|---:|---:|---:|---|
| `roh`-Save, alt (Deckel 5,5) | 67/80 (84 %) | 13 | 54 | 19 | 0,04..2,68 |
| `roh`-Save, **C2** (in der Stichprobe) | **74/80 (93 %)** | 6 | **0** | 22 | 0,08..2,58 |
| AUS-Save, alt (Deckel 5,5) | 68/80 (85 %) | 12 | 44 | 10 | 0,25..2,17 |
| AUS-Save, **C2** (Anker fest, Näherung aus gedeckelten Werten = Untergrenze) | **≥ 63/80 (79 %)** | ≤ 17 | 0 | 24 | 0,32..2,05 |
| dritter, frischer Save mit `OLY_PP_SKALA=an` (Ende-zu-Ende, 6 Spieltage, 12 Disziplinen) | **18/24 (75 %)** | 6 | **0** | 3 | 0,61..2,85 |

Die Gleichstände am Deckel steigen leicht (19 → 22 Zellen mit ≥ 3 Spielern bei 5). Ein großer Teil davon
sind die strukturellen Duellsieger von Climbing/Time-Trial/Staffel (Abschnitt 2.2), die übrigen kommen
daher, dass `R_top` auf den **Median**-Tag zielt: an der stärkeren Hälfte der Spieltage stehen dann
naturgemäß ein bis drei Spieler bei 5. Stellschraube, falls Chris weniger Gleichstände will: `R_top` auf
das 75. Perzentil der Tagesbesten legen. Dann bekommt der Beste an einem typischen Tag ~4,6–4,8, und die
5 wird seltener.

Außerhalb der Stichprobe fallen Basketball (2,98..3,74) und Hockey (2,96..3,64, Untergrenze) im AUS-Save
deutlich unter 4. Das ist der Befund aus 2.2: dort lag die Spitze im ersten Save viel niedriger als im
zweiten. Mit mehr Saves in der Kalibrierung und Ankern je Feldgröße wird das kleiner, ganz verschwinden kann
es bei einer absoluten Skala nicht.

**Ende-zu-Ende** (`OLY_PP_SKALA=an`, Save `new-game-1795007742662-j5dd3m`, 6 Spieltage, 1.450 Zeilen,
ganz außerhalb der Stichprobe): kein gebuchter Einsatz über 5, Tagesbester (Median je Disziplin) 3,07
(Spurt) bis 5,00. Basketball 4,37, Hockey 4,22, Fechten 4,16, Wettessen 4,06, Breaking 4,33; Battlefield,
Football und Gewichtheben 5,00. Ausreißer ist Spurt bei Feldgröße 2 (32 Einsätze je Zelle, Tagesbester
3,02..3,12): die Anker stammen aus Spurt-Zellen mit größerem Feld. Genau dafür sind Anker je Feldgröße
nötig (5.4 Punkt 6). Gleichstände am Deckel: nur 3 von 24 Zellen mit ≥ 3 Spielern bei 5.

### 5.3 Rangtreue und Pp-Abweichung

- **rho je Spiel** und **Pp-Abweichung** werden am Motor gemessen (`miss-alle-disziplinen.mjs`,
  `messe-arena-einfluss.mjs`), vor jeder PP-Kurve. Der Schalter berührt keine Zeile des Motors; beide
  Abnahmen bleiben, was in `data/generated/disziplin-abnahme.json` steht.
- Innerhalb einer Zelle ist die Abbildung streng monoton bis zum Deckel 5. Probe an beiden Abzügen
  (338.378 Paare): **0 Paare umgedreht**, Spearman Eignung → PP 0,750 → 0,750.
- Neue Gleichstände entstehen nur am neuen Deckel (346 von 338.378 Paaren, 0,1 %).
- Die Eignungsmatrix ist nicht berührt.

### 5.4 Was die Abnehmer anpassen müssten (bei Scharfschaltung)

1. **Organische Entwicklung** (`organic-season-progression.ts:691`): `/30` stammt aus der Rangtabellen-Zeit.
   Unabhängig von dieser Änderung ein Altfehler; bei 0–5 sinnvoll `/5`. Getrennt entscheiden, weil es die
   Spielerentwicklung verschiebt.
2. **Trainings-XP** (`player-progression-forecast.ts:144`, `pps × 4`, Deckel 35 bzw. 35 % der MVS-XP):
   Saisonsummen ändern sich je Spieler, im Mittel wenig (Median-Einsatz bleibt ~1,25); die Deckel greifen
   bei guten Spielern ohnehin. Keine Codeänderung, aber vor/nach am Abbild messen.
3. **Saison-MVP, Spieler des Tages, PP-Saisonrang der KI**: keine Codeänderung. Sie werden gewollt fairer
   zwischen Disziplinen (heute zählt z. B. ein Hockey-Spitzeneinsatz bis 5,5, ein Spurt-Spitzeneinsatz
   höchstens ~3,8).
4. **Historie**: Arena-/Pod-Zeilen sind mit dem Wert ihres Spieltags persistiert und bleiben auf der alten
   Skala. PPS-Duell-Zeilen rechnet der Ledger beim Lesen neu und würden rückwirkend umskaliert. Für eine
   saubere Umstellung: **zum Saisonwechsel** scharf schalten (dann ist jede Saison in sich einheitlich)
   und die Skala-Version (`ppSkala: { version }`) an der Leistungszeile speichern, damit der Ledger alte
   Zeilen nach ihrer eigenen Version liest. Rekordbuch und ewige Tabelle bekommen den Hinweis „ab Saison N
   neue PP-Skala“; Summen über Saisons bleiben grob vergleichbar, weil sich der Median-Einsatz kaum
   ändert, nur die Spitze.
5. **Anzeige**: unverändert eine Nachkommastelle je Einsatz; die Tabelle (2/1/0) ist ohnehin ganzzahlig.
6. **Kalibrierung vor Scharfschaltung**: 3 bis 5 weitere Saves im Modus `roh`, Anker je (Disziplin,
   Feldgröße) statt je Disziplin, sobald genug Zellen je Feldgröße da sind (Ziel ≥ 6).

---

## 6. Wertungs-Fingerabdruck

`node scripts/pruefe-wertung-fingerabdruck.mjs` auf diesem Branch:

| Schalter | Ergebnis |
|---|---|
| AUS (Standard, `OLY_PP_SKALA` nicht gesetzt) | **GESAMT ce8fcef66028 (75 Eintraege)**, wie auf `main` (CLAUDE.md) |
| AN (`OLY_PP_SKALA=an`, `NEXT_PUBLIC_OLY_PP_SKALA=an`) | **GESAMT ce8fcef66028 (75 Eintraege)**, alle 75 Zeilen byte-gleich zu AUS |

Erwartet: der Fingerabdruck läuft nur über den Motor (`battle-mode.engine.js`), die PP-Kurve sitzt danach
in TypeScript. Er beweist damit, dass der Schalter den Motor nicht berührt; die PP-Änderung selbst zeigt er
nicht (dafür Abschnitt 5.2).

---

## 7. Risiken

- **Stichprobe**: zwei Saves, je Disziplin 8 Zellen, davon 4 ungedeckelt. Die Anker sind eine erste
  Schätzung (Abschnitt 5.4 Punkt 6).
- **Grenze einer absoluten Skala**: der Tagesbeste hängt an der Stärke der Liga (Basketball 4,1..5,2 gegen
  7,5..8,9 zwischen zwei Saves). C2 trifft 5 im Mittel, nicht an jedem Tag. Wer jeden Tag 5 will, braucht B.
- **Strukturelle Gleichstände** (Climbing/Time-Trial/Staffel im Duell): ohne feineren Motorwert bleiben 7 bis
  8 Duellsieger je Zelle gleichauf. Das ist ein eigener Motor-/Rezeptauftrag mit Fingerabdruck-Änderung.
- **Drift**: wie heute die Referenzen veralten die Anker mit jeder Motoränderung (Basketball Runde 2 lief am
  selben Tag). Gegenmittel: die Sonde in die Abnahme einer Motoränderung aufnehmen, mit einer Zahl je
  Disziplin („Median-Tagesbester unter C2 zwischen 4,5 und 5“).
- **Browser/Server-Schalter** (5.1): nur ein Prototyp-Risiko.
- **Historie** (5.4): sauber nur mit Schaltung zum Saisonwechsel und gespeicherter Skala-Version.
- **Messbetrieb**: zwei Läufe wurden auf dem gemeinsam genutzten Rechner vom Speicher-Killer beendet
  (Exit 137). Ein Lauf wurde fortgesetzt, der andere verworfen. Bei Wiederholung `OLY_ARENA_TIER_PARALLEL=0`
  setzen und nur einen Lauf zugleich fahren.
