# Test-Typen-Triage — 2026-07-17

## 1. Intro

`npx tsc --noEmit` liefert aktuell **676 Fehler**, verteilt auf:

- **462 Fehler** in `tests/` (134 betroffene Dateien von ~415 Testdateien insgesamt)
- **214 Fehler** in `scripts/` (49 betroffene Dateien)
- **0 Fehler** in `lib/`, `app/`, `components/`

Verdacht laut Fable-Befund: Ein Teil der Tests baut Fixtures gegen eine **veraltete Weltform** (z.B. `RosterEntry` ohne `contractLength/salary/upkeep/roleTag`) und testet damit Verhalten, das die heutige Logik nicht mehr abbildet — das wäre gefährlicher als ein simpler Compile-Fehler, weil so ein Test isoliert per `vitest` weiterhin "grün" laufen kann, ohne die aktuelle Fachlogik zu prüfen.

### Methodik (und eine wichtige Korrektur unterwegs)

Diese Triage beruht auf einer **Stichprobe von 15 Dateien** (13 aus `tests/`, 2 aus `scripts/`), priorisiert nach (a) Fehleranzahl und (b) fachlicher Wichtigkeit (Economy/Roster/Save/Resolve zuerst). Die Gesamtverteilung in Abschnitt 3 ist eine **Hochrechnung aus dieser Stichprobe**, keine Vollerhebung aller 183 betroffenen Dateien.

Der erste Analyse-Durchgang klassifizierte Dateien allein danach, ob eine Fixture vom aktuellen `lib/`-Typ abweicht (z.B. fehlende Pflichtfelder). Nach diesem groben Kriterium sahen 12 von 13 Stichproben-Testdateien wie Kategorie A aus. Eine zweite, tiefere Verifikation — für jede Datei geprüft, ob der **getestete `lib/`-Code das fehlende/falsche Feld überhaupt liest** und ob die Assertions dadurch etwas Falsches behaupten — korrigiert das Bild deutlich: **nur 3 von 13 Testdateien sind tatsächlich grün-lügend.** Die übrigen 10 haben zwar veraltete/überzählige Fixture-Felder, aber der getestete Code liest diese Felder gar nicht (oder füllt sie intern mit Defaults auf), sodass die Assertions weiterhin echtes, aktuelles Verhalten prüfen — reines Compile-Rauschen, keine fachliche Gefahr.

**Praktische Konsequenz für die weitere Arbeit:** Ein reiner Fixture-Typ-Diff (wie ihn `tsc` liefert) überschätzt systematisch, wie viele Tests "gefährlich veraltet" sind. Die relevante Frage ist immer: *Liest der Code unter Test das betroffene Feld, und würde sich die Assertion ändern, wenn das Feld korrekt gesetzt wäre?* Nur wenn ja, ist es Kategorie A.

### Kernbefund: CI sieht diese 676 Fehler nie

Das ist der eigentliche Root-Cause, warum der Zustand so weit anwachsen konnte, ohne aufzufallen:

- `.github/workflows/ci.yml` und `.github/workflows/ci-nightly.yml` rufen an **keiner Stelle** `tsc --noEmit` auf.
- `.github/workflows/ci.yml` ruft auch **nicht** die volle Testsuite (`npm test` / `vitest run`) auf. Es läuft nur `npm run ci:flow-smoke`, ein kuratiertes Subset von **17 von ~415 Testdateien** (`game-flow-controller.test.ts`, `game-inbox-service.test.ts`, `season-playability-gate.test.ts`, u.a. — siehe `package.json:20`).
- Von diesen 17 CI-gatenden Dateien haben **6 selbst tsc-Fehler** (`game-flow-controller.test.ts`, `game-inbox-service.test.ts`, `inbox-quick-action-service.test.ts`, `fatigue-injury-inbox-integration.test.ts`, `sponsor-offer-service.test.ts`, `sponsor-event-service.test.ts`). Weil `vitest` standardmäßig nicht typprüft (nur transpiliert), laufen diese Tests trotzdem "grün" durch CI — auch `game-inbox-service.test.ts`, das in dieser Stichprobe untersucht wurde (Ergebnis: mechanisch, siehe unten, aber eben trotzdem kaputt kompiliert im Live-CI-Pfad).
- Die übrigen ~398 Testdateien laufen **überhaupt nicht** in CI/CI-Nightly. Sie sind reine Lokal-Artefakte, die niemand routinemäßig ausführt oder beobachtet.
- Zusätzlich: Der einzige Playwright-E2E-Lauf (`playwright.config.ts`, `testMatch: "ui-cockpit-playtest.spec.js"`) deckt nur einen einzigen Happy-Path ab; der Multiplayer-E2E-Smoke (`scripts/smoke-multiplayer-e2e.ts`) ist in `ci.yml` explizit auskommentiert (`TODO(online-mp): Re-enable when online multiplayer is prioritized`).

**Konsequenz:** Die 676 Typfehler sind für das Team komplett unsichtbar, weil kein automatisierter Prozess sie je meldet. Selbst wenn — wie unten gezeigt — die meisten davon fachlich harmlos sind, wächst die Liste bei jedem weiteren `lib/`-Refactor unbeobachtet weiter, und die wenigen echten Gefahrenfälle (siehe unten) gehen darin unter.

---

## 2. Stichprobe: Klassifizierung je Datei

Kategorien:
- **A — Veraltete Weltform (gefährlich, grün-lügend):** Der getestete Code liest das fehlende/falsche Feld tatsächlich, und die Assertions würden bei korrekter Fixture ein anderes (oder gar kein) Ergebnis prüfen. Der Test behauptet, etwas zu verifizieren, das er faktisch nicht mehr verifiziert.
- **B — Mechanisches Typ-Update (Compile-Rauschen):** Fixture weicht vom aktuellen Typ ab, aber der getestete Code liest die betroffenen Felder nicht (oder füllt sie intern mit Defaults) — Fix ist eine reine Signatur-/Fixture-Nachführung ohne fachliches Risiko.
- **C — Low-Value / veraltet, kann weg:** Test prüft entferntes Feature.
- **D — scripts/ (kein Sicherheitsnetz):** D-relevant = aktiv genutztes Audit-/Balancing-Tooling, Fix lohnt sich. D-ignorierbar = Ad-hoc-/Wegwerf-Diagnose.

| Datei | #Fehler | Kategorie | Begründung | Beleg |
|---|---|---|---|---|
| `tests/ai-market-plan-apply-service.test.ts` | 46 | **B** | Alle 46 Fehler laufen auf eine einzige TS-Falle zurück: die Basis-Fixture nutzt `satisfies GameState` mit leeren Array-Literalen (`teams: []`, `rosters: []`), die dabei zu `never[]` statt `Team[]`/`RosterEntry[]` inferiert werden. `transfermarkt-local-service` ist im Test vollständig gemockt — das stray Feld `activePlayerId` und die fehlenden `RosterEntry`-Felder werden vom geprüften Codepfad nie gelesen. | TS2322 Z.158 `Team[] not assignable to never[]`; `ai-market-plan-apply-service.ts` liest die betroffenen Roster-Felder im gemockten Pfad nicht. |
| `tests/ai-legacy-lineup-batch-apply-service.test.ts` | 37 | **B** | `buildAiLegacyLineupModifiers` liest von den betroffenen Fixture-Objekten nachweislich nur `.index`, `.matchdayIndex` bzw. `.length` (verifiziert in `lib/ai/ai-legacy-lineup-batch-apply-service.ts:634,646,882`). Zusätzliche/fehlende Felder (`sourceStatus`, `disciplineSide`, `relationship` statt `teamCode`) beeinflussen das geprüfte Verhalten nicht. | TS2353 Z.87 `'disciplineId' does not exist in type '{ rank...sourceStatus...}'` |
| `tests/ai-team-cash-reserve-service.test.ts` | 26 | **B** | Fehlen von `TeamStrategyProfile`-Feldern (`buyStyle/sellStyle/contractStyle/rosterStyle`, u.a.) ist kosmetisch: `normalizeStrategyProfile()` (`lib/foundation/team-strategy-profiles.ts:1042`) füllt fehlende Felder intern mit Defaults auf. `disciplineSchedule` wird vom getesteten Code gar nicht referenziert. Fachlicher Intent (Hoard-Multiplier, Cash-Runway-Reserve) bleibt gültig geprüft. | TS2740 Z.89 „missing buyStyle, sellStyle…" — aber Default-Fallback in `team-strategy-profiles.ts:1042` |
| `tests/ai-market-plan-convergence.test.ts` | 22 | **B** | Gleiches Muster: fehlende `Team.budget/identityId/rosterLimit`. Zusätzlich totes Altlast-Feld `playerMax` direkt auf `TeamIdentity` gesetzt — existiert im aktuellen Typ nicht mehr; `getTeamPlayerMax()` (`lib/foundation/roster-limits.ts`) berechnet den Cap heute anders, ändert aber in den geprüften Fällen das Ergebnis nicht (`playerOpt=10` liegt ohnehin unter Default-Max). | TS2353 „playerMax does not exist in type TeamIdentity"; `lib/foundation/roster-limits.ts:18-21` |
| `tests/game-inbox-service.test.ts` | 14 | **B** | Teilmigriert (manche Fixtures haben schon volle `RosterEntry`-Felder, andere nicht). `matchdayState.status` wird im Service nie auf konkreten Wert verglichen, `PlayerGeneratorAttributeName`-Kürzel werden nur gezählt statt ausgewertet, `startRank/seasonLabel/cost/source` werden von den betroffenen Assertions nicht geprüft. **Prozess-relevant trotzdem:** Diese Datei ist eine der 17 CI-gatenden Dateien (`ci:flow-smoke`) und läuft aktuell kaputt-kompiliert in CI. | TS2322 Z.614 `Type '"preparation"' is not assignable to type '"ready"\|"resolved"\|"planning"'` |
| `tests/season-end-progression-batch.test.ts` | 11 | **B** | `runSeasonEndProgressionBatch` liest von `teamControlSettings[...]` nur `.controlMode` (verifiziert `season-end-progression-batch.ts:112`). `Team.salaryTotal`, restliche `TeamControlSettings`-Felder sind reine Fixture-Bürde ohne Logikabhängigkeit. `roleTag: "core"/"depth"` ist totes Enum, wird von dieser Funktion aber nicht gelesen. | TS2322 Z.128 `Type '"core"' is not assignable to type '"starter"\|"prospect"\|"bench"'` — Feld wird von `runSeasonEndProgressionBatch` nicht gelesen |
| `tests/season-end-xp-apply-service.test.ts` | 10 | **B** | Gleiches Muster: `MatchdayResultRecord`-Felder (`teamsTotal, teamsReady, sourceVersion` …) werden im XP-Apply-Service nirgends referenziert (0 Treffer bei gezielter Suche). | TS2740 Z.131 „missing … saveId, sourceVersion, teamsTotal, teamsReady, and 7 more" — ungelesen |
| `tests/organic-season-progression.test.ts` | 9 | **B** (mit Hinweis) | `roster.marketValue`/fehlende `Team`-Felder sind unbenutzt. Bemerkenswert: ein Testfall prüft absichtlich den Legacy-Fallback-Pfad (`regressionBreakdown: { combinedTotal: -9.99 }`), den `organic-season-progression.ts:525-534` explizit über `!= null`-Prüfung behandelt — der TS-Fehler kommt daher, dass der `Pick<...>`-Typ die Felder strenger (alle required) deklariert als die echte Laufzeitlogik. Testinhalt ist gültig, nur die Typsignatur in `lib/` ist enger als das reale Verhalten. | TS2739 Z.569 „missing … marketValueTotal, baseFlatTotal" |
| `tests/legacy-lineup-service.test.ts` | 8 | **B** | Einzige Root Cause: `LegacyLineupDraft` verlangt inzwischen `modifiers: LineupDraftModifiers` (`lib/lineups/legacy-lineup-types.ts:213`), die `FakeLegacyLineupRepository` baut den Draft ohne dieses Feld. Der fachliche Testinhalt (fehlende Fatigue-/Form-Card-Quellen erzeugen Warnungen, Captain-Bonus, Slot-Validierung) deckt sich exakt mit dem heutigen Verhalten bei fehlenden Modifiers — die erwarteten Warnungstexte im Test stimmen mit der aktuellen Logik überein. Fix: `modifiers: createDefaultLineupDraftModifiers()` im Fake ergänzen. | TS2322 Z.63 „missing … modifiers"; reale Implementierung nutzt `createDefaultLineupDraftModifiers()` (`legacy-lineup-repository.ts:50`) |
| `tests/season-snapshot-service.test.ts` | 8 | **B** | `buildTeamEntryEconomyFromGameState` (Z.628-657) liest nur `.salary`, `.currentValue`, `.purchasePrice`, `.playerId`; die fehlenden `RosterEntry`-Felder (`id, upkeep, roleTag, joinedSeasonId`) und `Player`-Felder werden für die geprüften Assertions nicht gebraucht. | TS2739 Z.569 „missing … id, upkeep, roleTag, joinedSeasonId" — ungelesen im geprüften Pfad |
| `tests/legacy-matchday-result-mapper.test.ts` | 8 | **A — echt grün-lügend** | Der Mapper selbst liest die neuen Preview-Felder (`lib/resolve/legacy-matchday-result-mapper.ts:200-202`: `baseScore: teamResult.baseScore`, `totalScore: teamResult.finalPreviewScore`, `formModifier: teamResult.formModifier`). In der Fixture (Z.15-27) existieren `baseScore`, `finalPreviewScore`, `formModifier` gar nicht — zur Laufzeit (vitest prüft keine Typen) würden diese als `undefined` durchgereicht. Die Assertions prüfen aber nur Längen und `scoreContribution` (aus unbetroffenen `topPlayers`), sodass der Test trotz einer strukturell veralteten (vor-Fatigue/vor-Team-Power) Preview grün bliebe. **Konkreter Beweis für echte Gefahr.** | TS2740 Z.49 „missing … status, baseScore, fatigueModifier, fatigueStatus, and 17 more"; Konsumcode in `legacy-matchday-result-mapper.ts:200-202` |
| `tests/contract-renewal-service.test.ts` | 6 | **A — echt grün-lügend** | Nicht wegen des toten `roleTag: "rotation"`-Werts (der wird vom geprüften Codepfad nicht gelesen), sondern: Der Testfall „honors extend_core contract strategy" (Z.750-789) übergibt `seasonState: {...aiManagerContractStrategies}` an `createGameState()`. Dessen Parametertyp lässt `seasonState` gar nicht zu, **und** die Implementierung (Z.91-163) spreadet `input.seasonState` nirgends — der Override wird strukturell verschluckt. Der Test behauptet, „AI-Strategie extend_core wird respektiert" zu prüfen, löst diesen Codepfad aber nie tatsächlich aus. | TS2353 Z.767 „seasonState does not exist in type {teams?, players?, rosters?}"; `createGameState()` Z.91-163 baut `seasonState` fest selbst |
| `tests/market-value-apply.test.ts` | 6 | **A — echt grün-lügend** | Fixture setzt ein Phantomfeld `marketValue` per `as RosterEntry`-Cast auf die RosterEntry (existiert im aktuellen Typ nicht, nur `currentValue`). Assertion `expect(synced.rosters[0]?.marketValue).toBe(30.51)` (Z.69) prüft dieses tote Feld. Die reale Implementierung `syncRosterMarketValuesWithPlayerEconomy` (`lib/player-formulas/market-value-apply.ts:82-88`) schreibt aber nur `{ ...entry, currentValue: normalized }` — `marketValue` bleibt unverändert beim ursprünglichen (falschen) Wert. Wäre der Test kompilierbar, würde die Assertion entweder fehlschlagen oder — schlimmer — ein totes Feld statt echten Verhaltens für grün erklären. | Test Z.34/69 `marketValue: input.rosterCurrentValue` / `expect(...marketValue).toBe(30.51)` vs. lib Z.88 `return { ...entry, currentValue: normalized }` — kein `.marketValue`-Write |
| `scripts/export-balancing-save-review.ts` | 45 | **D — relevant** | Aktiv genutzt: wird von `scripts/run-balancing-multiseason-pipeline.sh:107` aufgerufen (`npx tsx scripts/export-balancing-save-review.ts --save-id ... > balancing-save-review.out`). Fehler sind größtenteils fehlende Typannotationen (`TS7006` implicit any) und ein fehlender Null-Check auf `PersistedSaveGame \| null` — mechanisch fixbar, lohnt sich. | TS2339 Z.86 `Property 'gameState' does not exist on type 'PersistedSaveGame \| null'`; aktiver Aufrufer in `run-balancing-multiseason-pipeline.sh:107` |
| `scripts/tmp-s5-preseason-diagnosis.ts` | 14 | **D — ignorierbar** | Header + hartkodierter Pfad bestätigen Wegwerf-Charakter: Diagnose für einen einzelnen historischen Lauf (`outputs/s1-s5-transfer-2026-07-06T21-31-56/balancing-run.sqlite`, `SAVE_ID = "fresh-season-1-1783373516602"`). Teil einer Gruppe von rund 21 `tmp-*`-Dateien in `scripts/` mit identischem Muster. Keine Referenz in package.json/anderen Skripten. | Datei-Kommentar „Diagnose S2-S5 preseason…"; hartkodierter `DB`-Pfad |

**Zusammenfassung Stichprobe (15 Dateien, 305 von 676 Fehlern / ~45%):** **3× A** (echt grün-lügend), **10× B** (mechanisches Compile-Rauschen ohne fachliches Risiko), **2× D** (1 relevant, 1 ignorierbar). Kein C in der Stichprobe gefunden.

---

## 3. Geschätzte Gesamtverteilung (Hochrechnung, keine Vollzählung)

**Wichtiger Vorbehalt:** Die Stichprobe fokussierte bewusst auf die fehlerträchtigsten Dateien. Die tiefe Verifikation zeigt aber, dass **Fehleranzahl kein guter Prädiktor für Gefährlichkeit ist** — die drei größten Dateien der Stichprobe (46, 37, 26 Fehler) sind alle B, während die drei echten A-Fälle nur 6-8 Fehler haben. Ein einzelnes strukturell falsch gelesenes/geschriebenes Feld erzeugt oft nur wenige TS-Fehler, ist aber gefährlicher als 40 Fehler durch eine `never[]`-Inferenzfalle. Die Hochrechnung berücksichtigt das:

**tests/ (462 Fehler, 134 Dateien):**

| Kategorie | Anteil Fehler (geschätzt) | Anteil Dateien (geschätzt) |
|---|---|---|
| A — echt grün-lügend | ~10–20 % (≈45–90 Fehler) | ~10–15 % (≈13–20 Dateien) |
| B — mechanisches Compile-Rauschen | ~65–80 % (≈300–370 Fehler) | ~70–80 % (≈94–107 Dateien) |
| C — low-value/löschen | ~5–15 % (≈25–70 Fehler) | ~8–12 % (≈11–16 Dateien) |

**scripts/ (214 Fehler, 49 Dateien):**

| Kategorie | Anteil (geschätzt) |
|---|---|
| D — relevant (aktives Audit-/Balancing-Tooling, Fix lohnt) | ~30–40 % (≈15–20 Dateien) |
| D — ignorierbar (tmp-/diag-/debug-/Einmal-Skripte) | ~60–70 % (≈29–34 Dateien) |

Beleg für die Schräglage in `scripts/`: 9 von 49 fehlerhaften Skriptdateien tragen bereits im Namen `tmp-`/`diag-`/`debug-`; laut Sub-Agent-Recherche existieren rund 21 `tmp-*`-Skripte insgesamt mit identischem Wegwerf-Muster — die tatsächliche Ignorier-Quote liegt vermutlich am oberen Ende der Schätzung.

**Einordnung:** Die gute Nachricht dieser Triage ist, dass die Mehrheit der 676 Fehler wahrscheinlich harmloses Compile-Rauschen ist (Kategorie B) — der Aufwand für eine Vollreparatur ist überwiegend mechanisch (Fixture-Felder ergänzen, Typen nachziehen) und nicht mit tiefen Logik-Audits verbunden. Die eigentliche Priorität liegt auf einer kleinen Zahl echter A-Fälle plus der strukturellen CI-Lücke (Abschnitt 1), nicht auf der schieren Fehlermenge.

---

## 4. Empfohlene erste Reparatur-Welle

Priorisiert nach: bestätigte Kategorie-A-Fälle zuerst (echtes fachliches Risiko), dann CI-Prozess-Hygiene, dann Bündel-Fixes nach Fehlervolumen.

| # | Datei | Warum zuerst |
|---|---|---|
| 1 | `tests/market-value-apply.test.ts` | **Bestätigter echter A-Fall.** Assertion prüft ein Phantomfeld (`RosterEntry.marketValue`), das die reale Marktwert-Sync-Funktion nie schreibt — Illusion von Testabdeckung für Marktwert-Logik. |
| 2 | `tests/contract-renewal-service.test.ts` | **Bestätigter echter A-Fall.** Der Testfall „honors extend_core contract strategy" löst den behaupteten Codepfad nie aus, weil `createGameState()` den `seasonState`-Override strukturell verschluckt — die AI-Vertragsstrategie-Logik ist faktisch ungetestet, obwohl ein Test dafür existiert. |
| 3 | `tests/legacy-matchday-result-mapper.test.ts` | **Bestätigter echter A-Fall.** Resolve-Kernlogik: Mapper liest `baseScore/finalPreviewScore/formModifier`, die in der Fixture fehlen — Fatigue-/Team-Power-Mechanik im Spieltag-Ergebnis ist faktisch ungetestet. |
| 4 | `tests/game-inbox-service.test.ts` | Kategorie B, aber **läuft aktuell kaputt-kompiliert im tatsächlichen CI-Gate** (`ci:flow-smoke`). Mechanischer Fix macht CI wieder ehrlich — kleinster Aufwand mit sofortiger Prozess-Wirkung, da hier bereits eine Beobachtungs-Infrastruktur existiert. |
| 5 | Die übrigen 5 CI-gatenden Dateien mit Fehlern (`game-flow-controller.test.ts`, `inbox-quick-action-service.test.ts`, `fatigue-injury-inbox-integration.test.ts`, `sponsor-offer-service.test.ts`, `sponsor-event-service.test.ts`) | Gleiche Logik wie #4 — das ist die einzige Teilmenge von Tests, die tatsächlich beobachtet wird; hier zuerst „grün" im echten Sinn herzustellen hat den höchsten Hebel pro Aufwand. |
| 6 | `tests/season-end-progression-batch.test.ts` + `tests/season-end-xp-apply-service.test.ts` + `tests/organic-season-progression.test.ts` | Alle drei Kategorie B, teilen aber offenbar dieselbe veraltete `Season`/`MatchdayResultRecord`/`TeamControlSettings`-Fixture-Basis — lohnt sich, in einem Rutsch über eine gemeinsame Test-Helper-Funktion zu fixen statt 3× einzeln. |
| 7 | `tests/ai-market-plan-apply-service.test.ts` (46) + `tests/ai-legacy-lineup-batch-apply-service.test.ts` (37) + `tests/ai-market-plan-convergence.test.ts` (22) | Größtes Fehlervolumen der Stichprobe (105 von 305 abgedeckten Fehlern), alle Kategorie B — lohnt sich rein wegen Masse, aber ohne Zeitdruck; ein gemeinsamer Fixture-Factory-Helfer (`createTestRosterEntry(overrides)`, `createTestTeam(overrides)` mit sinnvollen Defaults für alle Pflichtfelder) würde die `never[]`-Inferenzfalle und die fehlenden Pflichtfelder in einem Rutsch für viele Dateien lösen. |
| 8 | `scripts/export-balancing-save-review.ts` | Größte Skriptdatei (45 Fehler), aktiv genutztes Tooling (`run-balancing-multiseason-pipeline.sh`), Fix ist rein mechanisch (implicit-any + Null-Check). |

**Nicht in dieser Welle:** `tests/ai-team-cash-reserve-service.test.ts` (Kategorie B, Defaults fangen die Lücken intern ab) und `scripts/tmp-s5-preseason-diagnosis.ts` (Kategorie D-ignorierbar, kann ersatzlos gelöscht werden statt repariert — ebenso die übrigen ~20 `tmp-*`-Skripte).

**Zusätzliche strukturelle Empfehlung (Root Cause, nicht nur Symptom):** Sobald Welle 1 (die drei echten A-Fälle) und die CI-gatenden Dateien durch sind, `tsc --noEmit` und mindestens `vitest run` (volle Suite, nicht nur `ci:flow-smoke`) in `ci.yml` aufnehmen — sonst wächst diese Liste beim nächsten `lib/`-Refactor einfach weiter, unsichtbar, und die nächste echte A-Regression fällt niemandem auf.

---

## 5. Größte ungetestete Flächen

1. **E2E-Abdeckung faktisch auf einen Happy-Path reduziert.** `playwright.config.ts` hat `testMatch: "ui-cockpit-playtest.spec.js"` — es existiert nur diese eine Spec-Datei. Es gibt keine E2E-Tests für Fehlerpfade, Edge Cases oder alternative Nutzerflüsse.

2. **Multiplayer/Online-4v4-Pfad ist komplett unbeobachtet in CI.** `scripts/smoke-multiplayer-e2e.ts` existiert (2-Browser-Room-E2E via Playwright + socket.io), ist aber in `ci.yml` explizit auskommentiert (`# TODO(online-mp): Re-enable when online multiplayer is prioritized`). `lib/socket/` (`client.ts`, `server.ts`, `room-gameplay-broadcast.ts`) hat zudem **keine einzige direkte Unit-Testdatei** — Race Conditions bei gleichzeitigen Room-Aktionen sind komplett ungetestet.

3. **Keine Cash-/Ökonomie-Invarianten über eine ganze Saison.** Es gibt viele Einzeltests für Finance-Services (`loan-service.test.ts`, `cash-prize-apply-*.test.ts`, `transfer-finance-audit.test.ts`, …), aber keinen Test, der eine systemweite Invariante prüft — z.B. „Summe aller Cash-Bewegungen über eine komplette Saison (Transfers, Gehälter, Preisgelder, Sponsoring, Darlehen) muss sich zu einer erwartbaren Bilanz aufsummieren, kein Geld entsteht/verschwindet grundlos". Genau dieser Blindspot war im Fable-Befund benannt und wurde hier bestätigt: keine Datei mit `cashConservation`/`totalCash`-artigem Namen gefunden.

4. **Keine Property-based Tests trotz zahlenlastiger Domäne.** `fast-check` taucht nur transitiv in `package-lock.json` auf (Sub-Dependency eines anderen Pakets), ist **keine direkte Dependency** und wird in keiner Datei importiert (`from "fast-check"` — 0 Treffer). Für Bereiche mit komplexen numerischen Formeln (Marktwert-Kurven, XP-/Progression-Berechnung, Gehalts-Staffelung `ContractYearSalary`) gibt es damit nur handverlesene Beispiel-Fixtures statt generativer Grenzfall-Abdeckung.

5. **CI führt nur 17 von ~415 Vitest-Dateien aus — die übrigen ~398 sind kein automatisiertes Sicherheitsnetz, egal ob sie kompilieren oder nicht.** Das ist selbst eine ungetestete Fläche: Es gibt keine Instanz, die verlässlich beobachtet, ob Reparaturen aus dieser Triage den Rest der Suite nicht wieder in einen stale Zustand zurückfallen lassen. Ohne CI-Integration der vollen Suite bleibt jede Reparaturwelle strukturell fragil — und genau dieser blinde Fleck ist es, der die drei echten A-Fälle in dieser Stichprobe (Marktwert-Sync, KI-Vertragsstrategie, Fatigue-Mechanik im Spieltag-Ergebnis) unbemerkt hat entstehen lassen.

---

*Erstellt: 2026-07-17. Reine Analyse, keine Code-Änderungen. Methodik: Stichprobe von 15 der 183 betroffenen Dateien, Klassifizierung durch manuellen Abgleich von Test-Fixtures gegen aktuelle `lib/`-Typen UND Verifikation, ob der getestete Code die betroffenen Felder tatsächlich liest.*
