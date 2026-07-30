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

# Build-Stempel fuer die Sidebar-Version-Badge (lib/app-version.ts). Wird von
# docker-compose.yml als build-arg an den Dockerfile-builder-Stage
# durchgereicht und dort vor `npm run build` als NEXT_PUBLIC_*-ENV gesetzt,
# damit Next.js die Werte ins Client-Bundle inlined.
export NEXT_PUBLIC_OLY_BUILD_SHA="$(git rev-parse HEAD)"
export NEXT_PUBLIC_OLY_BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "Build-Stempel: ${NEXT_PUBLIC_OLY_BUILD_SHA:0:7} @ ${NEXT_PUBLIC_OLY_BUILD_DATE}"

# 3) Neu bauen & starten (Container wird bei Aenderung automatisch ersetzt)
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

# 4) Push-Crons nachziehen (Live-Save, Bug-Meldungen).
#
# WARUM HIER: eine neue Cron-Zeile im Installer nuetzt nichts, solange niemand den Installer auf dem
# Server erneut ausfuehrt. Genau daran ist die Bug-Melde-Kette gescheitert — die Zeile fuer
# push-bug-reports.sh kam dazu, auf dem Server lief aber weiter die alte Crontab mit nur dem
# Live-Save, und keine einzige Meldung erreichte GitHub. Niemandem faellt das auf, weil nichts
# fehlschlaegt; es passiert nur schlicht nichts. Seitdem richtet sich jede neue Zeile beim naechsten
# Deploy selbst ein.
#
# Idempotent und still: aendert sich nichts, gibt es keine Ausgabe. Ein Fehler beim Crontab-Schreiben
# darf den Deploy NICHT umwerfen — das Spiel laeuft dann trotzdem, nur die Spiegelung haengt.
if ! bash deploy/hetzner/install-live-save-cron.sh --ensure-only; then
  log "WARNUNG: Push-Crons konnten nicht eingerichtet werden — Deploy ist trotzdem durch."
fi

log "Deploy fertig — jetzt auf Stand ${REMOTE:0:7}."
