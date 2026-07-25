#!/bin/sh
# Produktions-Start (im Docker-Container): DATABASE_URL konsistent aus
# LEC_SQLITE_PATH ableiten, ausstehende Migrationen anwenden, dann den
# Next.js-Server starten. Siehe scripts/with-db-env.ts fuer denselben
# Aufloesungsweg wie im App-Runtime (src/lib/db/client.ts).
set -e

if [ -z "$LEC_SQLITE_PATH" ]; then
  export LEC_SQLITE_PATH="/app/data/lec.sqlite"
fi
export DATABASE_URL="file:${LEC_SQLITE_PATH}"

mkdir -p "$(dirname "$LEC_SQLITE_PATH")"

echo "[start-hosted] wende Prisma-Migrationen an ($DATABASE_URL) ..."
npx prisma migrate deploy

echo "[start-hosted] starte Next.js-Server ..."
exec npm run start
