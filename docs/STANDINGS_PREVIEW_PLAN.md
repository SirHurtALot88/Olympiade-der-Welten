# Standings Preview Plan

## Ziel
Read-only Saisonstand-Preview fuer die aktuelle Online-App-Version.

## Fachliche Basis
- kein Fame
- keine Draws
- keine Allianzen
- keine Paarungen
- globales Gesamtscoring aller Teams

## Inputs
- `MatchdayResult`
- `DisciplineResult`
- `TeamSeasonState`
- `Season`
- `Matchday`
- Sheet-/Retool-Exports fuer Saisonstand und Punktetabelle
- Team-Mapping ueber `Team.shortCode` und `Team.name`

## Preview output pro Team
- `teamId`
- `teamName`
- `d1Score`
- `d2Score`
- `totalScore`
- `matchdayRank`
- `currentRank`, falls aus Sheet vorhanden
- `projectedRank`, falls aus Sheet/Mappings vorhanden
- `currentPoints`, falls aus Sheet vorhanden
- `projectedPoints`, aus `currentPoints + pointsDelta`
- `pointsDelta`, aus echter Rang-zu-Punkte-Tabelle
- `cash`, falls vorhanden
- `readinessStatus`
- `warnings`

## offline_legacy_only
- Fame
- Draws
- wins/losses aus Paarungslogik
- alliance
- matchupIndex
- points_for / points_against

## Blocker
- `points_table_missing`, nur wenn die lokale Punktetabelle wirklich fehlt oder unlesbar ist
- `rank_to_points_mapping_missing`, nur wenn die lokale Punktetabelle nicht korrekt gemappt werden kann
- `season_standings_sheet_mapping_missing`, nur wenn der Saisonstand nicht korrekt gemappt werden kann
- `standings_before_after_snapshots_missing`
- `global_score_tie_breaker_missing`, nur bei echtem Gleichstand ohne bestaetigte Regel
- betroffene Teams werden bei Gleichstand explizit als Tie-Group ausgegeben

## Regel
- Teams werden global nach `totalScore desc` sortiert.
- `matchdayRank` kommt direkt aus diesem globalen `totalScore`-Ranking.
- `currentRank` und `currentPoints` kommen aus dem lokalen Saisonstand-Export.
- `pointsDelta` kommt aus der lokalen Punktetabelle passend zur Zahl der aktiven Disziplinseiten.
- `projectedPoints = currentPoints + pointsDelta`.
- `projectedRank` kommt aus `projectedPoints desc`.
- Bei gleichem `projectedPoints` wird sportlich ueber `matchdayScore/totalScore desc` weiter sortiert.
- Nur wenn `projectedPoints` und `matchdayScore/totalScore` gleich sind, bleibt die Preview blockiert.
- Es gibt in diesem Block keinen TeamCode-Tiebreaker und kein `shared_rank`.
