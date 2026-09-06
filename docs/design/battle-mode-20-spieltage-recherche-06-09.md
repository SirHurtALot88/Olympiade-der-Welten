# Battle Mode: 20 Spieltage, jede Disziplin zweimal, zweite Kadergröße nie gleich — Recherche (06.09.)

**Reine Recherche. Keine Codeänderung, kein Prototyp.** Alle Datei-/Zeilenangaben sind gegen
`origin/main` = `d2ced4fe` (nach PR #818) geprüft.

## 0. Ausgangslage und Chris' Vorgabe

PR #819 (`docs/design/kurs-wiederholung-praemisse-befund-06-09.md`) hat nachgewiesen: der heutige
Saison-Spielplan erzeugt **10 Spieltage à 2 Disziplinen = 20 Slots für 20 Disziplinen, jede genau
einmal, nie eine Wiederholung** — über 200 simulierte Saisons null Wiederholungen. Das widersprach
Chris' Satz vom 02.09. in `CLAUDE.md` („wir haben ja pro season dann nur 2x Hockey"). Auf Nachfrage
hat Chris am 06.09. beides bestätigt und die Lücke erklärt:

> „ja beides stimmt, das liegt daran, dass wir im battle mode 20 Spieltage spielen wollen! das heißt
> 40 diszis und jede kommt 2x dran aber zur saisonhälfte wird dann quasi neu gewürfelt welche diszi
> wie groß ist! keine soll 2x gleich groß sein"

Präzisiert: **Im Battle Mode hat eine Saison 20 Spieltage** (40 Diszi-Slots), **jede der 20
Disziplinen kommt genau zweimal dran**, und für das **zweite Vorkommen wird die Kadergröße je
Disziplin neu ausgewürfelt — nie dieselbe wie beim ersten Vorkommen.**

Das ist nicht der erste Anlauf zu diesem Thema. Drei Dokumente/Entscheidungen liegen bereits vor
und werden hier NICHT neu erfunden, sondern zusammengeführt:

| Baustein | Stand | Was davon gilt |
|---|---|---|
| `docs/design/fatigue-saisonlaenge-plan.md` (26.08., Chris-Entscheidungen 30.08.) | Teil A „20 Spieltage, jede Disziplin 2×" ist dort bereits als PR4–PR8 geplant; PR1 (aktive Erholung, Flag `OLY_FATIGUE_ACTIVE_RECOVERY`, Default AUS) ist umgesetzt | Entschieden 30.08.: **jede Disziplin einmal PRO SAISONHÄLFTE** (kein Mindestabstand; Spieltag 10 → 11 derselben Disziplin ausdrücklich erlaubt), KI-Endspurt unverändert, Kadergrenze bleibt 14, Verletzungskorridor 150–200 bleibt absolut. **Überholt** ist dort E.3 („gleiche Spieleranzahl bei beiden Vorkommen" empfohlen) — Chris hat am 06.09. das Gegenteil festgelegt. **Nicht enthalten** ist dort jede Battle-Mode-Verzweigung: das Dokument ist vor dem Spielmodus-Schalter entstanden. |
| PR #815 (gemergt) | `buildSeasonPlayerCount` würfelt 2–6 gleichverteilt; im Produktionspfad greift ohnehin der kategorie-balancierte Zweig (je Kategorie eine Permutation von `[2,3,4,5,6]`) | Bleibt der Kern; die Zweitvorkommen-Regel setzt darauf auf (Abschnitt 3b). |
| PR #813 (gemergt) / PR #819 | Drei Takeshi-Kurse existieren nur im Mess-Motor, Kurswahl hängt an der Renn-Saat, **kein Produktions-Aufrufer** | Kurs-Wiederholungssperre bleibt zurückgestellt (Abschnitt 3c). |
| `docs/pm-briefings/pm-gesamtstand-2026-09-06.md` | `ARENA_RESOLVED_DISCIPLINE_IDS` = basketball, gewichtheben, hockey, seit #818 speed-schach, showcase (`lib/resolve/battle-mode-arena-team-points.ts:159-165`) | Fünf von zwanzig laufen im Battle Mode über die Arena; der Rest über den PPS-Pfad. Für die Saisonstruktur ist das egal — beide Pfade lesen den Spielplan je Spieltag. |

---

## 1. Wo die Saisonlänge im Code verankert ist — alle Fundstellen

Es gibt **eine** Quelle der Wahrheit zur Laufzeit: `gameState.season.matchdayIds` (Typ `Season`,
`lib/data/olyDataTypes.ts:2495-2503`; `totalMatchdays?` dort ist optional und wird in Produktion
nirgends gesetzt — `grep totalMatchdays:` trifft nur Anzeige-/Report-Typen). Alle Spieltags-
Vorrück-, Saisonende- und Fenster-Logiken lesen diese Liste und skalieren damit von selbst. Die
**Zahl 10 kommt an genau drei Stellen in diese Liste hinein**, plus einer Rechenformel, die sie
unabhängig davon reproduziert:

### 1.1 Erzeuger der Länge (hart oder vererbt)

| # | Fundstelle | Art | Befund |
|---|---|---|---|
| E1 | `lib/data/dataAdapter.ts:46` `foundationSeedSeason.matchdayIds = Array.from({ length: 10 }, …)` | **hart** | Der Baseline-Seed jeder Saison 1. `createSeasonState()` (`:111-128`) baut daraus Spielplan und Disziplin-Schedule. |
| E2 | `lib/game/new-game-setup-service.ts:388` (`matchdayIds: resetGameState.season.matchdayIds` für den Fixture-Generator) und `:607` (`matchdayCount: gameState.season.matchdayIds.length`) | **vererbt aus E1** | Ein neues Spiel übernimmt die Länge des Baseline-Seeds unverändert — für Manager UND Battle. Hier ist die eine Stelle, an der `gameMode` schon entschieden ist (`:360-361`) und die Länge modusabhängig gesetzt werden müsste. |
| E3 | `lib/season/preseason-workflow-service.ts:550` und `:563` `matchdayCount: save.gameState.season.matchdayIds.length \|\| 10` | **vererbt + Fallback 10** | Saison n+1 erbt die Länge von Saison n. Ein Save, der einmal mit 20 angelegt wurde, bleibt bei 20 — gut; ein Alt-Save bleibt bei 10 — auch gut (keine stille Migration). |
| E4 | `lib/season/season-discipline-schedule.ts:165-167` `getRequiredSeasonDisciplineMatchdayCount = ceil(disciplines.length / 2)` | **Rechenformel = 10** | Unabhängige zweite Quelle. Speist `buildNormalizedMatchdayIds` (`:178-187`, **schneidet `matchdayIds` auf 10 ab**), `hasCompleteSeasonDisciplineSchedule` (`:189-210`), `buildLegacySeedSeasonDisciplineSchedule` (`:212-239`), Default in `buildSeasonSeededDisciplineSchedule` (`:252`). Wird ein 20er-Schedule je aus dem Store neu aufgebaut (Rebuild-Pfad in `getSeasonDisciplineSchedule` `:349-370`), würde er heute auf 10 gestutzt. **Muss modus-/saisonbewusst werden.** |

### 1.2 Der Liga-Spielplan (nicht die Disziplin-Auswahl)

| # | Fundstelle | Befund |
|---|---|---|
| F1 | `lib/season/season-fixture-schedule.ts:4-9` (Kopfkommentar), `:71-96` `buildCircleRounds` (n−1 = 15 Runden), `:136-140` Warnung `fixture_schedule_matchday_count_exceeds_rounds`, `:146` Modulo-Wrap | 16 Teams je Liga → 15 eindeutige Runden. Bei 20 Spieltagen wiederholen sich ab Spieltag 16 fünf Paarungen **exakt** (gleiches Heim/Auswärts). Reine Anzeige-Schicht (keine Punkte), aber sichtbar im Spielplan-Tab. Lösung aus dem Fatigue-Plan A.3.1 bleibt richtig: Doppel-Rundenplan (30 Runden), zweite Hälfte = Hin-/Rück getauscht. |
| F2 | `lib/game/new-game-setup-service.ts:384-391` | Circle-Generator nur für Battle-Mode-Saves, nur Saison 1. |
| F3 | `lib/season/preseason-workflow-service.ts:607-611` `buildSeasonFixtures` (Dummy-Paarung `teamIds[i % n]`) | **Nebenfund:** ab Saison 2 bekommt auch ein Battle-Mode-Save nur den Legacy-Dummy-Spielplan, der Circle-Generator wird nirgends sonst aufgerufen (`grep buildSeasonFixtureSchedule(` → nur F2). Unabhängig von 20 Spieltagen ein Fehler; gehört in dieselbe Welle wie F1. |

### 1.3 Fallbacks auf 10 (skalieren korrekt, sobald `matchdayIds` 20 trägt)

| # | Fundstelle | Befund |
|---|---|---|
| B1 | `lib/training/matchday-training-accumulator.ts:67-72` `resolveSeasonTotalMatchdays` → `fromIds > 0 ? fromIds : 10` | Trainings-Fatigue-Layer teilt durch die echte Länge; Fallback nur bei leerer Liste. |
| B2 | `lib/foundation/game-flow-controller.ts:981` `gameState.season.totalMatchdays ?? 10` | Liest das nie gesetzte `totalMatchdays`, fällt also **immer** auf 10 — heute folgenlos, weil die Bedingung `currentMatchday > 1` (`:982`) vorher greift. Bei 20 Spieltagen trotzdem auf `matchdayIds.length` umstellen. |

### 1.4 Hartkodierte Test-/Skript-Erwartungen (müssen mitziehen oder modusbewusst werden)

| Fundstelle | Zeile(n) |
|---|---|
| `lib/season/season-points-prize-regression.ts` | `:202` `currentMatchday: 10`, `:206` `matchdayId: "matchday-10"` (simuliert Saisonende) |
| `tests/singleplayer-state.test.ts` | `:485, :493, :977, :978, :1000-1002` (`toHaveLength(10)`, `matchdayIds[9] === "matchday-10"`) |
| `tests/season-points-prize-regression.test.ts` | `:101` `resolvedMatchdays === 10` |
| `tests/injury-basisfall-korridor.test.ts` | `:61-73` zehn Spieltage mit gemessenen D1/D2-Slots; Korridor explizit für 10 Spieltage kalibriert |
| `scripts/season1-simulation-run.ts` | `:23` `EXPECTED_MATCHDAY_COUNT = 10` |
| `scripts/multi-season-smoke.ts` | `:40` `DEFAULT_MATCHDAYS_PER_SEASON = 10` |
| `scripts/full-season-ui-playthrough.ts` | `:92` `max-matchdays` Default 10 |
| Viele Test-Fixtures mit `matchdayId: "matchday-10"` als „letzter Spieltag" (z. B. `tests/organic-season-progression.test.ts:81`, `tests/season-end-progression-batch.test.ts:123`) | bleiben gültig, solange sie ihre eigene 10er-Liste mitbringen |

### 1.5 Sichtbare Texte und Kommentare, die „10" behaupten

| Fundstelle | Befund |
|---|---|
| `app/foundation/transfermarkt-v2/transfer-sell-view-labels.ts:302` | **Spielertext**: „verkauft wird im Verkaufsfenster am Saisonende, nach Spieltag 10." — bei 20 falsch. |
| `lib/foundation/league-season-awards.ts:35-38, :383` | Award-Schwellen begründet mit „10 Spieltage à 2 Seiten = max. ~20 Einsätze" (Mindestzahl 6) und „20 Disziplinsiege ligaweit". Bei 40 Slots sind es 40 Siege und bis zu 40 Einsätze — die Schwelle 6 wird relativ halb so streng. Review, kein Muss. |
| `lib/season/apron-service.ts:5`, `lib/fatigue/fatigue-injury-service.ts:74,129,158,189`, `lib/ai/ai-legacy-lineup-engine.ts:51`, `app/foundation/season-v2/FoundationSeasonFinalePanel.tsx:6`, `lib/persistence/foundation-field-race-projection.ts:3` | Kommentare/Messnotizen; keine Logik. |

### 1.6 Relativ skalierende Logik (kein Eingriff, aber Review-Punkt)

- KI-Endspurt: `lib/ai/ai-legacy-lineup-batch-apply-service.ts:623, :869, :1310-1311` (`≥ ceil(total × 0,7)` bzw. `× 0,4`) — Chris 30.08.: unverändert lassen.
- KI-Trainings-Kadenz: `lib/ai/ai-manager-apply-service.ts:404` `AI_TRAINING_MIDSEASON_CADENCE_MATCHDAYS = 3` (Modulo) — läuft doppelt so oft je Saison, relativ gleich.
- Moral/Forderungen (`lib/morale/player-morale-service.ts:436-452`), Trainingsbudget (B1) — lesen `matchdayIds.length`.
- Saisonende-Erkennung: `lib/season/season-completion-state.ts:37-47, :72-75`, `lib/season/matchday-progress-service.ts:161-170` (`nextMatchdayId ?? "season-end"`), `lib/market/transfermarkt-local-service.ts:129-139` — alle über „letzter Eintrag in `matchdayIds`". Kein Umbau.
- Formkarten-Mutatoren: je Spieltag und Seite gewürfelt (`lib/lineups/legacy-lineup-modifiers.ts:291, :948`) — skaliert.

### 1.7 Absolute Schwellen und Budgets, die NICHT mitwachsen (Balance-Entscheidungen)

| Fundstelle | Heute | Bei 20 Spieltagen |
|---|---|---|
| `lib/lineups/lineup-discipline-contract.ts:11` `SEASON_CAPTAIN_SLOTS = 3` | 3 von 10 Spieltagen | 3 von 20 — halb so oft. Chris-Frage. |
| Formkarten: genau **eine Plus- und eine Minuskarte je Spieler je Saison** (`legacy-lineup-modifiers.ts:454-465`), Werte `[0,2,4,8]` | ~12/12 Karten je Team auf 20 Slots (`ai-form-card-season-plan.ts:21-22`) | dieselben ~24 Karten auf 40 Slots — Kartenabdeckung halbiert, Minuskarten-Strafe (`form-card-penalty-service`) relativ leichter zu vermeiden. Chris-Frage. |
| `lib/sponsor/sponsor-event-service.ts:29-47` | 12 % Event-Chance je Team je Spieltag | doppelt so viele Sponsor-Events und doppelt so viel Event-Cash je Saison. Saison-Pauschalen (Sponsor-Topf, Gebäude-Unterhalt) bleiben dagegen fix (Fatigue-Plan Fund 6). |
| `lib/training/training-mode-demand-service.ts:109-112` (`matchdayIndex ≥ 2/3/5`), `ai-legacy-lineup-batch-apply-service.ts:672` (`≥ 4`), `:1323, :1365` (`≤ 2`) | absolute Frühsaison-Schwellen | greifen bei 20 Spieltagen sehr früh; vermutlich harmlos, Review. |
| Verletzungskorridor 150–200 (`tests/injury-basisfall-korridor.test.ts`) | für 10 Spieltage gemessen | Chris 30.08.: absolute Zahl bleibt → Fatigue-Rekalibrierung ist **Voraussetzung**, nicht Folge (Fatigue-Plan Teil C: „Teil A darf nicht ohne Teil B aktiviert werden"). PR1 ist umgesetzt, aber Flag-Default AUS; PR2/PR3 offen. |

### 1.8 Die tiefere Annahme: „eine Kadergröße je Disziplin je Saison"

Das ist die eigentliche Sperre für Chris' Regel, und sie sitzt nicht in der Spieltagszahl, sondern
in einer Datenform:

- `lib/season/season-discipline-schedule.ts:81-107` `buildSeasonPlayerCountByDiscipline` liefert
  **eine** `Map<disciplineId, playerCount>` je Saison (je Kategorie eine Permutation von
  `[2,3,4,5,6]`).
- `:372-392` `buildSeasonDisciplinePlayerCountMap(gameState)` faltet den Spielplan wieder auf
  `Map<disciplineId, playerCount>` zusammen — **bei zwei Vorkommen gewinnt stillschweigend das
  letzte** (`set` überschreibt).
- **Neun Konsumenten** dieser Map, alle mit der Semantik „Disziplin X braucht in dieser Saison N
  Spieler": `lib/market/transfermarkt-local-service.ts:1611`, `lib/foundation/player-detail-drawer.ts:1039, :1187`,
  `lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx:7937-7940`,
  `lib/foundation/tabs/use-foundation-cross-tab-teams-roster.ts:455`,
  `lib/foundation/discipline-stage/discipline-stage-data.ts:118-122`,
  `lib/season/season-discipline-area-groups.ts:179-189`,
  `app/foundation/team-profile/TeamProfileNewLook.tsx:663`,
  `app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx:605`.
- **Bereits spieltagsgenau** (kein Umbau): `lib/resolve/rank-to-points.ts:133-143`
  `resolveDisciplinePlayerCount` (liest den Slot des Spieltags),
  `lib/resolve/battle-mode-arena-team-points.ts:701-728` (Arena-Feldgröße je Spieltag), alle
  Konsumenten von `getSeasonDisciplineScheduleEntry(gameState, matchdayId)` (Aufstellung, Arena,
  KI-Preview, Roster-Stress).

Fazit: Wertung und Aufstellung sind schon heute je Spieltag richtig. Was bei zwei verschiedenen
Größen kippt, sind **Anzeige und Planung** (Kaderprofil, Spielerdetail, Transfermarkt-Bedarf,
Bereichs-Sortierung, Bühnen-Vorschau). Das ist breit, aber flach.

---

## 2. Battle Mode oder alle Modi? — die Weiche

**Befund: Die Saisonlänge ist an keiner Stelle nach Spielmodus verzweigt.** `isBattleModeSave()`
(`lib/season/game-mode.ts:19`) wird in Produktion genau dreimal gelesen:

| Fundstelle | Gattet |
|---|---|
| `lib/game/new-game-setup-service.ts:360-391` (über `input.gameMode`) | Liga-Split-Zuordnung + Circle-Fixture-Generator (Saison 1) |
| `lib/season/arena-matchday-resolve-service.ts:225` | Arena-Auflösung der `ARENA_RESOLVED_DISCIPLINE_IDS` |
| `lib/resolve/legacy-matchday-resolve-engine.ts:345` | Arena-Eignung im Resolve |

Spieltagszahl, Disziplin-Schedule, Kadergrößen-Auslosung, Saisonübergang — alles ist **geteilt**.
Manager Mode (alle sieben Live-Saves) und Battle Mode (kein Live-Save) laufen heute durch denselben
Code mit derselben 10.

Chris' Formulierung ist eindeutig („im battle mode 20 Spieltage"), und die Architektur gibt die
Antwort gleich mit:

**Empfehlung: Battle-only, entschieden an der Erzeugung, nicht an jedem Leser.** Die Länge steht
weiterhin ausschließlich in `season.matchdayIds` — kein Leser fragt je nach `gameMode`. Nur die
drei Erzeuger (E2 für Saison 1, E3 für Saison n+1, E4 als Formel) beziehen die Zahl aus einer
einzigen neuen Funktion, sinngemäß `getSeasonDisciplineRepeatCount(gameState) = battle ? 2 : 1`
und daraus `requiredMatchdays = ceil(disciplines.length × repeat / 2)`. Gründe:

1. Die sieben Manager-Saves tragen ihre 10 im Save; E3 erbt sie. Keine Migration, keine
   stille Verlängerung einer laufenden Saison — exakt das Muster von `isLeagueSplitActive`
   (Feld gesetzt → aktiv, sonst bit-identisch).
2. Der Doppel-Rundenplan (F1) gehört zum Liga-Split, und der ist schon Battle-only. Manager Mode
   hat den Dummy-Spielplan ohne Runden-Begriff — 20 Spieltage wären dort technisch möglich, aber
   ohne Sinn.
3. Der Fatigue-Plan verlangt die aktive Erholung als Voraussetzung. Die per Flag nur für neue
   Battle-Saves scharf zu schalten ist eng, für alle Manager-Saves wäre es ein Eingriff in laufende
   Saisons.

Was Chris bestätigen muss: **ob Manager Mode bei 10 bleibt** (Empfehlung: ja) — und ob es in Battle
Mode neben der 2×-Regel weiter die Möglichkeit geben soll, mit `matchdayCount` enger zu fahren
(Tests/Smokes tun das heute über den Parameter; das bleibt unangetastet).

---

## 3. Konzept

### 3a. 20 Spieltage, 40 Slots, jede Disziplin genau zweimal

Zwei Halbserien, wie im Fatigue-Plan A.2 vorgeschlagen und von Chris am 30.08. auf „einmal pro
Saisonhälfte" festgezurrt:

- `buildSeededDisciplinePairs` (`season-discipline-schedule.ts:109-148`) bleibt unverändert und
  wird **zweimal** aufgerufen, mit Sub-Seeds `${scheduleSeed}:half-1` und `${scheduleSeed}:half-2`.
  Jede Hälfte garantiert für sich schon „jede Disziplin genau einmal, nie zweimal am selben
  Spieltag" (Pool wird erschöpft, s. #819 Befund 1). Zusammengesetzt: Spieltage 1–10 = Hälfte 1,
  11–20 = Hälfte 2.
- **Kein Mindestabstand, keine Nahtstellen-Reparatur**: Spieltag 10 und 11 dürfen dieselbe
  Disziplin tragen (Chris 30.08., ausdrücklich). Das erspart genau den Sonderfall, den der
  Fatigue-Plan noch vorsah.
- `SeasonDisciplineScheduleSlot` (`olyDataTypes.ts:2426-2432`) bekommt ein additives, optionales
  Feld `occurrenceInSeason?: 1 | 2` (#819 Option B). Für Manager-Saves und Alt-Saves ist es
  `undefined`/1 — bit-identische Ausgaben, keine Migration. Es ist der Anker für alles, was
  „Hinrunde/Rückrunde" sagen will (UI, Kurs später).
- `getRequiredSeasonDisciplineMatchdayCount` (E4) wird zu
  `ceil(disciplines.length × repeat / 2)`; `hasCompleteSeasonDisciplineSchedule` und
  `buildNormalizedMatchdayIds` bekommen den Repeat-Faktor durchgereicht, sonst schneidet der
  Rebuild-Pfad einen 20er-Plan auf 10.
- `matchdayIds` und `matchdayLabel` laufen 1..20 aus derselben Schleife wie heute (`:253-256`,
  `:286-299`). Die Reroll-Signatur im Saisonübergang (`preseason-workflow-service.ts:457-461`,
  `:553-566`) funktioniert unverändert über 20 Einträge.

### 3b. Zweites Vorkommen: Kadergröße neu, nie gleich — als Derangement

Heute zieht `buildSeasonPlayerCountByDiscipline` je Kategorie **eine** seeded Permutation von
`[2,3,4,5,6]` — deshalb hat jede Kategorie in jeder Saison genau eine 2er-, 3er-, 4er-, 5er- und
6er-Disziplin, und die Gesamt-Slotnachfrage einer Saison ist konstant (je Kategorie 2+3+4+5+6 = 20,
über vier Kategorien 80 Spielerplätze je Saison-Durchlauf). Diese Eigenschaft ist wertvoll (Kaderplanung, Formkarten-Plan,
Verletzungskorridor) und lässt sich **mit** Chris' Regel erhalten:

- **Hälfte 1**: exakt die heutige Permutation (Seed `${seed}:player-count-balance:${category}`,
  unverändert → Manager-Saves und Saison-1-Pläne bleiben ziffernidentisch).
- **Hälfte 2**: eine **fixpunktfreie Permutation (Derangement) der Hälfte-1-Zuteilung** je
  Kategorie: Disziplin i bekommt die Größe von Disziplin σ(i) mit σ(i) ≠ i. Damit gilt zwingend
  „zweite Größe ≠ erste Größe" für alle fünf Disziplinen der Kategorie, UND jede Kategorie ist auch
  in Hälfte 2 wieder genau `[2,3,4,5,6]`.
  - Erzeugung deterministisch: seeded Fisher-Yates ziehen, bei Fixpunkt verwerfen und weiterziehen
    (44 von 120 Permutationen sind Derangements, erwartete Züge < 3), gedeckelt auf z. B. 32
    Versuche mit Rückfall „Rotation um eine Position" (immer fixpunktfrei). Alternativ Sattolo
    (ein Durchlauf, immer zyklisch-fixpunktfrei, aber nur 24 der 44 Derangements erreichbar) —
    weniger Vielfalt, dafür kein Verwerfen. Empfehlung: Verwerfen mit Deckel, weil es die volle
    Vielfalt behält und der Deckel es beweisbar terminieren lässt.
  - **Ersatzzweig** (Kategorie ≠ 5 Disziplinen, heute nicht produktiv): gleichverteilt aus
    `{2..6} \ {erste Größe}`.
- Ergebnis je Disziplin: `(größe1, größe2)` mit `größe1 ≠ größe2`; beide landen in den beiden
  Slots des Spielplans, `buildSeededDisciplinePairs` bekommt je Hälfte ihre eigene Map.

Was sich dadurch NICHT ändert: die Paarungs-/Balance-Logik je Spieltag (`maxCombinedPlayerCount`,
Warnungen) und die Wertung (`rank-to-points`, Arena-Feldgröße) — beide lesen den Slot.

Was sich ändern muss (Abschnitt 1.8): `buildSeasonDisciplinePlayerCountMap` darf nicht mehr
`Map<disciplineId, number>` versprechen. Vorschlag: sie bleibt für Alt-Saves erhalten und liefert
für Battle-Saves die Größe des **nächsten noch offenen Vorkommens** (das ist, was Kaderprofil und
Transfermarkt-Bedarf tatsächlich fragen); daneben eine neue `getSeasonDisciplinePlayerCounts(
gameState, disciplineId) → Array<{ matchdayId, matchdayIndex, playerCount, occurrenceInSeason }>`
für Ansichten, die beide zeigen sollen („Hinrunde 4 · Rückrunde 6"). Neun Aufrufer, alle im Muster
„Zahl lesen, anzeigen/sortieren" — mechanisch, aber jeder braucht eine Entscheidung „nächstes
Vorkommen" vs. „beide".

### 3c. Verhältnis zur Kurs-Frage (Takeshi's Castle)

Gleiches **Muster**, zwei **Mechanismen**, in dieser Reihenfolge:

- Das Muster ist: **die Saison-Schicht entscheidet die Eigenschaft des Zweitvorkommens, der Motor
  empfängt sie**. Für die Kadergröße existiert die Empfangsseite schon (`slot.playerCount` → Arena
  `jeSeite` via `battle-mode-arena-team-points.ts:701-728`). Für den Kurs existiert sie nicht:
  `bauSpurt` wählt den Kurs aus der Renn-Saat, und es gibt keinen Produktions-Aufrufer, der eine
  Saat mit Spieltags-Kontext übergibt (#819 Befund 2).
- Eine gemeinsame Abstraktion „ziehe Zweitvorkommen ≠ Erstvorkommen" wäre für die Kadergröße
  ein Derangement über fünf Disziplinen mit Balance-Nebenbedingung, für den Kurs eine Ziehung
  aus zwei Restoptionen ohne Nebenbedingung. Das ist zu verschieden für eine Funktion; ein
  gemeinsames Interface würde heute gegen einen Motor-Vertrag gebaut, den es noch nicht gibt.
- Deshalb: **jetzt** `occurrenceInSeason` am Slot (das ist die Vorarbeit, die beiden dient),
  **später** — sobald Bahn-Disziplinen produktiv sind und der Aufrufer eine Saat + Slot an den
  Motor gibt — ein optionales `kursId` am Slot, von der Saison-Schicht mit derselben Regel
  („Hälfte 2 ≠ Hälfte 1") gesetzt, und ein optionaler `opt.kurs` an `bauSpurt`, der ohne Wert das
  heutige Verhalten behält (#819 Option B, Messskripte bleiben ziffernidentisch).

---

## 4. Auswirkung auf die Rangtreue-Abnahme

Die kaderfeste Standard-Abnahme (`scripts/miss-alle-disziplinen.mjs`, fünf echte Team-Paarungen
× 24 Spiele, rund elf Minuten für alle zwanzig laut `stand-aller-disziplinen.md:558`) misst bei
`jeSeite` = 6. Wichtig für die Einordnung: **die Vielfalt der Kadergrößen ist nicht neu** — seit
#815 (und schon vorher über die Kategorie-Permutation) wird jede Disziplin in 2/3/4/5/6 gespielt.
Chris' Regel verdoppelt nicht die Zahl der zu prüfenden Größen, sie garantiert nur, dass jede
Disziplin je Saison **zwei verschiedene** davon sieht. Für rho zählt die Größe, nicht das Paar:
ein Motor, der bei 2, 4 und 6 je Seite die Schranke hält, hält sie bei jeder Kombination.

Die Infrastruktur ist da: `disziplinProbe` (`public/mockups/battle-mode.engine.js:20007-20020`)
nimmt `o.jeSeite` für alle vier Chassis, `miss-alle-disziplinen.mjs:56-62` reicht `--je-seite=N`
durch. Das PM-Briefing (Abschnitt 7) hält fest: Bahnen bei 2/3/5 nachgemessen (0,86–0,92), **Bühnen
nicht**, Feldspiel nur Basketball/Hockey.

Vorschlag, ohne den Aufwand zu sprengen:

1. `--je-seite` mehrwertig (`--je-seite=2,4,6`) und ein Preset `--alle-groessen` = `2,4,6`.
   Ausgabe je Disziplin: Median und Spannweite **je Größe** plus die Zeile „schwächste Größe".
   Laufzeit ≈ 3 × 11 Minuten für alle zwanzig; in der Praxis läuft man nur die Disziplinen einer
   Welle.
2. **Abnahmekriterium**: Median-rho ≥ 0,80 bei 6 **und** bei der schwächsten Größe (2 ist beim
   Feldspiel die härteste, weil dort Torwart/Rollen kippen; bei Duell-Bühnen ist 2 = ein Duell).
   Die Basislinie (`data/generated/rangtreue-basislinie.json`, `scripts/baue-rangtreue-basislinie.mjs`)
   bekommt den Größen-Schlüssel dazu, damit `pruefe-rangtreue-schranke.mjs` einen Absturz bei 2
   sieht, nicht nur bei 6.
3. Arena (TDM/Mini-DM/Battlefield) bleibt außen vor — dort ist `jeSeite` rollenfest (4/6) und die
   Spannweite größer als der Median (PM-Briefing 1a); erst Messmethode, dann Größen.
4. Getrennt davon, **nicht rho, sondern Spielplan-Invarianten** als Vitest (aus
   `scripts/pruefe-disziplin-wiederholung-je-saison.ts` von #819 abgeleitet), über z. B. 200
   Saison-Seeds: (i) jede Disziplin genau 2×, (ii) genau 1× in Spieltagen 1–10 und 1× in 11–20,
   (iii) `größe2 ≠ größe1` für alle 20, (iv) je Kategorie und Hälfte genau `[2,3,4,5,6]`,
   (v) Manager-Save-Plan ziffernidentisch zu heute (Regression).

---

## 5. Aufwand und Wellen

| Welle | Inhalt | Aufwand | Risiko | Voraussetzung |
|---|---|---|---|---|
| **W1 Spielplan-Kern** | Repeat-Faktor, zwei Halbserien, Derangement der Hälfte 2, `occurrenceInSeason`, E4 mode-aware, Invarianten-Tests (4.4). Hinter dem Repeat-Faktor = 1 bit-identisch. | klein–mittel (≈ 1 Tag) | keins am Spiel (inert, nur `matchdayCount`-Aufrufer mit Repeat 2 erzeugen 20) | keine |
| **W2 Aktivierung für neue Battle-Saves** | E2 (Saison 1: 20 `matchdayIds`, Schedule, Fixtures), E3 (erbt), B1/B2-Fallbacks, `transfer-sell-view-labels.ts:302`, Test-Erwartungen 1.4, E2E gegen `live-save`-Abbild (alle sieben Saves bleiben bei 10). | mittel | Manager-Saves: null, wenn gegattet; Battle: neue Saves nur | W1, W3, **Fatigue-PR3** (Flag-Default aktive Erholung) laut Fatigue-Plan Teil C |
| **W3 Liga-Spielplan** | Doppel-Rundenplan 30 Runden (F1) + Nebenfund F3 (Saison 2+ ohne Circle-Generator). | klein–mittel | keins (Anzeige) | keine; unabhängig testbar |
| **W4 Konsumenten „eine Größe je Saison"** | Neun Aufrufer aus 1.8, neue Abfragefunktion, UI „Hinrunde/Rückrunde", Spielplan-Tab mit 20 Zeilen (Fatigue-Plan E.8, nie geprüft). | mittel (breit, flach) | Anzeige | W1 |
| **W5 Balance-Nachzug** | Captain-Slots, Formkarten je Spieler, Sponsor-Event-Frequenz, Award-Schwellen, absolute KI-Frühsaison-Schwellen, Verletzungskorridor-Neumessung für 20 Spieltage (Fatigue-Plan PR2). | mittel, überwiegend **Chris-Entscheidungen** | Spielgefühl | W2 gespielt oder Dry-Run über 20 |
| **W6 Kurs-Regel** | `kursId` am Slot, `opt.kurs` am Motor, Regel Hälfte 2 ≠ Hälfte 1. | klein | keins | Produktivierung der Bahn-Disziplinen (eigener Themenkomplex, nicht begonnen) |
| **W7 Abnahme-Sonde** | `--je-seite=2,4,6`, Basislinie mit Größen-Schlüssel, Bühnen bei 2/4 nachmessen. | klein–mittel (Rechenzeit, nicht Code) | keins | keine; kann parallel zu W1 laufen |

**In einem Zug? Nein.** W1 ist ein sicherer, inert deploybarer erster PR und beweist die Struktur
mit Tests; W3 und W7 sind unabhängig und können parallel laufen; W2 ist der Schalter und darf erst
kommen, wenn die aktive Erholung scharf ist — sonst tritt genau die Verdopplung des
Verletzungsproblems ein, die der Fatigue-Plan in B.2 vorrechnet (13 von 20 Spieltagen im
Maximalrisiko statt 3 von 10). W4 kann vor oder nach W2 kommen, muss aber vor dem ersten echten
Battle-Save mit 20 Spieltagen fertig sein, sonst zeigt das Kaderprofil für zehn Disziplinen die
falsche Größe. W5 und W6 sind eigene, spätere Aufträge.

---

## 6. Offene Fragen an Chris (vor W1 zu klären: 1–3; vor W2: 4–6; später: 7–10)

1. **Battle-only?** 20 Spieltage nur für Battle-Mode-Saves, Manager Mode bleibt bei 10 — bestätigen.
   (Empfehlung: ja, s. Abschnitt 2.)
2. **Hälfte 2 als Derangement** (jede Kategorie bleibt auch in der Rückrunde genau 2/3/4/5/6, nur
   anders verteilt) — oder freies Würfeln aus den vier Restgrößen je Disziplin (dann kann eine
   Kategorie in der Rückrunde z. B. zweimal 6 und keine 2 haben)? (Empfehlung: Derangement — hält
   die Slot-Nachfrage je Saison konstant und damit Kaderplanung, Formkartenplan und
   Verletzungskorridor vergleichbar.)
3. **Spieltag 10 → 11 dieselbe Disziplin** bleibt erlaubt (30.08.) — bestätigen, weil es die
   Nahtstellen-Reparatur erspart.
4. **Reihenfolge Fatigue vor Saisonlänge**: aktive Erholung (Flag-Default) wird VOR dem ersten
   20er-Save scharf — bestätigen. Und: die am 30.08. angedachte „Pause zur Saisonhälfte" (Verletzungen
   zurücksetzen, ohne Transfers) — Teil dieses Vorhabens oder eigener Auftrag?
5. **Formkarten**: bleibt es bei einer Plus- und einer Minuskarte je Spieler je Saison (Abdeckung
   auf 40 Slots halbiert), oder zwei je Vorzeichen?
6. **Captain-Slots**: 3 bleibt, oder 6 (relativ gleich)?
7. **Sponsor-Events**: doppelt so viele je Saison akzeptabel, oder Chance je Spieltag halbieren?
8. **Award-Mindesteinsätze** (6 von max. ~40 statt ~20) — unverändert lassen?
9. **Kurs-Regel** später nach demselben Muster („Rückrunde nie derselbe Kurs wie Hinrunde") —
   bestätigen, damit W6 ohne neue Rückfrage gebaut werden kann.
10. **Bestehende Saves**: keine Migration, auch kein Angebot „Battle-Save auf 20 verlängern" —
    bestätigen.

---

## 7. Was in dieser Runde bewusst nicht gemacht wurde

Keine Zeile in `lib/`, `app/`, `public/mockups/` oder `tests/` geändert; `miss-alle-disziplinen.mjs`
nicht gefahren (keine Codeänderung, gegen die zu messen wäre). Der Nebenfund F3 (Saison 2+ ohne
Circle-Generator im Battle Mode) ist als eigener Auftrag vorgemerkt, nicht behoben.
