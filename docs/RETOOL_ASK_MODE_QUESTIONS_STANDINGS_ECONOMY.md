# Retool Ask Mode Questions: Standings and Economy

## Standings table structure
> Gib mir die Spaltenstruktur der aktuellen Saisonstand-/Punktetabelle als JSON. JSON-Felder: `status`, `tableName`, `columns`, `teamColumn`, `rankColumn`, `pointsColumn`, `cashColumn`, `seasonColumn`, `matchdayColumn`, `notes`.

## Team column
> Welche Spalte ist in der aktuellen Saisonstandtabelle das Team? Antworte als JSON mit `status`, `columnName`, `exampleValue`.

## Rank column
> Welche Spalte ist Platz oder Rang? Antworte als JSON mit `status`, `columnName`, `exampleValue`.

## Points column
> Welche Spalte enthaelt die Saisonstand-Punkte? Antworte als JSON mit `status`, `columnName`, `exampleValue`.

## Cash column
> Welche Spalte enthaelt Cash? Antworte als JSON mit `status`, `columnName`, `exampleValue`.

## Rank-to-points table
> Gibt es eine Rang-zu-Punkte-Tabelle fuer die aktuelle Online-App-Version? Wenn ja, gib sie als JSON mit `status`, `rows`, wobei jede Zeile `rank` und `pointsAwarded` enthaelt.

## Global rank to points rule
> Wie wird aus globalem Matchday-Rang die Punktzahl berechnet? Antworte als JSON mit `status`, `sourceQueryName`, `sourceKind`, `formula`, `inputs`, `outputs`.

## Tie-breaker
> Gibt es bei gleichem `totalScore` einen Tie-Breaker? Wenn ja, gib ihn als JSON mit `status`, `tieBreakerSteps`, `sourceQueryName`, `notes`.

## Matchday 1 global score list
> Gib mir fuer Matchday 1 die globale `totalScore`-Liste aller Teams als JSON. JSON-Felder: `status`, `matchdayId`, `teams[]` mit `teamId`, `teamName`, `d1Score`, `d2Score`, `totalScore`, `matchdayRank`.

## Matchday 1 standings before
> Gib mir fuer Matchday 1 den Saisonstand vorher als JSON. JSON-Felder: `status`, `matchdayId`, `teams[]` mit `teamId`, `teamName`, `rank`, `points`, `cash`.

## Matchday 1 standings after
> Gib mir fuer Matchday 1 den Saisonstand nachher als JSON. JSON-Felder: `status`, `matchdayId`, `teams[]` mit `teamId`, `teamName`, `rank`, `points`, `cash`.

## Cash changes
> Wann wird Cash in der aktuellen Online-App-Version verändert? Antworte als JSON mit `status`, `transferChangesCash`, `prizeMoneyChangesCash`, `manualChangesCash`, `seasonEndChangesCash`, `sourceQueries`.

## Prize table
> Gibt es eine Preisgeldtabelle pro Platzierung? Wenn ja, gib sie als JSON mit `status`, `rows`, `seasonScope`, `payoutTiming`.

