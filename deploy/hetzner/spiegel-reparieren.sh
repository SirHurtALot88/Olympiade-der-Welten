#!/usr/bin/env bash
# spiegel-reparieren.sh — auf dem Hetzner-Server ausfuehren.
#
# EIN Befehl statt fuenf. Findet heraus, warum der Server nicht mehr spiegelt, und behebt das,
# was sich gefahrlos beheben laesst.
#
# ANLASS (19.08.): beide Spiegel standen seit dem 14.08. still — `live-save` 07:50,
# `bug-reports` 07:52. Chris' In-Game-Meldungen von fuenf Tagen lagen im Container fest, und in
# den Agenten-Sitzungen galt ein fuenf Tage altes Abbild als "der aktuelle Spielstand".
#
#   ssh root@135.181.102.2
#   cd Olympiade-der-Welten && bash deploy/hetzner/spiegel-reparieren.sh
#
# ZERSTOERT NICHTS. Der Arbeitsbaum wird nur angefasst, wenn `--deploy-loesen` mitgegeben wird —
# und auch dann sagt das Skript vorher, was es wegwirft.
set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_DIR"

LOESEN=0
[ "${1:-}" = "--deploy-loesen" ] && LOESEN=1

echo "=============================================="
echo " Spiegel-Diagnose  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=============================================="

echo
echo "[1] Crontab — laufen beide Push-Zeilen?"
CRON="$(crontab -l 2>/dev/null || true)"
for zeile in push-live-save.sh push-bug-reports.sh; do
  if printf '%s\n' "$CRON" | grep -q "$zeile"; then
    echo "    OK      $zeile"
  else
    echo "    FEHLT   $zeile"
  fi
done

echo
echo "[2] Laeuft der Cron-Dienst ueberhaupt?"
if pgrep -x cron >/dev/null 2>&1 || pgrep -x crond >/dev/null 2>&1; then
  echo "    OK      cron laeuft"
else
  echo "    FEHLT   cron laeuft NICHT — dann feuert keine einzige Zeile."
  echo "            Beheben:  systemctl start cron && systemctl enable cron"
fi

echo
echo "[3] Steht der Auto-Deploy? (er zieht mit --ff-only)"
git fetch -q origin main 2>/dev/null || echo "    (fetch fehlgeschlagen — Netz oder Zugang pruefen)"
LOKAL="$(git rev-parse HEAD 2>/dev/null || echo '?')"
FERN="$(git rev-parse origin/main 2>/dev/null || echo '?')"
echo "    lokal   ${LOKAL:0:8}"
echo "    origin  ${FERN:0:8}"
if [ "$LOKAL" != "$FERN" ]; then
  VORAUS="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo '?')"
  ZURUECK="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?')"
  echo "    -> $VORAUS Commit(s) VORAUS, $ZURUECK zurueck."
  if [ "$VORAUS" != "0" ] && [ "$VORAUS" != "?" ]; then
    echo "    -> Genau das blockiert --ff-only dauerhaft. Liegengeblieben:"
    git --no-pager log --oneline origin/main..HEAD | sed 's/^/         /'
  fi
fi
DRECK="$(git status --porcelain 2>/dev/null | head -5)"
[ -n "$DRECK" ] && { echo "    -> Ungespeicherte Aenderungen im Arbeitsbaum:"; printf '%s\n' "$DRECK" | sed 's/^/         /'; }

echo
echo "[4] Letzte Zeilen der Logs"
for log in /var/log/oly-deploy.log /var/log/oly-bug-reports.log /var/log/oly-live-save.log; do
  if [ -f "$log" ]; then
    echo "    --- $log (letzte 5) ---"
    tail -5 "$log" | sed 's/^/         /'
  else
    echo "    --- $log fehlt ---"
  fi
done

if [ "$LOESEN" = "1" ] && [ "$LOKAL" != "$FERN" ]; then
  echo
  echo "[5] --deploy-loesen: setze das Server-Repo hart auf origin/main."
  echo "    Verworfen wird alles oben unter [3] Genannte."
  git reset --hard origin/main && echo "    -> jetzt auf $(git rev-parse --short HEAD)"
fi

echo
echo "[6] Crons neu einrichten (idempotent) und einmal sofort spiegeln ..."
bash deploy/hetzner/install-live-save-cron.sh || echo "    WARNUNG: Cron-Einrichtung fehlgeschlagen."

echo
echo "=============================================="
echo " Fertig. Danach auf GitHub pruefen:"
echo "   Branch live-save und bug-reports muessen einen frischen Commit haben."
echo
echo " Steht oben irgendwo FEHLT und das Skript hat es nicht behoben,"
echo " diese Ausgabe an Claude geben — dann geht es gezielt weiter."
echo "=============================================="
