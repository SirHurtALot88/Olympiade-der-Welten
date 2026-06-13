# AI Golden-Master Dependency Map

## Zweck

Diese Datei ordnet den extrahierten Retool-AI-Code aus
[references/retool-ai-golden-master](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master)
als **Portierungsgrundlage** ein.

Sie ist bewusst keine Implementierungsspec, sondern eine Dependency- und Risiko-Karte:
- Was ist Primärquelle?
- Was ist nur Wrapper, Debug oder Preview?
- Welche Inputs / Outputs sind erkennbar?
- Wo sind Balancing-Konstanten sicher?
- Wo stört Retool-Serialisierung die saubere Rekonstruktion?

## 1. Quellenübersicht

### 1. [AI2_RunNeeds.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/AI2_RunNeeds.state.js)
- Retool-Name: `AI2_RunNeeds`
- Typ: `State`
- Zweck: AI2-Orchestrator fuer den deterministischen Gesamtlauf
- Quelle: `Primärquelle`
- Extraktionsstatus: `Retool-Serialisierungsquirk sichtbar`

Einordnung:
- Fachlich klar zentrale Pipeline-Quelle
- Der Extrakt ist nicht in jedem Lauf stabil gleich sauber; im besten Fall enthaelt er den kompletten Orchestrator, in manchen Extraktionslaeufen nur einen unvollstaendigen State-Block
- Fuer Portierung als **kanonische Pipeline-Referenz** behandeln, aber Extraktionsstabilitaet bei Bedarf vor Portierung noch einmal manuell absichern

### 2. [AI2_06_SimulatePicks.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/AI2_06_SimulatePicks.js)
- Retool-Name: `AI2_06_SimulatePicks`
- Typ: `Function`
- Zweck: simuliert sequentielle Picks nach Planner-Output
- Quelle: `Primärquelle`
- Extraktionsstatus: `vollständig extrahiert`

### 3. [disciplineRecipesGlobal.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/disciplineRecipesGlobal.js)
- Retool-Name: `disciplineRecipesGlobal`
- Typ: `Function / JS query-artiger Codeblock`
- Zweck: zentrale Diszi-/Axis-/Context-Logik fuer Needs und Preview-Kontexte
- Quelle: `Primärquelle`
- Extraktionsstatus: `weitgehend vollständig`

### 4. [aiPackageScoringConfig.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/aiPackageScoringConfig.state.js)
- Retool-Name: `aiPackageScoringConfig`
- Typ: `State / Config`
- Zweck: Konfigurationsmatrix fuer Package-Scoring
- Quelle: `Primärquelle`
- Extraktionsstatus: `vollständig extrahiert`

Hinweis:
- Der Dateikopf stammt im Extrakt teilweise vom Suchbegriff `disciplineHoleWeight`, aber der eigentliche State-Inhalt ist klar `aiPackageScoringConfig`

### 5. [cashCreatorPackageScoringConfig.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/cashCreatorPackageScoringConfig.state.js)
- Retool-Name: `cashCreatorPackageScoringConfig`
- Typ: `State / Config`
- Zweck: Sonderlogik fuer Cash-Creator-Paketbewertung
- Quelle: `Primärquelle inhaltlich`, `Extrakt technisch noch quirked`
- Extraktionsstatus: `Retool-Serialisierungsquirk sichtbar`

Einordnung:
- Der JSON-Rohinhalt bestaetigt die Werte klar
- Der automatisch geschriebene Dateikörper kann je nach Extraktionslauf noch einen Nachbarblock erwischen
- Inhaltlich trotzdem als vorhanden und balancingsensibel behandeln

### 6. [teamIdentityOverrides.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/teamIdentityOverrides.state.js)
- Retool-Name: `teamIdentityOverrides`
- Typ: `State / Config`
- Zweck: explizite Team-Archetypen und Sonderregeln
- Quelle: `Primärquelle`
- Extraktionsstatus: `inhaltlich vollständig`, `Header-Quirks moeglich`

### 7. [seasonPlannerEngine.state.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/seasonPlannerEngine.state.js)
- Retool-Name: `seasonPlannerEngine`
- Typ: `State / Engine`
- Zweck: Season-/Matchday-Planung inkl. Captain-/Card-/Focus-Entscheidungen
- Quelle: `Primärquelle`
- Extraktionsstatus: `vollständig extrahiert`

### 8. [playerExhaustionMap.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/playerExhaustionMap.txt)
- Retool-Name: `playerExhaustionMap`
- Typ: `Function / Widget-funcBody`
- Zweck: Fatigue-/Exhaustion-Multiplikatoren aus den letzten Spieltagen
- Quelle: `Primärquelle`
- Extraktionsstatus: `vollständig extrahiert`

### 9. [aiTeamNeeds.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/aiTeamNeeds.txt)
- Retool-Name: `aiTeamNeeds`
- Typ: `Function`
- Zweck: Needs-Berechnung oder Needs-Aggregation
- Quelle: `Hilfsquelle / vermutlich fachlich wichtig`
- Extraktionsstatus: `teilweise, mit Quirks`

### 10. [aiTeamNeedsQuery.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/aiTeamNeedsQuery.js)
- Retool-Name: `aiTeamNeedsQuery`
- Typ: `JavascriptQuery`
- Zweck: query-seitige Needs-Berechnung / Tabellenform
- Quelle: `Hilfsquelle`
- Extraktionsstatus: `teilweise bis gut`

### 11. [aiSNP_needsCore.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/aiSNP_needsCore.js)
- Retool-Name: `aiSNP_needsCore`
- Typ: `Function`
- Zweck: Needs-Kern einer SNP-/Planner-Linie
- Quelle: `Hilfsquelle, potenziell sehr wichtig`
- Extraktionsstatus: `gut`

### 12. [aiSNP_planner.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/aiSNP_planner.js)
- Retool-Name: `aiSNP_planner`
- Typ: `Function`
- Zweck: Planner-Stufe innerhalb der SNP-Linie
- Quelle: `Hilfsquelle`
- Extraktionsstatus: `gut`

### 13. [validateAiTeamNeedsThinRoster.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/validateAiTeamNeedsThinRoster.txt)
- Retool-Name: `validateAiTeamNeedsThinRoster`
- Typ: `JavascriptQuery`
- Zweck: Regressionstest / Audit fuer Needs bei kleinem Kader
- Quelle: `Hilfsquelle / Auditquelle`
- Extraktionsstatus: `gut`

### 14. [finalPicksScore100_v2_withWant.js](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/finalPicksScore100_v2_withWant.js)
- Retool-Name: `finalPicksScore100_v2_withWant`
- Typ: `Function`
- Zweck: Ranking-/Score-Hilfslogik fuer finale Picks
- Quelle: `Hilfsquelle`
- Extraktionsstatus: `gut`

### 15. [disciplineNeeds.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/disciplineNeeds.txt)
- Retool-Name: `disciplineNeeds`
- Typ: `unknown`
- Zweck: vermutlich Diszi-Need-Output oder State
- Quelle: `Hilfsquelle`
- Extraktionsstatus: `nur Spur`

### 16. [rosterNeeds.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/rosterNeeds.txt)
- Retool-Name: `rosterNeeds`
- Typ: `unknown`
- Zweck: vermutlich Roster-Need-Modell
- Quelle: `Hilfsquelle`
- Extraktionsstatus: `nur Spur`

### 17. [rosterPressureProfile.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/rosterPressureProfile.txt)
- Retool-Name: `rosterPressureProfile`
- Typ: `unknown`
- Zweck: vermutlich Kaderdruck-Modell
- Quelle: `Hilfsquelle`
- Extraktionsstatus: `nur Spur`

### 18. [teamIdentityWeights.txt](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/references/retool-ai-golden-master/teamIdentityWeights.txt)
- Retool-Name: `teamIdentityWeights`
- Typ: `unknown`
- Zweck: vermutlich Gewichtungsebene fuer Identity
- Quelle: `Hilfsquelle`
- Extraktionsstatus: `nur Spur`

## 2. Dependencies pro Datei

### AI2_RunNeeds
Gelesene Queries/States:
- `filterTeam.value`
- `AI2_01_Preload`
- `AI2_00_MarketRoleBenchmarks`
- `AI2_02_Context`
- `AI2_03_Needs`
- `AI2_04_Planner`
- `AI2_06_SimulatePicks`
- `ai2NeedsSnapshot`
- `ai2PlanSnapshot`
- `ai2PlannedPicksSnapshot`
- `autoBuyBatchEdits`
- `autoBuyBatchSelectedPick`
- `autoBuyBatchRunState`

Geschriebene States:
- `ai2NeedsSnapshot`
- `ai2PlanSnapshot`
- `ai2PlannedPicksSnapshot`
- `autoBuyBatchEdits`
- `autoBuyBatchSelectedPick`
- `autoBuyBatchRunState`

Globale Helper:
- `utils.showNotification`
- lokales `safeSet`, `safeTrigger`, `sleep`

Erkannte Inputs:
- ausgewähltes Team
- Vorstufen-Outputs der AI2-Pipeline

Erkannte Outputs:
- orchestrierter Run-Status
- Needs-Snapshot
- Plan-Snapshot
- Planned-Picks-Snapshot
- Preview-Daten fuer Folgekomponenten

### AI2_06_SimulatePicks
Gelesene Queries/States:
- `filterTeam.value`
- indirekt `planRes.plan.teamMetrics`
- indirekt `simSeed`
- Planner-/Need-Outputs aus vorheriger Pipeline-Stufe

Geschriebene States:
- im Extrakt nicht direkt als Retool-State-Write sichtbar
- produziert Return-Objekt fuer Folgekomponenten

Globale Helper:
- seeded hash / tie-breaking helpers
- Rollen-/Achsen-Helfer

Erkannte Inputs:
- Team
- Planner-Result
- Sim-Seed
- Kandidaten-/Bedarfsdaten
- Axis-/Diszi-Mapping

Erkannte Outputs:
- `planned_picks`
- `needs_timeline`
- `debug`
- `plannedSteps`

### disciplineRecipesGlobal
Gelesene Queries/States:
- `filterTeam.value`
- `localStorage.values.selectedTeamCode`
- `getActivePlayersByTeam.data`
- `getTeamRatingsTransfermarkt.data`
- `aiTransferCandidatePool.value`
- `aiTeamPlan.value`
- `aiTeamSlotPlan.value`
- `transfermarktSalaryBudgetLogic.value`
- `teamDisciplineRankings.value`
- `disciplineRecipesGlobal.value`
- `teamIdentityOverrides.value`
- `aiVarianceConfig.value`
- `bracketConfig.value`
- `aiTeamNeedsSnapshot.value`
- `aiTeamNeedsQuery.data`
- `getCashFromSaisonstand.value`
- `formatDataAsArray`
- optional `simRosterInput`

Geschriebene States:
- keine direkten Writes

Globale Helper:
- `window.aiSNP`
- `context.buildPreviewContext`
- `context.enrichContext`

Erkannte Inputs:
- Teamratings
- Kader
- Kandidatenpool
- Needs-Snapshot
- Budgetlogik
- Ranking-/Recipe-Daten

Erkannte Outputs:
- Diszi-/Axis-Need-Strukturen
- Coverage-/Hole-Profile
- Team-Focus-/Color-Kontext
- Preview-Kontext fuer spaetere Planner-/Pick-Stufen

### aiPackageScoringConfig
Gelesene Queries/States:
- keine externen Inputs, reine Config

Geschriebene States:
- keine

Globale Helper:
- keine

Erkannte Inputs:
- keine, statische Konfiguration

Erkannte Outputs:
- Package-Scoring-Gewichtungen fuer Need Coverage, Similarity, Identity Balance, Finance Posture

### cashCreatorPackageScoringConfig
Gelesene Queries/States:
- keine externen Inputs, reine Config

Geschriebene States:
- keine

Globale Helper:
- keine

Erkannte Inputs:
- keine, statische Konfiguration

Erkannte Outputs:
- Cash-Creator-spezifische Paketbewertungsregeln

### teamIdentityOverrides
Gelesene Queries/States:
- keine externen Inputs, reine Config

Geschriebene States:
- keine

Globale Helper:
- keine

Erkannte Inputs:
- keine, statische Konfiguration

Erkannte Outputs:
- team-spezifische Archetypen
- Roster-Ziele
- Trait-Praeferenzen
- Vertragsbias

### seasonPlannerEngine
Gelesene Queries/States:
- `seasonPlannerEngineInput.value`
- `input.roster`
- `input.schedule`
- `input.punktetabelleRows`
- `input.cards`
- `input.disziColorMapping`
- `input.proxyTeams`
- `input.teamBiasByDiszi`
- `input.teamRatingsRow`
- optionale `input.config`

Geschriebene States:
- keine direkten Writes im Engine-Block

Globale Helper:
- seeded tie jitter
- Ranking-/Points-Helfer
- Captain-/Card-Helfer

Erkannte Inputs:
- Team
- Season
- Roster
- Schedule
- Punktetabelle
- Formkarten
- Farben-/Bias-/Rating-Daten

Erkannte Outputs:
- Spieltagsplan
- Kartenallokation
- Captain-Entscheidungen
- Notes / AllocationSummary

### playerExhaustionMap
Gelesene Queries/States:
- `selectTeamEinsatzliste.value`
- `selectSpieltag.value`
- `formatDataAsArray(simpleLineupCheck.data)`

Geschriebene States:
- keine

Globale Helper:
- keine ausser Retool-Interpolation

Erkannte Inputs:
- Team
- aktueller Spieltag
- bisherige Legacy-Lineup-Daten

Erkannte Outputs:
- Map `playerName -> { count, multiplier }`

## 3. Pipeline-Reihenfolge

### Erkennbare Hauptpipeline
1. `AI2_01_Preload`
2. `AI2_00_MarketRoleBenchmarks`
3. `AI2_02_Context`
4. `AI2_03_Needs`
5. `AI2_04_Planner`
6. `AI2_06_SimulatePicks`
7. Snapshots / Debug / Preview

### Was erzeugt Needs?
- primaer vermutlich `AI2_03_Needs`
- fachlich vorbereitet durch:
  - `disciplineRecipesGlobal`
  - `aiTeamNeeds`
  - `aiTeamNeedsQuery`
  - `aiSNP_needsCore`

### Was erzeugt Pick-Kandidaten?
- Kandidatenpools tauchen in Referenzen auf wie:
  - `aiTransferCandidatePool`
  - `ai2MarketCandidatePool`
- der konkrete Sequenzlauf fuer Picks wird spaeter von `AI2_06_SimulatePicks` verarbeitet

### Was scored Pakete?
- `aiPackageScoringConfig`
- `cashCreatorPackageScoringConfig`
- evtl. zusaetzliche Hilfsquellen wie `finalPicksScore100_v2_withWant`

### Was simuliert Picks?
- `AI2_06_SimulatePicks`

### Was ist nur Config?
- `aiPackageScoringConfig`
- `cashCreatorPackageScoringConfig`
- `teamIdentityOverrides`
- Teile von `teamIdentityWeights`, falls spaeter sauber extrahierbar

## 4. Balancing-kritische Konstanten

### Package-Scoring
- `primaryHitBonus = 14`
- `secondaryHitBonus = 7`
- `uniqueNeedBonus = 4`
- `uniqueNeedBonusCap = 3`
- `disciplineHoleWeight = 0.60`
- `overlapSameNeedPenalty = 5`
- `overlapSameNeedPenaltyCap = 12`
- `profileOverlapThreshold = 0.80`
- `profileOverlapPenalty = 4`
- `profileOverlapPenaltyCap = 10`

### Similarity / Identity / Finance
- `wAxis = 0.70`
- `wNeed = 0.25`
- `wColor = 0.05`
- `threshold = 0.62`
- `scale = 28`
- `cap = 14`
- `identityBalance.pivot = 0.58`
- `identityBalance.scale = 18`
- `identityBalance.cap = 7`
- `cashTargetBase = 0.48`
- `cashTargetFinanceRange = 0.22`
- `cashTargetAmbitionBoost = 0.18`
- `cashTargetBoardBoost = 0.06`
- `cashTargetMin = 0.36`
- `cashTargetMax = 0.92`
- `cashPenaltyScale = 55`
- `cashPenaltyCap = 18`
- `cashBonusScale = 20`
- `cashBonusCap = 6`
- `salaryCapBase = 30`
- `salaryCapRange = 60`
- `salaryLoadThreshold = 0.72`
- `salaryPenaltyScale = 30`
- `salaryPenaltyCap = 12`
- `alignmentBonusCap = 5`
- `pkgTypeBiasScale = 3`

### Cash Creators
- `preferSize2Bonus = 6`
- `preferSize3Bonus = 8`
- `size4Penalty = 4`
- `size5Penalty = 8`
- `targetAxis = { pow: 0.05, spe: 0.05, men: 0.45, soc: 0.45 }`
- `axisAlignScale = 14`
- `axisAlignPivot = 0.62`
- `axisAlignCap = 10`
- `avgValueW = 0.12`
- `avgRatioW = 0.08`
- `usageTarget = 0.62`
- `usagePenaltyScale = 18`
- `usagePenaltyCap = 10`
- `fit25BonusEach = 2.5`
- `fit25BonusCap = 7`
- `salaryToFeePenaltyScale = 9`
- `salaryToFeePivot = 0.22`
- `salaryToFeePenaltyCap = 7`
- `coveredFieldBonusEach = 1.5`
- `coveredFieldBonusCap = 4`
- `totalCap = 18`

### Fatigue
- Consecutive use in last 4 matchdays:
  - `1 -> 0.95`
  - `2 -> 0.90`
  - `3 -> 0.85`
  - `4+ -> 0.80`

### Planner / Captain / Formkarten
- `TEAM_BIAS_PICK_W = 1.45`
- `TEAM_BIAS_PLAYER_W = 0.16`
- `PICKORDER_DIFF_THR = 0.2`
- `PICKORDER_OPP_THR = 0.25`
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

### Harte Regeln / Limits
- AI2-Pipeline-Reihenfolge ist fest
- Skip in `AI2_06_SimulatePicks` verbraucht kein Budget und verändert den Sim-Kader nicht
- `seasonPlannerEngine`:
  - max 2 Karten pro Disziplin
  - max 1 negative Karte pro Disziplin
  - `formkarte_id_2` nie negativ
  - negative Karte nur auf Slot 1
- `teamIdentityOverrides`:
  - `Cash Creators` Kaderziel 12
  - `W-L` Mercenary-Zielanteil 0.8

## 5. Open Questions

### Fehlende Dependencies
- klarer Primärblock fuer `teamIdentityWeights`
- klarer Primärblock fuer `rosterNeeds`
- klarer Primärblock fuer `rosterPressureProfile`
- klarer Primärblock fuer `disciplineNeeds`
- klarer Primärblock fuer `disciplineNeedDiagnostics`
- möglichst saubere Extrakte fuer `AI2_03_Needs` und `AI2_04_Planner`

### Unklare Retool-States
- mehrere Dateien erscheinen als `.state.js`, obwohl sie fachlich Function-/Query-Logik tragen
- einige Extrakte haben wegen Retool-Serialisierung einen irreführenden Header oder greifen Nachbarblöcke mit ab
- `AI2_RunNeeds.state.js` ist besonders quirk-anfällig und sollte vor Portierung nochmals manuell gegengeprüft werden
- `cashCreatorPackageScoringConfig.state.js` ist fachlich klar, technisch im Extrakt aber noch nicht ganz sauber

### Dinge, die nur als Spur vorliegen
- `disciplineNeeds`
- `disciplineNeedDiagnostics`
- `teamIdentityWeights`
- `rosterNeeds`
- `rosterPressureProfile`

### Retool-Serialisierungsquirks
- Komponenten stehen teils als Schlüsselblöcke, teils über `id`, teils über Nachbar-Widgets referenziert
- Suchbegriffe treffen oft Debug-/Preview-/Audit-Komponenten mit derselben Fachlogik
- dieselbe fachliche Quelle kann in mehreren Dateien indirekt gespiegelt werden

## 6. Porting-Reihenfolge

### 1. Reine Configs zuerst
Gefahrlos portierbar:
- `aiPackageScoringConfig`
- `cashCreatorPackageScoringConfig`
- `teamIdentityOverrides`

Warum zuerst:
- statische Daten
- keine Seiteneffekte
- balancingsensibel, aber direkt aus Originalquelle lesbar

### 2. Reine Helper danach
Gefahrlos portierbar:
- `playerExhaustionMap`
- kleine Determinismus-/Seed-Helper aus `AI2_06_SimulatePicks`
- reine Axis-/Color-/Diszi-Mappings aus `disciplineRecipesGlobal`

### 3. Context-/Recipe-Layer danach
- `disciplineRecipesGlobal`
- Teile von `aiSNP_needsCore`

Warum:
- schafft stabile Eingabeschicht für Needs, Planner und Simulate Picks

### 4. Needs Engine danach
- erst wenn `disciplineNeeds`, `teamIdentityWeights`, `rosterNeeds`, `rosterPressureProfile` besser geklärt sind
- bis dahin nur vorbereiten, nicht frei erfinden

### 5. Planner danach
- `seasonPlannerEngine`
- aber nur, wenn Captain/Formkarten/Fatigue im Scope ausdrücklich erlaubt sind

### 6. Simulate Picks erst später
- `AI2_RunNeeds`
- `AI2_06_SimulatePicks`

Warum zuletzt:
- höchste Abhängigkeitstiefe
- hängt von stabilen Needs-, Config-, Context- und Kandidatenmodellen ab
- hier wäre Balancing-Schaden am größten, wenn vorherige Bausteine nur angenähert sind

## 7. Fazit

Sicher als Primärquellen:
- `AI2_06_SimulatePicks.js`
- `disciplineRecipesGlobal.js`
- `aiPackageScoringConfig.state.js`
- `teamIdentityOverrides.state.js`
- `seasonPlannerEngine.state.js`
- `playerExhaustionMap.txt`
- `cashCreatorPackageScoringConfig` inhaltlich aus der JSON, technisch mit Extraktionsquirk
- `AI2_RunNeeds` fachlich als Primärquelle, aber mit Extraktionsquirk

Noch fehlende oder unsaubere Dependencies:
- `teamIdentityWeights`
- `rosterNeeds`
- `rosterPressureProfile`
- `disciplineNeeds`
- `disciplineNeedDiagnostics`
- saubere Primärblöcke für frühere AI2-Stufen

Erst sicher portierbar:
- Configs
- Fatigue-Helper
- Axis-/Color-/Diszi-Mappings
- Context-/Recipe-Layer

Balancing bleibt vor allem dort unklar, wo nur Spuren statt echter Primärblöcke vorliegen.
