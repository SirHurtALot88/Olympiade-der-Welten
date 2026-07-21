#!/bin/bash
# SessionStart-Hook: stellt in Claude-Code-Web-Sessions die "Online-Saves" wieder her, damit
# jede frische Umgebung sofort die aktuellen Spielstaende hat (aus data/online-saves/ in den
# lokalen SQLite-Store). Rein lesend/lokal — kein Netzwerk, kein Git-Push.
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

# Online-Saves NUR in einen leeren Store laden (frische Umgebung) — niemals eine Umgebung
# ueberschreiben, in der schon echte Spielstaende liegen (--only-if-empty schuetzt davor).
if [ -f data/online-saves/manifest.json ]; then
  npm run saves:import -- --only-if-empty || echo "[session-start] save-import uebersprungen"
fi

echo "[session-start] Online-Saves importiert."
