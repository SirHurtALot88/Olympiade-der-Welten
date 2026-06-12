# Oly Draftboard Schema Map

Quelle: `/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (5).json`

## Einordnung

Die Datei ist **fachlich sehr wertvoll**, aber **kein sauberes Domänen-JSON**.

Wichtig:
- `page.data.appState` ist als großer serialisierter Retool-Zustand gespeichert.
- Der Inhalt ist stark mit UI-Zustand, Query-Konfigurationen, Script-Blöcken und Transformern vermischt.
- Die Datei eignet sich deshalb **nicht** als direkte Runtime-Datenquelle für `Oly Umbau App v2`.
- Sie eignet sich aber sehr gut als **Reverse-Engineering-Bauplan** für:
  - echte Domänenobjekte
  - spätere Seed-Daten
  - ein Migrationsskript aus Retool nach `v2`

## Was klar erkennbar ist

Die Draftboard-Datei enthält bereits viele zentrale Oly-Konzepte:

- `player*`
- `team*`
- `roster*`
- `season*`
- `transfer*`
- `discipline*`
- `form*`
- `fatigue*` / `exhaustion`
- `alliance*`
- `captain*`
- `teamIdentity*`
- `teamFinances`
- `seasonPlannerEngine`

Das bestätigt, dass die langfristige Richtung von `v2` fachlich richtig geschnitten ist:

- `Player`
- `Team`
- `RosterEntry`
- `Contract`
- `TransferListing`
- `Discipline`
- `TeamIdentity`
- `Season`
- `Matchday`
- `GameState`

## Beobachtete Fachcluster

### 1. Player / Athlete

In der Draftboard-Datei tauchen unter anderem auf:

- `playerContractInfo`
- `playerCountByTeam`
- `playerExhaustionMap`
- `playerHistory`
- `playerHistoryEnrichedTeams`
- `playerOwner`
- `playerPPs`
- `playerScore`
- `playerAdvancedMetrics`

Aus Script-Snippets sind außerdem konkrete spielnahe Felder sichtbar:

- `name`
- `klasse`
- `pow`
- `spe`
- `men`
- `soc`
- `marktwert`
- `salary`
- `purchase_price`
- `purchase_date`
- `purchase_season`

### Empfohlene `v2`-Zuordnung

Diese Begriffe sollten in `Player` bzw. angrenzende Modelle einfließen:

- Kern:
  - `id`
  - `name`
  - `class` oder `klasse`
  - `pow`
  - `spe`
  - `men`
  - `soc`
  - `marketValue`
  - `form`
  - `fatigue` oder `exhaustion`
- Abgeleitet oder separat:
  - `history`
  - `ownership`
  - `advancedMetrics`

## 2. Team / Club / Manager-Kontext

Erkennbar sind viele Team-bezogene Begriffe:

- `teamAmbition`
- `teamCash`
- `teamCashAfter`
- `teamFinance`
- `teamFinances`
- `teamFit`
- `teamFocusScore`
- `teamIdentity`
- `teamIdentityOverrides`
- `teamIdentityScore100`
- `teamCaptainCount`
- `teamDisciplineRankings`
- `teamFormkartenStatus`

Aus Snippets zusätzlich sichtbar:

- `teamName`
- `team_code`
- `boardConfidence`
- `teamPowIdentity`
- `teamSpeIdentity`
- `teamMenIdentity`
- `teamSocIdentity`

### Empfohlene `v2`-Zuordnung

`Team` sollte mittelfristig nicht nur Basisdaten tragen, sondern auch wirtschaftliche und strategische Parameter:

- Basis:
  - `id`
  - `name`
  - `shortName`
  - `allianceId`
  - `humanControlled`
- Wirtschaft:
  - `cash`
  - `budget`
  - `weeklyWageBudget`
  - `boardConfidence`
- Ausrichtung:
  - `identityId`
  - `ambition`
  - `preferredAxes` oder `identityAxes`

## 3. TeamIdentity / Manager-Archetypen

Besonders wichtig für die KI:

- `teamIdentity`
- `teamIdentityOverrides`
- `teamIdentityWeights`
- `teamIdentityScore100`
- `teamPowIdentity`
- `teamSpeIdentity`
- `teamMenIdentity`
- `teamSocIdentity`

### Schlussfolgerung

Die vorhandene `TeamIdentity`-Idee in `v0.2` ist richtig, aber kann später realistischer werden:

- statt nur `archetype`
- zusätzlich echte Achsen:
  - `powerIdentity`
  - `speedIdentity`
  - `mentalIdentity`
  - `socialIdentity`
  - `ambition`
  - `budgetDiscipline`
  - `boardRiskTolerance`

## 4. Roster / Squad-Building

Erkennbar:

- `draft_roster`
- `rosterNeeds`
- `rosterPressureProfile`
- `rosterGapShare01`
- `rosterFillPressure01`
- `rosterTarget`
- `rosterDepthValue`
- `rosterSize`
- `rosterSalaryKnown`

### Schlussfolgerung

Das ist sehr wichtig für `v2`:

- Roster ist nicht nur “wer ist im Team”
- sondern auch:
  - Kadergröße
  - Kaderdruck
  - Positions-/Disziplinlücken
  - wirtschaftliche Tragfähigkeit

### Empfohlene `v2`-Erweiterung

Neben `RosterEntry` sollten später eigene berechnete Modelle existieren:

- `RosterSummary`
- `RosterNeedProfile`
- `RosterPressureProfile`

## 5. Contract / Transfermarkt / Ökonomie

Aus Snippets klar erkennbar:

- `calculateContractSalary`
- `transfermarktSalaryBudgetLogic`
- `salary`
- `contract_length`
- `contract_end_season`
- `purchase_price`
- `purchase_date`
- `purchase_season`
- `transferCashTotalToCash`
- `transferCalculatedCashToDb`
- `transferHistoryWithImages`

### Schlussfolgerung

Die neue `Contract`- und `TransferListing`-Schicht ist absolut richtig und sollte ausgebaut werden in:

- `Contract`
  - `salary`
  - `contractLength`
  - `contractEndSeason`
  - `purchasePrice`
  - `purchaseSeason`
  - `status`
- `TransferListing`
  - `askingPrice`
  - `sellerTeamId`
  - `minimumSalary`
  - `status`
- zusätzliche spätere Modelle:
  - `TransferBid`
  - `TransferDecision`
  - `TransferBudgetPolicy`

## 6. Season / Matchday / Einsatz / Planung

Erkennbar:

- `seasonPlannerEngine`
- `seasonPlannerEngineV7`
- `seasonSummary`
- `seasonProgress`
- `seasonStartRanks`
- `spieltag`
- `disziplin_nr`
- `seasonModeEinsatzliste`

### Schlussfolgerung

Die Datei bestätigt stark, dass Saison und Spieltag Kern des Spiels sind.

### Empfohlene `v2`-Domäne

- `Season`
- `SeasonState`
- `Matchday`
- `MatchdayState`
- später zusätzlich:
  - `LineupPlan`
  - `DisciplineAssignment`
  - `SeasonPlanResult`

## 7. Discipline / Einsatz / Spezialistenlogik

Erkennbar:

- `disciplineRecipesGlobal`
- `disciplineNeeds`
- `disciplineRankings`
- `disciplineType`
- `disciplineAffinity`
- `disciplineHoleWeight`
- `disciplineNeedDiagnostics`

Außerdem in Spieltag-/Captain-Snippets:

- `disziplin_nr`
- disziplinspezifische Base-Score-Berechnungen

### Schlussfolgerung

Disziplinen sind nicht nur Namen, sondern eigenständige Bewertungslogik.

### Empfohlene spätere Erweiterung

- `Discipline`
  - `id`
  - `name`
  - `category`
  - `weight`
- später:
  - `recipe`
  - `relevantStats`
  - `captainScaling`
  - `fatigueImpact`

## 8. Form / Fatigue / Captain

Sehr relevante Signale:

- `formCards`
- `formCardUtility`
- `formFromCards`
- `formByTeam`
- `captain_boost_x10`
- `playerExhaustionMap`
- `exhaustionChange`
- `fatigueMode`
- `fatigueMult`

### Schlussfolgerung

Das bestätigt deine Produktvision:

- Form
- Fatigue / Exhaustion
- Captain
- Event-/Card-Effekte

sind echte Kernsysteme und sollten in `v2` früh sauber vorbereitet werden.

### Empfohlene spätere Modelle

- `PlayerConditionState`
- `FormCard`
- `CaptainAssignment`
- `FatigueRuleSet`

## 9. Alliance / Meta-Struktur

Erkennbar:

- Allianz-Spieler
- `alliancePlayersRows`
- `alliance*`

### Schlussfolgerung

`Alliance` ist kein Fantasieobjekt, sondern gehört wirklich zur bisherigen Spielstruktur und sollte bleiben.

## Was wir aus der Datei **nicht direkt** übernehmen sollten

Diese Teile sind eher Retool-/UI-spezifisch:

- Query-Definitionen
- `trigger()`-Flows
- lokale UI-Filterzustände
- Drawer-/Table-/Image-Container
- Notifications
- Script-Verkettungen für Seiteninteraktionen

Diese Dinge gehören **nicht** in die `v2`-Core-Logik.

## Konkrete Mapping-Empfehlung für `v2`

### Bereits gut angelegt

- `Player`
- `Team`
- `Alliance`
- `Discipline`
- `Season`
- `Matchday`
- `RosterEntry`
- `Contract`
- `TransferListing`
- `TeamIdentity`
- `GameState`

### Als nächstes sinnvoll ergänzen

- `PlayerStats`
- `PlayerConditionState`
- `TeamFinanceState`
- `RosterNeedProfile`
- `TransferBudgetPolicy`
- `LineupPlan`
- `DisciplineAssignment`
- `CaptainAssignment`
- `FormCard`
- `FatigueRuleSet`

## Fazit

Die Draftboard-JSON hilft **sehr**, aber vor allem als:

- Fachlandkarte
- Feldsammlung
- Reverse-Engineering-Quelle
- Vorlage für spätere Normalisierung

Sie hilft **weniger** als:

- direkte Importdatei
- fertige API-Struktur
- sauberes Persistenzmodell

## Empfohlener nächster Schritt

Auf Basis dieser Datei sollten wir als Nächstes nicht “alles importieren”, sondern gezielt:

1. `v0.2`-Typen an das echte Oly-Vokabular anpassen
2. Seed-Daten um echte Attribute wie `pow/spe/men/soc`, `cash`, `ambition`, `boardConfidence` erweitern
3. `TeamIdentity` von abstrakt zu achsenbasiert umbauen
4. `Form/Fatigue/Captain` als vorbereitete Kernsysteme ergänzen
5. später ein `normalizeDraftboard.ts`-Skript bauen, das Retool-Daten in saubere `v2`-Seeds überführt
