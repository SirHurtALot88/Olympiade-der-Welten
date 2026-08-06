#!/bin/bash
# SessionStart-Hook: stellt in Claude-Code-Web-Sessions die Spielstaende wieder her, damit jede
# frische Umgebung sofort die AKTUELLEN Staende vom Hetzner-Server hat.
#
# WARUM ES ZWEI WEGE GAB — UND WARUM JETZT EINER FUEHRT:
#
# Bis hierher las dieser Hook ausschliesslich `data/online-saves/manifest.json` auf `main` (JSON-
# Exporte, geschrieben vom Auto-Export-Timer). Der Hetzner-Server pusht seinen echten Spielstand
# aber ueber `deploy/hetzner/push-live-save.sh` als ROHE SQLite auf den Branch `live-save` — ein
# Dateiname, der in keinem Manifest steht, auf einem Branch, den dieser Hook nie ansah.
#
# Folge: in `data/online-saves/` lagen ueber die gesamte Repo-Historie nur Smoke- und Audit-Saves,
# und keine Sitzung hatte je einen echten Spielstand. Fehler im laufenden Spiel liessen sich
# deshalb nicht am echten Stand nachstellen.
#
# Jetzt fuehrt der Hetzner-Weg: `live-save` traegt die vollstaendige Datenbank, also ALLE
# Spielstaende auf einmal und immer den Stand des letzten Cron-Laufs. Der Manifest-Weg bleibt als
# Rueckfall, falls der Branch fehlt.
set -euo pipefail

# Nur in der Remote-Umgebung (Claude Code on the web) laufen — lokal nichts tun.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Abhaengigkeiten sicherstellen (gecacht; nur falls node_modules fehlt).
if [ ! -d node_modules ]; then
  npm install
fi

STORE="data/persistence/oly-app.sqlite"
LIVE_BRANCH="${OLY_LIVE_SAVE_BRANCH:-live-save}"
LIVE_DATEI="data/online-saves/hetzner-live.sqlite.gz"

# Niemals eine Umgebung ueberschreiben, in der schon Spielstaende liegen — dieselbe Zusage wie
# `--only-if-empty` beim Manifest-Weg. Ein bereits vorhandener Store kann der Stand sein, an dem
# gerade gearbeitet wird.
if [ -s "$STORE" ]; then
  echo "[session-start] Store enthaelt bereits Spielstaende — Import uebersprungen."
  exit 0
fi

hole_hetzner_stand() {
  git fetch origin "$LIVE_BRANCH" --quiet 2>/dev/null || return 1
  git cat-file -e "origin/$LIVE_BRANCH:$LIVE_DATEI" 2>/dev/null || return 1

  local tmp_gz="/tmp/oly-live-import.gz"
  git show "origin/$LIVE_BRANCH:$LIVE_DATEI" > "$tmp_gz" 2>/dev/null || return 1
  # Halbe/leere Datei abfangen, BEVOR sie zum Spielstand wird.
  gunzip -t "$tmp_gz" 2>/dev/null || { rm -f "$tmp_gz"; return 1; }

  mkdir -p "$(dirname "$STORE")"
  gunzip -cf "$tmp_gz" > "$STORE" || { rm -f "$tmp_gz"; return 1; }
  rm -f "$tmp_gz"
  # `-wal`/`-shm` gehoeren zu einer anderen Datenbank und wuerden beim ersten Oeffnen auf diesen
  # frischen Stand angewandt — dieselbe Falle wie in deploy/hetzner/pull-repaired-save.sh.
  rm -f "${STORE}-wal" "${STORE}-shm"
  [ -s "$STORE" ] || return 1
  return 0
}

if hole_hetzner_stand; then
  echo "[session-start] Spielstaende vom Hetzner-Server geladen (Branch $LIVE_BRANCH)."
  exit 0
fi

echo "[session-start] Kein Hetzner-Stand auf '$LIVE_BRANCH' — falle auf die Manifest-Exporte zurueck."
if [ -f data/online-saves/manifest.json ]; then
  npm run saves:import -- --only-if-empty || echo "[session-start] save-import uebersprungen"
  echo "[session-start] Online-Saves importiert."
else
  echo "[session-start] Keine Spielstaende verfuegbar."
fi
