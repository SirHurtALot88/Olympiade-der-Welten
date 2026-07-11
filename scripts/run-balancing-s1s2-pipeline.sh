#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${OUT:-outputs/balancing-s1s2-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export OLY_LONG_RUN_ALLOW_DEV_SERVER="${OLY_LONG_RUN_ALLOW_DEV_SERVER:-0}"
export OLY_LONG_RUN_BALANCE_PROFILE="${OLY_LONG_RUN_BALANCE_PROFILE:-iterate}"
export OLY_LONG_RUN_PLANNER_MAX_ROUNDS="${OLY_LONG_RUN_PLANNER_MAX_ROUNDS:-5}"
export OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES="${OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES:-5}"
export OLY_UNIFIED_PICK="${OLY_UNIFIED_PICK:-1}"
export OLY_LONG_RUN_OUTPUT_DIR="$OUT"

log() { echo "[balancing-s1s2] $(date -Iseconds) $*" | tee -a "$OUT/pipeline.log"; }

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

run_s1_with_tune_retry() {
  local attempt=1
  while [[ $attempt -le 2 ]]; do
    log "Phase 2 attempt $attempt: S1 season_end"
    PHASE2_START=$(date +%s)
    if OLY_LONG_RUN_SAVE_ID="$SAVE_ID" OLY_LONG_RUN_FINAL_SEASON=1 OLY_LONG_RUN_STOP_AFTER=season_end \
      OLY_LONG_RUN_LABEL="Balancing S1 attempt $attempt" \
      node --import tsx scripts/long-run-sandbox-s1-s6.ts 2>&1 | tee "$OUT/phase2-s1-attempt${attempt}.log"; then
      observe_slow season_end "$PHASE2_START" season-1
      observe_latest_audit season_end
      if grep -qE "AUDIT RED.*organic_peak_net_corridor|organic_peak_net_corridor.*RED" "$OUT/phase2-s1-attempt${attempt}.log" 2>/dev/null; then
        log "Peak corridor RED — auto-tune attempt $attempt"
        node --import tsx scripts/long-run-auto-tune-organic.ts --save-id "$SAVE_ID" --season-id season-1 --apply 2>&1 | tee -a "$OUT/auto-tune-s1.log" || true
        attempt=$((attempt + 1))
        continue
      fi
      log "S1 season_end complete"
      return 0
    fi
    observe_slow season_end "$PHASE2_START" season-1
    observe_latest_audit season_end
    if grep -q "organic_peak_net_corridor" "$OUT/phase2-s1-attempt${attempt}.log" 2>/dev/null; then
      node --import tsx scripts/long-run-auto-tune-organic.ts --save-id "$SAVE_ID" --season-id season-1 --apply 2>&1 | tee -a "$OUT/auto-tune-s1.log" || true
      attempt=$((attempt + 1))
      continue
    fi
    log "S1 sandbox non-zero exit without peak tune path"
    return 1
  done
  log "S1 peak tune retries exhausted"
  return 1
}

log "OUT=$OUT"
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

log "Phase 3: S2 season_end"
PHASE3_START=$(date +%s)
OLY_LONG_RUN_SAVE_ID="$SAVE_ID" OLY_LONG_RUN_FINAL_SEASON=2 OLY_LONG_RUN_STOP_AFTER=season_end \
  OLY_LONG_RUN_LABEL="Balancing S2" \
  node --import tsx scripts/long-run-sandbox-s1-s6.ts 2>&1 | tee "$OUT/phase3-s2.log"
observe_slow season_end "$PHASE3_START" season-2
observe_latest_audit season_end

if grep -qE "organic_peak_net_corridor" "$OUT/phase3-s2.log" 2>/dev/null; then
  log "S2 peak RED — auto-tune"
  node --import tsx scripts/long-run-auto-tune-organic.ts --save-id "$SAVE_ID" --season-id season-2 --apply 2>&1 | tee -a "$OUT/auto-tune-s2.log" || true
fi

log "Phase 4: Exports"
# The long-run harness writes to the isolated per-run DB (long-run-db-isolation clones the shared DB
# into $OUT/balancing-run.sqlite). The export/report scripts default to data/persistence/oly-app.sqlite
# and would otherwise fail with "Save not found". Point them at the isolated run DB so the tables
# (Marktwert/Cash/Spieleranzahl/Rollen) and the balancing report actually populate.
export OLY_APP_SQLITE_PATH="$OUT/balancing-run.sqlite"
npx tsx scripts/multiseason-final-audit.ts --save-id "$SAVE_ID" --history > "$OUT/multiseason-final-audit-history.txt" 2>&1 || true
npx tsx scripts/export-team-kpi-table.ts --save-id "$SAVE_ID" --output "$OUT/team-kpi-table.md" 2>&1 | tee "$OUT/export-kpi.log" || true
npx tsx scripts/export-team-finance-season-table.ts --save-id "$SAVE_ID" > "$OUT/team-finance-season-table.md" 2>&1 || true
npx tsx scripts/export-player-progression-rankings.ts --save-id "$SAVE_ID" > "$OUT/player-progression-rankings.md" 2>&1 || true
npx tsx scripts/dump-facility-levels.ts --save-id "$SAVE_ID" > "$OUT/facility-levels.txt" 2>&1 || true
node --import tsx scripts/analyze-long-run-performance.ts --output-dir "$OUT" 2>&1 | tee "$OUT/performance-analysis.log" || true
node --import tsx scripts/generate-balancing-report.ts --save-id "$SAVE_ID" --output-dir "$OUT" --seasons 2 2>&1 | tee "$OUT/balancing-report.log" || true

log "DONE save=$SAVE_ID out=$OUT"
