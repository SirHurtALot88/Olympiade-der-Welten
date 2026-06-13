# Olympiade der Welten – Retool System Documentation

Technische Dokumentation basierend auf einem Retool-Export des Projekts „Olympiade der Welten“.
Retool ist hierbei **nur Referenz/Prototyp**, um:
- Domänenlogik (Fachlogik) zu verstehen
- Datenflüsse (Reads/Writes) zu identifizieren
- ein sauberes Zielsystem (eigene Web-App + eigene DB) abzuleiten

Wichtige Einschränkung:
- Diese Dokumentation kann **keine DB-Foreign-Key Actions** (`ON DELETE` / `ON UPDATE`) garantieren, weil im Export **keine vollständige DB-Schema-Dump-Ausgabe** enthalten ist.
  -> Siehe Abschnitt **12 (Risiken / offene Fragen)** + **Extraction Playbook**.

---

## 1. Projektziel

„Olympiade der Welten“ ist ein Fantasy-/Sport-/Management-System mit:

- **Teams** (Roster, Finanzen, Performance)
- **Allianzen** (Gruppierungen mehrerer Teams; eigener Draft-/Season-Kontext)
- **Spieler** (Stats, Attribute, Traits, Bilder)
- **Disziplinen** (jeweils mit Gewichtungen auf Attribute)
- **Seasons** (Saisonstand, Transfers, Historie, Snapshots)
- **Matchdays/Spieltage** (z. B. 1–10), pro Spieltag werden Disziplinen gespielt
- **Lineups/Einsatzlisten**: Teams wählen Spieler je Disziplin/Slot
- **Scoring**: Base + Form + Trait + Captain Bonus + ggf. Fatigue
- **Transfermarkt**: Kaufen/Verkaufen (inkl. saisonbezogener Locks)
- **AI-Teamlogik**: Needs/Planner/Auto-Buy/Package-Scoring für Transfermarkt und Season-/Matchday-Planung

Ziel des Neubaus:
- nicht Retool nachbauen
- sondern **saubere Architektur, DB-Modell, IDs und APIs** definieren
- UI/Optik kann sich am Retool-Layout orientieren

---

## 2. Aktueller Retool-Stand

### 2.1 Seitenübersicht (Screens)

Im `main.rsx` sind folgende Screens inkludiert:

- Saisonstand (`src/Saisonstand.rsx`)
- Teams (`src/Teams.rsx`)
- Einsatzliste (`src/Einsatzliste.rsx`)
- Transfermarkt (`src/transfermarktPage.rsx`)
- Transferhistorie (`src/Transferhistorie.rsx`)
- Preisgeld (`src/Preisgeld.rsx`) *(im Export vorhanden, Inhalt hier nicht im Detail analysiert)*
- Spieler (`src/Spieler.rsx`)
- Ranks (`src/Ranks.rsx`)
- Diszis (`src/Diszis.rsx`) *(im Export vorhanden, Inhalt hier nicht im Detail analysiert)*
- Battle (`src/Battle.rsx`)
- Draft Mode (`src/draftModePage.rsx`)
- Draft Ranks (`src/draftRanksPage.rsx`) *(im Export vorhanden, nicht im Detail analysiert)*
- Allianz Spieltage (`src/allianzSpieltagePage.rsx`)
- Einsatzliste Slots v2 (`src/einsatzlisteSlotsV2Page.rsx`)

Globale Drawer/Frames:
- `src/drawerFramePlayerDetails.rsx`
- `src/drawerFramePlayerDetails_GLOBAL.rsx`
- `src/scoreEditDrawer.rsx`

Navigation:
- `header.rsx` (mainNavigation)

---

### 2.2 Produktiv vs MVP/Preview-only

**Produktive Systeme mit Writes (nachweisbar durch INSERT/UPDATE/DELETE Queries):**
- Einsatzliste (Legacy) — schreibt `lineup`, `formkarten_v2` und Score-Felder (x10) und stößt Saisonstand-Syncs an
- Transfermarkt — schreibt `active_players`, `player_transfers`, `Saisonstand` und besitzt einen “Atomic Buy” Pfad (`buy_player_atomic(...)`)
- Teams — schreibt bei Verkauf/Vertragsverlängerung u. a. `active_players`, `player_transfers`, `Saisonstand`
- Saisonstand — enthält viele Admin-/History-/Season-End Tools (Deletes/Inserts/Schema-Fixes)

**Read-only bzw. “Preview-only” Systeme:**
- Einsatzliste Slots v2 (`einsatzlisteSlotsV2Page`) ist explizit **Preview-only / keine Writes**:
  - baut Slot UI State (`v2_slots_d1`, `v2_slots_d2`)
  - erzeugt Save-ready Payload Preview (`lineupPayloadPreview_v2`)
  - Score Preview mit Hook für späteres Slot-Scoring (`slotScorePreview_v2`)
- Teile der Draft-/Allianz-Seiten sind produktiv (Upserts in Matchups/Scores), aber “Draft” ist fachlich ein separater Modus/Subsystem (eigene Season-ID).
  - Matchups & TeamScores sind **writefähig** (nachweisbar: `upsertAllianceMatchupForSeason.sql`, `upsertAllianceTeamScore.sql`, `deleteAllianceTeamScoreLine.sql`).

**MVP/Preview Hinweis:**
- Slots v2 ist isoliert, um Stabilität zu gewährleisten (keine Writes, guarded init, last-write-wins, cross-diszi exclusivity).

---

## 3. Hauptmodule (Domänenlogik / Module)

> Hinweis: „Module“ sind hier fachliche Gruppen. Retool verteilt Logik auf Screens, globale functions.rsx und `lib/`.

### 3.1 Einsatzliste Legacy (Einsatzliste)
**Zweck:** Spieltag-basierte Lineups für Disziplin 1 & 2 inkl. Formkarten, Mutators, Captain, Score-Berechnung und Persistenz.

Wichtige Bausteine:
- Reads:
  - `getDiszireihenfolgeEinsatz.sql`
  - `getTeamPlayersEinsatz.sql`
  - `getFormkartenPoolEinsatz.sql`
  - `getAllTeamLineupsEinsatz.sql`
- Writes:
  - `insertLineupD1v2` / `insertLineupD2v2` (UPDATE_OR_INSERT_BY auf `lineup`)
  - `updateLineupScoresD1` / `updateLineupScoresD2` (UPDATE_BY auf `lineup`)
  - Formkarten used/unuse flows (reset + mark used from lineups)
- Orchestrator:
  - `lib/saveLineupComplete.js` (komplettes Save + Score Update + Validierung)

**Score-Schema:** basiert auf `*_x_10` Feldern:
- `base_score_x_10`
- `form_points_x_10`
- `trait_points_x_10`
- `total_score_x_10`
- plus `captain_boost_x10`, `mutator_trait_*`, `updated_at`

Warum x10:
- Dezimalstabilität / Summen ohne Float-Drift in UI/DB

---

### 3.2 Einsatzliste Slots v2 (einsatzlisteSlotsV2Page)
**Zweck:** Slot-basiertes Lineup UI als stabiler Preview-Workflow mit offiziellen Disziplin-Gewichtungen (SSOT für Attribute weights).

- Keine Writes
- Fokus: bessere Auswahlunterstützung (Slot-spezifische Dropdowns), Fatigue-Adjustments, Requirement-Text, Payload-Preview

Siehe Abschnitt 6 für Details.

---

### 3.3 Spielerpool (Slots v2)
Baustein: `lib/playerPoolRowsTableOfficial_v4.js`

- Input:
  - `getTeamPlayersEinsatz_v2.data`
  - `currentSpieltagDisziplinen_v2.value`
  - `disciplineWeightsOfficialPct.value`
- Output:
  - pro Spieler: `d1Base/d1Effective`, `d2Base/d2Effective`
  - pro Attribute: `powerBase/powerEffective/powerRating` etc. (12 Attribute)
  - `fatiguePct` wird berücksichtigt (`applyFatigue(...)`)
  - “Top 4 Attributes” je Discipline aus offiziellen Gewichten (`topAttrsForDisziPct`)
- Identifiers:
  - `active_player_id` kommt aus SQL
  - `player_id` ist **NULL** (Kommentar: Player table hat kein id)

---

### 3.4 Slot-Gewichtungen (Slots v2)
Bausteine:
- `slotWeights_v2` (Function, nicht im Detail gelesen; liefert Slot-Definitionen & Weights)
- `slotWeightsEnhanced_v2` (Function)
  - ergänzt Slots um `requirementWeightedText` (z. B. `POW 28% · HEA 20% · ...`)
  - übernimmt `debugFocusLabel`

---

### 3.5 Slot Player Options (Slots v2)
Baustein: `lib/slotPlayerOptionsBySlot_v2.js`

- Ziel: Slot-spezifische Dropdown Options pro `slotIndex`
- Features:
  - Label: `"Name | POW B · HEA S · ..."` (abhängig von Slot keyAttributes)
  - Sorting: `debugSortScore` = gewichtete Summe über slot weights × attribute effective
  - Cross-Diszi-Exklusivität:
    - D1 Dropdown schließt Spieler aus, die in D2 bereits gewählt sind (und umgekehrt)
    - Ausnahme: aktuell ausgewählter Spieler im Slot bleibt auswählbar

---

### 3.6 Lineup Payload Preview (Slots v2)
Baustein: `lib/lineupPayloadPreview_v2.js`

- Baut eine “save-ready” Struktur aus UI state:
  - `team`, `matchday`, `disciplineSide`, `disciplineName`, `disciplineKey`
  - `slotIndex0` (0-based) und `slotIndex` (1-based)
  - `playerName`, `playerId` (falls vorhanden), `activePlayerId`
  - `slotRequirementText`, `slotRoleLabel`
- Diagnostics:
  - `missingPlayers` (name lookup im Pool fehlgeschlagen)
  - `unmatchedSlotWeights` (SlotIndex im UI nicht im weights-Array gefunden)
  - `playerIdAvailableCount` / `playerIdMissingCount`
- Wichtig:
  - aktuell **kein Persist**, aber Payload ist bereits strukturiert, um Save später sauber zu implementieren

---

### 3.7 Scoring Preview (Slots v2)
Baustein: `lib/slotScorePreview_v2.js`

- Aktuell: v2 == legacy (Summe raw discipline scores)
- Enthält “Hook” `calcSlotScore(...)` für späteres slot weighting logic

---

### 3.8 Transfermarkt (Käufe, Wishlist, Cash/Salary, Atomic Buy)
Wichtigste “sichere” Businesslogik:
- `lib/buyPlayerFromWishlistCompleteSafe.js` orchestriert:
  - pre-refresh (best-effort)
  - schreibt atomisch über `buyPlayerAtomic` (DB Funktion)
  - post-refresh + Wishlist cleanup
- `lib/buyPlayerAtomic.sql` ruft `public.buy_player_atomic(...)` auf (DB Funktion)

Wichtig:
- Prepared statements scheinen deaktiviert -> SQL escapen von Strings im Query.

---

### 3.9 Spielerverkäufe / Sales (Teams)
Baustein: `lib/sellPlayerComplete.js`

- Ziel: Verkauf mit konsistentem Buyout (brutto/netto) und korrekter Season-Verwendung
- Besonderheit:
  - DB-Season ist “authoritative”
  - UI Season (localStorage) kann vorauslaufen
  - Flow hebt DB Season ggf. an (updateCurrentSeasonInDBGlobal)
- Writes:
  - delete active player
  - insert sale transfer
  - update saisonstand cash/salary (netto)

---

### 3.10 AI-Teamlogik (Transfermarkt)
Transfermarkt enthält ein großes AI-Subsystem:
- AI2 Needs / Planner / Auto-buy Batch
- Viele helper/transformer (im Export sichtbar, nicht vollständig inhaltlich auditiert)

Die AI nutzt u. a.:
- Team Identity Overrides (global state `teamIdentityOverrides`)
- Scoring configs (z. B. `aiPackageScoringConfig`, `cashCreatorPackageScoringConfig`)
- Player attribute tables + discipline weights (teilweise)

---

### 3.11 Season/Matchday Planung
In Einsatzliste Legacy existiert ein “Season Planner Preview”:
- `seasonPlannerEngine`, `seasonPlannerPreviewRows`, `aiPickSeasonPreview` etc.
- Ziel: Vorschläge für ST1–10 (dry-run), ohne DB writes (laut UI Text)

---

### 3.12 Formkarten / Formwürfel (Form Cards)
In Einsatzliste Legacy:
- `formkarten_v2` (Tabelle in DB, wird gelöscht/resettet)
- Hard-resync:
  - “reset all to unused” + “mark used if referenced in lineup”
- Hard Validation in `saveLineupComplete`:
  - Jede Formkarte soll genau einmal verwendet sein (`usage_count === 1`), Query `validateFormkarteUsageCount` existiert im Projekt (nicht im Export gelesen, aber im Code referenziert)

---

### 3.13 Captain
Legacy:
- Captain Bonus ist `0.5 × best current player score` (x10 skaliert)
- Captain wirkt als Add-on zum total_score_x_10

Slots v2:
- Noch nicht persistiert, aber könnte in Payload ergänzt werden (z. B. `captain_player_id` oder `captain_slot_index`)

---

### 3.14 Taktiken (Tactics)
Im Export wird “Taktiken” als Konzept erwähnt (User Request), aber:
- Konkrete DB-Tabellen/Queries/Transformer für Taktiken sind im hier gelesenen Material **nicht eindeutig**.
- -> `needs_review`: existiert ggf. in un-gelesenen lib-files oder in DB/Sheets.

---

## 4. Datenmodell (fachliche Übersicht)

> Dies ist eine fachliche Entitäten-Landkarte. DB-Tabellen-Namen sind teils bekannt (durch Queries), teils unknown.

### 4.1 Kern-Entitäten (empfohlenes Zielmodell)
- Seasons
- Matchdays (Spieltage)
- Alliances (Draft-/Allianz-Season separat von Olympiade-Season möglich)
- Teams
- Players (stabile Player-ID)
- ActivePlayers / Rosters (Team-zu-Player über Season/Contract)
- Attributes (pro Player, ggf. pro Season-Version)
- Disciplines (Definitionen)
- DisciplineWeights (SSOT, Versionierung)
- Lineups (pro Team, Season, Matchday, Discipline)
- LineupSlots (Slots v2: pro Team/Season/Matchday/Discipline/SlotIndex)
- FormCards / FormDice (Inventar + usage constraints)
- Captain (Flag oder Relation pro lineup/discipline)
- Results (Matchday results, scoring logs)
- Standings (Saisonstand, Rankings)
- Transfers (buys, sells, fees, salary, contract)
- DraftPicks (Draft Mode)
- AllianceMatchups / AllianceTeamScores (Allianz Spieltage)

### 4.2 Konkrete DB-Tabellen, die im Export referenziert werden (nachweisbar)
Aus SQL/RSX sichtbar:
- `active_players`
- `"Player"` (Achtung: quoted/case-sensitive)
- `"Attribute"`
- `lineup`
- `formkarten_v2`
- `player_season_scores`
- `player_transfers`
- `"Saisonstand"`
- `alliance_matchups`
- `alliance_team_scores`
- `team_season_history` (Teams Page)
- diverse history tables: `saisonstand_history`, `player_stats_history`, etc. (aus Saisonstand/Teams ersichtlich, aber nicht vollständig enumeriert)

---

## 5. Zentrale Retool Queries und Transformer (Auszug, relevant)

### 5.1 Global (functions.rsx)
**disciplineWeightsOfficialPct** (Function)
- Typ: Transformer/Function (JS)
- Zweck: Offizielle Disziplin→Attribute Gewichtungen (Prozent)
- Output: `Record<discipline_field, Record<attr, pct>>`
- Read-only: ja
- Produktiv: ja (wird in Slots v2 / Official pool benutzt)

**disciplineFieldResolver** (Function)
- Zweck: Disziplin-Displayname → DB-field key (normalize + overrides)
- Wichtig für: Mapping “Eiskunstlauf/eiskunst”, “Takeshi’s Castle/takeshi”, “Speed Schach/schach”
- Read-only: ja

**disciplineWeightsOfficialNormalized** (Function)
- Zweck: Normierung (Sum weights = 1)
- Read-only: ja

**disciplineWeightsOfficialSanityCheck** (Function)
- Zweck: Check gegen `disciplineRecipesGlobal` (AI recipes)
- Output: Liste von Issues (missing/mismatch)
- Read-only: ja

Allianz Queries (global):
- `getAllianceMatchups` (SQL read)
- `getAllianceTeamScores` (SQL read)
- `insertAllianceMatchup` (SQL write)
- `updateAllianceMatchupDisciplines` (SQL write)
- `upsertAllianceTeamScore` (SQL write)
- `deleteAllianceTeamScoreLine` (SQL write)
- plus Season state: `allianceDraftSeasonGlobal` etc.

---

### 5.2 Einsatzliste Slots v2 (einsatzlisteSlotsV2Page)
**getTeams_v2** (SQL read)
- Zweck: Team dropdown aus `active_players`
- Output: distinct team codes

**getDiszireihenfolgeEinsatz_v2** (SQL read)
- Zweck: Disziplin-Reihenfolge & player counts (aus `"Diszireihenfolge"`)
- Output: disziplin, reihenfolge, player, mutator_1, mutator_2

**getTeamPlayersEinsatz_v2** (SQL read)
- Zweck: Spieler + Stats + Attributes für Slot-v2
- Output: enthält `active_player_id`, `player_id (NULL)`, attrs, discipline scores, traits, bracket, percentiles, etc.
- Read-only: ja

**initSlotsV2OnLoad** (JS query, runWhenPageLoads)
- Zweck: Stabiler Init (Teams laden, Diszi-Reihenfolge sicherstellen, Spieltag aus localStorage lesen, reset slots)
- Read-only: ja (keine localStorage writes laut Kommentar)
- Produktiv: ja (für Slots v2 Seite)

**playerPoolRowsTableOfficial_v4** (Function)
- Zweck: derived player rows mit fatigue + attribute ratings + top attrs from official weights
- Read-only: ja

**slotWeightsEnhanced_v2** (Function)
- Zweck: Slot requirement text (weight-preview)
- Read-only: ja

**slotPlayerOptionsBySlot_v2** (Function)
- Zweck: slot dropdown options + exclusivity + sorting
- Read-only: ja

**applySlotSelection_v2** (JS query)
- Zweck: last-write-wins; cross-diszi exclusivity enforced by clearing selections
- Read-only: ja (UI state only)

**lineupPayloadPreview_v2** (Function)
- Zweck: Save-ready payload preview + diagnostics
- Read-only: ja

**slotScorePreview_v2** (Function)
- Zweck: Legacy-vs-v2 score preview (hooked)
- Read-only: ja

---

### 5.3 Einsatzliste Legacy (Einsatzliste)
**saveLineupComplete** (JS query)
- Zweck: Orchestriert saves für D1+D2 inkl.
  - formkarten exclusivity handling
  - preserves existing form/trait points
  - computes base and captain bonus
  - updates lineup scores
  - recomputes current_score_x10
  - syncs formkarten is_used
  - triggers ranking refresh
  - HARD VALIDATION (usage_count === 1)
- Schreibend: ja (mehrere DB writes)
- Produktiv: ja

---

### 5.4 Transfermarkt
**buyPlayerFromWishlistCompleteSafe** (JS query)
- Zweck: Kauf via atomic DB function, UI refresh, wishlist cleanup
- Schreibend: ja (indirekt über DB function)
- Produktiv: ja

**buyPlayerAtomic** (SQL)
- Zweck: `public.buy_player_atomic(...)`
- Schreibend: ja (DB function)
- Produktiv: ja

---

### 5.5 Teams
**sellPlayerComplete** (JS query)
- Zweck: Verkauf + season consistency fix
- Schreibend: ja
- Produktiv: ja

**extendPlayerContractFlow** (JS query)
- Zweck: Vertragsverlängerung (update active_players) + refresh
- Schreibend: ja
- Produktiv: ja

---

### 5.6 Allianz Spieltage / Draft
**upsertAllianceMatchupForSeason.sql**
- Zweck: Upsert matchups by (season, matchday, matchup_index)
- Schreibend: ja
- Besonderheit: `ON CONFLICT (...) DO UPDATE` (überschreibt Teams/Namen, lässt disciplines unverändert)

**upsertAllianceTeamScore.sql**
- Zweck: Insert per-team score lines
- Schreibend: ja
- Hinweis: Fame wird in `points` gespeichert (NUMERIC, .5 relevant)

**generateAllianceMatchups.js**
- Zweck: Generiert Schedule (10 matchdays, round-robin-like)
- Schreibend: ja (Upserts)
- Preflight checks: erwartet 8 Allianzen, 4 Teams je Allianz, Teamnamen aus Saisonstand
- Außerdem: DDL “ensure schema” (season column + unique constraint) per dynamic SQL

**seedAllianceTeamScores.js**
- Zweck: Seeds score rows pro matchup, repariert Namen, upserts lines

---

## 6. Einsatzliste Slots v2 (detailliert)

### 6.1 Ziel der Seite
- Slot-basierter Lineup Builder (D1/D2) als Grundlage für neues Scoring
- bessere UI-Führung: slot-spezifische Anforderungen, dropdown sorted by slot-fit
- Official discipline weights als Single Source of Truth

### 6.2 Warum isoliert gebaut?
- Stabilität: kein Eingriff in Legacy Writes
- Risiko-Reduktion: keine DB Writes, nur Preview
- Guarded Init (`v2_isInitializing`) verhindert Trigger-Loops / Race Conditions

### 6.3 Inputs
- Team (`teamSelect_v2`)
- Spieltag (`spieltagSelect_v2`)
- Disziplin-Reihenfolge aus `"Diszireihenfolge"` via `getDiszireihenfolgeEinsatz_v2`
- Spieler + Attributes via `getTeamPlayersEinsatz_v2`

### 6.4 States
- `v2_slots_d1`: Array Slot objects `{ slotIndex, playerName, meta }`
- `v2_slots_d2`: dito
- `v2_lastSelectionMeta`: `{ discipline, slotIndex, playerName }`
- `v2_isInitializing`: boolean

### 6.5 Slot-System
- UI generiert Slots anhand Spieleranzahl pro Disziplin (aus diszi config)
- Slot weights kommen aus `slotWeights_v2` / enhanced variant

### 6.6 Cross-Diszi-Exklusivität
- enforced in 2 layers:
  1) `applySlotSelection_v2`: wenn Spieler gewählt -> in ALLEN anderen Slots beider Disziplinen cleared
  2) `slotPlayerOptionsBySlot_v2`: Filtert Options, damit Spieler aus Gegendisziplin nicht auswählbar sind (außer current selection)

### 6.7 Last-write-wins
- `v2_lastSelectionMeta` beschreibt “letzte Interaktion”
- `applySlotSelection_v2` setzt deterministisch den finalen Zustand

### 6.8 Slot-Gewichtung
- Offizielle discipline weights sind in `disciplineWeightsOfficialPct`
- Slot weights sind in `slotWeights_v2` (Slot-specific weights/roles/requirements)
- `slotWeightsEnhanced_v2` baut requirement string + debug focus label

### 6.9 Spielerpool mit official weights
- `playerPoolRowsTableOfficial_v4`:
  - wendet fatigue auf discipline scores und attributes an
  - berechnet Ratings (S+/S/A/…)
  - bestimmt Top-Attribute pro Discipline aus official weights

### 6.10 Slot-spezifische Dropdowns
- `slotPlayerOptionsBySlot_v2`:
  - labelt Optionen abhängig von slot keyAttributes
  - sortiert nach weighted attribute effective

### 6.11 LineupPayloadPreview
- `lineupPayloadPreview_v2` baut Save-ready rows + meta diagnostics
- enthält disciplineKey via `disciplineFieldResolver`

### 6.12 Status
- Preview-only: **keine Writes**
- Save ist vorbereitet, aber nicht implementiert

---

## 7. Offizielle Disziplin-Gewichtungen (SSOT)

### 7.1 disciplineWeightsOfficialPct
- Datei: `lib/disciplineWeightsOfficialPct.js`
- Output: mapping discipline_field -> attribute weights in Prozent (Summe typischerweise 100)

Beispiel:
- `tdm: { power: 28, health: 20, ... }`
- `schach: { awareness: 21, intelligence: 28, ... }`
- `eiskunst: { charisma: 28, dexterity: 18, ... }`

### 7.2 Disziplinnamen -> Keys (Resolver)
- Datei: `lib/disciplineFieldResolver.js`
- Normalisierung:
  - lower + whitespace to `_` + `-` to `_`
- Overrides:
  - `speed_schach` -> `schach`
  - `takeshis_castle` -> `takeshi`
  - `eiskunstlauf` -> `eiskunst`

### 7.3 Systeme, die diese Matrix nutzen
Nachweisbar:
- Slots v2 Spielerpool (`playerPoolRowsTableOfficial_v4`)
- Normalisierung + SanityCheck gegen AI recipes

### 7.4 Warum SSOT
- reduziert doppelte Logik (AI recipes vs UI calculations)
- verhindert Drift zwischen “official scoring” und “AI evaluation”
- erleichtert Versionierung (z. B. weights v1/v2 per season)

Empfehlung Neubau:
- `discipline_weights` table mit:
  - `version`, `discipline_key`, `attribute_key`, `weight_pct`
  - plus `effective_from_season`, optional `effective_from_matchday`

---

## 8. Scoring

### 8.1 Legacy Score (Einsatzliste)
- Komponenten:
  - Base Score (sum discipline values)
  - Form Points
  - Trait Points
  - Captain Bonus (0.5 × best current score)
  - Mutators (traits) existieren, werden separat berechnet/persistiert
- Persist:
  - `lineup.*_x_10` Felder
- Recompute:
  - `updateCurrentScoreX10Query` nach Save

### 8.2 Slot-v2 Scoring (geplant)
- `slotScorePreview_v2` enthält Hook `calcSlotScore`
- Aktuell: v2 = legacy
- Ziel: Slot weights + official weights stärker integrieren

### 8.3 Fatigue
- Slots v2: Fatigue ist integriert (applyFatigue in playerPoolRowsTableOfficial_v4)
- Legacy: exhaustion/fatigue existieren über `playerExhaustionMap` und multipliers

### 8.4 Formkarten/Formwürfel
- Legacy: `formkarten_v2` + usage sync; hard validation (exactly one use)
- Slots v2: noch nicht integriert/persistiert

### 8.5 Captain
- Legacy: implemented via best-player current score × 0.5
- Slots v2: fehlt

### 8.6 Taktiken
- needs_review (nicht eindeutig im gelesenen Export)

---

## 9. Save/Load Status

### 9.1 Was wird aktuell gespeichert?
- Legacy Einsatzliste:
  - lineups (per team/spieltag/disziplin) inklusive score fields
  - formkarten used flags
- Transfermarkt:
  - active_players
  - player_transfers
  - saisonstand cash/salary updates
- Teams:
  - Sales + Contract extension
- Allianz/Draft:
  - alliance_matchups, alliance_team_scores (season-scoped)
  - draft roster picks (in Draft Mode)

### 9.2 Was speichert Slots v2 noch nicht?
- keine Writes
- Slots existieren nur in UI state (`v2_slots_d1`, `v2_slots_d2`)

### 9.3 Welche Payload ist vorbereitet?
- `lineupPayloadPreview_v2.rows[]` enthält:
  - team, matchday, disciplineKey, slotIndex, playerName, activePlayerId, etc.

### 9.4 Empfehlung: Zieltabellen/Struktur für Neubau
Empfohlen (normalized, ID-based):
- `lineup_submissions` (header)
  - `id`, `season_id`, `matchday`, `team_id`, `submitted_by_user_id`, `submitted_at`, `status`
- `lineup_slots` (details)
  - `submission_id`, `discipline_id`, `slot_index`, `player_id`, `is_captain`, `form_card_id`, `tactic_id`
- `lineup_scores` (materialized results)
  - `submission_id`, `discipline_id`, `base_score`, `form_score`, `trait_score`, `captain_bonus`, `total_score`
- plus `form_card_usage` (unique constraints per season/matchday)

---

## 10. Zielarchitektur neue App (Skizze)

### 10.1 Frontend
- Next.js / React
- UI: Design orientiert an Retool (Tabellen, Drawer, Filter), aber echte App-Komponenten
- State management: React Query / TanStack Query + server actions

### 10.2 Backend
- Eigene API:
  - Next.js Route Handlers oder separates Backend (NestJS/Fastify)
- Domain Services:
  - LineupService (validation + scoring)
  - TransferService (atomic transactions)
  - SeasonService (season end, snapshots)
  - DraftService + AllianceService
  - AIService (batch jobs, reproducible seeds)

### 10.3 Datenbank
- Postgres
- Migrations: Prisma / Drizzle / Flyway
- Constraints:
  - FK constraints mit expliziten `ON DELETE/ON UPDATE` rules
  - Unique constraints (Form cards usage, lineup uniqueness per team+season+matchday+discipline)

### 10.4 Auth / User System
- NextAuth / Clerk / custom
- Rollen:
  - Player/Manager
  - Admin/GM
  - Debug/QA

### 10.5 Multiplayer / Async
- Turn-based lineup submission window
- optimistic locking / submission versioning
- audit trail / event log

### 10.6 Admin/GM
- Season transitions
- Data repair tools (ex-Retool “debug/maintenance” ersetzen)
- Replay / rollback snapshots

---

## 11. Migrationsplan (Phasen)

1) Daten exportieren (Sheets + Retool DB)
2) Neues DB-Schema bauen (IDs, Constraints, actions)
3) Import: Players/Teams/Disciplines/Attributes/Weights
4) Lineup Builder MVP (Slots v2 als Grundlage)
5) Slot-v2 Scoring aktivieren (server-side canonical)
6) Save/Load + Validation (form cards, captain)
7) Async Multiplayer + Audit Log
8) Transfermarkt (atomic buy/sell)
9) AI-Teamlogik (job-based + reproducible)
10) Season/Standings + History Snapshots

---

## 12. Risiken / offene Fragen (kritisch)

### 12.1 Fehlende IDs / Name Matching
Nachweis:
- `getTeamPlayersEinsatz_v2.sql` setzt `player_id` explizit auf NULL (“Player table has no id column”).
Risiko:
- Name-based joins sind fehleranfällig (Apostroph, Version suffixes, duplicates).
Empfehlung:
- Neubau: stabile `player_id` als Primary Key + separate `player_aliases`.

### 12.2 Retool-spezifische Altlasten
- Prepared statements disabled in einigen SQL resources -> String-escaping im Query
- localStorage als “state bus” (selectedPlayer, globalCurrentSeason, selectedSpieltag)

### 12.3 Unklare DB Constraints / FK Actions (ON UPDATE/ON DELETE)
Im Export fehlen:
- `pg_constraint` dump / `information_schema` results
Daher:
- `ON DELETE/ON UPDATE` actions: **unknown**
Action:
- Aus DB per SQL exportieren (siehe Extraction Playbook)

### 12.4 Systeme mit Writes / doppelte Logik
- Legacy Einsatzliste schreibt Score-Felder & lineup csv
- Slots v2 rechnet parallel (preview)
- Transfermarkt hat zwei Pfade (klassische Inserts + atomic function)
-> Im Neubau klar trennen: “write path” canonical, preview optional.

### 12.5 Draft/Allianz hat eigene Season
- allianceDraftSeasonGlobal != olympiade current season
Empfehlung:
- separate season tables oder `competition_context` dimension

---

## Extraction Playbook (für sauberen Neubau)

### A) DB Schema inkl. FK Actions
Führe in der Retool DB aus:

1) Tabellen
```sql
select table_schema, table_name, table_type
from information_schema.tables
where table_schema not in ('pg_catalog', 'information_schema')
order by table_schema, table_type, table_name;
```

2) Spalten
```sql
select
table_schema, table_name, column_name, data_type, is_nullable,
column_default, character_maximum_length, numeric_precision, numeric_scale
from information_schema.columns
where table_schema not in ('pg_catalog', 'information_schema')
order by table_schema, table_name, ordinal_position;
```

3) Foreign Keys inkl. ON UPDATE/ON DELETE
```sql
select
tc.constraint_name,
tc.table_schema,
tc.table_name,
kcu.column_name,
ccu.table_schema as foreign_table_schema,
ccu.table_name as foreign_table_name,
ccu.column_name as foreign_column_name,
rc.update_rule as on_update,
rc.delete_rule as on_delete
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
on tc.constraint_name = kcu.constraint_name
and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
on ccu.constraint_name = tc.constraint_name
and ccu.table_schema = tc.table_schema
join information_schema.referential_constraints rc
on rc.constraint_name = tc.constraint_name
and rc.constraint_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
order by tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;
```

Damit kann SYSTEM_MAP.json später um echte FK actions ergänzt werden.
