# Battle Mode an die Arena gebunden: 20 Spieltage, Doppel-Rundenplan, Punkteverhältnis, simulierte Liga 2, die fünf Nicht-Arena-Disziplinen (16.10.)

Recherche-Stand: 2026-10-16, Repo `/home/user/Olympiade-der-Welten`, `main` = `24476e6b` (nach
PR #1262). Alle Datei-/Funktionsangaben sind gegen den echten Code geprüft, nicht vermutet; die
Seitenstand-Zahlen in Abschnitt 3 stammen aus einer eigenen, heute gefahrenen Playwright-Sonde
(Methode dort). Erarbeitet auf Basis von Chris' Wunsch vom 16.10., wörtlich:

> „nee der battle mode soll ja direkt an die battle arena angebunden sein! spieltage müssen
> vergeben werden, eine neue spieltagstabelle wie in der bundesliga usw. dann das 2 ligen system
> mit je 16 teams! 2. liga wird ja komplett simuliert quasi und findet parallel zur ersten statt."
>
> „wir haben ja 20 disziplinen und es soll 16 teams in liga 1 geben und 20 Spieltage. Das heißt
> alle Diszis finden 2x statt immer 2 parallel pro Spieltag. Zb Spieltag 1 = Battlefield + I Spy.
> Dann treten Team 1 vs Team 2 in Battlefield UND in I Spy nacheinander an - beides gibt normal 2
> punkte für sieg 1 unentschieden 0 niederlage. Punkteverhältnis wird berechnet aus dem scoring
> heraus und normalisiert auf max 10 punkte glaube ich? 2. Liga hat genau den selben ablauf und
> gleiche Diszis! Mutatoren müssen VOR start ausgewürfelt werden damit das spiel weiß welche
> Spieler Boni bekommen"

Dieses Dokument baut auf `docs/design/liga-split-plan.md` (25.08.),
`docs/design/battle-mode-spielmodus-plan.md` (26.08., Entscheidungen 30.08.) und
`docs/design/battle-mode-20-spieltage-recherche-06-09.md` (Chris' Entscheidungen 06.09.) auf und
wiederholt deren Entscheidungen nicht — es sagt nur, was davon gebaut ist, was fehlt, und
entscheidet die vier Fragen, die dort noch offen oder noch nicht gestellt waren.

---

## 0. Wichtige Funde vorab (die Chris' Auftrag präzisieren oder ihm widersprechen)

1. **Gut die Hälfte des Auftrags ist bereits entschieden und gebaut — nur nicht eingeschaltet.**
   Die 20-Spieltage-Struktur („jede Disziplin genau zweimal, einmal je Saisonhälfte, zweite
   Kadergröße nie gleich") hat Chris am 06.09. selbst festgelegt, und W1 aus der damaligen
   Recherche ist seit PR #930 im Code: `getSeasonDisciplineRepeatCount()` liefert für
   Battle-Saves `2` (`lib/season/season-discipline-schedule.ts:41-43`),
   `buildSeasonSeededDisciplineSchedule({ repeat: 2 })` baut zwei Halbserien mit Derangement
   der Kadergrößen (`:496-531`), `occurrenceInSeason` sitzt am Spielplan-Slot, 
   `tests/season-discipline-schedule-battle-repeat.test.ts` beweist es. **Aber kein einziger
   Erzeuger der Saisonlänge ruft das auf**: `lib/data/dataAdapter.ts:46` baut hart 10
   `matchdayIds`, `lib/game/new-game-setup-service.ts` enthält das Wort `repeat` nicht (0
   Treffer), `lib/season/preseason-workflow-service.ts:552/:565` erbt `matchdayIds.length || 10`.
   **Ein heute angelegter Battle-Save bekommt 10 Spieltage, jede Disziplin einmal.** Das ist
   W2 der 06.09.-Recherche, und die war ausdrücklich an eine Voraussetzung gebunden (Fund 2).
2. **Der eine Blocker heißt Fatigue, nicht Spielplan.** `docs/design/fatigue-saisonlaenge-plan.md`
   Teil C: „Teil A (20 Spieltage) darf **nicht ohne** die Fatigue-Rekalibrierung aktiviert
   werden — sonst verdoppelt sich exakt das Problem, das Chris lösen will". Stand heute: PR1
   (aktive Erholung) ist gebaut, aber `OLY_FATIGUE_ACTIVE_RECOVERY` steht auf **Default AUS**
   (`lib/fatigue/fatigue-injury-service.ts:220-253`); PR2 (Korridor für 10 UND 20 Spieltage neu
   vermessen) und PR3 (Flag-Default umstellen) sind offen. Wer 20 Spieltage einschaltet, ohne
   das, schaltet laut Fatigue-Plan B.2 „13 von 20 Spieltagen im Maximalrisiko statt 3 von 10"
   ein. Das ist der kritische Pfad dieses ganzen Vorhabens (Abschnitt 6).
3. **Der Liga-Spielplan wickelt bei 20 Spieltagen heute exakt um.** `buildSeasonFixtureSchedule()`
   (`lib/season/season-fixture-schedule.ts:151-153`) nimmt Runde `(offset + index) % 15` — die
   Spieltage 16–20 wiederholen die Runden der Spieltage 1–5 **inklusive derselben
   Heim/Auswärts-Verteilung**, und die Warnung `fixture_schedule_matchday_count_exceeds_rounds`
   (`:142-146`) feuert. Der Fatigue-Plan (PR5) und die 06.09.-Recherche (W3) nennen beide die
   Lösung — Doppel-Rundenplan mit 30 Runden — gebaut ist sie nicht. Abschnitt 2 entscheidet sie.
   Positiv: der Nebenfund F3 von damals (Saison 2+ ohne Circle-Generator) **ist inzwischen
   behoben** (`preseason-workflow-service.ts:608-619`), und Mini-DMs Vierergruppen
   (`lib/season/mini-dm-pod-schedule.ts`) haben sich vom Rundenwrap bewusst entkoppelt — ein
   Umbau des Generators zieht sie nicht mit.
4. **Es gibt in einem Battle-Save heute ZWEI Punkte-Ökonomien nebeneinander, und das ist die
   eigentliche Lücke hinter Chris' Satz „beides gibt normal 2 Punkte".** Der Resolve
   (`lib/resolve/legacy-matchday-resolve-engine.ts:784-795`) zahlt
   `arenaOverride ? arenaOverride.teamPoints : getRankToPointsValue(playerCount, rank)`. Für
   die 15 arena-aufgelösten Disziplinen sind das 2/1/0. Für die fünf anderen (Football, I-Spy,
   Battlefield, TDM, Mini-DM) und für **jeden** Spieltag, an dem der Arena-Lauf scheitert,
   läuft der Manager-Mode-Pfad: `references/sheets/rank-to-points.json` zahlt Rang 1 bei zwei
   Spielern 6,6 Punkte, bei sechs 19,9. **Ein PPS-Spieltag ist damit bis zu zehnmal so viel
   Tabelle wert wie ein Arena-Sieg.** `battle-mode-spielmodus-plan.md` 5.1 hat am 30.08.
   ausdrücklich festgehalten, dass Battle-Mode-Standings „eine eigene Aggregation" brauchen —
   die existiert bis heute nicht. Abschnitt 5 löst das, und die Lösung ist zugleich die Antwort
   auf die Frage nach den fünf Nicht-Arena-Disziplinen.
5. **Es gibt kein Punkteverhältnis — und keine Spalte, die eins aufnehmen könnte.**
   `StandingRecord` (`lib/data/olyDataTypes.ts:304-318`) trägt `points`, `rank`, `startplatz`,
   `rankDiff` — nichts Duell-Bezogenes. `DisciplineResultRecord` (`:2559-2583`) persistiert
   `teamPoints`/`resolutionSource`/`arenaMatchSeed`/`momente`, aber **nicht den Seitenstand**:
   `ArenaTeamPointsOverride.seiten` (`battle-mode-arena-team-points.ts:949`, Kommentar: „für
   Anzeige/Tie-Breaking, NICHT für die Punktevergabe") lebt nur im Speicher des Resolve-Laufs
   und ist nach dem Buchen weg. `totalScore` der Zeile bleibt auch bei einem Arena-Ergebnis der
   **PPS-Score** (`rankWithinLeagueScope(..., (r) => r.score)`, `:774-776`). Folge für die
   Tabelle: `sortForProjectedPoints()` (`lib/standings/standings-tiebreaker-policy.ts:42-56`)
   bricht Punktgleichstand über `totalScore` — also über eine Zahl, die das Ergebnis gar nicht
   entschieden hat. Bei 2/1/0 über 40 Slots (Saisonmaximum 80, ganzzahlig, 16 Teams) sind
   Punktgleichstände der Normalfall, nicht die Ausnahme; `DEFAULT_STANDINGS_TIEBREAKER_MODE =
   "block_on_tie"` (`:4`) würde dann `requiresConfirmedTieBreaker` verlangen. **Das
   Punkteverhältnis ist deshalb kein Schmuck, sondern der fehlende Tiebreaker** (Abschnitt 3).
6. **Die Seitenstände der fünf Chassis liegen vier Größenordnungen auseinander — und zwei
   Bahnen liefern gar keinen Abstand.** Eigene Sonde heute (Abschnitt 3.2): Breaking endet
   `1:0`/`2:0` (Überlebende), Gewichtheben `6:0` bis `3:3` (Duelle), Basketball `77:25`,
   Eiskunstlauf `5251:3666` (Punktsummen), Takeshi `87,2:30,4` (Burgpunkte), Spurt/Climbing
   `25:30` (Rangpunkte, Summe stets 78 bei 6 je Seite). **Staffel und Time-Trial geben `seiten`
   als reines `1:0` zurück** (`bahnTeamstand()`, `wertung:"etappe"`/`"zeit"`,
   `battle-mode.engine.js:37139-37231`) — der Zeitabstand existiert dort bereits (Time-Trial
   als Feld `delta`, `:37208`; die Staffel hält die beiden Zieleinlauf-Zeiten `z[0]`/`z[1]`,
   `:37227-37228`, ohne sie als Differenz zurückzugeben), nur `spieleBahn()` (`:53397-53410`)
   reicht nichts davon hinaus. Eine Formel, die „das Scoring"
   normalisiert, muss also je Chassis eine andere Rohgröße lesen und braucht je Disziplin eine
   Bezugsgröße — genau das Muster, das die Impact-Kurve für die PPs schon hat
   (`data/generated/<disziplin>-pps-referenz.json`, `iMittel`/`iKrass` je Feldgröße).
7. **„Mutatoren VOR Start auswürfeln" ist bereits exakt so gebaut.** `determineArenaDisciplineContexts()`
   (`lib/season/arena-matchday-resolve-service.ts:115-135`) würfelt je arena-aufgelöster
   Disziplin den Spieltagswurf aus denselben Feldern, aus denen `buildLegacyMatchdayResolvePreview()`
   später würfelt, und reicht ihn als `matchdayMutatorTraits` fest in `runBattleModeArenaMatchday()`
   (`battle-mode-arena-team-points.ts:1331-1337`, „EIN Wurf für alle Fixtures dieser Disziplin").
   Der interaktive Host bekommt denselben Wurf (`mutatorenByDisciplineId` in
   `FoundationBattleArenaHost.tsx`). Hier ist nichts zu tun außer, es Chris zu sagen.
8. **Liga 2 wird heute schon im selben Lauf simuliert.** `runBattleModeArenaMatchday()` iteriert
   `LEAGUE_TIERS = ["liga1","liga2"]` (`:928`, `:1339-1382`) und fährt für jede Liga ihre acht
   Fixtures — beide Ligen haben denselben Disziplin-Spielplan (es gibt nur einen
   `disciplineSchedule` je Saison), denselben Mutator-Wurf und dieselbe 2/1/0-Umrechnung.
   „Gleicher Ablauf, gleiche Diszis" ist erfüllt. Was „komplett simuliert" NEU verlangt, ist
   eine **Eigentums-Regel** (kein Mensch in Liga 2), und die kollidiert mit zwei bestehenden
   Entscheidungen: `liga-split-plan.md` 2.4 („ein Mensch darf Teams in beiden Ligen
   kontrollieren — keine Sperre") und Chris' eigenem Preset `CHRIS_ONLINE_4V4_TEAM_IDS = ["P-S",
   "D-P", "M-M", "V-W"]` (D-P Rang 18, V-W Rang 30 → Liga 2). Abschnitt 4 legt die Regel vor,
   die beides versöhnt; die letzte Entscheidung ist Chris' (Abschnitt 7.3).
9. **Auf-/Abstieg ist nicht gebaut, und ohne ihn ist „komplett simuliert" harmlos, mit ihm
   nicht.** `RELEGATION_COUNT = 3` (`lib/season/league-split.ts:43`) wird von keinem
   Produktionscode gelesen (`preseason-workflow-service.ts:593-595` sagt es selbst). Solange
   niemand absteigt, kann ein menschliches Liga-1-Team nie in die simulierte Liga geraten. Sobald
   der Abstieg kommt (und er muss kommen, sonst ist Liga 2 eine Kulisse), braucht die Regel aus
   Abschnitt 4 eine Antwort auf „mein Team steigt ab".
10. **Die Saisonstand-Ansicht kennt keine Ligen.** `app/foundation/season-v2/SeasonStandingsNewLook.tsx`
    rendert EIN `nl-standings-board` (`:2719`); `getLeagueOf`/`isLeagueSplitActive` wird unter
    `app/` nirgends gelesen (0 Treffer), unter `lib/foundation` nur für die Gegner-Disziplinränge
    im Spielplan-Tab (`use-foundation-cross-tab-discipline-ranks.ts:267`). Chris' „neue
    Spieltagstabelle wie in der Bundesliga" ist also sowohl Daten (Fund 5) als auch Anzeige
    (zwei 16er-Tabellen, Verhältnis-Spalte, Auf-/Abstiegszonen) — `liga-split-plan.md` 6 hat die
    Anzeige geplant, PR 7 von damals wurde nie gebaut.
11. **Die vier bzw. fünf Disziplinen außerhalb der Arena, frisch nachgesehen** (alle Zahlen aus
    `docs/design/stand-aller-disziplinen.md` und den Einzeldokumenten vom 13.–15.10., nicht aus
    dem Auftragstext — der nannte für Mini-DM 0,256 und für I-Spy 0,684, beides veraltet):

    | Disziplin | Chassis | rho je Spiel | Pp-Abweichung | Was fehlt |
    |---|---|---:|---:|---|
    | Football | Feldspiel | **0,814** (26.09./29.09.) | **47,3** (verletzt) | Pp-Runde; rho besteht seit 26.09. (die 0,722 im Kommentar von `arena-resolved-disciplines.ts:139` ist stale) |
    | I-Spy | Bühne-Auftritt | 0,750 (15.10.) | 13,6 (bestanden) | 0,05 rho; Raumwahl I-1 gebaut, Standard Werkstatt |
    | Mini-DM, FFA (gespieltes Format) | eigener Schlagwechsel | **0,80/0,82** (13.10.) | **8,7/9,0** (bestanden) | **kein Resolve-Pfad** — 4-Team-Pod statt 2-Team-Fixture, Liga-Punkte 2-1-0-0 (Chris) |
    | Mini-DM, 4-gegen-4-Chassis | Arena | 0,588 | 55,6/43,9 | wird nicht mehr gespielt (Chris 14.09.: „immer 4 teams mit je 1 spieler") |
    | Battlefield | Arena | 0,399 | 30,1/37,1 (15.10.) | rho — Domination-Layer gebaut (22.09.), rho unverändert |
    | TDM | Arena | 0,324 | 51,4 | rho; V9 (Zusammenhalt als Handwerk) gemessen 0,416/0,432, nicht eingeschaltet |

    Chris' Beispiel „Spieltag 1 = Battlefield + I-Spy" trifft damit ausgerechnet zwei Disziplinen,
    die an der 0,80-Schranke scheitern — und die Schranke gilt laut CLAUDE.md „für jede Disziplin,
    nicht nur wenn gerade Zeit ist". Abschnitt 5 nimmt das ernst, ohne den Spielplan zu
    verstümmeln: ein 20-Spieltage-Plan mit nur 15 Disziplinen gäbe es nicht (40 Slots verlangen
    20 Disziplinen × 2).

---

## 1. Die Architektur-Entscheidung: EIN Rückgrat, zwei Ligen, jede Disziplin ein Duell

**Entschieden (Chris, 30.08./06.09./16.10., hier nur zusammengeführt):** Eine Battle-Mode-Saison
hat 20 Spieltage à zwei Disziplinen, jede der 20 Disziplinen genau zweimal (einmal je Hälfte,
zweite Kadergröße ≠ erste), 2×16 Teams, je Spieltag acht Fixtures je Liga, jede Disziplin
ein Zwei-Team-Duell mit 2/1/0, Mutatoren vor dem Lauf fest gewürfelt.

**Was dieses Dokument dazu entscheidet, in einem Satz:** *Das Fixture (Team A gegen Team B an
Spieltag k) ist die Einheit, auf der ALLES gewertet wird — beide Disziplinen des Spieltags, in
beiden Ligen, egal ob der Score aus der Arena oder aus der PPS-Formel kommt.* Die Arena ist
ein **Score-Lieferant je Disziplin**, nicht die Bedingung dafür, dass ein Duell stattfindet. Das
löst Fund 4 (zwei Ökonomien) und Fund 11 (fünf Disziplinen ohne Arena) mit derselben
Regel, hält die Pflichtschranke aus CLAUDE.md unangetastet (ein Arena-Motor ersetzt den
PPS-Score erst, wenn er rho > 0,80 UND Pp ≤ 25 besteht — genau wie heute über
`ARENA_RESOLVED_DISCIPLINE_IDS`), und macht das Punkteverhältnis für alle 40 Slots definierbar.

Die drei Schichten, von unten nach oben, jede eine eigene PR-Gruppe (Abschnitt 6):

1. **Spielplan**: 20 Spieltage (W2, Fatigue-gebunden) + Doppel-Rundenplan (Abschnitt 2).
2. **Wertung**: 2/1/0 je Fixture für alle 20 Disziplinen + Punkteverhältnis als Tabellenspalte
   und Tiebreaker (Abschnitte 3 und 5).
3. **Ligen**: Liga 2 ohne Menschen, Auf-/Abstieg, zwei Tabellen (Abschnitt 4).

---

## 2. Frage 1 — Die 20-Spieltage-Struktur und die Paarungswiederholung

### 2.1 Was NICHT neu zu entscheiden ist

Die Disziplin-Seite ist seit 06.09. entschieden und gebaut (Fund 1): Spieltage 1–10 sind
Halbserie 1 (jede Disziplin einmal, kategorie-balancierte Kadergrößen `[2,3,4,5,6]`), Spieltage
11–20 Halbserie 2 (dieselben 20 Disziplinen, Kadergröße je Disziplin ein Derangement der ersten
Hälfte, also nie gleich), Spieltag 10 → 11 darf dieselbe Disziplin tragen (Chris 30.08.). Die
Frage „muss die Disziplin beim zweiten Mal gegen denselben Gegner laufen?" beantwortet die
bestehende Architektur **mit Nein, und das ist richtig so**: Disziplin-Plan
(`buildSeasonSeededDisciplineSchedule`) und Paarungs-Plan (`buildSeasonFixtureSchedule`) sind
zwei unabhängige, je eigens geseedete Schichten, die am Spieltag zusammengesteckt werden. Ein
Team trifft an Spieltag k genau einen Gegner und spielt gegen ihn **beide** Disziplinen des Tages
(Chris: „Team 1 vs Team 2 in Battlefield UND in I Spy nacheinander") — das ist heute schon so,
weil `findLeagueFixturesForMatchday()` je Liga und Spieltag genau acht Fixtures liefert und der
Arena-Lauf für D1 und D2 dieselben Fixtures nimmt (nur mit `disciplineId` im Seed,
`buildArenaMatchSeed`). Die Disziplin beim zweiten Vorkommen an einen bestimmten Gegner zu
koppeln, würde die Zufälligkeit der Paarungen einschränken, ohne dass eine Spielidee dahinter
steht; Hin-/Rückrunde ist ein Begriff der **Disziplinen** (`occurrenceInSeason`), nicht der
Gegner.

### 2.2 Die Paarungen: Doppel-Rundenplan mit 30 Runden, 20 davon in Folge — Empfehlung

16 Teams haben 15 eindeutige Runden; 20 Spieltage sind mehr als 15 und weniger als 30. Drei
Möglichkeiten, eine davon ist richtig:

| Variante | Wie | Gegner je Saison | Nachteil |
|---|---|---|---|
| A. Status quo (Wrap) | Runde `(offset+i) % 15` | 15 × einmal, 5 × zweimal **mit derselben Heim/Auswärts-Seite** | Spieltag 16 sieht aus wie Spieltag 1, Warnung feuert; fühlt sich wie ein Fehler an |
| B. Zwei Halbserien à 10 | Hälfte 2 = neue Permutation, 10 Runden | im Schnitt ~13 verschiedene, 5 Gegner bleiben ganz ungespielt, manche trifft man dreimal | Die eine Garantie, die 20 Spieltage endlich erlauben (jeder gegen jeden), wird verschenkt |
| **C. Doppel-Rundenplan 30, Fenster 20** | Runden 1–15 Circle, Runden 16–30 dieselben mit **getauschter** Heim/Auswärts-Seite; die Saison nimmt 20 aufeinanderfolgende ab `offset ∈ 0..29` (zyklisch) | **jeder gegen jeden genau einmal, fünf Gegner ein zweites Mal mit getauschter Seite**; welche fünf, rotiert per Seed über Saisons | keiner, den die anderen nicht auch hätten |

**Empfehlung: C.** Es ist exakt das, was `fatigue-saisonlaenge-plan.md` PR5 und die
06.09.-Recherche F1/W3 schon vorgeschlagen haben — hier nur konkretisiert, damit es gebaut
werden kann:

- `buildCircleRounds()` bleibt **unverändert** (Mini-DM-Pods und Tests hängen daran). Neu daneben
  in derselben Datei: `buildDoubleRoundRobin(teamIds) = [...rounds, ...rounds.map(swapHomeAway)]`.
- `buildSeasonFixtureSchedule()` wechselt den Seed auf `fixtures-v2` (alte Saves behalten ihre
  bereits gebuchten `schedule`-Arrays, nichts wird migriert; die Fixture-Erzeugung läuft nur bei
  Saisonstart), zieht `offset` aus `0..29` und nimmt `rounds[(offset + index) % 30]`. Die
  Warnung `fixture_schedule_matchday_count_exceeds_rounds` bleibt für `matchdayIds.length > 30`
  stehen — für 20 feuert sie nicht mehr.
- Ein Rundenfenster der Länge 20 enthält immer alle 15 Grundrunden mindestens einmal (das Fenster
  ist länger als 15) und genau 5 Runden zweimal — in der zweiten Fassung gespiegelt. Für die
  Anzeige im Spielplan-Tab heißt das: „Rückspiel gegen X" ist ein echter, zeigbarer Begriff.
- Heim/Auswärts hat weiterhin keine Spielwirkung (Datei-Kommentar `season-fixture-schedule.ts:68-69`
  gilt weiter); es ist die Seite in `ArenaFixtureInput` und damit die Seite 0/1 im Motor — eine
  spätere Heimvorteil-Idee hätte hier bereits ihren Anker.
- Mini-DM: unverändert — `mini-dm-pod-schedule.ts` zieht seine eigene Permutation und ist vom
  Rundenwrap ausdrücklich entkoppelt (Kopfkommentar dort, Zeilen 32-41).

**Tests (Vitest, 200 Seeds je Liga):** 160 Fixtures je Liga bei 20 Spieltagen; jedes Paar ≥ 1 und
≤ 2 Mal; ein Paar mit zwei Treffen hat getauschte Heim/Auswärts-Seiten; alle Fixtures
liga-intern; Determinismus bei gleichem Seed; Manager-Saves ohne Split bit-identisch (Dummy-Plan
unverändert).

### 2.3 Wann 20 Spieltage wirklich eingeschaltet werden (W2)

Nicht in dieser Runde, und nicht vor Fatigue-PR2/PR3 — das ist die **einzige harte
Reihenfolge-Abhängigkeit** dieses Dokuments (Fund 2). Der Schalter selbst ist klein (drei
Erzeuger auf `getSeasonDisciplineRepeatCount(gameState)` umstellen, Battle-only, keine
Migration — 06.09.-Recherche Abschnitt 2 und 5, von Chris nicht widersprochen). Was bis dahin
parallel gebaut werden kann, ohne dass ein Battle-Save mit 10 Spieltagen falsch wird: Doppel-
Rundenplan (bei 10 Spieltagen liefert er 10 eindeutige Runden, wie heute), Punkteverhältnis,
PPS-Duell-Brücke, zwei Tabellen. Nur W2 wartet.

---

## 3. Frage 2 — Das Punkteverhältnis: Formel, Beispiele, Verankerung

### 3.1 Was es ist — und was nicht

Chris' „Spieltagstabelle wie in der Bundesliga" plus „Punkteverhältnis" plus „normalisiert auf
max 10" liest sich als eine Sache: die **Tordifferenz-Spalte** einer Liga-Tabelle, nur mit dem
Zusatz, dass ein Basketball-Sieg 87:72 und ein Gewichtheben-Sieg 4:2 nicht auf derselben Skala
liegen und deshalb je Duell auf eine gemeinsame Skala **0–10** gebracht werden müssen, bevor man
sie addieren kann.

**Empfehlung: Das Verhältnis ist eine eigene Tabellenspalte und der erste Tiebreaker nach den
Punkten — es gibt KEINE Punkte.** Drei Gründe:

1. Die 2/1/0 sind „gesetzt" (30.08.). Ein Bonus von 0–10 obendrauf würde einen Kantersieg bis
   zu sechsmal so viel wert machen wie einen knappen Sieg und einen Sieg zweimal bezahlen (einmal
   als Sieg, einmal als Höhe) — das ist die Rang-Ökonomie, von der Chris sich mit 2/1/0 gerade
   verabschiedet hat.
2. Bei 2/1/0 über 40 Slots sind Punktgleichstände der Normalfall (Fund 5); der heutige
   Tiebreaker `totalScore` ist der PPS-Score und hat mit dem Duell nichts zu tun. Die Tabelle
   braucht genau die Spalte, die Chris beschreibt — als Tiebreaker.
3. Es ist die Lesart, die jeder Spieler ohne Erklärung versteht: „Punkte, dann Verhältnis".

### 3.2 Die Rohgröße je Chassis — gemessen, nicht angenommen

Sonde heute (Playwright gegen `public/mockups/battle-mode.html`, fünf echte Team-Paarungen aus
`data/generated/kaderfamilie-live-save.json`, je 8 Saaten, also n = 40 je Disziplin; Skript im
Sitzungs-Scratchpad, bewusst nicht ins Repo gelegt — eine Abnahme-Ziehung braucht n und
Feldgrößen-Trennung wie `scripts/ziehe-buehne-pps-referenz.ts`, s. 3.4). Die Paarungen der
Kaderfamilie sind teils ungleich stark; die Zahlen zeigen **Größenordnungen**, keine Referenz:

| Disziplin | `spiele*` | Beispiel-Seitenstände | Median Summe | \|h−g\| Median / p75 / p90 / max | Remis |
|---|---|---|---:|---|---:|
| Basketball | Feldspiel | 77:25, 80:41, 71:34 | 85 | 28 / 39 / **47** / 52 | 0 % |
| Hockey | Feldspiel | 6:4, 7:2, 3:9 | 11 | 5 / 9 / **10** / 12 | 7,5 % |
| Gewichtheben | Heben (Duelle) | 6:0, 3:3, 4:2 | 6 | 2 / 6 / **6** / 6 | 15 % (→ kg) |
| Speed-Schach | Duell (Brettpunkte) | 3:3, 2:4, 4:2 | 6 | 2 / 4 / **6** / 6 | 12,5 % |
| Tennis | Duell (Rubber) | 4:1, 3:2 | 5 | 3 / 5 / **5** / 5 | 0 % |
| Fechten | Duell (kumulierte Treffer) | 38:33, 21:35 | 76 | 6 / 13 / **16** / 24 | 5 % |
| Showcase | Auftritt (Punktsumme) | 2755:1742 | 3973 | 715 / 845 / **995** / 1150 | 0 % |
| Eiskunstlauf | Auftritt | 5251:3666 | 8792 | 1585 / 2140 / **2360** / 2785 | 0 % |
| Wettessen | Auftritt | 4260:3714 | 7388 | 422 / 602 / **754** / 860 | 0 % |
| I-Spy | Auftritt (Schatzsuche) | 1274:999 | 2186 | 244 / 326 / **416** / 554 | 0 % |
| Breaking | Gauntlet (Überlebende) | 1:0, 2:0 | 1 | 1 / 1 / **2** / 2 | 0 % |
| Spurt | Bahn, `rang` (Rangpunkte) | 25:30, 22:33 | 78 | 8 / 14 / **24** / 26 | 5 % |
| Climbing | Bahn, `rang` | 35:43, 30:48 | 78 | 12 / 16 / **26** / 26 | 0 % |
| Takeshi's Castle | Bahn, `burg` (Burgpunkte) | 87,2:30,4 | 91,9 | 39,5 / 53,8 / **60,9** / 77,1 | 0 % |
| Staffel | Bahn, `etappe` | **1:0** | 1 | 1 / 1 / 1 / 1 | 0 % |
| Time-Trial | Bahn, `zeit` | **0:1** | 1 | 1 / 1 / 1 / 1 | 0 % |

Zwei Schlüsse daraus:

- **Ein Anteil `h/(h+g)` taugt nicht als Normierung.** Breaking läge immer bei 10 (Verlierer hat
  0 Überlebende), Basketball 87:72 bei 0,9, ein Staffelsieg immer bei 10. Jede Disziplin braucht
  eine **eigene Bezugsgröße** für „deutlicher Sieg".
- **Staffel und Time-Trial brauchen eine andere Rohgröße als `seiten`.** `bahnTeamstand()` hat sie
  (Time-Trial: `delta` = Zeitabstand der Zeitsummen in Simulationssekunden, `:37208`; Staffel:
  `|z[0]−z[1]|` aus den beiden Zieleinlauf-Zeiten, `:37227-37228`, dort noch ohne eigenes
  Feld), `spieleBahn()` muss sie nur mit hinausreichen — **zwei additive Zeilen** nach dem
  Muster, mit dem `spieleBuehneHeben()` `gesamtKg` anhängt.

### 3.3 Die Formel

Je Fixture, nach dem Lauf, mit `m` = Rohabstand der Disziplin (Tabelle oben; für Staffel/Time-Trial
die Zeitdifferenz in Sekunden) und `M90(d, n)` = 90. Perzentil von `m` in einer **festen,
einmalig gezogenen Referenz** je Disziplin `d` und Feldgröße `n` (Abschnitt 3.4):

```
D(fixture) = 0                                  bei Unentschieden (2 Punkte → 1/1)
           = max(1, round(10 · min(1, m / M90)))  sonst
```

Sieger `+D`, Verlierer `−D`. Tabellenspalte `verhaeltnis = Σ ±D` über die Saison (Bereich
−400…+400 bei 40 Slots). `max(1, …)` garantiert, dass ein Sieg nie 0 Verhältnis einbringt (sonst
wären ein 1:0-Sieg in Breaking und ein Remis in der Spalte ununterscheidbar); `min(1, …)` ist ein
Deckel, keine Asymptote — dasselbe bewusste Muster wie `ppsAusArenaImpact()` („wer `I_krass`
erreicht, bekommt die volle Punktzahl, nicht nur eine Annäherung"). `M90` statt `max`, damit ein
einzelner Ausreißer in der Referenz nicht den ganzen Bereich zusammendrückt; 90 statt 99,5 wie bei
`iKrass`, weil die Spalte **Abstände** zeigen soll, nicht Rekorde — ein Zehntel der Siege darf
„10" sein.

**Gewichtheben-Sonderfall (kg-Tiebreak):** entscheidet bei `3:3` die Kilogrammsumme
(`arenaTeamPointsForFixtureMitTiebreak()`), ist `m = 0` in Duellen, der Sieg aber echt — `D = 1`
(„knappster möglicher Sieg"). Keine zweite Referenz für kg nötig.

**Beispielrechnungen** (M90 aus der Sonde oben, also nur illustrativ; die produktive Referenz muss
gezogen werden):

| Duell | m | M90 (Sonde) | m/M90 | D | Tabelle |
|---|---:|---:|---:|---:|---|
| Basketball 87:72 | 15 | 47 | 0,32 | **3** | Sieger +3 / Verlierer −3 |
| Basketball 77:25 | 52 | 47 | 1,11 → 1 | **10** | +10 / −10 |
| Gewichtheben 4:2 | 2 | 6 | 0,33 | **3** | +3 / −3 |
| Gewichtheben 6:0 | 6 | 6 | 1,00 | **10** | +10 / −10 |
| Gewichtheben 3:3, 812 kg gegen 790 kg | 0 (kg entscheidet) | — | — | **1** | +1 / −1 |
| Showcase 2755:1742 | 1013 | 995 | 1,02 → 1 | **10** | +10 / −10 |
| I-Spy 1274:999 | 275 | 416 | 0,66 | **7** | +7 / −7 |
| Tennis 3:2 | 1 | 5 | 0,20 | **2** | +2 / −2 |
| Hockey 6:4 | 2 | 10 | 0,20 | **2** | +2 / −2 |
| Speed-Schach 3:3 | 0 | — | — | **0** | 1 Punkt / 1 Punkt, Verhältnis ±0 |
| Breaking 1:0 | 1 | 2 | 0,50 | **5** | +5 / −5 |
| Time-Trial, 4,8 s Vorsprung | 4,8 s | *zu ziehen* | — | — | — |

Ein 20-Spieltage-Vergleich, damit die Spalte Sinn hat: zwei Teams mit je 52 Punkten — eins mit
Verhältnis +118 (viele deutliche Siege, wenige knappe Niederlagen), eins mit +31 — stehen nicht
mehr „nach `totalScore`", sondern nach dem, was sie in ihren Duellen gezeigt haben. Erst bei
Gleichstand auch dort greift der heutige Rest der Sortierung (`matchdayRank`, `currentRank`,
Name) unverändert.

### 3.4 Die Referenz `M90(d, n)` — gezogen, nicht geraten

Exakt derselbe Weg wie die PPS-Referenz: `scripts/ziehe-buehne-pps-referenz.ts` (und die
Basketball-/Gewichtheben-/Hockey-/Football-Pendants) fahren bereits `runArenaFixtures()` gegen
echte Liga-Kader aus dem `live-save`-Abbild, je Feldgröße 2..6, und sehen dabei `seiten` (künftig
`marge`) ohnehin — sie müssen den Wert nur **zusätzlich** quantilisieren und als
`margeReferenz: { feldgroessen: { "2": { n, m90 }, … } }` in dieselbe
`data/generated/<disziplin>-pps-referenz.json` schreiben (additiv; `ArenaPpsReferenzJson` bekommt
ein optionales Feld, alte Dateien ohne das Feld → Fallback `D = 5` für jeden Sieg, mit Warnung
`verhaeltnis_referenz_fehlt:<disziplin>`, nie ein Wurf). Provenienz (Motor-SHA1, Commit, Datum)
steht dann wie heute in der Datei selbst.

Warum je Feldgröße: bei Gewichtheben ist `m ≤ n` (höchstens n Duelle), bei Spurt/Climbing ist die
Rangpunkte-Summe `n(2n+1)` — derselbe Abstand bedeutet bei 2 je Seite etwas völlig anderes als bei
6. Genau die Begründung, aus der `iMittel`/`iKrass` je Feldgröße getrennt sind
(`battle-mode-arena-team-points.ts:36-41`).

### 3.5 Datenmodell und Pipeline (alles additiv)

```ts
// lib/battle/arena-headless-runner.ts
export type ArenaFixtureResult = {
  // ... unverändert ...
  /** Rohabstand der Disziplin (|h−g|, oder Zeitabstand bei Staffel/Time-Trial), s. Konzept 16.10. Abschnitt 3.2. */
  marge?: number;
};

// lib/resolve/battle-mode-arena-team-points.ts
export type ArenaTeamPointsOverride = {
  // ... unverändert ...
  /** ±D nach Abschnitt 3.3, aus Sicht DIESES Teams (Sieger positiv). */
  verhaeltnis: number;
};

// lib/data/olyDataTypes.ts
export type DisciplineResultRecord = { /* ... */ verhaeltnis?: number | null; };
export type StandingRecord          = { /* ... */ verhaeltnis?: number | null; };
```

- `spieleBahn()`/`spieleFeldspiel()`/`spieleBuehne*()` liefern `marge` (Bahn `zeit`/`etappe`:
  `st.delta`; sonst `|seiten[0]−seiten[1]|`); `runArenaFixtures()` reicht es durch.
- `computeArenaTeamPointsFromFixtureResults()` rechnet `D` über `resolveMargeReferenz(d, n)`
  (neuer Nachbar von `resolveArenaPpsReferenz()`, gleiche Feldgrößen-Fallback-Logik).
- `legacy-matchday-resolve-engine.ts:784-806` schreibt `verhaeltnis: arenaOverride?.verhaeltnis ?? 0`
  in die `DisciplineTeamResolvePreview`, der Mapper (`legacy-matchday-result-mapper.ts`) in die
  Zeile, `standings-apply-service.ts` summiert es idempotent neben `points` (dieselbe
  `matchdayBaseline*`-Mechanik, sonst zählt ein `forceReplace` doppelt).
- `StandingsTieBreakItem` bekommt `verhaeltnis`, `sortForProjectedPoints()` sortiert
  `projectedPoints → verhaeltnis → totalScore → …`. Für Manager-Saves ist `verhaeltnis` überall
  `null`/0 und die Sortierung bit-identisch.
- Für die fünf PPS-Disziplinen liefert die Brücke aus Abschnitt 5 `m` = Score-Abstand und `M90`
  aus der PPS-Score-Verteilung — dieselbe Formel, andere Quelle.

---

## 4. Frage 3 — Liga 2 „komplett simuliert"

### 4.1 Was heute schon stimmt

Beide Ligen laufen im selben Hintergrundlauf (Fund 8), mit demselben Disziplin-Spielplan,
demselben Mutator-Wurf, denselben 2/1/0, derselben PPS-Referenz (Chris 31.08.: „gemeinsam über
beide Ligen", `battle-mode-pps-modell-plan.md` 7.2). KI-Teams werden über
`TeamControlSettings.controlMode: "ai"` (`lib/foundation/team-control-settings.ts`) vom
bestehenden Auto-Run (`lib/season/matchday-auto-run-service.ts`, Schritte `ai_lineups →
resolve_preview → result_apply → standings_apply → …`) und den Preseason-Automaten
(`aiPreseasonAutomationRuns`, `league-setup-draft-service.ts`) vollständig geführt. **Eine Liga,
in der alle 16 Teams `controlMode: "ai"` haben, IST „komplett simuliert" — ohne neuen Code.**

### 4.2 Was neu ist: die Eigentums-Regel — Empfehlung

„Komplett simuliert" heißt: **kein menschlich kontrolliertes Team in Liga 2**. Das widerspricht
`liga-split-plan.md` 2.4 und Chris' 4v4-Preset (Fund 8). Empfehlung, die beides zusammenbringt:

1. **Neue Battle-Saves**: der Team-Wähler im Anlege-Assistenten (`new-game-setup-wizard`) bietet
   im Battle Mode nur die 16 Teams mit Budget-Startrang ≤ 16 an (`buildInitialLeagueAssignment`),
   die 16 Liga-2-Teams sind ausgegraut mit Hinweis „Liga 2 wird simuliert". Manager Mode
   unverändert. Das 4v4-Preset wird im Battle Mode auf Liga-1-Teams gemappt (P-S und M-M bleiben,
   D-P/V-W werden durch die nächsten freien Liga-1-Teams ersetzt) — oder Chris wählt neu.
2. **Invariante** `assertLiga2IsAiOnly(gameState)` in `withNormalizedTeamControlSettings()`
   (Ladepfad): ein Battle-Save, in dem ein `controlMode: "manual"`-Team in Liga 2 steht, ist ein
   Fehlerzustand und wird mit Warnung geheilt (Team → `ai`, derselbe Heilungs-Weg wie
   `heileFalschAlsMenschMarkierteTeams()`), **außer** im Fall 3.
3. **Abstieg eines menschlichen Teams** (sobald Auf-/Abstieg gebaut ist, 4.3): **das Team bleibt
   menschlich, Liga 2 ist in dieser Saison für dieses eine Team nicht simuliert.** Alternative
   wäre „Game Over" oder „Zwangs-KI" — beides nimmt dem Spieler das Spiel in dem Moment, in dem
   es spannend wird. „Simuliert" ist dann eine Eigenschaft der Liga *ohne menschliche
   Teilnahme*, nicht ein Verbot. Chris muss das abnicken (7.3), weil es seine Formulierung
   „komplett" relativiert.

### 4.3 Auf-/Abstieg — was zu bauen ist (unverändert aus `liga-split-plan.md` 7, hier nur mit
den Battle-Mode-Folgen)

`league_movement` in `runSeasonCompletion()` zwischen `snapshot` und `transition`, auf der
Form-Card-bereinigten Endtabelle **nach Punkten, dann Verhältnis** (3.3 — die Spalte ist für
den Abstieg so wichtig wie für die Meisterschaft); `RELEGATION_COUNT = 3`; in
`buildNextSeasonGameState()`/`preseason-workflow-service.ts:608-619` die **neue** Zuordnung an
`buildSeasonFixtureSchedule()` reichen (der Kommentar dort sagt bereits, dass genau dieser Block
umgestellt werden muss). Sponsor-Zonen-Term (`liga-split-plan.md` 4) bleibt der Ort für die
Finanzseite.

### 4.4 Sichtbarkeit — Empfehlung: sichtbar, nicht bedienbar

Liga 2 ist für den Spieler **lesbar** (Tabelle, Spielplan, Ergebnisse, Boxscores — dieselben
Komponenten wie Liga 1, nur ohne Aufstellungs-/Markt-Aktionen) und **nicht anfassbar**. Drei
Gründe: (a) Auf-/Abstieg braucht Sichtbarkeit — wer absteigen könnte, will wissen, wer
aufsteigt; (b) die Daten existieren ohnehin (derselbe Save, dieselben Tabellen); (c) „unsichtbar
im Hintergrund" wäre für den Spieler ununterscheidbar von „gibt es nicht". Ein Nachrichtenticker
(„Liga 2: X schlägt Y 6:0 im Gewichtheben") ist ein hübscher Zusatz über die bestehende
Game-Inbox (`lib/foundation/game-inbox-service.ts`), aber nicht Teil der ersten Runde.

Die Anzeige-Seite (zwei 16er-Tabellen, Verhältnis-Spalte, Auf-/Abstiegszonen, „Rückspiel gegen"
im Spielplan-Tab) ist `liga-split-plan.md` PR 7, nie gebaut — gehört hier in Gruppe 3 (Abschnitt 6).

---

## 5. Frage 4 — Battlefield, I-Spy, Mini-DM, TDM (und Football): Option (c), die PPS-Duell-Brücke

### 5.1 Warum (a) und (b) allein nicht reichen

- **(a) „Spieltags-Planer wählt nur aus den 15 arena-fähigen"** ist mit 20 Spieltagen
  **unmöglich**: 40 Slots verlangen 20 Disziplinen × 2; mit 15 Disziplinen gäbe es 30 Slots.
  Und es wäre falsch: Chris will alle 20, zweimal.
- **(b) „erst alle vier kalibrieren, dann Battle Mode"** hängt Battle Mode an die vier
  schwierigsten Motoren des Projekts. TDM (0,324) und Battlefield (0,399) stehen seit Wochen
  mit großem Aufwand unter 0,50; das Projekt hat an keiner Stelle gezeigt, dass das schnell geht.
- **Der Status quo ist das Schlimmste von allem** (Fund 4): die fünf Disziplinen laufen heute
  in einem Battle-Save über den Rang-Pfad und zahlen bis zu 19,9 Punkte für Rang 1 — neben 2
  für einen Arena-Sieg. Das ist keine „Hybrid-Lösung", das ist eine kaputte Tabelle.

### 5.2 Die Empfehlung: jede Disziplin ist ein Duell, die Arena ist nur die bessere Score-Quelle

Für jede Disziplin ohne Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS` wird in einem Battle-Save
**dasselbe Fixture** gewertet, nur mit dem PPS-Score als Rohwert:

```ts
// lib/resolve/battle-mode-pps-duell.ts (neu, rein, synchron — kein Browser)
export function ppsDuellOverrides(
  fixtures: Fixture[],                              // die 8 des Spieltags je Liga
  scoreByTeamId: ReadonlyMap<string, number>,       // result.score aus scoreLegacyLineupDisciplineSide()
  margeReferenz: { m90: number },                   // aus der PPS-Score-Verteilung, je Disziplin & Feldgröße
): Map<string, ArenaTeamPointsOverride>             // dieselbe Form wie die Arena-Overrides
```

- Sieg/Remis/Niederlage: `scoreHeim > scoreGast` → 2/0, gleich → 1/1 (der PPS-Score ist eine
  Fließkommazahl aus Eignung, Form, Mutator und Slot — ein exaktes Remis ist praktisch
  ausgeschlossen, bleibt aber defensiv ein Remis).
- Verhältnis: `m = |scoreHeim − scoreGast|`, `M90` aus derselben Referenz-Ziehung (PPS-Scores
  über echte Kader, je Feldgröße — `scripts/ziehe-pps-duell-referenz.ts`, ein Nachbar der
  Arena-Skripte, aber ohne Playwright, weil der PPS-Pfad reiner Node-Code ist).
- Einhängen an genau der Stelle, an der heute die Arena-Overrides eingehängt werden
  (`legacy-matchday-resolve-engine.ts:765-768`): `arenaOverridesForThisDiscipline ?? ppsDuellOverrides(...)`
  für Battle-Saves, `pointSource: "battle_mode_pps_duell"`, `resolutionSource: "pps"`.
  Individuelle Spieler-PPs laufen weiter über `distributeRankPointsToPlayers()` wie heute — nur
  der **Team**-Wert wechselt auf 2/1/0, exakt die Trennung, die der Kommentar `:836-839` für den
  Arena-Fall schon beschreibt.

**Warum das die Pflichtschranke nicht verletzt:** Die rho-Schranke misst, ob ein *Motor* die
Eignung in Einzelspiel-Rang übersetzt. Der PPS-Pfad ist kein Motor, sondern die deterministische
Manager-Mode-Formel, die das gesamte Spiel seit Saison 1 trägt — sie **ist** die Eignung (plus
Form/Mutator/Slot). Ein Arena-Motor ersetzt sie in einer Disziplin erst, wenn er beweist, dass er
sie *verbessert* (rho > 0,80, Pp ≤ 25). Diese Reihenfolge ist exakt die heutige
(`ARENA_RESOLVED_DISCIPLINE_IDS`-Eintrag erst nach bestandener Abnahme); die Brücke ändert
nichts daran, sie macht nur die Tabelle schon vorher konsistent.

### 5.3 Mini-DM: der eine Fall, der nicht in ein Zwei-Team-Fixture passt

Chris 14.09.: Mini-DM ist „immer 4 teams mit je 1 spieler", als Vierergruppe
(`mini-dm-pod-schedule.ts`), mit Liga-Punkten **2-1-0-0** je Event (Chris, zitiert in
`mini-dm-nachtkonzept-03-10.md:62`). Das ist weder 2/1/0 noch ein Fixture — und das FFA-Format
besteht seit 13.10. **beide** Pflichtzahlen (rho 0,80/0,82, Pp 8,7/9,0), hat aber keinen
Resolve-Pfad. Empfehlung: Mini-DM bekommt als **einzige** Disziplin einen eigenen Pod-Resolve
(vier Teams je Pod, `miniDmFfaSonde()`-Nachbar als `spieleMiniDmFfa()` im Motor, Liga-Punkte
2-1-0-0, Verhältnis aus den Rundenpunkten 4-3-2-1 gegen den Pod-Median mit derselben
`M90`-Normierung) — genau der „eigene, separate Resolve-Pfad", den der 13.10.-Nachtrag als
nächsten Schritt benennt. Bis er gebaut ist, läuft Mini-DM über die PPS-Duell-Brücke wie die
anderen vier (die Pods existieren nur im Spielplan-Tab, nicht in der Wertung — das ist heute
schon so).

### 5.4 Reihenfolge der Kalibrierung — was die Brücke ablöst

| Reihe | Disziplin | Warum jetzt | Was fehlt |
|---|---|---|---|
| 1 | **Mini-DM FFA** | besteht rho UND Pp bereits | nur der Pod-Resolve (5.3) |
| 2 | **Football** | rho 0,814 besteht | eine Pp-Runde (47,3 → ≤ 25; sechs Matrixattribute werden von `feldspielWert()` nicht gelesen, Stand-Doku Z. 747) |
| 3 | **I-Spy** | 0,750, Pp 13,6 besteht | 0,05 rho — Raumwahl ist gebaut, „Kennerblick" und „Spur statt Los" gemessen/verworfen; nächster Hebel offen |
| 4 | Battlefield | 0,399 | rho — Domination-Layer hat nichts gebracht; TMP/AUS-Normierung bleibt draußen (15.10.) |
| 5 | TDM | 0,324 | rho — V9 (0,416/0,432) wartet auf die Pp-Messung |

Jede Disziplin wechselt einzeln per Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS` von der Brücke
in die Arena — ohne dass der Spielplan, die Tabelle oder das Verhältnis etwas davon merken.

---

## 6. Empfohlene Umsetzungsreihenfolge (Gruppen, jede hält `main` deploybar)

Gruppe 1 und 2 sind unabhängig voneinander und von Fatigue; nur W2 (Gruppe 1, PR 3) wartet.

**Gruppe 1 — Spielplan**
1. Doppel-Rundenplan (`buildDoubleRoundRobin`, `fixtures-v2`, Offset 0..29, Tests) — Abschnitt 2.2.
2. `spieleBahn()`-Export von `marge` (Zeitabstand) + `marge` an allen fünf `spiele*`-Einstiegen
   (Motor-Patch, bit-identisch für `seiten`/`boxscore`).
3. **W2 — erst nach Fatigue-PR2/PR3**: drei Erzeuger auf `getSeasonDisciplineRepeatCount()`,
   Battle-only, keine Migration; `transfer-sell-view-labels.ts:302` („nach Spieltag 10"), B1/B2-
   Fallbacks, Test-Erwartungen (06.09.-Recherche 1.4); E2E am Live-Abbild (alle sieben Saves
   bleiben bei 10).

**Gruppe 2 — Wertung**
4. `verhaeltnis` im Datenmodell (`DisciplineResultRecord`, `StandingRecord`, `StandingsTieBreakItem`),
   Sortierung `points → verhaeltnis → totalScore`, Standings-Apply idempotent; für Manager-Saves
   bit-identisch (Feld `null`).
5. `margeReferenz` in den Referenz-Skripten ziehen (alle 15 Arena-Disziplinen, je Feldgröße) +
   `resolveMargeReferenz()` + `D` in `computeArenaTeamPointsFromFixtureResults()`.
6. PPS-Duell-Brücke (`battle-mode-pps-duell.ts`, Referenz-Skript, Einhängen im Resolve) — ab
   hier zahlt JEDE Disziplin in einem Battle-Save 2/1/0 und ein Verhältnis.
7. Mini-DM-Pod-Resolve (5.3).

**Gruppe 3 — Ligen**
8. Eigentums-Regel (Wizard-Filter, Invariante, Preset-Mapping) — Abschnitt 4.2.
9. Auf-/Abstieg (`league_movement`, Zuordnung an den Fixture-Generator) — Abschnitt 4.3.
10. Anzeige: zwei Tabellen mit Verhältnis-Spalte und Zonen, Liga-2-Lesemodus, „Rückspiel gegen"
    im Spielplan-Tab, Hinrunde/Rückrunde-Marker aus `occurrenceInSeason` — `liga-split-plan.md`
    PR 7, nachgeholt.

**Abnahme am Ende (Chris' „teste das so dass es funktioniert"):** ein Battle-Save aus dem Wizard,
20 Spieltage, per `matchday-auto-run-service` durchgespielt (`scripts/multi-season-smoke.ts` mit
`gameMode: "battle"`), Prüfung: 160 Fixtures je Liga, jedes Team 40 Ergebnisse, Punkte nur aus
{0,1,2} je Slot (kein `rank_to_points_final_score_share` mehr in einem Battle-Save), Summe der
`verhaeltnis`-Spalte je Liga = 0, Liga-2-Teams alle `controlMode: "ai"`, Saisonende mit drei
Auf-/Absteigern, Saison 2 mit neuer Zuordnung und neuem Rundenplan. Dazu die beiden Pflichtzahlen
für jede Disziplin, die neu in die Arena wechselt.

---

## 7. Offene Fragen — Chris-Entscheidung nötig

1. **Verhältnis = Tiebreaker-Spalte, keine Zusatzpunkte** (3.1). Ja? Falls Chris wirklich
   Punkte meinte: dann bitte als Ersatz für 2/1/0 (0–10 je Duell, Sieger bekommt D, Verlierer 0),
   nicht obendrauf — aber das wäre eine Abkehr von „gesetzt" (30.08.) und eine neue Ökonomie.
2. **M90 als Bezug (ein Zehntel der Siege ist eine „10")** — oder lieber p95/max, damit die 10
   seltener fällt?
3. **Liga 2 ohne Menschen, aber ein abgestiegenes Team bleibt menschlich** (4.2 Punkt 3). Oder
   soll Abstieg für ein menschliches Team etwas anderes bedeuten (Zwangs-KI, Saisonende)? Und:
   das 4v4-Preset im Battle Mode auf Liga-1-Teams mappen, oder Chris wählt bei Anlage neu?
4. **PPS-Duell-Brücke für die fünf Nicht-Arena-Disziplinen** (5.2) — bestätigen, dass eine
   Disziplin im Battle Mode **sofort** 2/1/0 zahlt, auch bevor ihr Arena-Motor die Abnahme
   besteht (die Alternative ist der heutige Zustand: bis 19,9 Punkte für Rang 1 neben 2 für
   einen Sieg).
5. **Mini-DM 2-1-0-0 je Pod** (5.3) bleibt — also summiert ein Mini-DM-Spieltag je Liga 12
   Punkte (4 Pods × 3) statt 16 (8 Duelle × 2). Hinnehmen (Disziplin-Eigenart) oder auf
   16 normieren?
6. **Reihenfolge Fatigue vor 20 Spieltagen** (2.3) — die 06.09.-Frage 4 war nie beantwortet.
   Soll Fatigue-PR2/PR3 jetzt priorisiert werden, damit W2 nicht mehr blockiert?
7. **Doppel-Rundenplan: Heim/Auswärts bleibt ohne Spielwirkung** (2.2) — bestätigen, dass kein
   Heimvorteil gewünscht ist (der Anker dafür entsteht trotzdem).
8. **Liga 2 lesbar, nicht bedienbar** (4.4) — oder ganz unsichtbar bis zum Saisonende?
9. **Sponsor-/Finanz-Fragen aus `liga-split-plan.md` 10.3–10.4** (Topf je Liga, Apron je Liga)
   sind weiterhin offen und werden mit Auf-/Abstieg akut — hier nur erinnert, nicht neu gestellt.

---

## 8. Kern-Dateien für den Einstieg

- `lib/season/season-fixture-schedule.ts` (Doppel-Rundenplan, 2.2)
- `lib/season/season-discipline-schedule.ts` (`getSeasonDisciplineRepeatCount`, W2, 2.3)
- `lib/data/dataAdapter.ts:46` · `lib/game/new-game-setup-service.ts:360-394` ·
  `lib/season/preseason-workflow-service.ts:548-622` (die drei Erzeuger der Saisonlänge, W2;
  Fixture-Generator Saison 2+ und Ort der künftigen Auf-/Abstiegs-Zuordnung)
- `lib/fatigue/fatigue-injury-service.ts:220-253` (`OLY_FATIGUE_ACTIVE_RECOVERY`, der Blocker)
- `public/mockups/battle-mode.engine.js:53103-53410` (`spiele*`-Einstiege, `marge`-Export) ·
  `:37057-37231` (`bahnTeamstand()`, `delta` / Zieleinlauf-Zeiten)
- `lib/battle/arena-headless-runner.ts:289-304` (`ArenaFixtureResult`)
- `lib/resolve/battle-mode-arena-team-points.ts:944-1073` (`ArenaTeamPointsOverride`, 2/1/0,
  `computeArenaTeamPointsFromFixtureResults`) · `:852-887` (`resolveArenaPpsReferenz`, Vorbild
  für `resolveMargeReferenz`)
- `lib/resolve/legacy-matchday-resolve-engine.ts:765-806` (Einhängepunkt für Arena- UND
  PPS-Duell-Overrides) · `lib/resolve/rank-to-points.ts:118` (der Pfad, der im Battle Mode
  abgelöst wird)
- `lib/standings/standings-tiebreaker-policy.ts:7-56` · `lib/standings/standings-apply-service.ts`
  (Verhältnis-Spalte, Sortierung)
- `lib/data/olyDataTypes.ts:304-318` (`StandingRecord`) · `:2559-2583` (`DisciplineResultRecord`)
- `lib/season/arena-matchday-resolve-service.ts:100-137` (Mutator-Vorab-Wurf, Fund 7 — nichts zu tun)
- `lib/foundation/team-control-settings.ts` (Eigentums-Regel, Invariante, 4.2)
- `lib/season/league-split.ts` (`RELEGATION_COUNT`, 4.3) · `lib/season/season-completion-service.ts`
  (`league_movement`)
- `lib/season/mini-dm-pod-schedule.ts` (Pods, 5.3)
- `app/foundation/season-v2/SeasonStandingsNewLook.tsx` (zwei Tabellen, 4.4)
- `docs/design/battle-mode-20-spieltage-recherche-06-09.md` (W1–W7, Chris' Entscheidungen vom
  06.09.) · `docs/design/fatigue-saisonlaenge-plan.md` Teil C/D (die Abhängigkeit)
