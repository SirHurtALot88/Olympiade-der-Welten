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

# 3) oly-app und lec-app UNABHAENGIG bauen & starten (16.11., Chris-Fund).
#
# VORHER: ein einziges "docker compose up -d --build" fuer BEIDE Dienste. Schlug lec-apps Build
# fehl (konkreter Anlass: Debian-APT-GPG-Fehler im gecachten Basis-Image, s. unten), brach der
# GESAMTE Befehl ab, BEVOR irgendein Container ersetzt wurde -- auch oly-app blieb dann auf dem
# alten Image stehen, obwohl der Git-Pull in Schritt 2 laengst erfolgreich war. Der alte Kommentar
# im Compose-File ("ein LEC-Build-Fehler betrifft den bereits laufenden oly-app-Container nicht")
# stimmte nur fuer den schon LAUFENDEN Container, nicht fuers NEUBAUEN -- das Gegenteil von dem,
# was er suggerierte. Dadurch stand der Server real von 14.11. 09:13 bis 16.11. komplett still,
# ohne dass irgendein Fehler das je offensichtlich gemacht haette (derselbe "schlaegt lautlos fehl"-
# Charakter wie die Spiegel-Ausfaelle oben).
#
# JETZT: separate Build+Start-Befehle je Dienst, genau wie die CI-Weiche
# (scripts/ci-nur-kartenschmiede.sh/ci-beruehrt.sh) zwischen Oly und den Nebenprojekten
# unterscheidet -- nur Dateien unter apps/LEC/ bzw. docs/enterich-cards/ zaehlen als
# LEC-relevant, alles andere als Oly-relevant. Ein fehlgeschlagener lec-app-Build (oder
# umgekehrt) wird nur noch als WARNUNG geloggt, wirft den Deploy aber NICHT um (derselbe
# "Fehler hier darf den Deploy nicht umwerfen"-Stil wie bei 'docker image prune' und dem
# Cron-Install unten). Zusaetzlicher Nebeneffekt: wird nur ein Dienst beruehrt, baut auch nur
# der neu -- kein verschwendeter LEC-Build bei einer reinen Oly-Aenderung und umgekehrt.
#
# '--pull' bei JEDEM Build: behebt den akuten Fund vom 16.11. an der Wurzel. Der GPG-Fehler
# ("At least one invalid signature was encountered") kam nicht von einem toten Debian-Spiegel,
# sondern vom lokal gecachten 'node:22-bookworm-slim'-Basis-Image, dessen eingebauter
# debian-archive-keyring inzwischen zu alt fuer Debians aktuelle Signierschluessel war -- Docker
# zieht ein FROM-Image nie von selbst neu, auch wenn es laengst veraltet ist. '--pull' erzwingt
# bei jedem Build einen frischen Zug der Basis-Images, bevor gebaut wird.
DATEIEN="$(git diff --name-only "$LOCAL" "$REMOTE")"
LEC_MUSTER='^(apps/LEC/|docs/enterich-cards/)'
LEC_BERUEHRT=0
OLY_BERUEHRT=0
if grep -q -E "$LEC_MUSTER" <<<"$DATEIEN"; then LEC_BERUEHRT=1; fi
if grep -q -v -E "$LEC_MUSTER" <<<"$DATEIEN"; then OLY_BERUEHRT=1; fi

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

if [ "$OLY_BERUEHRT" = "1" ]; then
  log "Oly-relevante Aenderungen -- baue und starte oly-app neu ..."
  if compose build --pull oly-app && compose up -d oly-app; then
    log "oly-app: Deploy fertig."
  else
    log "WARNUNG: oly-app-Build/-Start fehlgeschlagen -- lec-app/caddy bleiben davon unberuehrt."
  fi
else
  log "Keine Oly-relevanten Aenderungen -- oly-app wird nicht neu gebaut."
fi

if [ "$LEC_BERUEHRT" = "1" ]; then
  log "LEC-relevante Aenderungen -- baue und starte lec-app neu ..."
  if compose build --pull lec-app && compose up -d lec-app; then
    log "lec-app: Deploy fertig."
  else
    log "WARNUNG: lec-app-Build/-Start fehlgeschlagen -- oly-app bleibt davon unberuehrt."
  fi
else
  log "Keine LEC-relevanten Aenderungen -- lec-app wird nicht neu gebaut."
fi

# caddy baut nie (festes 'caddy:2'-Image) -- nur sicherstellen, dass es laeuft bzw. eine
# geaenderte Caddyfile/Env uebernimmt. Guenstig genug, um das jeden Lauf zu tun.
compose up -d caddy

# Geaenderte Caddyfile wirklich laden: `up -d` allein tut dafuer NICHTS (die Compose-Konfiguration
# ist unveraendert, der Container wird nicht neu erzeugt), und die Datei ist als EINZELDATEI
# gemountet -- `git pull` ersetzt sie durch eine neue Inode, der Container sieht weiter die alte.
# Ein Neustart des Containers bindet den Pfad neu (Ausfall ~1-2 s, Zertifikate liegen im Volume
# caddy-data). Nur bei tatsaechlicher Aenderung, nicht bei jedem Lauf.
if grep -q -x 'deploy/hetzner/Caddyfile' <<<"$DATEIEN"; then
  log "Caddyfile geaendert -- starte caddy neu ..."
  compose restart caddy || log "WARNUNG: caddy-Neustart fehlgeschlagen -- Caddyfile ggf. von Hand laden."
fi

# 3b) Alte, ungenutzte Images wegraeumen (E1, Fund F10: kein Deploy-Skript tat das bisher).
#
# Jeder erfolgreiche Build oben hinterlaesst das VORHERIGE Image als "dangling" (ohne Tag,
# niemand zeigt mehr drauf), weil `compose up -d` den Container ersetzt, das alte Image aber
# nicht loescht. Seit Chromium im Image steckt (E1), kostet jedes dieser Images mehrere
# hundert MB zusaetzlich (Plan Abschnitt 4.2, ~0,6-0,75 GB) -- das summiert sich ueber viele
# Deploys zur alten "no space left on device"-Falle (CLAUDE.md, 01.09.), nur eine Ebene
# hoeher (Images statt Git-Historie).
#
# `docker image prune -f` entfernt NUR dangling Images (keinen Tag, kein laufender Container
# zeigt drauf) -- das laufende oly-app-/lec-app-/caddy-Image bleibt unberuehrt, weil der
# frisch gestartete Container genau darauf zeigt. Ein Fehler hier darf den Deploy NICHT
# umwerfen (wie bei den Push-Crons unten): das Spiel laeuft, nur die Platte raeumt sich
# diesmal nicht auf.
if ! docker image prune -f >/dev/null; then
  log "WARNUNG: 'docker image prune' fehlgeschlagen — Deploy ist trotzdem durch."
fi

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
