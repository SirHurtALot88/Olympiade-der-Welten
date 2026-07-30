#!/usr/bin/env bash
# install-live-save-cron.sh — richtet die beiden Push-Crons auf dem Hetzner-Server ein.
#
#   1. Live-Spielstand alle 10 Minuten nach GitHub (Branch "live-save").
#   2. Bug-Meldungen alle 15 Minuten nach GitHub (Branch "bug-reports").
#
# Danach ist auf GitHub IMMER dein aktueller Stand UND jede im Spiel gemeldete Sache — ohne dass du
# je wieder etwas tippst. Claude liest beides von dort (siehe docs/BUGFIXING_AGENT.md).
#
# ZWEI AUFRUFARTEN:
#   bash install-live-save-cron.sh                 von Hand: richtet ein und pusht sofort einmal
#   bash install-live-save-cron.sh --ensure-only   aus auto-deploy.sh: still, ohne Sofort-Push
#
# Das `--ensure-only` ist der Grund, warum dieses Skript ueberhaupt zweimal existieren darf: eine
# neue Cron-Zeile hier drin nuetzt nichts, solange niemand das Skript auf dem Server erneut
# ausfuehrt. Genau das ist passiert — die Zeile fuer die Bug-Meldungen kam dazu, auf dem Server lief
# aber weiter die alte Crontab mit nur dem Live-Save, und die Meldungen erreichten GitHub nie.
# Seitdem ruft `auto-deploy.sh` diese Datei bei jedem Deploy auf: neue Zeilen richten sich selbst ein.
#
# Idempotent: mehrfaches Ausfuehren legt keine Duplikate an. Der Auto-Deploy-Cron selbst bleibt
# unangetastet — entfernt werden nur die beiden eigenen Zeilen, bevor sie neu geschrieben werden.
set -euo pipefail

ENSURE_ONLY=0
[ "${1:-}" = "--ensure-only" ] && ENSURE_ONLY=1

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SAVE_CRON="*/10 * * * * cd $REPO_DIR && bash deploy/hetzner/push-live-save.sh >> /var/log/oly-live-save.log 2>&1"
# Versetzt zur vollen Viertelstunde, damit die beiden Pushes nicht gleichzeitig auf denselben
# Git-Zugang gehen. Meldungen sind selten — 15 Minuten sind reichlich schnell.
BUGS_CRON="7,22,37,52 * * * * cd $REPO_DIR && bash deploy/hetzner/push-bug-reports.sh >> /var/log/oly-bug-reports.log 2>&1"

BEFORE="$(crontab -l 2>/dev/null || true)"
AFTER="$(
  printf '%s\n' "$BEFORE" | grep -v -e 'push-live-save.sh' -e 'push-bug-reports.sh' | sed '/^$/d' || true
  echo "$SAVE_CRON"
  echo "$BUGS_CRON"
)"

if [ "$BEFORE" = "$AFTER" ]; then
  # Schon auf Stand. Im Deploy-Pfad heisst das: nichts sagen, kein Log-Spam bei jedem Deploy.
  [ "$ENSURE_ONLY" = "1" ] && exit 0
  echo "Crons sind bereits auf Stand — nichts zu aendern."
else
  printf '%s\n' "$AFTER" | crontab -
  echo "Crons eingerichtet:"
  echo "    Live-Save     → alle 10 Minuten nach GitHub (Branch 'live-save')"
  echo "    Bug-Meldungen → alle 15 Minuten nach GitHub (Branch 'bug-reports')"
fi

if [ "$ENSURE_ONLY" = "1" ]; then
  # Der Deploy soll nicht auf zwei Git-Pushes warten — der Cron holt das binnen Minuten nach.
  exit 0
fi

echo "Aktuelle Crontab:"
crontab -l | sed 's/^/    /'
echo ""
echo "Mache jetzt gleich den ersten Push ..."
bash "$REPO_DIR/deploy/hetzner/push-live-save.sh"
bash "$REPO_DIR/deploy/hetzner/push-bug-reports.sh"
