#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${OUT:-outputs/balancing-s5-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export OLY_LONG_RUN_ALLOW_DEV_SERVER="${OLY_LONG_RUN_ALLOW_DEV_SERVER:-0}"
export OLY_LONG_RUN_BALANCE_PROFILE="${OLY_LONG_RUN_BALANCE_PROFILE:-iterate}"
export OLY_LONG_RUN_PLANNER_MAX_ROUNDS="${OLY_LONG_RUN_PLANNER_MAX_ROUNDS:-5}"
export OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES="${OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES:-5}"
export OLY_UNIFIED_PICK="${OLY_UNIFIED_PICK:-1}"
export OLY_LONG_RUN_OUTPUT_DIR="$OUT"

log() { echo "[balancing-s5] $(date -Iseconds) $*" | tee -a "$OUT/pipeline.log"; }

observe_slow() {
  local phase="$1" start="$2" season="${3:-}"
  local elapsed=$(( $(date +%s) - start ))
  local args=(--output-dir "$OUT" --slow-phase "$phase" --duration-ms $(( elapsed * 1000 )))
  [[ -n "$season" ]] && args+=(--season-id "$season")
  node --import tsx scripts/append-long-run-observation.ts "${args[@]}" 2>/dev/null || true
}

observe_latest_audit() {
  local phase="$1"
  local audit_json
  audit_json=$(ls -t "$OUT"/long-run-audit-"${phase}"-"${SAVE_ID}".json 2>/dev/null | head -1)
  [[ -f "$audit_json" ]] && node --import tsx scripts/append-long-run-observation.ts \
    --output-dir "$OUT" --from-audit "$audit_json" 2>/dev/null || true
}

run_exports() {
  log "Exports"
  node --import tsx scripts/generate-balancing-report.ts --save-id "$SAVE_ID" --output-dir "$OUT" --seasons 5 2>&1 | tee "$OUT/balancing-report.log" || true
  npx tsx scripts/multiseason-final-audit.ts --save-id "$SAVE_ID" --history > "$OUT/multiseason-final-audit-history.txt" 2>&1 || true
  npx tsx scripts/export-team-kpi-table.ts --save-id "$SAVE_ID" --output "$OUT/team-kpi-table.md" 2>&1 | tee "$OUT/export-kpi.log" || true
  npx tsx scripts/export-team-finance-season-table.ts --save-id "$SAVE_ID" > "$OUT/team-finance-season-table.md" 2>&1 || true
  npx tsx scripts/export-player-progression-rankings.ts --save-id "$SAVE_ID" > "$OUT/player-progression-rankings.md" 2>&1 || true
  npx tsx scripts/dump-facility-levels.ts --save-id "$SAVE_ID" > "$OUT/facility-levels.txt" 2>&1 || true
  node --import tsx scripts/analyze-long-run-performance.ts --output-dir "$OUT" 2>&1 | tee "$OUT/performance-analysis.log" || true
  OLY_LONG_RUN_SAVE_ID="$SAVE_ID" OLY_PICK_AUDIT_OUTPUT_DIR="$OUT/pick-audit" \
    node --import tsx scripts/pick-audit-preseason-fast.ts --save-id "$SAVE_ID" 2>&1 | tee "$OUT/pick-audit.log" || true
  if [[ -f "$OUT/strategic-transfer-market-by-team.csv" ]]; then
    cp "$OUT/strategic-transfer-market-by-team.csv" "$OUT/planned-vs-filler-by-team.csv"
  fi
}

log "OUT=$OUT profile=$OLY_LONG_RUN_BALANCE_PROFILE planner=${OLY_LONG_RUN_PLANNER_MAX_ROUNDS}/${OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES}"

if [[ -n "${SAVE_ID:-}" ]]; then
  log "Resume mode SAVE_ID=$SAVE_ID"
  echo "OUT=$OUT" > "$OUT/run-manifest.txt"
  echo "SAVE_ID=$SAVE_ID" >> "$OUT/run-manifest.txt"
  echo "PROFILE=$OLY_LONG_RUN_BALANCE_PROFILE" >> "$OUT/run-manifest.txt"
else
  log "Phase A: Draft gate (fresh save)"
  PHASE1_START=$(date +%s)
  node --import tsx scripts/long-run-sandbox-s1-s6.ts 2>&1 | tee "$OUT/phase1-draft.log"
  observe_slow draft "$PHASE1_START"
  SAVE_ID=$(grep -oE 'fresh-season-1-[0-9]+' "$OUT/phase1-draft.log" | head -1)
  if [[ -z "$SAVE_ID" ]]; then log "ERROR: no SAVE_ID"; exit 1; fi
  echo "OUT=$OUT" > "$OUT/run-manifest.txt"
  echo "SAVE_ID=$SAVE_ID" >> "$OUT/run-manifest.txt"
  echo "PROFILE=$OLY_LONG_RUN_BALANCE_PROFILE" >> "$OUT/run-manifest.txt"
  log "SAVE_ID=$SAVE_ID"
fi

export OLY_LONG_RUN_SAVE_ID="$SAVE_ID"

log "Phase B: Resilient S1→S5"
PHASEB_START=$(date +%s)
node --import tsx scripts/run-resilient-multiseason.ts --save-id "$SAVE_ID" --seasons 5 --output-dir "$OUT" 2>&1 | tee "$OUT/phase-resilient-s1s5.log"
RESILIENT_EXIT=$?
observe_slow resilient "$PHASEB_START"

if [[ -f "$OUT/RUN-PAUSED.json" ]]; then
  log "RUN-PAUSED — see RUN-PAUSED.json"
  run_exports
  exit "${RESILIENT_EXIT:-2}"
fi

run_exports

if [[ "$OLY_LONG_RUN_BALANCE_PROFILE" == "iterate" && "${RUN_AUDIT_PROFILE:-0}" == "1" ]]; then
  log "Phase D: optional audit-profile re-run (set RUN_AUDIT_PROFILE=1)"
  export OLY_LONG_RUN_BALANCE_PROFILE=audit
  node --import tsx scripts/run-resilient-multiseason.ts --save-id "$SAVE_ID" --seasons 5 --output-dir "$OUT/audit-profile" 2>&1 | tee "$OUT/phase-audit-profile.log" || true
fi

log "DONE save=$SAVE_ID out=$OUT"
