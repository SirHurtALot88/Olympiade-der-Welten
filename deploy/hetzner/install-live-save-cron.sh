#!/usr/bin/env bash
# install-live-save-cron.sh — EINMAL auf dem Hetzner-Server ausfuehren.
#
# Richtet einen Cron ein, der den Live-Spielstand alle 10 Minuten nach GitHub schiebt
# (Branch "live-save"). Danach ist auf GitHub IMMER dein aktueller Stand — ohne dass du
# je wieder etwas tippst. Claude liest den Stand von dort.
#
# Idempotent: mehrfaches Ausfuehren legt keine Duplikate an. Der bestehende Auto-Deploy-Cron
# bleibt unangetastet.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CRON_LINE="*/10 * * * * cd $REPO_DIR && bash deploy/hetzner/push-live-save.sh >> /var/log/oly-live-save.log 2>&1"

# Bestehende Crontab uebernehmen, nur alte push-live-save-Zeilen entfernen, neue anhaengen.
( crontab -l 2>/dev/null | grep -v 'push-live-save.sh' || true ; echo "$CRON_LINE" ) | crontab -

echo "OK — Cron installiert: der Live-Save geht ab jetzt alle 10 Minuten automatisch nach GitHub."
echo "Aktuelle Crontab:"
crontab -l | sed 's/^/    /'
echo ""
echo "Mache jetzt gleich den ersten Push ..."
bash "$REPO_DIR/deploy/hetzner/push-live-save.sh"
