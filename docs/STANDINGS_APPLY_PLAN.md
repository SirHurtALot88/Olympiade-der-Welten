# Standings Apply Plan

## Status

Standings Apply ist jetzt technisch als Skeleton vorbereitet, bleibt aber mit harten Gates blockiert.

## Inputs

- Standings Preview Result
- Season
- TeamSeasonState
- rank-to-points mapping
- season-standings mapping
- Scope Keys:
  - `saveId`
  - `seasonId`
  - `matchdayId`

## Erlaubte spaetere Writes

Wenn die Gates spaeter wirklich gruen sind, duerfen nur klar definierte Saisonstand-Felder beschrieben werden:

- Zieltabelle:
  - `TeamSeasonState`
- erlaubte Felder:
  - ein spaeter explizit freigegebenes Standings-Subset wie `rank`, `points`, optional weitere Standings-Zielfelder nur nach bestaetigter Fachfreigabe
- Scope:
  - nur Datensaetze fuer genau ein `saveId + seasonId + matchdayId`
- Audit:
  - `ResultAuditLog` ist **nicht** ausreichend, weil es den Matchday-Result-Apply beschreibt
  - spaeter eigenes `StandingsApplyLog` oder gleichwertiger Auditpfad empfohlen

## Aktueller Schema-Blocker

- `TeamSeasonState` enthaelt aktuell **keine** echten Standings-Zielfelder wie `rank` oder `points`
- deshalb setzt der Execute-Pfad aktuell bewusst:
  - `team_season_state_standings_fields_missing`
- ohne diese Felder wird **nicht** auf andere bestehende Felder ausgewichen
- `ResultAuditLog` wird ebenfalls **nicht** als Ersatz fuer ein echtes `StandingsApplyLog` missbraucht

## Verbotene Writes

- keine Transfer-Writes
- keine ActivePlayer-Writes
- keine Cash-/Preisgeld-Writes
- keine SQLite-Writes
- keine AI-Writes
- keine Writes an Matchday-Result-Tabellen

## Idempotenz

- Apply darf spaeter nur einmal pro `saveId + seasonId + matchdayId` laufen
- Re-Apply nur mit `forceReplace`
- Skeleton nutzt dafuer schon einen stabilen `idempotencyKey`
- `forceReplace` darf spaeter nur explizit vorhandene Standings-Apply-Datensaetze derselben Scope ersetzen, nie fremde Saves oder Seasons beruehren

## Harte Gates

Standings Apply darf nicht freigeschaltet werden, solange mindestens einer dieser Punkte fehlt:

- `season-standings.csv/json` oder korrekter Sheet-Export
- `rank-to-points.csv/json` oder korrekter Sheet-Export
- erfolgreiches Team-Mapping
- keine Apply-relevanten `blockedRules`
- keine Fame-/Draw-/Allianz-/Pairing-Logik in aktiven Pfaden
- plausible Preview-Daten ohne Luecken

## Aktuelle Blocking Reasons

Das Skeleton prueft aktuell insbesondere:

- `missingMappings`
- `blockedRules`
- `ambiguousTeams`
- `tieBreakerMissing`
- `missingPreviewData`

## PlannedChanges pro Team

- `currentRank`
- `projectedRank`
- `currentPoints`
- `projectedPoints`
- `pointsDelta`
- `totalScore`
- `matchdayRank`

## Service-Skeleton

- `previewStandingsApply(params)`
  - read-only
  - nutzt denselben Preview-Pfad wie UI und Preview-API als Wahrheitsquelle
  - prueft Gates nur noch auf Basis der aktuellen Preview-Ergebnisse
  - erzeugt `plannedChanges`
  - schreibt nichts

- `executeStandingsApply(params)`
  - prueft dieselben Gates
  - fuehrt aktuell **nie** einen echten Write aus
  - blockiert weiterhin kontrolliert, auch wenn spaeter die Gates einmal gruen sein sollten

## API-Skeleton

- `POST /api/standings/apply`
- `dryRun: true` ist Default
- `dryRun: false` bleibt aktuell blockiert, solange die Gates nicht vollstaendig frei sind

## Aktueller Echtstand

- veraltete Blocker wie `points_table_missing`, `rank_to_points_mapping_missing` und `season_standings_sheet_mapping_missing` duerfen im Apply-Pfad nicht mehr auftauchen, sobald die angebundene Preview diese Quellen erfolgreich liest
- aktuell bleibt Standings Apply nur noch an echten Restblockern haengen, vor allem:
  - `global_score_tie_breaker_missing`, wenn im konkreten Preview ein Gleichstand vorliegt
  - `standings_before_after_snapshots_missing`, falls Golden-Master-Snapshots noch fehlen
- bei Gleichstand muessen die betroffenen Teams explizit im Apply-Preview auftauchen
- `plannedChanges` bleiben auch dann sichtbar; nur `canApply` bleibt `false`

## Smoke-Script

- `standings:smoke-apply`
- default: dry-run
- `--write` ist erlaubt, bleibt aktuell aber sicher blockiert

## Wichtig

- kein stiller Write
- keine Heuristik
- kein Standings Apply im aktuellen Projektstand

## offline_legacy_only

Historische Begriffe wie Fame, Draws, Allianz oder Pairings duerfen nicht Teil des aktiven Apply-Plans sein.
