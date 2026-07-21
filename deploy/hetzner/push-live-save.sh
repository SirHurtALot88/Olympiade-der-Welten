#!/usr/bin/env bash
# push-live-save.sh — auf dem Hetzner-Server ausfuehren.
#
# Kopiert die Live-Spielstand-SQLite aus dem laufenden Docker-Container und pusht sie
# (gzip-komprimiert) auf den GitHub-Branch "live-save". Von dort liest Claude den
# aktuellen Save. So kann ein Bug in genau deinem aktiven Spielstand reproduziert werden.
#
# Bewusst so gebaut:
#   - Es wird NUR der eigene Branch "live-save" gepusht → main bleibt unberuehrt,
#     der Auto-Deploy (der main pollt) baut NICHT neu, das Spiel laeuft ohne Unterbrechung.
#   - Der Arbeitsbaum wird NICHT angefasst (eigener temporaerer Git-Index) → Auto-Deploy
#     bleibt sauber.
#   - Nutzt den bereits gespeicherten Git-Zugang (wie auto-deploy.sh) — keine Tokens hier.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_DIR"

COMPOSE="deploy/hetzner/docker-compose.yml"
BRANCH="live-save"
TMP_DB="/tmp/oly-live.sqlite"
TMP_GZ="/tmp/oly-live.sqlite.gz"

echo "[1/3] Live-Save aus dem Container kopieren ..."
docker compose -f "$COMPOSE" cp oly-app:/app/data/persistence/oly-app.sqlite "$TMP_DB"
gzip -cf "$TMP_DB" > "$TMP_GZ"
rm -f "$TMP_DB"
echo "      Groesse: $(du -h "$TMP_GZ" | cut -f1)"

echo "[2/3] Commit bauen (main + Arbeitsbaum bleiben unberuehrt) ..."
# Bewusst ein ELTERNLOSER Einzel-Commit + Force-Push: der Branch "live-save" bleibt so
# immer genau EIN Commit (~wenige MB) statt bei jedem Cron-Lauf zu wachsen → kein Repo-Muell.
export GIT_INDEX_FILE=/tmp/oly-live-index
rm -f "$GIT_INDEX_FILE"
git read-tree --empty
BLOB="$(git hash-object -w "$TMP_GZ")"
git update-index --add --cacheinfo 100644 "$BLOB" "data/online-saves/hetzner-live.sqlite.gz"
TREE="$(git write-tree)"
COMMIT="$(printf 'chore(saves): live Hetzner save snapshot' | git commit-tree "$TREE")"
unset GIT_INDEX_FILE
rm -f "$TMP_GZ"

echo "[3/3] Push nach GitHub (Branch $BRANCH) ..."
git push -f origin "$COMMIT:refs/heads/$BRANCH"

echo ""
echo "FERTIG — dein Live-Save liegt jetzt auf GitHub (Branch '$BRANCH')."
echo "Sag Claude Bescheid: 'live save ist da'."
