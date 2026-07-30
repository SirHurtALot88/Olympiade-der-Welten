#!/usr/bin/env bash
# push-bug-reports.sh — auf dem Hetzner-Server ausfuehren.
#
# Holt die im Spiel gemeldeten Fehler (rote Flagge oben rechts) aus dem laufenden Container und
# spiegelt sie auf den GitHub-Branch "bug-reports". Erst damit sind Meldungen vom Live-Server
# ueberhaupt lesbar: geschrieben werden sie im Container-Dateisystem, und dort sieht sie sonst
# niemand ausser dem Container selbst.
#
# Bewusst so gebaut — dieselben Gruende wie bei push-live-save.sh:
#   - NUR der eigene Branch "bug-reports" wird gepusht → main bleibt unberuehrt, der Auto-Deploy
#     (der main pollt) baut NICHT neu, das Spiel laeuft ohne Unterbrechung.
#   - Der Arbeitsbaum wird NICHT angefasst (eigener temporaerer Git-Index) → Auto-Deploy bleibt sauber.
#   - Nutzt den bereits gespeicherten Git-Zugang (wie auto-deploy.sh) — keine Tokens hier.
#
# Warum ein ELTERNLOSER Commit + Force-Push und keine Historie: die Quelle der Wahrheit ist das
# Docker-Volume `oly-bug-reports`, in dem die Meldungen liegen bleiben. Der Branch ist nur ein
# Spiegel davon. So bleibt er immer genau EIN Commit gross statt bei jedem Cron-Lauf zu wachsen.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_DIR"

COMPOSE="deploy/hetzner/docker-compose.yml"
BRANCH="bug-reports"
TMP_DIR="/tmp/oly-bug-reports"

echo "[1/3] Meldungen aus dem Container kopieren ..."
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
# Fehlt der Ordner im Container, wurde schlicht noch nie etwas gemeldet — das ist kein Fehler.
if ! docker compose -f "$COMPOSE" cp oly-app:/app/data/bug-reports/. "$TMP_DIR" 2>/dev/null; then
  echo "      Noch keine Meldungen vorhanden — nichts zu tun."
  rm -rf "$TMP_DIR"
  exit 0
fi

REPORT_COUNT="$(find "$TMP_DIR" -maxdepth 1 -name 'bug-*.json' | wc -l | tr -d ' ')"
if [ "$REPORT_COUNT" = "0" ]; then
  echo "      Noch keine Meldungen vorhanden — nichts zu tun."
  rm -rf "$TMP_DIR"
  exit 0
fi
echo "      $REPORT_COUNT Meldung(en) gefunden."

echo "[2/3] Commit bauen (main + Arbeitsbaum bleiben unberuehrt) ..."
export GIT_INDEX_FILE=/tmp/oly-bug-reports-index
rm -f "$GIT_INDEX_FILE"
git read-tree --empty
while IFS= read -r FILE; do
  BLOB="$(git hash-object -w "$FILE")"
  git update-index --add --cacheinfo 100644 "$BLOB" "data/bug-reports/$(basename "$FILE")"
done < <(find "$TMP_DIR" -maxdepth 1 -name 'bug-*.json' | sort)
TREE="$(git write-tree)"
COMMIT="$(printf 'chore(bug-reports): %s Meldung(en) vom Live-Server' "$REPORT_COUNT" | git commit-tree "$TREE")"
unset GIT_INDEX_FILE
rm -rf "$TMP_DIR"

echo "[3/3] Push nach GitHub (Branch $BRANCH) ..."
git push -f origin "$COMMIT:refs/heads/$BRANCH"

echo ""
echo "FERTIG — die Meldungen liegen jetzt auf GitHub (Branch '$BRANCH')."
echo "Der Bugfixing-Agent liest sie von dort (siehe docs/BUGFIXING_AGENT.md)."
