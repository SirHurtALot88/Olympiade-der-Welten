#!/usr/bin/env bash
# Ein Lock-Halt fuer die Einsatzliste-Optik-Aufnahmen: Save-Bau, next build, Aufnahmen aller Disziplinen.
# Danach wartet das Skript bis 25 Minuten auf /tmp/eliste-go (weitere Runde mit frischem Build) oder /tmp/eliste-ende.
# AUFRUF: flock /tmp/oly-aufnahme.lock bash scripts/lauf-einsatzliste-optik.sh
set -u
export OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 SCREENSHOT_PORT=3211 OLY_SERVER=start
DISZ="${DISZ:-basketball,tennis,spurt,mini-dm,battlefield,time-trial,climbing}"
OUT=docs/design/einsatzliste-optik-18-11
rm -f /tmp/eliste-fertig /tmp/eliste-go /tmp/eliste-ende
echo "[lauf] bau $(date)"
npx tsx scripts/screenshot-einsatzliste-optik.ts bau "$OUT" "$DISZ" 2>&1 | tail -15
# NODE_OPTIONS enthaelt --use-openssl-ca: das bricht next build ("Collecting page data").
unset NODE_OPTIONS
runde() {
  echo "[lauf] build $(date)"
  rm -rf .next
  npx next build 2>&1 | tail -5
  for d in ${DISZ//,/ }; do
    npx tsx scripts/screenshot-einsatzliste-optik.ts foto "$OUT" "$d" app 2>&1 | tail -8
  done
  echo "[lauf] runde fertig $(date)"
  touch /tmp/eliste-fertig
}
runde
ende=$(( $(date +%s) + 1500 ))
while [ "$(date +%s)" -lt "$ende" ] && [ ! -f /tmp/eliste-ende ]; do
  if [ -f /tmp/eliste-go ]; then
    rm -f /tmp/eliste-go /tmp/eliste-fertig
    [ -f /tmp/eliste-disz ] && DISZ=$(cat /tmp/eliste-disz)
    runde
    ende=$(( $(date +%s) + 1500 ))
  fi
  sleep 10
done
rm -rf .next
echo "[lauf] ende"
