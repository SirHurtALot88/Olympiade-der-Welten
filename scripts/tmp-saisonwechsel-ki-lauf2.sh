#!/usr/bin/env bash
# Fortsetzung des reinen KI-Laufs nach dem Draft (gleiche SQLite): 20 Spieltage, Saisonwechsel, KI-Kauflauf S2.
set -u
export OLY_APP_SQLITE_PATH=/tmp/abnahme-ki-19-11.sqlite
export OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 PORT=3217
export ABNAHME_VOLLKI=1 ABNAHME_LAUF=ki
NODE_ENV=production npx tsx server.ts > /tmp/claude-0/ki-dev2.log 2>&1 &
DEV=$!
for i in $(seq 1 300); do curl -s -o /dev/null --max-time 20 http://127.0.0.1:3217/foundation && break; sleep 3; done
echo "SERVER OK"
S="npx tsx scripts/abnahme-saison-app.ts"
$S spieltage 20 && $S vertragsbilanz && $S saisonende && $S messen-fenster && $S vertragsbilanz
echo "FERTIG exit=$?"
kill -- -$DEV 2>/dev/null
pkill -f "tsx server.ts"
