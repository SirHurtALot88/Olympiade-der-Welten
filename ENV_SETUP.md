# Env Setup

Die echte Laufzeitdatei liegt jetzt **kanonisch in diesem Sammelordner**:

- [`.env.local`](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/Olympiade%20der%20Welten/.env.local)
- [`.env.local`](/Users/chrisfalk/Documents/Codex/Olympiade%20der%20Welten/.env.local)

Damit Next.js und Prisma trotzdem wie gewohnt arbeiten, gibt es im Projektroot nur noch einen technischen Symlink:

- [Projektroot `.env.local`](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/.env.local)

Das bedeutet:

- du pflegst die Werte im Ordner `Olympiade der Welten`
- Next.js liest weiter erfolgreich aus dem Projektroot
- Prisma liest `DATABASE_URL` und `DIRECT_URL` ebenfalls weiter normal

## Aktueller Supabase-Connector

Vorlage:

```env
# Connect to Postgres via the shared transaction-mode pooler (IPv4-only)
DATABASE_URL="postgresql://postgres.mspujpyxjlewdvegpmus:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Connect to Postgres via the shared session-mode pooler (used for migrations)
DIRECT_URL="postgresql://postgres.mspujpyxjlewdvegpmus:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

## Referenzdateien

- Vorlage im Projektroot: [`.env.example`](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/.env.example)
- Kanonische Laufzeitdatei: [`.env.local`](/Users/chrisfalk/Documents/Codex/Olympiade%20der%20Welten/.env.local)
- Technischer Symlink im Projektroot: [`.env.local`](/Users/chrisfalk/Documents/Codex/2026-06-01/baue-einen-lokalen-web-app-prototyp/.env.local)

## Regel fuer spaetere Chats

Wenn in kuenftigen Chats nach DB-Setup oder Supabase-Zugang gefragt wird:

- fachliche Referenz: dieser Ordner `Olympiade der Welten`
- kanonische Env-Datei: `Olympiade der Welten/.env.local`
- technische Root-Datei: nur noch Symlink auf diese Datei
