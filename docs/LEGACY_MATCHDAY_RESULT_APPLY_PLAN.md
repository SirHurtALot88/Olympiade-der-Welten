# Legacy Matchday Result Apply Plan

## 1. Ziel

### Was bedeutet Result Apply?
Result Apply ist der bewusst kontrollierte Schritt, bei dem eine bereits berechnete Legacy Matchday Resolve Preview als persistierter Matchday-Result-Snapshot gespeichert wird.

### Unterschied zwischen Resolve Preview und persistiertem Result
- Resolve Preview:
  - read-only
  - jederzeit neu berechenbar
  - dient Diagnose, Kontrolle und fachlicher Prüfung
  - schreibt nichts in die Datenbank
- Persistiertes Result:
  - ist ein gespeicherter Snapshot für genau einen Matchday-Scope
  - ist Grundlage für spätere Folgeprozesse
  - muss auditierbar und ersetzbar sein

### Warum Preview zuerst, Apply danach?
- Erst die Preview zeigt, ob Matchday-Daten fachlich sauber aussehen.
- Erst nach menschlicher oder kontrollierter Systemprüfung sollte persistiert werden.
- Damit werden fehlerhafte oder veraltete Zustände nicht blind übernommen.

### Warum Result Apply noch keine Tabellen-/Fame-/Cash-Fortschreibung ist
Result Apply speichert in Phase 1 nur den Resolve-Snapshot selbst.
Es ist noch kein Season-Progress-Schritt.
Es verändert bewusst nicht:
- Tabellenstand
- Fame
- Cash
- Preisgeld
- TeamSeasonState

## 2. Was Phase 1 speichern darf

### Erlaubte Result-/Audit-Daten
Phase 1 darf nur dedizierte Result- und Audit-Daten schreiben:
- `MatchdayResult`
- `DisciplineResult`
- `PlayerDisciplinePerformance`
- `DisciplineHighlight`
- `ResultAuditLog`

### Explizit nicht erlaubt
- `TeamSeasonState` verändern
- Tabellenstand fortschreiben
- Cash verändern
- Preisgeld verändern
- Fame verändern
- Spieler-Fatigue anwenden oder fortschreiben
- Formkarten anwenden
- Captain anwenden
- Taktiken anwenden

## 3. Benötigte Inputs

Ein späterer Apply-Pfad braucht mindestens:
- `saveId`
- `seasonId`
- `matchdayId`
- `resolvePreviewVersion`
- `teamResults`
- `playerPerformances`
- `highlightCandidates`
- `warnings`
- `readinessStatus`

Zusätzlich sinnvoll:
- `previewFingerprint`
- `appliedAt`
- `appliedBy` optional
- `forceReplace` optional

## 4. Idempotenz-Regeln

- Ein Apply für denselben `saveId + seasonId + matchdayId` Scope muss ersetzbar sein.
- Es darf keinen unkontrollierten doppelten Result-Datensatz für denselben Scope geben.
- Re-Apply darf nur kontrolliert passieren.
- Result-Audit muss nachvollziehbar bleiben.
- Underfilled-Teams werden als `underfilled` gespeichert, nicht aufgefüllt oder erfunden.

Empfohlene Konsequenz:
- Result-Tabellen als replace-safe Snapshot pro Matchday-Scope
- Audit-Log append-only

## 5. Datenmodell-Vorschlag

### MatchdayResult
Zweck:
- Kopfdatensatz für einen angewendeten Matchday-Resolve-Snapshot

Wichtige Felder:
- `id`
- `saveId`
- `seasonId`
- `matchdayId`
- `status`
- `sourceVersion`
- `teamsTotal`
- `teamsReady`
- `teamsUnderfilled`
- `teamsMissingLineup`
- `teamsInvalidLineup`
- `teamsMissingScoreCoverage`
- `warningsCount`
- `createdAt`
- `updatedAt`

Unique Constraints:
- `saveId + seasonId + matchdayId`

Relationen:
- zu `Save`
- zu `Season`
- zu `Matchday`
- zu `DisciplineResult`
- zu `PlayerDisciplinePerformance`
- zu `DisciplineHighlight`
- zu `ResultAuditLog`

Kommt aus Resolve Preview:
- Summary
- Matchday-Scope
- Warnings-Count

### DisciplineResult
Zweck:
- Ergebnis pro Team und Disziplinseite

Wichtige Felder:
- `id`
- `matchdayResultId`
- `teamId`
- `disciplineId`
- `disciplineSide`
- `rank`
- `baseScore`
- `totalScore`
- `readinessStatus`
- `warnings`
- `createdAt`

Unique Constraints:
- `matchdayResultId + teamId + disciplineId + disciplineSide`

Relationen:
- zu `MatchdayResult`
- zu `Team`
- zu `Discipline`

Kommt aus Resolve Preview:
- TeamResult je D1/D2
- Rank
- Warnings
- Readiness pro Team

### PlayerDisciplinePerformance
Zweck:
- Performance-Snapshot je eingesetztem Spieler in einer Disziplin

Wichtige Felder:
- `id`
- `matchdayResultId`
- `teamId`
- `playerId`
- `activePlayerId` optional
- `disciplineId`
- `disciplineSide`
- `slotIndex`
- `baseValue`
- `finalPlayerScore`
- `scoreContribution`
- `rankInTeam`
- `rankInDiscipline`
- `isTop10`
- `isMvpCandidate`
- `storyWeight` optional
- `createdAt`

Unique Constraints:
- `matchdayResultId + teamId + disciplineId + disciplineSide + slotIndex`

Relationen:
- zu `MatchdayResult`
- zu `Team`
- zu `Player`
- optional zu `ActivePlayer`
- zu `Discipline`

Kommt aus Resolve Preview:
- `topPlayers`
- Player-Performance-Daten

### DisciplineHighlight
Zweck:
- strukturierte Highlight-Kandidaten aus Resolve

Wichtige Felder:
- `id`
- `matchdayResultId`
- `disciplineId` optional
- `highlightType`
- `teamId` optional
- `playerId` optional
- `relatedTeamId` optional
- `importanceScore`
- `shortSummary` optional
- `payload`
- `createdAt`

Unique Constraints:
- keine harte globale Business-Unique nötig
- Ersetzung sollte über Matchday-Scope passieren

Relationen:
- zu `MatchdayResult`
- optional zu `Discipline`
- optional zu `Team`
- optional zu `Player`

Kommt aus Resolve Preview:
- `highlightCandidates`

### ResultAuditLog
Zweck:
- nachvollziehbare Historie für Apply und Re-Apply

Wichtige Felder:
- `id`
- `saveId`
- `seasonId`
- `matchdayId`
- `matchdayResultId` optional
- `action`
- `payload`
- `createdAt`

Unique Constraints:
- bewusst keine enge Business-Unique
- Audit soll append-only bleiben

Relationen:
- zu `Save`
- zu `Season`
- optional zu `MatchdayResult`

Kommt aus Resolve Preview:
- Scope
- Warnings
- Readiness-Lage
- Quelle / Version / Fingerprint

## 6. Apply-Strategie

Empfohlener Ablauf:
1. `GET Resolve Preview`
2. User oder Admin prüft Preview
3. `POST Apply Result`
4. Service validiert Preview erneut
5. Service prüft Scope und Aktualität
6. Service löscht oder ersetzt nur Result-Daten für diesen Matchday-Scope
7. Service schreibt neuen Result-Snapshot
8. Service schreibt Audit-Log
9. Kein Standings-Update in Phase 1

Wichtig:
- kein blindes Vertrauen in Client-Payloads
- keine indirekte Fortschreibung anderer Systeme
- nur Result-Scope, nichts darüber hinaus

## 7. Validierungen

- alle Teams müssen verarbeitet sein
- underfilled Teams bleiben underfilled
- missing oder invalid Teams werden als solche gespeichert, nicht erfunden
- Score-Warnings werden übernommen
- Result darf nicht aus veralteter Preview blind geschrieben werden
- keine Cross-Source-Mischung zwischen SQLite und Prisma
- Matchday-Scope muss eindeutig sein
- Re-Apply nur kontrolliert

Zusätzliche Schutzfragen:
- Ist die Preview-Version noch aktuell?
- Wurde der Matchday-Scope seit der Preview fachlich verändert?
- Stimmen TeamCounts und Disziplinen noch?

## 8. Roadmap

### Phase 1
- Result-Tabellen
- Apply Service
- kein Standings-Update

### Phase 2
- Result Lab UI mit Apply Button

### Phase 3
- Standings Preview

### Phase 4
- Standings Apply

### Phase 5
- Fame / Cash / Preisgeld / Season Progress

## Kleinster sicherer Implementierungsschritt

Der kleinste sichere nächste Schritt wäre:
- dedizierte Result-Tabellen plus reiner Apply-Service
- serverseitig Preview erneut laden
- nur Result- und Audit-Daten schreiben
- keinerlei Standings- oder Economy-Folgeeffekte

## Offene Fragen vor produktivem Apply

- Welche Preview-Version oder welcher Fingerprint gilt als verbindlich?
- Soll Re-Apply per Flag, Rollenkonzept oder separatem Admin-Pfad geschützt werden?
- Welche Warning-Level blockieren Apply, und welche werden nur mitprotokolliert?
- Soll `missing_lineup` in Phase 1 erlaubt gespeichert werden oder erst nach expliziter Bestätigung?
- Wie genau wird später die Brücke von `MatchdayResult` zu `Standings Preview` modelliert?
