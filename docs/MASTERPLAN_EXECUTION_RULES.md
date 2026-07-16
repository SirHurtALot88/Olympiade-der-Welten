# Masterplan Execution Rules

## Snapshot Pflicht

Nach jeder abgeschlossenen Phase:

1. `npm run project:export-snapshot`
2. Snapshot muss aktualisieren:
   - Completed Blocks
   - Blockers
   - Write Paths
   - Tests

## Phase 0A

Direkt nach Phase 0 folgt der Mutating Script Safety Audit.

Zu pruefen:

- Buy / Sell
- Result Apply
- Standings Apply, falls vorhanden
- Cash Apply, falls vorhanden
- Sync-Scripts
- Seed
- Migrationen

Ziel:

- read/audit default non-mutating
- echte Writes nur mit `--write` oder `dryRun=false`
- klare `allowedTables`
- klare `forbiddenTables`
- keine Secrets
- keine Remote-Writes ohne expliziten Befehl

## Standings Apply Gate

Standings Apply bleibt blockiert, bis mindestens diese Quellen wirklich vorhanden und erfolgreich auditiert sind:

- `season-standings.csv/json` oder korrekter Sheet-Export
- `rank-to-points.csv/json` oder korrekter Sheet-Export
- erfolgreiches Team-Mapping
- keine Apply-relevanten `blockedRules`

Auch dann gilt in diesem Projektstand weiter:

- Skeleton und Dry-run sind erlaubt
- echter Execute-Write bleibt blockiert
- keine stillen Writes
- wenn `TeamSeasonState` keine echten Standings-Zielfelder wie `rank` / `points` hat, bleibt Execute ebenfalls blockiert

## Aktive Standings-Sprache

In aktiven Standings-Codepfaden nicht benutzen:

- Fame
- Draws
- Allianz
- Pairings

Historische Retool-Spuren duerfen nur bleiben, wenn sie klar `offline_legacy_only` markiert sind.

## Build Gate nach jeder Phase

Pflichtlauf:

1. `npm run next:clean`
2. `npm run build`
3. `npm run build`
4. `npm test`
5. `npm run db:smoke-studio-models`, wenn Prisma/DB betroffen war

Wichtig:

- diese Schritte muessen **seriell** laufen
- kein zweiter Build starten, solange der erste noch nicht vollstaendig beendet ist
- ein Fehler wie `Another next build process is already running` ist ein Gate-Ablauffehler, kein Fachfehler
