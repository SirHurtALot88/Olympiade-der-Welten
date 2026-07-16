#!/usr/bin/env bash
# Generalized multi-season balancing pipeline (draft -> S1 with auto-tune retry -> S2..N -> exports).
# Mirrors the proven run-balancing-s1s2-pipeline.sh structure, parametrized by FINAL_SEASON (default 5).
# Phase-4 exports read the isolated per-run DB (OLY_APP_SQLITE_PATH), so the tables actually populate.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FINAL_SEASON="${FINAL_SEASON:-5}"
OUT="${OUT:-outputs/balancing-s1s${FINAL_SEASON}-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export OLY_LONG_RUN_ALLOW_DEV_SERVER="${OLY_LONG_RUN_ALLOW_DEV_SERVER:-0}"
export OLY_LONG_RUN_BALANCE_PROFILE="${OLY_LONG_RUN_BALANCE_PROFILE:-iterate}"
export OLY_LONG_RUN_PLANNER_MAX_ROUNDS="${OLY_LONG_RUN_PLANNER_MAX_ROUNDS:-5}"
export OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES="${OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES:-5}"
export OLY_UNIFIED_PICK="${OLY_UNIFIED_PICK:-1}"
export OLY_LONG_RUN_OUTPUT_DIR="$OUT"

log() { echo "[balancing-multiseason] $(date -Iseconds) $*" | tee -a "$OUT/pipeline.log"; }

observe_slow() {
  local phase="$1" start="$2" season="${3:-}"
  local elapsed=$(( $(date +%s) - start ))
  local args=(--output-dir "$OUT" --slow-phase "$phase" --duration-ms $(( elapsed * 1000 )))
  [[ -n "$season" ]] && args+=(--season-id "$season")
  node --import tsx scripts/append-long-run-observation.ts "${args[@]}" 2>/dev/null || true
}

observe_latest_audit() {
  local audit_json
  audit_json=$(ls -t "$OUT"/long-run-audit-season_end-"${SAVE_ID}".json 2>/dev/null | head -1)
  [[ -f "$audit_json" ]] && node --import tsx scripts/append-long-run-observation.ts \
    --output-dir "$OUT" --from-audit "$audit_json" 2>/dev/null || true
}

# S1: play to season_end with up to 2 attempts, auto-tuning on organic peak-corridor RED.
run_s1_with_tune_retry() {
  local attempt=1
  while [[ $attempt -le 2 ]]; do
    log "S1 season_end (attempt $attempt)"
    local START=$(date +%s)
    if OLY_LONG_RUN_SAVE_ID="$SAVE_ID" OLY_LONG_RUN_FINAL_SEASON=1 OLY_LONG_RUN_STOP_AFTER=season_end \
      OLY_LONG_RUN_LABEL="Balancing S1 attempt $attempt" \
      node --import tsx scripts/long-run-sandbox-s1-s6.ts 2>&1 | tee "$OUT/phase-s1-attempt${attempt}.log"; then
      observe_slow season_end "$START" season-1
      observe_latest_audit
      if grep -qE "AUDIT RED.*organic_peak_net_corridor|organic_peak_net_corridor.*RED" "$OUT/phase-s1-attempt${attempt}.log" 2>/dev/null; then
        log "S1 peak corridor RED — auto-tune attempt $attempt"
        node --import tsx scripts/long-run-auto-tune-organic.ts --save-id "$SAVE_ID" --season-id season-1 --apply 2>&1 | tee -a "$OUT/auto-tune-s1.log" || true
        attempt=$((attempt + 1)); continue
      fi
      log "S1 season_end complete"; return 0
    fi
    observe_slow season_end "$START" season-1
    observe_latest_audit
    if grep -q "organic_peak_net_corridor" "$OUT/phase-s1-attempt${attempt}.log" 2>/dev/null; then
      node --import tsx scripts/long-run-auto-tune-organic.ts --save-id "$SAVE_ID" --season-id season-1 --apply 2>&1 | tee -a "$OUT/auto-tune-s1.log" || true
      attempt=$((attempt + 1)); continue
    fi
    log "S1 sandbox non-zero exit without peak tune path"; return 1
  done
  log "S1 peak tune retries exhausted"; return 1
}

# Season s (>=2): advance one season to season_end once; auto-tune on RED (benefits the next season).
run_season() {
  local s="$1"; local sid="season-$s"
  log "S$s season_end"
  local START=$(date +%s)
  OLY_LONG_RUN_SAVE_ID="$SAVE_ID" OLY_LONG_RUN_FINAL_SEASON="$s" OLY_LONG_RUN_STOP_AFTER=season_end \
    OLY_LONG_RUN_LABEL="Balancing S$s" \
    node --import tsx scripts/long-run-sandbox-s1-s6.ts 2>&1 | tee "$OUT/phase-s${s}.log"
  observe_slow season_end "$START" "$sid"
  observe_latest_audit
  if grep -qE "organic_peak_net_corridor" "$OUT/phase-s${s}.log" 2>/dev/null; then
    log "S$s peak RED — auto-tune"
    node --import tsx scripts/long-run-auto-tune-organic.ts --save-id "$SAVE_ID" --season-id "$sid" --apply 2>&1 | tee -a "$OUT/auto-tune-s${s}.log" || true
  fi
}

log "OUT=$OUT FINAL_SEASON=$FINAL_SEASON"
log "Phase 1: Draft gate"
PHASE1_START=$(date +%s)
node --import tsx scripts/long-run-sandbox-s1-s6.ts 2>&1 | tee "$OUT/phase1-draft.log"
observe_slow draft "$PHASE1_START"
SAVE_ID=$(grep -oE 'fresh-season-1-[0-9]+' "$OUT/phase1-draft.log" | head -1)
if [[ -z "$SAVE_ID" ]]; then log "ERROR: no SAVE_ID"; exit 1; fi
echo "OUT=$OUT" > "$OUT/run-manifest.txt"
echo "SAVE_ID=$SAVE_ID" >> "$OUT/run-manifest.txt"
log "SAVE_ID=$SAVE_ID"

run_s1_with_tune_retry || log "WARN: S1 completed with audit warnings"
log "Proactive league-delta tune after S1"
node --import tsx scripts/long-run-auto-tune-organic.ts --save-id "$SAVE_ID" --season-id season-1 --apply 2>&1 | tee -a "$OUT/auto-tune-s1-league.log" || true

for (( s=2; s<=FINAL_SEASON; s++ )); do
  run_season "$s"
done

log "Phase 4: Exports"
# Point export/report scripts at the isolated per-run DB (see run-balancing-s1s2-pipeline.sh).
export OLY_APP_SQLITE_PATH="$OUT/balancing-run.sqlite"
npx tsx scripts/multiseason-final-audit.ts --save-id "$SAVE_ID" --history > "$OUT/multiseason-final-audit-history.txt" 2>&1 || true
npx tsx scripts/export-team-kpi-table.ts --save-id "$SAVE_ID" --output "$OUT/team-kpi-table.md" 2>&1 | tee "$OUT/export-kpi.log" || true
npx tsx scripts/export-team-finance-season-table.ts --save-id "$SAVE_ID" > "$OUT/team-finance-season-table.md" 2>&1 || true
npx tsx scripts/export-balancing-save-review.ts --save-id "$SAVE_ID" --output-dir "$OUT" --seasons "$FINAL_SEASON" > "$OUT/balancing-save-review.out" 2>&1 || true
npx tsx scripts/export-player-progression-rankings.ts --save-id "$SAVE_ID" > "$OUT/player-progression-rankings.md" 2>&1 || true
npx tsx scripts/dump-facility-levels.ts --save-id "$SAVE_ID" > "$OUT/facility-levels.txt" 2>&1 || true
node --import tsx scripts/analyze-long-run-performance.ts --output-dir "$OUT" 2>&1 | tee "$OUT/performance-analysis.log" || true
node --import tsx scripts/generate-balancing-report.ts --save-id "$SAVE_ID" --output-dir "$OUT" --seasons "$FINAL_SEASON" 2>&1 | tee "$OUT/balancing-report.log" || true

log "DONE save=$SAVE_ID out=$OUT seasons=$FINAL_SEASON"
