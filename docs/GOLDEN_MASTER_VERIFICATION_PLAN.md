# Golden Master Verification Plan

## Ziel
Neue Standings-, Punkte- und Cash-Logik darf nur gegen echte Retool- oder Sheet-Snapshots verifiziert werden.

## Current app version
- globales Gesamtscoring
- keine Fame-/Draw-/Allianzlogik

## Pflicht-Fixtures
- `matchday-1-global-score.example.json`
- `matchday-1-standings-before.example.json`
- `matchday-1-standings-after.example.json`
- `rank-to-points-table.example.json`

## Blocker
- keine before/after Saisonstand-Snapshots
- kein bestaetigter Tie-Breaker bei Gleichstand
- Preisgeld-Tabelle fehlt weiter fuer den Economy-Block

## Regel
- Keine neue Apply-Logik, solange einer dieser Blocker offen ist.

## Zusatz-Gate fuer Standings Apply
- zusaetzlich muessen `season-standings` und `rank-to-points` als echte Quelle erfolgreich auditiert sein
- Team-Mapping muss erfolgreich sein
- keine Apply-relevanten `blockedRules`
