#!/bin/zsh

set -euo pipefail

PROJECT_DIR="/Users/chrisfalk/Documents/Codex/Olympiade der Welten"
PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}"
TARGET_PATH="/foundation?view=season"

cd "$PROJECT_DIR"

is_server_ready() {
  curl -sSf --max-time 2 "${BASE_URL}${TARGET_PATH}" >/dev/null 2>&1
}

find_port_pid() {
  lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1
}

cleanup_stale_project_processes() {
  local pids
  pids="$(
    {
      pgrep -f "${PROJECT_DIR}.*server.ts" 2>/dev/null || true
      pgrep -f "${PROJECT_DIR}/scripts/start-oly-seasonstand.command" 2>/dev/null || true
    } | sort -u
  )"

  if [[ -z "$pids" ]]; then
    return 0
  fi

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    kill "$pid" >/dev/null 2>&1 || true
  done <<< "$pids"

  sleep 2
}

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo ""
echo "Starte Olympiade der Welten ..."
echo "Projekt: $PROJECT_DIR"
echo "Seite:   ${BASE_URL}${TARGET_PATH}"
echo ""

if is_server_ready; then
  echo "Server laeuft bereits. Browser wird geoeffnet ..."
  open "${BASE_URL}${TARGET_PATH}"
  exit 0
fi

EXISTING_PID="$(find_port_pid || true)"
if [[ -n "$EXISTING_PID" ]]; then
  echo "Port ${PORT} ist noch belegt (PID ${EXISTING_PID}), aber die Seite antwortet nicht."
  echo "Alte Oly-Prozesse werden beendet und neu gestartet ..."
  cleanup_stale_project_processes
fi

npm run dev &
SERVER_PID=$!

for _ in {1..60}; do
  if is_server_ready; then
    open "${BASE_URL}${TARGET_PATH}"
    echo "Browser wurde im Saisonstand geöffnet."
    echo "Zum Beenden einfach Strg+C drücken."
    wait "$SERVER_PID"
    exit 0
  fi
  sleep 1
done

echo "Der Server wurde nicht rechtzeitig erreichbar."
exit 1
