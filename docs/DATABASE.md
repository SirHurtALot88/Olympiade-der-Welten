# Database Foundation

Die App hat jetzt ein vorbereitetes Prisma/Postgres-Fundament parallel zur bestehenden lokalen SQLite-Schicht.

## Environment

Lege lokal eine `.env.local` an:

```env
# Connect to Postgres via the shared transaction-mode pooler (IPv4-only)
DATABASE_URL="postgresql://postgres.mspujpyxjlewdvegpmus:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Connect to Postgres via the shared session-mode pooler (used for migrations)
DIRECT_URL="postgresql://postgres.mspujpyxjlewdvegpmus:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

`.env.local` wird nicht committed. Als Vorlage dient `.env.example`.

- `DATABASE_URL`: normale Prisma-Client-/App-Verbindung
- `DIRECT_URL`: direkte Verbindung fuer Prisma-Migrationen, z.B. bei Supabase Direct Connection

## Befehle

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

### Was die Befehle machen

- `db:generate`: erzeugt den Prisma Client aus `prisma/schema.prisma`
- `db:migrate`: spielt vorhandene Prisma-Migrationen sicher auf die verbundene Postgres-Datenbank aus
- `db:seed`: schreibt Stammdaten und einen frischen Startzustand in Postgres
- `db:studio`: oeffnet Prisma Studio

## Was aktuell weiter SQLite nutzt

Die laufende Foundation-App unter `/foundation` nutzt fuer Saves und Writes aktuell weiterhin die bestehende SQLite-gestuetzte Persistenz in `lib/persistence/*`.

Das neue Prisma-Fundament ist in diesem Schritt bewusst additiv:

- Prisma/Postgres fuer sauberes Ziel-Datenmodell
- SQLite weiter als bestehender Runtime-Speicher der aktuellen App
- Prisma darf aber bereits als read-only Quelle fuer Foundation-Basisdaten dienen, solange noch kein lokaler SQLite-Spielstand vorhanden ist

## Was Prisma aktuell speichert

Die neue Postgres-Struktur speichert:

- Saves
- Seasons
- Alliances
- Teams
- TeamSeasonState
- Players
- PlayerAttributes
- PlayerDisciplineScores
- ActivePlayers
- Disciplines
- DisciplineWeights als Attributmatrix je Disziplin
- SeasonDisciplineConfig getrennt fuer Reihenfolge, Spieleranzahl und Mutatoren
- Matchdays
- Lineups
- LineupSlots
- Transfers

Im Seed werden aktuell nur Stammdaten und ein frischer Initialzustand geschrieben.

## Was bewusst NICHT importiert wird

Folgende Daten werden absichtlich nicht nach Postgres uebernommen:

- historische Retool-Werte
- alte Saisonstaende
- historische Transfers
- Marktwert-Historien
- Transfer-Listings
- Battle-/Draft-/Room-Systeme
- synthetische Verlaufsdaten aus der bisherigen Demo-Seedlogik

## Seed-Quellen

Der Seed zieht nur aus app-eigenen Datenquellen:

- `data/source/teams.json`
- `data/source/team-identities.json`
- `data/source/player-team-mapping.json`
- `data/generated/oly-player-stats.json`
- `data/generated/team-logo-map.json`
- `data/generated/player-portrait-map.json`
- Disziplin- und Matchday-Definitionen aus `lib/data/dataAdapter.ts`
- vorlaeufige Gewichtungsmatrix aus `lib/db/seed/seedSources.ts`

### Player-Economy-Quelle

Fuer Marktwert und Gehalt ist aktuell diese Quelle fuehrend:

- `data/generated/oly-player-stats.json`

Das Mapping laeuft ueber:

- `lib/data/playerStatsAdapter.ts`
- `lib/data/dataAdapter.ts`
- `lib/db/seed/mappers.ts`
- `prisma/seed.ts`

Dabei gilt:

- `PlayerAttribute.marketValue` uebernimmt `player.marketValue`
- `PlayerAttribute.salaryDemand` uebernimmt `player.salaryDemand`
- die Werte werden als Vollwerte gespeichert
- es gibt aktuell keine beabsichtigte Dummy-Skalierung wie `100 -> 100000`

Read-only Pruefung:

- `npm run player:audit-economy-source`

## Uebergangsschicht

Die aktuelle Migrationsstrategie ist bewusst schrittweise:

- Prisma/Supabase ist die Zielarchitektur fuer neue Fachlogik
- SQLite bleibt nur Uebergangs- und Fallback-Schicht
- bestehende Foundation-Reads koennen serverseitig bereits aus Prisma projiziert werden
- bestehende Foundation-Writes bleiben vorerst bei SQLite, bis die produktiven Management-Workflows sauber auf Prisma gehoben sind

## Remote-Migrationspfad

Fuer die gehostete Supabase-Datenbank nutzt das Projekt bewusst `prisma migrate deploy` statt `prisma migrate dev`.

Der Grund:

- `migrate dev` ist fuer lokale Entwicklungsdatenbanken gedacht
- es arbeitet mit Shadow-DB-/Dev-Semantik
- gehostete Supabase-Postgres-Instanzen sind fuer diesen Pfad oft unpassend oder zu restriktiv
- `migrate deploy` ist der sichere nicht-destructive Pfad fuer vorhandene SQL-Migrationen auf einer Remote-Datenbank
