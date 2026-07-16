# Generated Data

Diese Dateien sind nachvollziehbare Snapshots aus den aktuellen Quellen:

- `oly-player-stats.json`
  - Quelle: Excel-Import aus `Oly Player Stats 05-2026.xlsx`
  - Inhalt: normalisierte Spielerstammdaten und Disziplinwerte
- `oly-rosters.json`
  - Quelle: `data/source/player-team-mapping.json` + `oly-player-stats.json`
  - Inhalt: aufloesbare `RosterEntry`-Snapshots mit `playerId` und `teamId`
- `oly-teams.json`
  - Quelle: `data/source/teams.json`
  - Inhalt: normalisierte Team-Snapshots
- `oly-mapping-report.json`
  - Quelle: Team- und Mapping-Import
  - Inhalt: Zaehler, Warnungen und Abweichungen des aktuellen Mapping-Laufs

## Warnungsbedeutung

- `playerWithoutTeam`: Importierter Spieler ohne autoritative Teamzuordnung
- `teamWithoutPlayers`: Team ohne Roster-Eintraege
- `mappingRowWithoutPlayerMatch`: Mapping-Zeile ohne eindeutigen Spielermatch
- `duplicateMappedPlayer`: Spieler mehrfach in der Mapping-Quelle zugeordnet
- `unknownTeamCode`: Mapping verweist auf nicht definierten Teamcode
- `duplicateTeamCode`: Teamquelle enthaelt denselben Teamcode mehrfach
- `officialTeamPendingCode`: offizieller Teamname bekannt, aber noch ohne sicheren kanonischen Code
