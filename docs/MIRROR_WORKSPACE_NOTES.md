# Mirror Workspace Notes

## Was passiert ist

Der Arbeitsordner `Olympiade der Welten` war zwischenzeitlich unvollständig gespiegelt.
Dadurch fehlten echte Projektteile wie:
- `lib/game-state`
- `lib/game`
- `types`
- `lib/room`
- `lib/data`
- `components`
- `app/room`

Die Folge waren rote `npm test`- und `npm run build`-Läufe mit `@/...`-Importfehlern.

Wichtig:
- Der Alias war nicht kaputt.
- Das Problem war kein Fachfehler im Code.
- Das Problem war ein unvollständiger Mirror-/Arbeitsordner.

## Kritische Ordner

Die folgenden Ordner sind fuer einen voll funktionsfaehigen Mirror kritisch:
- `app`
- `components`
- `lib`
- `lib/ai`
- `lib/data`
- `lib/db`
- `lib/game`
- `lib/game-state`
- `lib/lineups`
- `lib/market`
- `lib/persistence`
- `lib/resolve`
- `lib/room`
- `lib/season`
- `lib/socket`
- `prisma`
- `scripts`
- `tests`
- `types`

## Diagnose-Regel

Wenn `npm test` oder `npm run build` wegen fehlender `@/...`-Module scheitert:

1. zuerst pruefen, ob der Mirror vollstaendig ist
2. nicht sofort Stub-Module bauen
3. nicht Tests verstecken oder ausschalten
4. nicht Alias-Mappings blind aendern

Erst wenn der Mirror vollstaendig ist und der Fehler bleibt, ist es wahrscheinlich ein echter Code- oder Konfigurationsfehler.

## Standard-Checks nach Sync

Nach einem Mirror-/Sync-Schritt sollten mindestens diese Checks laufen:
- `npx prisma validate`
- `npm run db:generate`
- `npm test`
- `npm run build`
- `npm run resolve:check-legacy-matchday`
- `npm run lineup:check-readiness`

## Mirror-Konsistenz-Check

Verfuegbar ist dafuer:
- `npm run project:check-mirror`

Das Script ist:
- read-only
- ohne Secrets
- ohne Datenbank-Writes
- ohne Migrationen

Typische Ursache fuer FAIL:
- unvollstaendiger Spiegelordner
- fehlende Kernordner
- fehlende Root-Dateien
- fehlende wichtige `package.json`-Scripts
