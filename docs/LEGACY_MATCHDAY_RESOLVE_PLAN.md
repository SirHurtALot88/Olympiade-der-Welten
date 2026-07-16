# Legacy Matchday Resolve Plan

## 1. Ziel

### Was bedeutet Legacy Matchday Resolve?
Legacy Matchday Resolve ist der naechste Spielsystem-Block nach Legacy-Lineup Save/Load. Ziel ist, gespeicherte Legacy-Lineups fuer einen Matchday fachlich auszuwerten und daraus pro Team verwertbare Matchday-Ergebnisse abzuleiten.

Phase 1 meint dabei bewusst:
- nur Legacy-Lineups
- nur Legacy-Basisscore
- keine Slot-v2-Slotgewichte
- keine Formkarten
- kein Captain
- keine Taktiken
- keine Tabellenfortschreibung
- noch keine produktiven Result-Writes

### Warum zuerst Legacy ohne Slot-v2 / Formkarten / Captain?
- Legacy-Lineups sind bereits das erste produktive Supabase-Spielsystem mit Save/Load.
- Die aktuelle Legacy-Score-Basis ist klarer rekonstruierbar als spaetere Zusatzsysteme.
- Slot-v2 ist weiterhin Preview-/Debug-only und darf den ersten kanonischen Resolve-Pfad nicht dominieren.
- Formkarten, Captain und Taktiken sind balancerelevant und sollten erst spaeter additiv folgen, wenn der nackte Resolve-Pfad stabil ist.

Kurz: zuerst einen kleinen, verifizierbaren Resolve-Kern bauen, dann Erweiterungen addieren.

---

## 2. Benoetigte Inputs

### Primäre Schlüssel
- `saveId`
- `seasonId`
- `matchdayId`

### Team-Kontext
Phase 1 sollte beide Modi vorbereiten:
- einzelnes Team fuer Preview-/Debug-Zwecke
- alle Teams eines Matchdays fuer spaetere Sammelauflösung

### Gelaadene Daten
- gespeicherte `Lineup`
- gespeicherte `LineupSlot`
- `PlayerDisciplineScore`
- `SeasonDisciplineConfig`
- `Matchday`
- `TeamSeasonState`
- `ActivePlayer`

### Matchday-Disziplinen
Der Resolve-Kontext muss fuer den Matchday eindeutig wissen:
- welche Disziplin `d1` ist
- welche Disziplin `d2` ist
- welche `playerCount` pro Disziplinseite gilt

Aktueller pragmatischer Stand:
- D1/D2 werden aus `SeasonDisciplineConfig` und dem bestehenden Legacy-Lineup-Kontext abgeleitet

### Open question
- Ob spaeter echte Matchday-spezifische Disziplinzuordnungen statt nur SeasonDisciplineConfig benoetigt werden
- Ob das Modell spaeter echte paarweise Matchups braucht oder ob der Wettbewerb immer “alle gleichzeitig” ausgewertet wird

---

## 3. Score-Regeln Phase 1

### Grundregel
- Score pro Disziplinseite = Summe der Legacy-Lineup-Einzelwerte
- Einzelwert = `PlayerDisciplineScore.score`

### Phase-1-Beschränkungen
Explizit **nicht** enthalten:
- keine Fatigue
- keine Formkarten
- kein Captain
- keine Taktiken
- keine Slot-v2-Gewichte
- keine Mutator-/Trait-Zusatzlogik

### Team-Ergebnis Phase 1
- `d1Score`
- `d2Score`
- `totalScore = d1Score + d2Score`

### Winner / Draw
Das Resolve-Modell sollte beides vorbereiten:
- paarweiser Vergleich `Winner / Draw`
- oder globale Platzierung ueber alle Teams

Fachlich offene Frage:
- Dein aktueller Hinweis sagt, dass es **keine Home/Away-Teams** geben soll und alle Teams gleichzeitig antreten
- deshalb sollte Phase 1 fuer die App **primär ein globales Matchday-Ranking** vorbereiten
- paarweiser `Winner / Draw` bleibt nur als optionale Vergleichsform / Debug-Sicht modelliert

---

## 4. Output

Phase 1 sollte mindestens diese read-only Outputs liefern:

### Pro Team
- `teamId`
- `teamName`
- `d1DisciplineId`
- `d1Score`
- `d2DisciplineId`
- `d2Score`
- `totalScore`

### Resolve-Metadaten
- `matchdayId`
- `saveId`
- `seasonId`
- `warnings`
- `missingLineups`
- `missingScores`
- `validationIssues`

### Vergleich / Platzierung
Vorbereiten fuer:
- `rank` im Matchday-Feld
- optional `winner/draw/loser` fuer rein paarweisen Debug-Vergleich

### Missing-Daten-Faelle
- `missingLineups`
- `missingScores`
- `invalidLineups`

---

## 5. Datenmodell-Vorschlag

### Was schon vorhanden ist
Bereits ausreichend fuer einen read-only Resolve-Prototyp:
- `Save`
- `Season`
- `Matchday`
- `Team`
- `TeamSeasonState`
- `ActivePlayer`
- `PlayerDisciplineScore`
- `Lineup`
- `LineupSlot`
- `SeasonDisciplineConfig`

### Was fuer Phase 1 noch **nicht** zwingend noetig ist
Ein read-only Resolve-Preview kann ohne neue Result-Tabellen gebaut werden.

### Was spaeter sinnvoll sein kann

#### `matchday_results`
Zweck:
- ein Ergebnis pro Team und Matchday persistieren

Felder grob:
- `id`
- `saveId`
- `seasonId`
- `matchdayId`
- `teamId`
- `d1Score`
- `d2Score`
- `totalScore`
- `rank`
- `status`
- timestamps

#### `matchup_results`
Nur falls spaeter doch paarweise Spiele benoetigt werden:
- `matchdayResultAId`
- `matchdayResultBId`
- `winnerTeamId?`
- `isDraw`

#### `standings_events`
Zweck:
- kontrollierte Fortschreibung von Saison-/Tabellenereignissen

#### `result_audit_log`
Zweck:
- nachvollziehbare Audits fuer Resolve-Läufe und spaetere Re-Resolves

### Fazit zum Datenmodell
- fuer Phase 1 reichen die vorhandenen Tabellen
- fuer spaetere produktive Result-Writes fehlen noch dedizierte Result-/Audit-/Standings-Tabellen

---

## 6. Write-Strategie spaeter

### Phase 1
- ausschliesslich read-only Resolve-Preview
- keine Tabellenfortschreibung
- keine Standings-Updates

### Phase 2 spaeter
- kontrollierter Write aus Preview-Ergebnis
- niemals “blind resolve and write”
- erst Preview, dann bewusster Apply-Schritt

### Idempotenz
Spaetere Writes sollten:
- replace-safe sein
- fuer denselben `saveId + seasonId + matchdayId + teamId` deterministisch ersetzbar sein
- nicht mehrfach Ergebnisduplikate erzeugen

### Wichtige Regel
- niemals direkte Tabellenstandsfortschreibung ohne vorherige Resolve-Vorschau

---

## 7. Validierungen

Mindestens diese Regeln muessen fuer einen Resolve-Lauf gelten:

### Lineup-Vollständigkeit
- Team hat ein Legacy-Lineup fuer den Matchday
- beide Disziplinseiten vorhanden

### Spieleranzahl
- D1-Entry-Anzahl entspricht `SeasonDisciplineConfig.playerCount`
- D2-Entry-Anzahl entspricht `SeasonDisciplineConfig.playerCount`

### Doppelnutzung
- kein Spieler doppelt ueber D1 / D2

### Kaderkonsistenz
- `activePlayerId` gehoert zum Team-Kader
- `playerId` passt zur `activePlayerId`

### Score-Daten
- fehlende `PlayerDisciplineScore`-Rows muessen mindestens Warning ausloesen

### Source-Konsistenz
- keine Cross-Source-Mischung zwischen SQLite und Prisma
- Resolve Phase 1 arbeitet ausschliesslich auf Prisma/Supabase

---

## 8. Teststrategie

### Unit Tests
- Resolve einer einzelnen Disziplinseite
- Resolve beider Seiten fuer ein Team
- Missing-Score-Warnings
- Missing-Lineup-Warnings
- Ranking / Sortierung bei mehreren Teams

### Supabase Smoke Test
- echter Matchday-Resolve auf Seed-Daten
- mindestens fuer den bestaetigten Legacy-Lineup-Smoke-Kontext

### Golden-Master-Beispiele
- spaeter bekannte Legacy-Lineups mit erwarteten Summen
- Unterschiede zu Retool nur explizit markieren, nicht still korrigieren

### Edge Cases
- Team ohne Lineup
- Team mit invalidem Lineup
- Team mit fehlenden Scores
- ungleiche Datenlage zwischen Teams
- leerer Matchday / fehlende D1/D2-Konfiguration

---

## 9. Implementierungsreihenfolge

### 1. Read-only resolve engine
Neues reines Fachmodul, z. B.:
- `lib/matchdays/legacy-matchday-resolve-engine.ts`

Verantwortung:
- gespeicherte Legacy-Lineups lesen
- D1/D2-Summen berechnen
- Warnings / Missing-Daten erfassen
- Ranking fuer alle Teams bilden

### 2. Resolve preview API
Neue read-only Route, z. B.:
- `GET /api/matchdays/legacy/resolve-preview`

Verantwortung:
- Resolve fuer Team oder alle Teams eines Matchdays ausgeben

### 3. Debug UI
Kleine isolierte Debug-/Lab-Ansicht
- keine Foundation-Hauptseite umbauen
- nur Preview / Inspektion

### 4. Result write
Erst spaeter:
- Result-Persistenz
- keine direkten Tabellenfortschreibungen ohne Preview

### 5. Standings update
Ganz zuletzt:
- kontrollierte Tabellenfortschreibung aus aufgeloesten Matchday-Ergebnissen

---

## Kurzfazit

### Welche Tabellen schon reichen
- `Save`
- `Season`
- `Matchday`
- `Team`
- `TeamSeasonState`
- `ActivePlayer`
- `PlayerDisciplineScore`
- `Lineup`
- `LineupSlot`
- `SeasonDisciplineConfig`

### Welche Tabellen / Felder fehlen
Fuer produktive Ergebnisfortschreibung spaeter sinnvoll:
- `matchday_results`
- optional `matchup_results`
- `standings_events`
- `result_audit_log`

### Kleinster sicherer Implementierungsschritt
- eine **read-only Legacy Matchday Resolve Engine**, die aus gespeicherten Legacy-Lineups D1/D2/Total pro Team berechnet, Warnings sammelt und ein Matchday-Ranking liefert

### Offene Fragen
- globales Matchday-Ranking vs. paarweise Matchups als kanonisches Resolve-Modell
- spaetere echte Matchday-Disziplinkonfiguration vs. aktuelle SeasonDisciplineConfig-Ableitung
- wie Captain / Formkarten / Fatigue spaeter additiv eingebaut werden sollen
- wie Result-Writes und Standings-Events spaeter sauber modelliert werden
