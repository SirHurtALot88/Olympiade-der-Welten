# AI Golden-Master Porting Spec

## Status

Die Retool-JSON `Olympiade der Welten Draftboard (7).json` liefert jetzt **echte Originalspuren** der alten AI-/Needs-/Planner-/Fatigue-Logik.

Der Status ist damit nicht mehr pauschal „komplett blockiert“, sondern fachlich aufgeteilt:
- `PARTIALLY UNBLOCKED`: mehrere balancingsensible Kernbausteine wurden direkt aus der Retool-JSON extrahiert
- `STILL BLOCKED`: einige Bereiche sind weiterhin nur als Spur, Wrapper, Preview oder Teiltreffer vorhanden
- die aktuelle lokale Repo-AI bleibt **keine** Golden-Master-Quelle fuer altes Retool-Balancing

Primaere Extraktbasis:
- [references/retool-ai-golden-master/README.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/README.md)
- [references/retool-ai-golden-master/AI2_RunNeeds.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/AI2_RunNeeds.state.js)
- [references/retool-ai-golden-master/AI2_06_SimulatePicks.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/AI2_06_SimulatePicks.js)
- [references/retool-ai-golden-master/disciplineRecipesGlobal.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/disciplineRecipesGlobal.js)
- [references/retool-ai-golden-master/aiPackageScoringConfig.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/aiPackageScoringConfig.state.js)
- [references/retool-ai-golden-master/teamIdentityOverrides.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/teamIdentityOverrides.state.js)
- [references/retool-ai-golden-master/seasonPlannerEngine.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/seasonPlannerEngine.state.js)
- [references/retool-ai-golden-master/playerExhaustionMap.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/playerExhaustionMap.txt)

Wichtiger Hinweis:
- Einige Retool-Objekte sind in der JSON seriell und schwer eindeutig adressierbar.
- Deshalb gibt es im Extrakt teils sowohl **primaere Code-Dateien** als auch **Teiltreffer** zum selben Suchbegriff.
- Fuer die spaetere Portierung muessen wir immer die **primaeren Volltreffer** vor Wrappern, Debug-Widgets und Teilspuren priorisieren.

---

## 1. Gefundene Quellen

### A. Direkt aus Retool-JSON extrahierte Primaerquellen

#### Quelle A1
- Datei: [references/retool-ai-golden-master/AI2_RunNeeds.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/AI2_RunNeeds.state.js)
- Name: `AI2_RunNeeds`
- Typ: `State`
- Page: `transfermarktPage`
- Zweck: Orchestrator fuer den deterministischen AI2-Lauf
- Status: `vollstaendige Logik`

Sicher rekonstruierbar:
- Reihenfolge der Pipeline:
  - `AI2_01_Preload`
  - `AI2_00_MarketRoleBenchmarks`
  - `AI2_02_Context`
  - `AI2_03_Needs`
  - `AI2_04_Planner`
  - `AI2_06_SimulatePicks`
- alter State wird vor jedem Lauf gezielt geleert
- Needs, Plan und Planned Picks werden als Snapshots gespeichert
- Run liefert `needsCount`, `stepsCount`, `plannedPicksCount`, `engine`, `needsVersion`, `plannerVersion`, `simulateVersion`

#### Quelle A2
- Datei: [references/retool-ai-golden-master/AI2_06_SimulatePicks.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/AI2_06_SimulatePicks.js)
- Name: `AI2_06_SimulatePicks`
- Typ: `Function`
- Page: `transfermarktPage`
- Zweck: simulierter Pick-Lauf nach Planner-Ergebnis
- Status: `vollstaendige Logik`

Sicher rekonstruierbar:
- Version: `ai2.simulatePicks.v15_7_3_1_fit_tiebreak_neartop_fix`
- seeding / near-tie handling vorhanden
- skip-Verhalten ist explizit dokumentiert
- `simRoster`, `pickedAxes`, `pickedDisciplines`, `planned_picks`, `needs_timeline` werden gefuehrt
- `DISZI_AXIS` Mapping ist enthalten

#### Quelle A3
- Datei: [references/retool-ai-golden-master/disciplineRecipesGlobal.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/disciplineRecipesGlobal.js)
- Name: `disciplineRecipesGlobal`
- Typ: `query`
- Zweck: zentrale Diszi-/Achsen- und Preview-Kontext-Logik
- Status: `vollstaendige Logik`

Sicher rekonstruierbar:
- `DISZI_AXIS` Mapping fuer 20 Diszis
- `AXIS_COLOR`
- Kontextaufbau ueber:
  - `activePlayersRaw`
  - `teamRatingsRaw`
  - `candidatePoolRaw`
  - `plan`
  - `rankingsRaw`
  - `recipes`
  - `overrides`
  - `snapshotNeedsRaw`
  - `queryNeedsRaw`
  - `cashRow`
- `normalizeSharesSoft(...)`
- diszi-bezogene Team-/Axis-Logik

#### Quelle A4
- Datei: [references/retool-ai-golden-master/aiPackageScoringConfig.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/aiPackageScoringConfig.state.js)
- Name: `aiPackageScoringConfig`
- Typ: `State`
- Zweck: Paket-Scoring-Konfiguration
- Status: `vollstaendige Konfigurationslogik extrahiert`

Sicher rekonstruierbar:
- `needCoverage.primaryHitBonus = 14`
- `needCoverage.secondaryHitBonus = 7`
- `needCoverage.uniqueNeedBonus = 4`
- `needCoverage.uniqueNeedBonusCap = 3`
- `needCoverage.disciplineHoleWeight = 0.60`
- `needCoverage.overlapSameNeedPenalty = 5`
- `needCoverage.overlapSameNeedPenaltyCap = 12`
- `needCoverage.profileOverlapThreshold = 0.80`
- `needCoverage.profileOverlapPenalty = 4`
- `needCoverage.profileOverlapPenaltyCap = 10`
- `similarity.wAxis = 0.70`
- `similarity.wNeed = 0.25`
- `similarity.wColor = 0.05`
- `similarity.threshold = 0.62`
- `similarity.scale = 28`
- `similarity.cap = 14`
- `identityBalance.pivot = 0.58`
- `identityBalance.scale = 18`
- `identityBalance.cap = 7`
- `financePosture.*` Werte sind ebenfalls voll extrahiert

#### Quelle A5
- Datei: [references/retool-ai-golden-master/cashCreatorPackageScoringConfig.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/cashCreatorPackageScoringConfig.state.js)
- Name: `cashCreatorPackageScoringConfig`
- Typ: `State`
- Zweck: Cash-Creator-Sonderkonfiguration
- Status: `direkt aus Retool-JSON gefunden, Extrakt noch gemischt`

Sicher rekonstruierbar aus der JSON-Quelle:
- `version = ccPkgPref.v1`
- `depth.preferSize2Bonus = 6`
- `depth.preferSize3Bonus = 8`
- `depth.size4Penalty = 4`
- `depth.size5Penalty = 8`
- `depth.targetAxis = { pow: 0.05, spe: 0.05, men: 0.45, soc: 0.45 }`
- `depth.axisAlignScale = 14`
- `depth.axisAlignPivot = 0.62`
- `depth.axisAlignCap = 10`
- `resale.avgValueW = 0.12`
- `resale.avgRatioW = 0.08`
- `resale.usageTarget = 0.62`
- `resale.usagePenaltyScale = 18`
- `resale.usagePenaltyCap = 10`
- `flip.fit25BonusEach = 2.5`
- `flip.fit25BonusCap = 7`
- `flip.salaryToFeePenaltyScale = 9`
- `flip.salaryToFeePivot = 0.22`
- `flip.salaryToFeePenaltyCap = 7`
- `holes.coveredFieldBonusEach = 1.5`
- `holes.coveredFieldBonusCap = 4`
- `totalCap = 18`

Hinweis:
- Der automatisch geschriebene Dateiinhalt ist aktuell noch nicht die saubere State-Value-Darstellung.
- Die JSON-Quelle bestaetigt aber eindeutig, dass der Baustein **existiert und inhaltlich rekonstruierbar ist**.

#### Quelle A6
- Datei: [references/retool-ai-golden-master/teamIdentityOverrides.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/teamIdentityOverrides.state.js)
- Name: `teamIdentityOverrides`
- Typ: `State`
- Zweck: explizite Team-Archetypen/Overrides
- Status: `vollstaendige Konfigurationslogik extrahiert`

Sicher rekonstruierbar:
- `Cash Creators` / `C-C`
  - `archetype = cash_creator`
  - `roster.target = 12`
  - `contracts.preferredLengthYears = 1`
- `W-L`
  - `archetype = mercenary_roster`
  - `traitPreferences.requiredPrimary = ['mercenary']`
  - `requiredShareTarget = 0.8`
- `T-T`
  - `archetype = trainer_culture`
  - `traitPreferences.preferred = ['diligent']`

#### Quelle A7
- Datei: [references/retool-ai-golden-master/seasonPlannerEngine.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/seasonPlannerEngine.state.js)
- Name: `seasonPlannerEngine`
- Typ: `State`
- Zweck: Season-/Matchday-Planung
- Status: `vollstaendige Logik`

Sicher rekonstruierbar:
- documented goals und hard rules sind im Code enthalten
- starke Captain-, Positive-/Negative-Card-, Team-Focus- und Core-Diszi-Logik
- viele konkrete Planner-Knobs inklusive harter Grenzen
- `seasonPlannerEngineV7` ist als Dokumentations-/Versionsspur im Block enthalten

#### Quelle A8
- Datei: [references/retool-ai-golden-master/playerExhaustionMap.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/playerExhaustionMap.txt)
- Name: `playerExhaustionMap`
- Typ: `TextWidget2 funcBody`
- Zweck: Ermuedungs-/Fatigue-Multiplikator
- Status: `vollstaendige Logik`

Sicher rekonstruierbar:
- letzte 4 Spieltage werden betrachtet
- Consecutive-Use-Logik pro Spieler
- Multipliers:
  - `1x -> 0.95`
  - `2x -> 0.90`
  - `3x -> 0.85`
  - `4x+ -> 0.80`

### B. Weitere gefundene Quellen / Teilspuren

#### Quelle B1
- Datei: [references/retool-ai-golden-master/aiTeamNeeds.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/aiTeamNeeds.txt)
- Zweck: Retool-Funktionsblock zu Team Needs
- Status: `teilweise extrahiert`

#### Quelle B2
- Datei: [references/retool-ai-golden-master/aiTeamNeedsQuery.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/aiTeamNeedsQuery.js)
- Zweck: Query-seitige Needs-Berechnung
- Status: `teilweise extrahiert`

#### Quelle B3
- Datei: [references/retool-ai-golden-master/validateAiTeamNeedsThinRoster.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/validateAiTeamNeedsThinRoster.txt)
- Zweck: Validierungs-/Regressionstest gegen Thin-Roster-Verhalten
- Status: `vollstaendig oder weitgehend extrahiert`

#### Quelle B4
- Datei: [references/retool-ai-golden-master/aiSNP_needsCore.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/aiSNP_needsCore.js)
- Zweck: needsCore-Logik der SNP-/Planner-Linie
- Status: `vollstaendige oder grosse Teil-Logik`

#### Quelle B5
- Datei: [references/retool-ai-golden-master/aiSNP_planner.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/aiSNP_planner.js)
- Zweck: Planner-Variante in der SNP-Linie
- Status: `vollstaendige oder grosse Teil-Logik`

#### Quelle B6
- Datei: [references/retool-ai-golden-master/finalPicksScore100_v2.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/finalPicksScore100_v2.txt)
- Zweck: finales Pick-Scoring / Ranking-Spur
- Status: `teilweise extrahiert`

### C. Repo-/Doku-Quellen ausserhalb der JSON

#### Quelle C1
- Datei: [docs/README_RETOOL_SYSTEM.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/README_RETOOL_SYSTEM.md)
- Zweck: fachliche Retool-Referenz
- Status: `Retool-Referenz`

#### Quelle C2
- Datei: [data/oly-draftboard-schema-map.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/data/oly-draftboard-schema-map.md)
- Zweck: Namens-/Systemkartierung
- Status: `Retool-Referenz`

#### Quelle C3
- Datei: [lib/ai/aiNeedsEngine.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/aiNeedsEngine.ts)
- Zweck: lokale Approximation
- Status: `aktiv, aber nicht Golden Master`

#### Quelle C4
- Datei: [lib/ai/aiTransferMarket.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/aiTransferMarket.ts)
- Zweck: lokale Approximation
- Status: `aktiv, aber nicht Golden Master`

#### Quelle C5
- Datei: [lib/ai/aiTurnEngine.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/aiTurnEngine.ts)
- Zweck: lokale Approximation
- Status: `aktiv, aber nicht Golden Master`

---

## 2. Welche Logik ist vollstaendig rekonstruierbar?

Mit hoher Sicherheit aus Retool-Originalcode rekonstruierbar:
- `AI2_RunNeeds` Pipeline-Orchestrierung
- `AI2_06_SimulatePicks` als eigener Sequenz-/Pick-Simulator
- `disciplineRecipesGlobal` als Diszi-/Axis-/Context-Kern
- `playerExhaustionMap` inklusive Fatigue-Multipliers
- `seasonPlannerEngine` inklusive vieler harter Regeln und Konfigurationswerte
- `aiPackageScoringConfig`
- `teamIdentityOverrides`
- `cashCreatorPackageScoringConfig` inhaltlich aus der JSON-Quelle

Nur teilweise rekonstruierbar:
- `aiTeamNeeds`
- `disciplineNeeds`
- `disciplineNeedDiagnostics`
- `teamIdentityWeights`
- `rosterNeeds`
- `rosterPressureProfile`
- Teile von `aiPickSeasonPlan`
- Teile der finalen Pick-Rankings und Preview-Debugs

---

## 3. Welche Logik ist nur als Spur vorhanden?

Als Spur, Wrapper, Preview oder Diagnostik vorhanden:
- `disciplineNeedDiagnostics`
  - aktuell nur als diagnostische Struktur in Preview-/Audit-Code sichtbar
- `teamIdentityWeights`
  - Namensspur vorhanden, kein sauberer Primär-State extrahiert
- `rosterNeeds`
  - Namensspur vorhanden, aber kein sauberer Primärblock
- `rosterPressureProfile`
  - Namensspur vorhanden, aber kein sauberer Primärblock
- `aiPickSeasonPlan`
  - Trigger/Buttons/Preview und Planner-Anbindung vorhanden, aber nicht als einzelnes kanonisches Gesamtmodul isoliert

---

## 4. Welche Gewichtungen/Zahlen wurden gefunden?

### Sicher extrahierte Zahlen
- `disciplineHoleWeight = 0.60`
- `similarity.wAxis = 0.70`
- `similarity.wNeed = 0.25`
- `similarity.wColor = 0.05`
- `similarity.threshold = 0.62`
- `similarity.scale = 28`
- `similarity.cap = 14`
- `identityBalance.pivot = 0.58`
- `identityBalance.scale = 18`
- `identityBalance.cap = 7`
- `primaryHitBonus = 14`
- `secondaryHitBonus = 7`
- `uniqueNeedBonus = 4`
- `profileOverlapPenalty = 4`
- `cashPenaltyCap = 18`
- `salaryPenaltyCap = 12`
- `cashCreator.totalCap = 18`
- `cashCreator.depth.preferSize2Bonus = 6`
- `cashCreator.depth.preferSize3Bonus = 8`
- `cashCreator.flip.fit25BonusEach = 2.5`
- `playerExhaustionMap multipliers = 0.95 / 0.90 / 0.85 / 0.80`

### Planner-/Captain-/Card-Knobs sicher gefunden
Beispiele aus `seasonPlannerEngine.state.js`:
- `TEAM_BIAS_PICK_W = 1.45`
- `TEAM_BIAS_PLAYER_W = 0.16`
- `POS_TEAM_FOCUS_W = 3.25`
- `POS_BIG_DISZI_W = 1.35`
- `POS_AVG_QUALITY_W = 1.75`
- `NEG_MATCH_COLOR_FACTOR = 1.65`
- `NEG_CORE_DISZI_FACTOR = 1.48`
- `NEG_MEGA_CORE_DISZI_FACTOR = 1.72`
- `CAP_CORE_BONUS = 10.0`
- `CAP_MEGA_CORE_BONUS = 18.0`
- `CAP_NEG_FORM_PENALTY = 42.0`
- `CAP_NEG_FORM_HARD_PENALTY = 999.0`

---

## 5. Welche Regeln sind harte Regeln?

Sicher gefunden:
- `AI2_RunNeeds` leert vor einem Lauf gezielt alten Run-State
- `AI2` laeuft in fester Reihenfolge
- `skip` in `AI2_06_SimulatePicks` verbraucht kein Budget und veraendert den simulierten Kader nicht
- `playerExhaustionMap` betrachtet nur letzte 4 Spieltage
- `seasonPlannerEngine` dokumentiert harte Regeln:
  - max 2 Karten pro Disziplin
  - max 1 negative Karte pro Disziplin
  - `formkarte_id_2` darf nie negativ sein
  - wenn negativ, dann nur in Slot 1
- Team-/Identity-Overrides koennen harte Kader-/Trait-Vorgaben enthalten
  - z. B. `Cash Creators` Kaderziel 12
  - `W-L` Mercenary-Share 0.8

---

## 6. Welche Regeln sind Soft Biases?

Sicher als Soft Bias / Gewichtung erkennbar:
- Axis-/Need-/Color-Gewichtung im Paket-Scoring
- Identity-Balance-Pivot und Scale
- Finance-Posture-Adjustments
- Cash-Creator-spezifische Size-/Axis-/Resale-/Flip-Boni und Penalties
- Team-Focus-, Core-Diszi- und Big-Diszi-Gewichte im Planner
- seeded near-tie variety in `AI2_06_SimulatePicks` und `seasonPlannerEngine`

---

## 7. Welche Tiebreaker gibt es?

Sicher gefunden:
- seeded hash / pseudo-random near-tie resolution in `AI2_06_SimulatePicks`
- `seasonPlannerEngine` arbeitet mit `TIE_BAND_*` und `TIE_JITTER_*`
- mehrere Planner-/Pick-Systeme benutzen bewusst kleine deterministische Varianz statt voll zufaelligem Verhalten

Open question:
- welche Tiebreaker im finalen `aiTeamNeeds` / `disciplineNeeds` / `rosterPressureProfile` wirklich kanonisch waren

---

## 8. Welche Systeme duerfen spaeter nicht neu erfunden werden?

Diese Bereiche muessen spaeter moeglichst treu aus dem Retool-Material portiert werden:
- `AI2_RunNeeds`
- `AI2_06_SimulatePicks`
- `disciplineRecipesGlobal`
- `aiPackageScoringConfig`
- `cashCreatorPackageScoringConfig`
- `teamIdentityOverrides`
- `playerExhaustionMap`
- `seasonPlannerEngine`
- spaeter auch `disciplineNeeds`, `rosterNeeds`, `rosterPressureProfile`, sobald deren Primaerlogik sauberer extrahiert ist

Die aktuelle lokale Repo-AI darf dafuer nicht als Wahrheit benutzt werden.

---

## 9. Welche Retool-Exports / JS / SQL fehlen noch?

`BLOCKED: original Retool AI logic missing for ...`
- `teamIdentityWeights` als klarer Primärblock
- `rosterNeeds` als klarer Primärblock
- `rosterPressureProfile` als klarer Primärblock
- `disciplineNeeds` als klarer Primärblock
- `disciplineNeedDiagnostics` als klarer Primärblock
- ggf. sauber isolierter `aiPickSeasonPlan`-Primärblock
- ggf. weitere AI2-Stages wie `AI2_03_Needs`, `AI2_04_Planner`, falls sie separat exportierbar sind

Zusätzlich hilfreich waeren:
- Retool-Export der betroffenen einzelnen Functions/Queries als RSX/JS
- eventuelle SQL-Queries fuer Needs-/Roster-/Ranking-Hilfsdaten
- falls vorhanden: kommentierte Snapshots oder Debug-Exports der finalen Pipeline

---

## 10. Konkreter Portierungsplan in Reihenfolge

1. **Team Identity**
- zuerst `teamIdentityOverrides`
- danach `teamIdentityWeights`, sobald der Primärblock vorliegt
- Zielmodul: `lib/ai/team-identity.ts`

2. **Discipline Needs**
- `disciplineRecipesGlobal`
- danach `disciplineNeeds` / `disciplineHoleWeight` / `disciplineNeedDiagnostics`
- Zielmodul: `lib/ai/discipline-needs-engine.ts`

3. **Roster Pressure**
- `rosterNeeds`
- `rosterPressureProfile`
- Zielmodul: `lib/ai/roster-pressure-engine.ts`

4. **Legacy Lineup AI**
- erst auf Basis der echten Needs-/Identity-/Fatigue-Inputs
- Zielmodul: `lib/ai/ai-legacy-lineup-engine.ts`

5. **Transfer AI**
- `AI2_RunNeeds`
- `AI2_06_SimulatePicks`
- `aiPackageScoringConfig`
- `cashCreatorPackageScoringConfig`
- Zielmodul: `lib/ai/ai-transfer-engine.ts`

6. **Season Planner**
- `seasonPlannerEngine`
- `seasonPlannerEngineV7`
- spaeter Captain/Formkarten/Fatigue nur aus Originalregeln additiv
- Zielmodul: `lib/ai/season-planner-engine.ts`

---

## 11. Update gegenueber frueherem Stand

Vorher als fehlend oder blockiert markiert, jetzt aus der Retool-JSON gefunden:
- `AI2_06_SimulatePicks`
- `AI2_RunNeeds`
- `aiTeamNeeds`
- `aiPickSeasonPlan`
- `disciplineRecipesGlobal`
- `playerExhaustionMap`
- `cashCreatorPackageScoringConfig`
- `teamIdentityOverrides`
- `seasonPlannerEngine`
- `seasonPlannerEngineV7`
- `captain_boost_x10` als produktive Score-/Lineup-Spur
- `formkarten_v2` als produktive Karten-/Season-End-Spur

Weiterhin nicht sauber als Primärlogik isoliert:
- `disciplineNeeds`
- `disciplineNeedDiagnostics`
- `teamIdentityWeights`
- `rosterNeeds`
- `rosterPressureProfile`

## 12. Fazit

Die Portierung ist jetzt **nicht mehr blind**.

Wir haben echte Retool-Originalbausteine fuer:
- AI2 Orchestrierung
- Pick-Simulation
- Diszi-/Axis-Rezepte
- Package-Scoring
- Team-Identity-Overrides
- Season Planner
- Fatigue

Balancing bleibt trotzdem in Teilen unklar, solange `disciplineNeeds`, `rosterNeeds`, `rosterPressureProfile` und `teamIdentityWeights` nicht als primaere Originalblöcke vorliegen.

Bis dahin gilt:
- keine neue AI-Heuristik als Golden Master behandeln
- lokale Repo-AI nur als Platzhalter sehen
- Portierung streng an den extrahierten Retool-Dateien ausrichten

## 13. Bereits als TypeScript-Referenz portiert

Die folgenden **statischen** Golden-Master-Bausteine wurden jetzt als reine Referenzdaten nach TypeScript portiert:
- [lib/ai/golden-master/discipline-recipes.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/golden-master/discipline-recipes.ts)
  - portiert nur die statischen Teile aus `disciplineRecipesGlobal`
  - aktuell: `VERSION`, `DISZI_AXIS`, `AXIS_COLOR`
- [lib/ai/golden-master/team-identity-overrides.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/golden-master/team-identity-overrides.ts)
- [lib/ai/golden-master/package-scoring-config.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/golden-master/package-scoring-config.ts)
- [lib/ai/golden-master/cash-creator-package-scoring-config.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/golden-master/cash-creator-package-scoring-config.ts)

Wichtig:
- diese Module enthalten **keine** AI-Entscheidungslogik
- sie enthalten **keine** neuen Heuristiken
- Werte wurden 1:1 aus dem Retool-Extrakt uebernommen

Noch nicht portiert:
- `AI2_RunNeeds`
- `AI2_06_SimulatePicks`
- dynamische Teile aus `disciplineRecipesGlobal`
- `seasonPlannerEngine`
- `playerExhaustionMap`
- unsaubere oder nur spurhaft extrahierte Bausteine wie `disciplineNeeds`, `teamIdentityWeights`, `rosterNeeds`, `rosterPressureProfile`

Offene Quirks:
- `cashCreatorPackageScoringConfig.state.js` ist im Extrakt technisch nicht in jedem Lauf sauber, die Zahlenbasis ist aber aus der JSON bestaetigt
- `disciplineRecipesGlobal` ist nur teilweise statisch; der dynamische Need-/Context-Code wurde bewusst noch nicht portiert
