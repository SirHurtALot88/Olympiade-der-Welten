#!/bin/sh
# Produktions-Start (im Docker-Container): DATABASE_URL konsistent aus
# LEC_SQLITE_PATH ableiten, ausstehende Migrationen anwenden, dann den
# Next.js-Server starten. Siehe scripts/with-db-env.ts fuer denselben
# Aufloesungsweg wie im App-Runtime (src/lib/db/client.ts).
set -e

# Der Container startet als root, repariert die Rechte im Datenvolume und faellt dann auf den
# Benutzer "lec" zurueck. Hintergrund: gehoert die SQLite-Datei im Volume root (frueher als root
# angelegt oder kopiert), kann "lec" nicht schreiben, die Migration bricht mit "attempt to write a
# readonly database" ab, und die App startet nie. So heilt sich das von selbst, ohne Handarbeit.
if [ "$(id -u)" = "0" ]; then
  DATA_DIR="$(dirname "${LEC_SQLITE_PATH:-/app/data/lec.sqlite}")"
  mkdir -p "$DATA_DIR"
  chown -R lec:nodejs "$DATA_DIR"
  exec runuser -u lec -- "$0" "$@"
fi

if [ -z "$LEC_SQLITE_PATH" ]; then
  export LEC_SQLITE_PATH="/app/data/lec.sqlite"
fi
export DATABASE_URL="file:${LEC_SQLITE_PATH}"

mkdir -p "$(dirname "$LEC_SQLITE_PATH")"

echo "[start-hosted] wende Prisma-Migrationen an ($DATABASE_URL) ..."
npx prisma migrate deploy

echo "[start-hosted] starte Next.js-Server ..."
exec npm run start
