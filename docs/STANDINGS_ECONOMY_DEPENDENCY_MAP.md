# Standings Economy Dependency Map

## Primärquellen
- `MatchdayResult`
- `DisciplineResult`
- Sheet-Export fuer Saisonstand
- Sheet- oder Retool-Export fuer Rang-zu-Punkte-Tabelle

## Current app version
- globales Ranking ueber alle Teams
- keine Fame-Logik
- keine Draw-Logik
- keine Allianz- oder Paarungslogik

## Standings
- `totalScore` ist die globale Matchday-Basis.
- Punkte duerfen erst berechnet werden, wenn die Rang-zu-Punkte-Tabelle bestaetigt ist.
- Vorher-/Nachher-Saisonstand braucht echte Snapshots.

## Cash and prize
- Transfermarkt-Cash ist getrennt von Season-End-Preisgeld zu behandeln.
- Preisgeld bleibt blockiert, bis Preisgeldtabelle und Auszahlungszeitpunkt belastbar sind.

## offline_legacy_only
- `alliance_matchups`
- `alliance_team_scores`
- Fame-in-points-Spur
- Pairing-Tabellen
