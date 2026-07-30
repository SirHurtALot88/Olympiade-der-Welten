#!/usr/bin/env bash
# install-live-save-cron.sh — EINMAL auf dem Hetzner-Server ausfuehren.
#
# Richtet zwei Crons ein:
#   1. Live-Spielstand alle 10 Minuten nach GitHub (Branch "live-save").
#   2. Bug-Meldungen alle 15 Minuten nach GitHub (Branch "bug-reports").
#
# Danach ist auf GitHub IMMER dein aktueller Stand UND jede im Spiel gemeldete Sache — ohne dass du
# je wieder etwas tippst. Claude liest beides von dort (siehe docs/BUGFIXING_AGENT.md).
#
# Idempotent: mehrfaches Ausfuehren legt keine Duplikate an. Der bestehende Auto-Deploy-Cron
# bleibt unangetastet.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SAVE_CRON="*/10 * * * * cd $REPO_DIR && bash deploy/hetzner/push-live-save.sh >> /var/log/oly-live-save.log 2>&1"
# Versetzt zur vollen Viertelstunde, damit die beiden Pushes nicht gleichzeitig auf denselben
# Git-Zugang gehen. Meldungen sind selten — 15 Minuten sind reichlich schnell.
BUGS_CRON="7,22,37,52 * * * * cd $REPO_DIR && bash deploy/hetzner/push-bug-reports.sh >> /var/log/oly-bug-reports.log 2>&1"

# Bestehende Crontab uebernehmen, nur die eigenen alten Zeilen entfernen, neue anhaengen.
(
  crontab -l 2>/dev/null | grep -v -e 'push-live-save.sh' -e 'push-bug-reports.sh' || true
  echo "$SAVE_CRON"
  echo "$BUGS_CRON"
) | crontab -

echo "OK — Crons installiert:"
echo "    Live-Save   → alle 10 Minuten nach GitHub (Branch 'live-save')"
echo "    Bug-Meldungen → alle 15 Minuten nach GitHub (Branch 'bug-reports')"
echo "Aktuelle Crontab:"
crontab -l | sed 's/^/    /'
echo ""
echo "Mache jetzt gleich den ersten Push ..."
bash "$REPO_DIR/deploy/hetzner/push-live-save.sh"
bash "$REPO_DIR/deploy/hetzner/push-bug-reports.sh"
