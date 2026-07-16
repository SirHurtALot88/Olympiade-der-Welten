#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}"
CLEAN_FIRST="false"

for arg in "$@"; do
  case "$arg" in
    --clean)
      CLEAN_FIRST="true"
      ;;
  esac
done

cd "$PROJECT_DIR"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

if [[ "$CLEAN_FIRST" == "true" ]]; then
  npm run next:clean -- --port "$PORT"
else
  (lsof -ti "tcp:${PORT}" || true) | while read -r pid; do
    [[ -n "$pid" ]] || continue
    kill "$pid" >/dev/null 2>&1 || true
  done
fi

echo ""
echo "Starte Olympiade der Welten Foundation ..."
echo "Projekt: $PROJECT_DIR"
echo "Server:  $BASE_URL"
echo "Seite:   ${BASE_URL}/foundation"
echo ""

npx tsx server.ts &
SERVER_PID=$!

if ! npm run app:check-live -- --base-url="$BASE_URL" --timeout-ms=5000 --startup-retries=90 --startup-delay-ms=1000; then
  echo "Der Dev-Server wurde nicht rechtzeitig bereit."
  exit 1
fi

echo "Foundation ist bereit: ${BASE_URL}/foundation"
echo "Zum Beenden einfach Strg+C druecken."
wait "$SERVER_PID"
