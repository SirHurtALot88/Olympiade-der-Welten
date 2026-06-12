#!/bin/zsh

set -euo pipefail

PROJECT_DIR="/Users/chrisfalk/Documents/Codex/Olympiade der Welten"
PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}"
DEFAULT_PATH="${1:-/foundation}"
SECOND_PATH="${SECOND_PATH:-/foundation/legacy-lineup-lab}"
THIRD_PATH="${THIRD_PATH:-/foundation/legacy-resolve-lab}"

cd "$PROJECT_DIR"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo ""
echo "Starte Olympiade der Welten ..."
echo "Projekt: $PROJECT_DIR"
echo "Server:  $BASE_URL"
echo "Seite 1: ${BASE_URL}${DEFAULT_PATH}"
echo "Seite 2: ${BASE_URL}${SECOND_PATH}"
echo "Seite 3: ${BASE_URL}${THIRD_PATH}"
echo ""

npx next dev --hostname 0.0.0.0 --port "$PORT" &
SERVER_PID=$!

for _ in {1..60}; do
  if curl -sSf "${BASE_URL}${DEFAULT_PATH}" >/dev/null 2>&1; then
    open "${BASE_URL}${DEFAULT_PATH}"
    open "${BASE_URL}${SECOND_PATH}"
    open "${BASE_URL}${THIRD_PATH}"
    echo "Browser wurde geöffnet."
    echo "Zum Beenden einfach Strg+C drücken."
    wait "$SERVER_PID"
    exit 0
  fi
  sleep 1
done

echo "Der Server wurde nicht rechtzeitig erreichbar."
exit 1
