#!/usr/bin/env bash
# Oly Auto-Deploy
# Prueft, ob auf dem GitHub-Branch (Standard: main) neue Commits liegen, und
# baut/startet Oly nur dann neu. Als Cron alle paar Minuten laufen lassen:
#   */5 * * * * /root/Olympiade-der-Welten/deploy/hetzner/auto-deploy.sh >> /var/log/oly-deploy.log 2>&1
#
# Nutzt den bereits gespeicherten Git-Zugang (credential.helper store) — es
# muessen KEINE Passwoerter/Token in dieser Datei oder bei GitHub liegen.
set -euo pipefail

BRANCH="${OLY_DEPLOY_BRANCH:-main}"

# Repo-Wurzel = zwei Ebenen ueber diesem Skript (deploy/hetzner/..)
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_DIR"

COMPOSE_FILE="deploy/hetzner/docker-compose.yml"
ENV_FILE="deploy/hetzner/.env"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# 1) Neuen Stand von GitHub holen (nur Infos, noch nichts anwenden)
git fetch origin "$BRANCH" --quiet

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/${BRANCH}")"

if [ "$LOCAL" = "$REMOTE" ]; then
  # Nichts Neues — still beenden (kein Log-Spam)
  exit 0
fi

log "Neue Aenderungen auf '${BRANCH}' gefunden (${LOCAL:0:7} -> ${REMOTE:0:7}). Deploye ..."

# 2) Sauber auf den neuen Stand ziehen (nur Vorwaerts-Merge, keine Konflikte)
git merge --ff-only "origin/${BRANCH}"

# 3) Neu bauen & starten (Container wird bei Aenderung automatisch ersetzt)
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

log "Deploy fertig — jetzt auf Stand ${REMOTE:0:7}."
