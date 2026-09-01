#!/usr/bin/env bash
# git-repo-aufraeumen.sh — auf dem Hetzner-Server per Cron, woechentlich.
#
# ANLASS (01.09.): .git allein stand bei 6,8 GB, der Arbeitsbaum nur bei ~200 MB — fast die
# gesamte Root-Platte war reine Git-Historie, und genau das liess den Auto-Deploy-Build mit
# "no space left on device" abbrechen (s. auto-deploy.sh). Ursache: push-live-save.sh und
# push-bug-reports.sh bauen bei jedem Lauf (alle 10 bzw. 15 Minuten) bewusst einen ELTERNLOSEN
# Commit (git hash-object -w + git commit-tree, s. dort) und pushen ihn per Force-Push — das
# haelt den BRANCH auf GitHub klein (immer nur ein Commit), aber der lokal gebaute Commit haengt
# an KEINER Referenz und ist die Sekunde nach dem Push bereits ein "dangling object". Git raeumt
# sowas nie von selbst weg, das bleibt in .git/objects liegen, bis jemand `git gc` laufen laesst
# — bei einer ~25-MB-SQLite-Datei alle 10 Minuten, ueber Wochen, genau die beobachteten
# Gigabytes an reinem Muell.
#
# `git gc --prune=now` entfernt nur, was von KEINER lokalen Referenz (Branch/Tag/Reflog) mehr
# erreichbar ist. Der aktuelle Checkout (main) bleibt unangetastet — das hier ist reines
# Aufraeumen, keine Aenderung an irgendeinem Dateiinhalt oder am Arbeitsbaum.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

VORHER="$(du -sh .git 2>/dev/null | cut -f1)"
log "Vor der Bereinigung: .git = ${VORHER:-?}"
git count-objects -v | sed 's/^/    /'

log "git gc --prune=now ..."
git gc --prune=now --quiet

NACHHER="$(du -sh .git 2>/dev/null | cut -f1)"
log "Nach der Bereinigung: .git = ${NACHHER:-?} (vorher: ${VORHER:-?})"
git count-objects -v | sed 's/^/    /'

log "Fertig."
