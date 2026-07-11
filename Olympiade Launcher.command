#!/bin/zsh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}"
HOME_PATH="/foundation?view=home"

cd "$PROJECT_DIR"

is_server_ready() {
  curl -sSf --max-time 2 "${BASE_URL}${HOME_PATH}" >/dev/null 2>&1
}

ensure_gameplay_smoke_save() {
  local output save_id save_name
  output="$(npm run ci:ensure-gameplay-smoke-save --silent 2>/dev/null || npm run ci:ensure-gameplay-smoke-save 2>&1 || true)"
  save_id="$(printf '%s' "$output" | node -e "const input=require('fs').readFileSync(0,'utf8'); try { const match=input.match(/\{[\s\S]*\}/); if (!match) process.exit(0); const data=JSON.parse(match[0]); process.stdout.write(String(data?.saveId ?? '')); } catch { process.stdout.write(''); }")"
  save_name="$(printf '%s' "$output" | node -e "const input=require('fs').readFileSync(0,'utf8'); try { const match=input.match(/\{[\s\S]*\}/); if (!match) process.exit(0); const data=JSON.parse(match[0]); process.stdout.write(String(data?.name ?? '')); } catch { process.stdout.write(''); }")"
  if [[ -n "$save_id" ]]; then
    if [[ -n "$save_name" ]]; then
      echo "Smoke-Spielstand: ${save_name} (${save_id})" >&2
    else
      echo "Smoke-Spielstand: ${save_id}" >&2
    fi
    printf '%s' "$save_id"
    return 0
  fi
  return 1
}

resolve_active_save_url() {
  local payload save_id save_name target_path smoke_save_id
  smoke_save_id="$(ensure_gameplay_smoke_save 2>/dev/null || true)"
  if [[ -n "$smoke_save_id" ]]; then
    echo "Aktiver Spielstand: CI Gameplay Smoke Save (${smoke_save_id})" >&2
    echo "${BASE_URL}${HOME_PATH}&saveId=${smoke_save_id}"
    return 0
  fi

  payload="$(curl -sSf --max-time 5 "${BASE_URL}/api/singleplayer-state?compact=foundation-initial" 2>/dev/null || true)"
  if [[ -z "$payload" ]]; then
    echo "${BASE_URL}${HOME_PATH}"
    return 0
  fi

  save_id="$(printf '%s' "$payload" | node -e "const input=require('fs').readFileSync(0,'utf8'); try { const data=JSON.parse(input); process.stdout.write(String(data?.save?.saveId ?? '')); } catch { process.stdout.write(''); }")"
  save_name="$(printf '%s' "$payload" | node -e "const input=require('fs').readFileSync(0,'utf8'); try { const data=JSON.parse(input); process.stdout.write(String(data?.save?.name ?? '')); } catch { process.stdout.write(''); }")"

  target_path="${HOME_PATH}"
  if [[ -n "$save_id" ]]; then
    target_path="${HOME_PATH}&saveId=${save_id}"
  fi

  if [[ -n "$save_name" && -n "$save_id" ]]; then
    echo "Aktiver Spielstand: ${save_name} (${save_id})" >&2
  elif [[ -n "$save_id" ]]; then
    echo "Aktiver Spielstand: ${save_id}" >&2
  fi

  echo "${BASE_URL}${target_path}"
}

find_port_pid() {
  lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1
}

cleanup_stale_project_processes() {
  local pids
  pids="$(
    {
      pgrep -f "${PROJECT_DIR}.*server.ts" 2>/dev/null || true
      pgrep -f "${PROJECT_DIR}/Spielen.command" 2>/dev/null || true
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
echo "Olympiade der Welten — Spielen"
echo "Projekt: $PROJECT_DIR"
echo "Home:    ${BASE_URL}${HOME_PATH}"
echo ""

if is_server_ready; then
  echo "Server laeuft bereits. Spielstand wird vorbereitet ..."
  open "$(resolve_active_save_url)"
  trap - EXIT INT TERM
  exit 0
fi

EXISTING_PID="$(find_port_pid || true)"
if [[ -n "$EXISTING_PID" ]]; then
  echo "Port ${PORT} ist noch belegt (PID ${EXISTING_PID}), aber die Seite antwortet nicht."
  echo "Alte Oly-Prozesse werden beendet und neu gestartet ..."
  kill "$EXISTING_PID" >/dev/null 2>&1 || true
  sleep 1
  cleanup_stale_project_processes
fi

npm run dev &
SERVER_PID=$!

for _ in {1..90}; do
  if is_server_ready; then
    echo "Spielstand wird vorbereitet ..."
    open "$(resolve_active_save_url)"
    echo "Browser wurde auf der Home-Seite geoeffnet."
    echo "Zum Beenden einfach Strg+C druecken."
    wait "$SERVER_PID"
    exit 0
  fi
  sleep 1
done

echo "Der Server wurde nicht rechtzeitig erreichbar."
exit 1
