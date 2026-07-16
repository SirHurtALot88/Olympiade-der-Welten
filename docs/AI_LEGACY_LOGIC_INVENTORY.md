# AI Legacy Logic Inventory

## Zweck

Diese Datei ist eine reine Inventur der vorhandenen AI-/Needs-/Einsatzlogik-Spuren im Projekt und in den Retool-Referenzen.

Wichtig:
- Es wird hier **keine neue AI-Logik definiert**
- es werden **keine Balancing-Annahmen als Wahrheit ausgegeben**
- die aktuelle lokale AI wird **nicht** als Golden Master behandelt

Kurzfazit:
- Es gibt eine **aktive lokale Approximation** fuer AI Needs, Transfer-Intents und AI-Turn-Zusammenfassung
- Es gibt **starke Retool-Spuren** fuer die originale Legacy-/AI-/Planner-Logik
- Die originale Retool-AI ist im Repo aber **nicht vollstaendig rekonstruierbar**

---

## 1. Gefundene Dateien, Module und Abschnitte

### Aktive lokale Approximationen

#### [lib/ai/aiNeedsEngine.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/aiNeedsEngine.ts)
- Zweck: berechnet im aktuellen Repo eine vereinfachte Team-Needs-Sicht
- Status: `aktiv`

#### [lib/ai/aiTransferMarket.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/aiTransferMarket.ts)
- Zweck: baut Transfer-Intents aus offenen Listings
- Status: `aktiv`

#### [lib/ai/aiTurnEngine.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/aiTurnEngine.ts)
- Zweck: verknuepft Needs und Transfer-Intents zu einem AI-Turn-Result
- Status: `aktiv`

#### [lib/market/transfer-market.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/market/transfer-market.ts)
- Zweck: Bewertungslogik fuer Transfer-Listings
- Status: `aktiv`

#### [lib/ai/ai-needs-engine.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/ai-needs-engine.ts)
- Zweck: neuer read-only Needs-Baustein auf Basis des Legacy-Lineup-Contexts
- Status: `aktiv, neu`
- Hinweis: ebenfalls **nicht** Golden Master

#### [lib/ai/ai-legacy-lineup-engine.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/ai-legacy-lineup-engine.ts)
- Zweck: neuer read-only Legacy-Lineup-Vorschlag
- Status: `aktiv, neu`
- Hinweis: ebenfalls **nicht** Golden Master

### Legacy- / Scoring- / Einsatzlogik im neuen Port

#### [lib/lineups/legacy-score-engine.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/lineups/legacy-score-engine.ts)
- Zweck: read-only Legacy-Basisscore aus `PlayerDisciplineScore.score`
- Status: `aktiv`

#### [lib/lineups/legacy-lineup-validator.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/lineups/legacy-lineup-validator.ts)
- Zweck: Legacy-Lineup-Validierungen
- Status: `aktiv`

#### [lib/lineups/legacy-lineup-context-loader.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/lineups/legacy-lineup-context-loader.ts)
- Zweck: laedt Prisma-/Supabase-Kontext fuer Legacy-Lineup, Team, Scores, Team Identity
- Status: `aktiv`

### Retool-Referenzen / Altspuren

#### [docs/README_RETOOL_SYSTEM.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/README_RETOOL_SYSTEM.md)
- Zweck: fachliche Referenz des Retool-Systems
- Status: `Retool-Referenz`

Wichtige Abschnitte:
- `3.1 Einsatzliste Legacy`
- `3.10 AI-Teamlogik (Transfermarkt)`
- `3.11 Season/Matchday Planung`
- `3.12 Formkarten / Formwürfel`
- `3.13 Captain`
- `5.1 Global (functions.rsx)`
- `7. Offizielle Disziplin-Gewichtungen`
- `8. Scoring`

#### [data/oly-draftboard-schema-map.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/data/oly-draftboard-schema-map.md)
- Zweck: Reverse-Engineering-Hinweise aus Retool-Draftboard-Strukturen
- Status: `Retool-Referenz`

Wichtige Cluster:
- `teamIdentity*`
- `rosterNeeds`
- `rosterPressureProfile`
- `seasonPlannerEngine`
- `seasonPlannerEngineV7`
- `disciplineRecipesGlobal`
- `disciplineNeeds`
- `disciplineHoleWeight`
- `disciplineNeedDiagnostics`
- `captain_boost_x10`
- `playerExhaustionMap`
- `fatigueMult`

#### [docs/AI_GOLDEN_MASTER_PORTING_SPEC.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/AI_GOLDEN_MASTER_PORTING_SPEC.md)
- Zweck: bereits erstellte Porting-Spec fuer die spaetere Golden-Master-Rekonstruktion
- Status: `Dokumentationsbaustein`

### Gewichtungs- und Resolver-Spuren

#### [docs/README_RETOOL_SYSTEM.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/README_RETOOL_SYSTEM.md), Abschnitt `5.1 Global (functions.rsx)`
- `disciplineWeightsOfficialPct`
- `disciplineFieldResolver`
- `disciplineWeightsOfficialNormalized`
- `disciplineWeightsOfficialSanityCheck`
- Status: `Retool-Referenz`

### Datenbasis fuer Team Identity

#### [data/source/team-identities.json](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/data/source/team-identities.json)
- Zweck: aktuelle Stammdaten fuer Identity-/Kaderzielwerte wie `playerOpt`
- Status: `aktive Seed-/Source-Datei`

---

## 2. Fachliche Logik

### 2.1 AI Needs

#### Aktive lokale Approximation
Quelle:
- [lib/ai/aiNeedsEngine.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/aiNeedsEngine.ts)

Inputs:
- Team
- Team Identity
- Roster
- Cash / Budget
- Upkeep
- Spieler-Core-Stats `pow/spe/men/soc`
- Disziplinkategorien
- Diszi-Ratings der Kaderspieler

Outputs:
- `rosterCount`
- `rosterGap`
- `budgetPressure`
- `upkeepPressure`
- `axisDeficits`
- `uncoveredNeedAxes`
- `topNeedDisciplineIds`
- `overallNeedScore`

Harte Regeln:
- wenn Team oder Identity fehlt: Fallback mit vollen Defiziten

Soft Biases:
- `rosterGap * 0.35`
- Top-Diszi-Need `* 0.25`
- `budgetPressure * 0.15`
- `upkeepPressure * 0.10`
- max. Achsendefizit `* 0.15`
- Kategoriebias:
  - `strength -> pow`
  - `speed -> spe`
  - `mental/tactics -> men`
  - `social -> soc`

Tiebreaker:
- implizit ueber Sortierung der berechneten `disciplineScores`

Team-Identity-Einfluss:
- Core-Stats des Kaders werden gegen `identity.pow/spe/men/soc` gemessen

Budget-/Roster-/Need-Faktoren:
- `rosterGap`
- `budgetPressure`
- `upkeepPressure`
- Achsendefizite

Bewertung:
- `aktiv`, aber **vereinfachte Approximation**

#### Retool-Spuren
Quellen:
- [docs/README_RETOOL_SYSTEM.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/README_RETOOL_SYSTEM.md)
- [data/oly-draftboard-schema-map.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/data/oly-draftboard-schema-map.md)

Begriffe:
- `disciplineNeeds`
- `disciplineHoleWeight`
- `disciplineNeedDiagnostics`
- `teamIdentityOverrides`
- `teamIdentityWeights`
- `rosterNeeds`
- `rosterPressureProfile`

Bewertung:
- `Retool-Referenz`, aber **Formeln fehlen**

### 2.2 AI Lineups / Einsatzliste

#### Aktive neue read-only Approximation
Quelle:
- [lib/ai/ai-legacy-lineup-engine.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/ai-legacy-lineup-engine.ts)

Inputs:
- Legacy-Lineup-Context
- Team Identity
- ActivePlayers
- PlayerDisciplineScores
- SeasonDisciplineConfig / playerCount

Outputs:
- Vorschlags-Entries fuer `d1` / `d2`
- Score Preview
- Warnings
- Debug-Reasoning

Harte Regeln:
- nur `ActivePlayers` des Teams
- keine Doppelnutzung ueber `d1` / `d2`
- `playerCount` muss erfuellt werden

Soft Biases:
- primaer Legacy-Disziwert
- Team Identity als Tiebreaker

Tiebreaker:
- hoher Disziwert zuerst
- bei Gleichstand leichter Identity-Bias

Bewertung:
- `aktiv`, aber **nicht als Alt-Golden-Master bestaetigt**

#### Retool-Spuren
Quellen:
- [docs/README_RETOOL_SYSTEM.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/README_RETOOL_SYSTEM.md)

Begriffe:
- `seasonPlannerEngine`
- `seasonPlannerPreviewRows`
- `aiPickSeasonPreview`
- Legacy Einsatzliste mit produktiven Writes

Bewertung:
- `Teilspur`
- keine vollstaendige originale Einsatz-AI-Logik vorhanden

### 2.3 AI Picks / Transfermarkt

#### Aktive lokale Approximation
Quellen:
- [lib/ai/aiTransferMarket.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/aiTransferMarket.ts)
- [lib/market/transfer-market.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/market/transfer-market.ts)

Inputs:
- offene Transfer-Listings
- Team Cash
- Team Rostergroesse
- `evaluateAiNeeds(...)`
- Spieler-Diszi-Ratings fuer `topNeedDisciplineIds`

Outputs:
- `AiTransferIntent[]`
- `fitScore`
- `needScore`
- `budgetRisk`
- `rosterPressure`
- `overallScore`
- `recommendedAction`

Harte Regeln:
- nur offene Listings
- fehlender Spieler => Listing faellt raus

Soft Biases:
- `fitScore * 0.45`
- `needScore * 0.4`
- `budgetRisk * -0.25`
- `rosterPressure * -0.15`

Tiebreaker:
- Sortierung nach `overallScore desc`
- Top 3 bleiben

Budget-/Roster-/Need-Faktoren:
- `askingPrice`
- `minimumSalary`
- Team Cash
- Rostergroesse vs `rosterLimit`

Bewertung:
- `aktiv`, aber **vereinfachte Approximation**

#### Retool-Spuren
Quellen:
- [docs/README_RETOOL_SYSTEM.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/README_RETOOL_SYSTEM.md)

Begriffe:
- `aiPackageScoringConfig`
- `cashCreatorPackageScoringConfig`
- AI2 Needs / Planner / Auto-buy Batch

Bewertung:
- `Teilspur`
- konkrete Package-Scoring-Formeln fehlen

### 2.4 Team Identity

Quellen:
- [data/source/team-identities.json](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/data/source/team-identities.json)
- [data/oly-draftboard-schema-map.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/data/oly-draftboard-schema-map.md)
- [docs/README_RETOOL_SYSTEM.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/README_RETOOL_SYSTEM.md)

Nachweisbare Begriffe:
- `teamIdentity`
- `teamIdentityOverrides`
- `teamIdentityWeights`
- `teamIdentityScore100`
- `teamPowIdentity`
- `teamSpeIdentity`
- `teamMenIdentity`
- `teamSocIdentity`
- `playerOpt`

Rolle im aktuellen Repo:
- Needs- und Tie-Break-Input

Rolle im Altbestand:
- offenbar staerkerer fachlicher Cluster fuer AI / Planner / Kaderentscheidungen

Bewertung:
- `teilweise rekonstruierbar`

### 2.5 Roster Evaluation

Quellen:
- [lib/ai/aiNeedsEngine.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/ai/aiNeedsEngine.ts)
- [data/oly-draftboard-schema-map.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/data/oly-draftboard-schema-map.md)

Nachweisbare Begriffe:
- `rosterNeeds`
- `rosterPressureProfile`
- `rosterGapShare01`
- `rosterFillPressure01`
- `rosterTarget`
- `rosterDepthValue`
- `rosterSize`
- `rosterSalaryKnown`
- `playerOpt`

Aktive lokale Faktoren:
- Rostergroesse
- `rosterGap`
- `rosterPressure`

Bewertung:
- `teilweise aktiv`, `teilweise nur Retool-Spur`

### 2.6 Disziplin-/Attributgewichtungen

Quellen:
- [docs/README_RETOOL_SYSTEM.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/README_RETOOL_SYSTEM.md)
- bestehende DB-/Seed-Schicht im Projekt

Nachweisbare Begriffe:
- `disciplineWeightsOfficialPct`
- `disciplineFieldResolver`
- `disciplineWeightsOfficialNormalized`
- `disciplineWeightsOfficialSanityCheck`
- `disciplineRecipesGlobal`

Inputs:
- Disziplinname / DisciplineKey
- Attributmatrix

Outputs:
- Prozentgewichte
- normalisierte Gewichte
- Sanity-Check gegen Recipes

Bewertung:
- Gewichts-SSOT fachlich klar
- AI-/Needs-Kopplung an `disciplineRecipesGlobal` aber nicht voll belegt

### 2.7 Formkarten / Captain / Taktik

Quellen:
- [docs/README_RETOOL_SYSTEM.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/README_RETOOL_SYSTEM.md)
- [data/oly-draftboard-schema-map.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/data/oly-draftboard-schema-map.md)

Nachweisbar:
- `formkarten_v2`
- `formCardUtility`
- `formFromCards`
- `captain_boost_x10`
- `playerExhaustionMap`
- `fatigueMult`
- Taktiken `needs_review`

Harte Regeln:
- Formkarten-Usage wird hart validiert
- Captain-Bonus ist produktiv

Bewertung:
- Captain / Form / Fatigue sind **balancing-kritisch**
- Taktik bleibt `unklar`

### 2.8 Scoring- / Ranking-Hilfslogik

Quellen:
- [docs/README_RETOOL_SYSTEM.md](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/docs/README_RETOOL_SYSTEM.md)
- [lib/lineups/legacy-score-engine.ts](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/lib/lineups/legacy-score-engine.ts)

Nachweisbar:
- `base_score_x_10`
- `form_points_x_10`
- `trait_points_x_10`
- `total_score_x_10`
- `captain_boost_x10`
- `updateCurrentScoreX10Query`

Aktuelle neue Port-Basis:
- Legacy Einzelwert = `PlayerDisciplineScore.score`

Bewertung:
- Basisscore rekonstruierbar
- additive Retool-Komponenten nur teilweise dokumentiert

---

## 3. Balancing-kritische Punkte

Diese Punkte duerfen spaeter beim Portieren nicht frei veraendert werden:

- `teamIdentityOverrides`
- `teamIdentityWeights`
- `disciplineRecipesGlobal`
- `disciplineHoleWeight`
- `disciplineNeedDiagnostics`
- `rosterNeeds`
- `rosterPressureProfile`
- `aiPackageScoringConfig`
- `cashCreatorPackageScoringConfig`
- `captain_boost_x10`
- `formkarten_v2`
- `playerExhaustionMap`
- `fatigueMult`
- harte Kaderziele wie `playerMin` / `playerOpt`
- Budget-/Cash-Grenzen und Rosterdruck
- nicht offensichtliche Tiebreaker

Besonders starke heute sichtbare Gewichte im lokalen Alt-/Approx-Pfad:
- Needs:
  - `rosterGap 0.35`
  - `top discipline need 0.25`
  - `budgetPressure 0.15`
  - `upkeepPressure 0.10`
  - `max axis deficit 0.15`
- Transferbewertung:
  - `fitScore 0.45`
  - `needScore 0.40`
  - `budgetRisk -0.25`
  - `rosterPressure -0.15`

Bekannte Sonderfaelle:
- fehlendes Team / fehlende Identity => harter Fallback in `aiNeedsEngine.ts`
- fehlender Spieler in Listing => `null` in `evaluateTransferListing(...)`
- Slots-v2 nutzt eigene Gewichts- und Fatigue-Pfade, die nicht mit Legacy gleichgesetzt werden duerfen

---

## 4. Open Questions

- Ist `aiNeedsEngine.ts` nur ein lokaler Zwischenstand oder basiert es teilweise auf echten Retool-Formeln?
- War `disciplineRecipesGlobal` die eigentliche Needs-SSOT oder nur eine Vergleichs-/Diagnostics-Ebene?
- Wie genau wurden `teamIdentityOverrides` und `teamIdentityWeights` im Altpfad verrechnet?
- Welche Rolle spielte `rosterPressureProfile` konkret im Planner und im Transfermarkt?
- Wie genau funktionierten `aiPackageScoringConfig` und `cashCreatorPackageScoringConfig`?
- Wurde `seasonPlannerEngineV7` produktiv statt `seasonPlannerEngine` genutzt?
- Welche Tiebreaker galten im Altpfad fuer:
  - Needs
  - Transferpakete
  - Season Planner
  - Captain
  - Formkarten
  - Legacy-Einsatz-Auswahl
- Wie genau wurden `playerExhaustionMap` und `fatigueMult` ausserhalb von Slot-v2 angewandt?
- Ob Taktiken produktiv waren oder nur konzeptionell / partiell im Altbestand auftauchten

Keine dieser Fragen sollte ohne originale Retool-JS-/SQL-/Transformer-Dateien als geklaert gelten.

---

## 5. Portierungsplan

Spaeter sinnvoll getrennte Module:

- `lib/ai/team-identity.ts`
  - TeamIdentity, Overrides, Weights, Identity-Score
- `lib/ai/discipline-needs-engine.ts`
  - `disciplineRecipesGlobal`, `disciplineNeeds`, `disciplineHoleWeight`, Diagnostics
- `lib/ai/roster-pressure-engine.ts`
  - `rosterNeeds`, `rosterPressureProfile`, `rosterGapShare01`, `rosterFillPressure01`
- `lib/ai/ai-legacy-lineup-engine.ts`
  - erst nach echter Rekonstruktion der Legacy-Priorisierung
- `lib/ai/ai-transfer-engine.ts`
  - Transferpakete, Package Scores, Cash-Creator-Logik
- `lib/ai/season-planner-engine.ts`
  - `seasonPlannerEngine`, `seasonPlannerEngineV7`, Preview/Planner
- `lib/ai/form-fatigue-engine.ts`
  - Formkarten, Fatigue, Captain-Zusatzlogik

Empfohlene Reihenfolge:
1. Originale Retool-JS-/SQL-/Transformer-Quellen beschaffen
2. Inputs / Outputs / Gewichte / Tiebreaker pro Altmodul dokumentieren
3. Team-Identity- und Roster-Pressure-Schicht rekonstruieren
4. Discipline-Needs-/Recipe-Schicht rekonstruieren
5. Season Planner / AI Picks rekonstruieren
6. Transfer-Package-Logik rekonstruieren
7. Erst danach produktive TypeScript-Portierung mit Golden-Master-Tests

---

## Inventur-Fazit

### Gefundene Quellen
- aktive lokale Approximationen:
  - `aiNeedsEngine.ts`
  - `aiTransferMarket.ts`
  - `aiTurnEngine.ts`
  - `transfer-market.ts`
- neue read-only MVP-Bausteine:
  - `ai-needs-engine.ts`
  - `ai-legacy-lineup-engine.ts`
- Retool-Referenzen:
  - `README_RETOOL_SYSTEM.md`
  - `oly-draftboard-schema-map.md`
  - `AI_GOLDEN_MASTER_PORTING_SPEC.md`

### Rekonstruierbarkeit
- Basisscore und Teile der aktuellen Approximation sind rekonstruierbar
- die originale Retool-AI-/Planner-/Package-Logik ist **nicht ausreichend vollstaendig rekonstruierbar**

### Offene Lage
- Balancing ist besonders unklar bei:
  - Team Identity Overrides / Weights
  - Discipline Needs / Hole Weight
  - Roster Pressure
  - Package Scoring
  - Cash-Creator-Logik
  - Captain / Formkarten / Fatigue

### Klarstellung
- In dieser Inventur wurde **keine neue AI-Logik implementiert**
- es wurden **keine Writes geaendert**
- es wurden **keine Balancing-Annahmen neu erfunden**
