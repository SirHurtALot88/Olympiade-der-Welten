# Script Tooling Registry

## `next:clean`

### Zweck
Raeumt nur Next-/Turbopack-Artefakte auf, wenn Dev oder Build in einen kaputten Zustand geraten sind.

### Was entfernt wird
- `.next`
- `.next-dev`
- `.turbo`

### Was bewusst **nicht** entfernt wird
- `node_modules`
- `.env.local`
- Prisma-/Supabase-Daten
- lokale SQLite-Dateien

### Wann ausfuehren
- bei `ENOENT`- oder Manifest-Fehlern aus Next
- wenn Dev und Build sich gegenseitig in einen kaputten Artefaktzustand gebracht haben
- vor einem sauberen doppelten Build-Test

### Sicherheitsprofil
- keine Datenbank-Writes
- keine Migrationen
- keine Secrets im Output

## `build:clean`

### Zweck
Startet einen frischen Produktions-Build nach einem gezielten Next-Artefakt-Clean.

### Ablauf
1. `next:clean`
2. `build`

### Wann ausfuehren
- vor einem stabilen Build-Check
- nach kaputten `.next`-/Turbopack-Artefakten
- wenn `build` zwar fachlich korrekt ist, aber am Ausgabeverzeichnis stolpert

### Sicherheitsprofil
- keine Datenbank-Writes
- keine Migrationen
- keine Secrets im Output

## `project:audit-write-safety`

### Zweck
Formaler Phase-0A-Audit fuer alle bekannten mutierenden Pfade.

### Was geprueft wird
- Buy / Sell
- Standings Apply Skeleton
- Prize Preview
- geplanter Cash Apply Status
- Result Apply
- Sync-Scripts
- Seed
- Migrationen

### Zielbild
- read-only oder dry-run als Default
- echte Writes nur mit `--write` oder `dryRun=false`
- klare `allowedTables`
- klare `forbiddenTables`
- keine Secret-Ausgabe
- keine impliziten Remote-Writes

### Sicherheitsprofil
- read-only Audit
- keine Datenbank-Writes
- keine Migrationen
- keine Secrets

## `project:check-mirror`

### Zweck
Read-only Konsistenzcheck fuer den Spiegel-/Arbeitsordner des Projekts.

### Was geprueft wird
- wichtige Projektpfade
- wichtige Projektdateien
- Alias-Grundcheck fuer `@/*`
- wichtige `package.json`-Scripts

### Wann ausfuehren
- nach dem Nachziehen oder Spiegeln von Projektteilen
- wenn `npm test` oder `npm run build` ploetzlich wegen fehlender Module rot werden
- vor groesseren Arbeitsbloecken im Mirror-Ordner

### Typische Ursache
Ein unvollstaendiger Spiegelordner, bei dem echte Projektordner oder Dateien nicht mitgezogen wurden.

### Sicherheitsprofil
- read-only
- keine Secrets
- keine Datenbank-Writes
- keine Migrationen
- keine Codegenerierung ausser normaler Script-Ausgabe

## `transfermarkt:audit`

### Zweck
Read-only Audit fuer den aktuellen Prisma-/Supabase-Transfermarkt-Status.

### Voraussetzungen
- erwartet `.env.local` im Projektroot
- `DATABASE_URL` muss gesetzt sein
- `DIRECT_URL` optional
- loggt nur `DATABASE_URL present: yes/no`, niemals den Wert
- loggt nur `DIRECT_URL present: yes/no`, niemals den Wert

### Was geprueft wird
- Players total
- ActivePlayers total
- Free Agents im aktuellen `saveId + seasonId`-Scope
- Transfers total
- Teams unter `7`, `playerMin`, `playerOpt`
- Top Free Agents fuer den MVP

### Sicherheitsprofil
- read-only
- keine Secrets im Output
- keine Prisma-Writes
- keine SQLite-Writes
- keine Migrationen
- typischer Einsatz: vor dem Transfermarkt-Lab und vor einem spaeteren Buy-Service

### Stabilitaetshinweis
- Dev und Build nicht parallel gegeneinander laufen lassen
- bei kaputten Next-Artefakten zuerst `next:clean`
- Build seriell testen, idealerweise zweimal hintereinander

## `transfermarkt:smoke-buy`

### Zweck
Kontrollierter Smoke-Test fuer den serverseitigen Buy-Service.

### Verhalten
- default = Dry-run
- waehlt defensiv ein Team und einen Free Agent
- schreibt **nichts**, solange `--write` nicht gesetzt ist
- mit `--write` schreibt nur in den erlaubten Kauf-Scope

### Erlaubte Writes bei `--write`
- `ActivePlayer`
- `Transfer`
- `TeamSeasonState.cash`

### Nicht erlaubt
- keine SQLite-Writes
- keine Standings-Writes
- keine Result-Writes
- keine AI-Kaeufe
- keine Verkaeufe

## `retool:extract-transfermarkt-columns`

### Zweck
Read-only Extraktion der Transfermarkt-Tabellen und Spalten aus der Retool-Draftboard-JSON.

### Was erzeugt wird
- `references/retool-transfermarkt-columns/manifest.json`
- `references/retool-transfermarkt-columns/transfermarkt-columns.raw.json`
- `references/retool-transfermarkt-columns/transfermarkt-formatting.raw.json`
- `references/retool-transfermarkt-columns/README.md`

### Was geprueft wird
- Transfermarkt-Tabellen auf `transfermarktPage`
- Column Labels / Keys / Reihenfolge / Hidden Flags
- Formatierungen je Spalte
- Conditional-Formatting-Regeln und Farbwerte
- Row Actions
- Data Source und Dependencies

### Sicherheitsprofil
- read-only
- keine Secrets
- keine Prisma-Writes
- keine SQLite-Writes
- keine Migrationen

## `player:audit-economy-source`

### Zweck
Read-only Vergleich von Player-Economy-Werten zwischen Quell-JSON, Prisma-DB und Transfermarkt-Service.

### Voraussetzungen
- erwartet `.env.local` im Projektroot
- `DATABASE_URL` muss gesetzt sein
- loggt nur `DATABASE_URL present: yes/no`
- keine Secret-Werte

### Was geprueft wird
- Quelle: `data/generated/oly-player-stats.json`
- DB: `PlayerAttribute.marketValue`
- DB: `PlayerAttribute.salaryDemand`
- optional aktive Spielergehaelter aus `ActivePlayer.salary`
- Service-Ausgabe aus `/api/transfermarkt/free-agents`
- Match / Missing / Scale-Mismatch / Value-Mismatch / Fallback-Nutzung
- Verteilungsanalyse fuer `marketValue` und `salaryDemand`
- Rohfeld-Inventur fuer moegliche Money-Spalten inkl. Locale-Signalen und Beispielwerten

### Sicherheitsprofil
- read-only
- keine Prisma-Writes
- keine SQLite-Writes
- keine Migrationen

## `retool:extract-player-attributes`

### Zweck
Extrahiert die Retool-Spur fuer die echte 12er-Spielerattributquelle und dokumentiert, ob nur die Query oder auch eingebettete Daten lokal vorliegen.

### Was erzeugt wird
- `references/retool-player-attributes/attribute-query.sql`
- `references/retool-player-attributes/attribute-fields.json`
- `references/retool-player-attributes/README.md`

### Was geprueft wird
- Query-/Source-Name
- Source-Kind (`GoogleSheetsQuery` / SQL)
- Page / Spreadsheet / Sheet
- erwartete 12 Attributfelder
- erwartete 12 Rating-Felder
- ob Rohdaten im Retool-Export eingebettet sind

### Sicherheitsprofil
- read-only
- keine Prisma-Writes
- keine SQLite-Writes
- keine Migrationen

## `player:audit-retool-attribute-mapping`

### Zweck
Prueft, ob aus der Retool-Attributquelle echte Rohdaten fuer ein Name-Mapping gegen die neue Player-Liste vorliegen.

### Verhalten
- meldet `blocked`, wenn nur Query-Metadaten vorliegen
- mappt bei vorhandenen Rohdaten:
  - Exact Matches
  - Missing in App
  - Missing in Attributes
  - Duplicate Names
  - Fuzzy Candidates

### Sicherheitsprofil
- read-only
- keine Prisma-Writes
- keine SQLite-Writes
- keine Migrationen

## `golden:compare`

### Zweck
Read-only Diff-Runner fuer Golden-Master-Fixtures gegen einen separaten App-Output.

### Was verglichen wird
- Fixture JSON gegen Actual JSON
- exakte Gleichheit
- numerische Deltas
- fehlende Felder
- Extra-Felder
- Reihenfolge in Arrays

### Optionen
- `--fixture <path>`
- `--actual <path>`
- `--ignore <path>` fuer volatile Felder
- `--delta <number>` fuer tolerierte Rundungsabweichung

### Wann ausfuehren
- vor jeder Portierung von Saisonstand-/Punkte-/Cash-Logik
- beim Gegencheck von Retool gegen neue App-Outputs
- vor Snapshoterneuerungen

### Sicherheitsprofil
- read-only
- keine Datenbank-Writes
- keine Migrationen
- keine Fixture-Ueberschreibungen

## `retool:extract-standings-economy`

### Zweck
Read-only Extrakt fuer Retool-Spuren rund um Punkte, Saisonstand, Score-Felder, Cash und Preisgeld.

### Sicherheitsprofil
- read-only
- keine Datenbank-Writes
- keine Migrationen
- keine Fixture-Ueberschreibungen

## `standings:audit-sheet`

### Zweck
Zentrales Read-Audit fuer die aktuelle Online-Saisonstand-Welt:

- Saisonstand
- Rang-zu-Punkte
- Preisgeld

### Was geprueft wird
- lokale CSV-/JSON-Exporte in `references/sheets/`
- optional direkter Google-Sheet-CSV-Pfad fuer den Saisonstand
- Header-Erkennung
- erkannte Kernspalten
- Zeilenanzahl
- ungueltige Preisgeld-Zeilen
- doppelte Preisgeld-Raenge
- fehlende Preisgeld-Werte
- Tab-Klassifikation:
  - `season_standings`
  - `rank_to_points`
  - `prize_money`
  - `attribute_sheet`
  - `unknown`

### Unterstuetzte lokale Dateien
- `references/sheets/season-standings.csv`
- `references/sheets/season-standings.json`
- `references/sheets/rank-to-points.csv`
- `references/sheets/rank-to-points.json`
- `references/sheets/prize-money-table.csv`
- `references/sheets/prize-money-table.json`
- `references/sheets/prize-money-table.normalized.csv`
- `references/sheets/prize-money-table.normalized.json`

### Optionen
- `--gid <gid>` um den Saisonstand gegen eine andere Sheet-GID zu pruefen
- `--url <url>` um einen direkten CSV-Exportpfad zu pruefen

### Sicherheitsprofil
- read-only
- keine Datenbank-Writes
- keine Migrationen
- keine Heuristik-Fallbacks

## `standings:export-sheets`

### Zweck
Legt die bestaetigten Online-Sheet-Exporte fuer Saisonstand, Punktetabelle und Preisgeld lokal unter `references/sheets/` ab.

### Was erzeugt wird
- `references/sheets/season-standings.csv`
- `references/sheets/season-standings.json`
- `references/sheets/rank-to-points.csv`
- `references/sheets/rank-to-points.json`
- `references/sheets/prize-money-table.csv`
- `references/sheets/prize-money-table.json`
- bei eindeutigem Preisgeldblock zusaetzlich:
  - `references/sheets/prize-money-table.normalized.csv`
  - `references/sheets/prize-money-table.normalized.json`

### Bestaetigte Quellen
- `Saisonstand` -> `gid=475050161`
- `Punktetabelle` -> `gid=1155023152`
- `Preisgeld` -> `gid=2059519103`

### Optionen
- `--source season-standings`
- `--source rank-to-points`
- `--source prize-money-table`
- `--gid <gid>`
- `--url <sheet-url>`

### Sicherheitsprofil
- read-only gegen das Google Sheet
- keine Datenbank-Writes
- keine Migrationen
- keine Secrets

## `standings:smoke-apply`

### Zweck
Read-only Smoke fuer das Standings-Apply-Skeleton.

### Verhalten
- default = dry-run
- zeigt `canApply`, `blockingReasons`, `warnings` und `plannedChanges`
- `plannedChanges` enthalten `currentRank`, `projectedRank`, `currentPoints`, `pointsDelta`, `projectedPoints`, `totalScore` und `matchdayRank`
- zeigt bei Gleichstand auch erkannte `tieGroups` und betroffene Teams
- `--write` ist erlaubt, bleibt aktuell aber sicher blockiert
- keine Cash-/Preisgeld-Writes
- keine Transfer-/ActivePlayer-Writes

## `cash:smoke-prize-apply`

### Zweck
Read-only Smoke fuer das Cash-/Preisgeld-Apply-Skeleton.

### Verhalten
- default = dry-run
- zeigt `canApply`, `blockingReasons`, `warnings` und `plannedChanges`
- `plannedChanges` enthalten `currentCash`, `prizeMoney`, `bonus`, `malus`, `projectedCash` und `projectedRank`
- `--write` ist erlaubt, bleibt aktuell aber sicher blockiert

### Sicherheitsprofil
- keine Cash-Writes
- keine Standings-Writes
- keine Transfer-/ActivePlayer-Writes
- keine SQLite-Writes
- keine AI-Writes

## `prize:audit-normalized`

### Zweck
Read-only Audit fuer die normalisierte Preisgeldtabelle.

### Output
- Anzahl der Preisgeld-Raenge
- `minRank` / `maxRank`
- fehlende oder doppelte Ränge
- ungueltige `prizeMoney`-Werte
- `totalPrizePool`
- ob `sourceRow` und `selectedBlock` dokumentiert sind

### Sicherheitsprofil
- read-only
- keine Cash-Writes
- keine Standings-Writes
- keine Migrationen

## `standings:audit-tiebreaker`

### Zweck
Read-only Audit fuer echte Gleichstaende im aktuellen globalen Standings-Preview.

### Output
- `tieGroups`
- `affectedTeams`
- `tieFieldsAvailable`
- `requiresConfirmedTieBreaker`
- `recommendation`

### Sicherheitsprofil
- read-only
- keine Standings-Writes
- keine Cash-/Preisgeld-Writes
- keine Migrationen

### Sicherheitsprofil
- keine Standings-Writes
- keine Cash-/Preisgeld-Writes
- keine Transfer-Writes
- keine AI
- keine Migrationen

## `app:check-live`

### Zweck
Prueft einen laufenden lokalen Dev-Server gegen die wichtigsten Foundation- und API-Pfade.

### Gepruefte Ziele
- `/foundation`
- `/api/transfermarkt/free-agents?saveId=save-initial&seasonId=season-1&limit=5`
- `/api/transfermarkt/history?saveId=save-initial&seasonId=season-1&limit=5`
- `/api/standings/preview?saveId=save-initial&seasonId=season-1&matchdayId=matchday-1`
- `/api/season/prize-preview?saveId=save-initial&seasonId=season-1`

### Verhalten
- wenn der Dev-Server laeuft:
  - gibt pro Ziel `OK` oder `ERR` aus
- wenn kein Dev-Server laeuft:
  - Ausgabe `dev server not running`
  - kein Codefehler

### Sicherheitsprofil
- read-only HTTP-Checks
- keine Datenbank-Writes
- keine Migrationen
- keine versteckten Mutationen

## `player:sync-attribute-sheet-db`

### Zweck
Synchronisiert die echten 12 Attributwerte und Ratings aus dem Attribute-Sheet in `PlayerAttribute`.

### Sicherheitsprofil
- default = dry-run
- echte Writes nur mit `--write`
- schreibt nur `PlayerAttribute`
- keine Migrationen
- keine Nebenwrites in Transfer-, Result- oder Standings-Tabellen

## `player:sync-sheet-columns-db`

### Zweck
Synchronisiert angeleitete Player-/Economy-Spalten aus dem lokalen Player-Export in `Player` und `PlayerAttribute`.

### Sicherheitsprofil
- default = dry-run
- echte Writes nur mit `--write`
- schreibt nur `Player` und `PlayerAttribute`
- keine Migrationen
- keine Nebenwrites in Transfer-, Result- oder Standings-Tabellen

### Was erzeugt wird
- `references/retool-standings-economy/manifest.json`
- `references/retool-standings-economy/standings.raw.json`
- `references/retool-standings-economy/scoring.raw.json`
- `references/retool-standings-economy/cash-prize.raw.json`
- `references/retool-standings-economy/README.md`

### Was geprueft wird
- Retool-Exports und Doku auf Standings-/Economy-Begriffe
- Quelle/Seitenspur
- Source-Kind wie JS Query, SQL, Function oder State
- Abhaengigkeiten aus `{{ ... }}` oder `.trigger(...)`
- Extraktionsqualitaet: `complete`, `partial`, `quirky`

### Sicherheitsprofil
- read-only
- keine App-Writes
- keine Datenbank-Writes
- keine Migrationen
