#!/usr/bin/env bash
# Resume S2→S10 for an existing fresh save after S1 completed.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${1:-outputs/long-run-fresh-s10-20260701-060200}"
SAVE_ID="${2:-fresh-season-1-1782878530467}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export OLY_LONG_RUN_ALLOW_DEV_SERVER="${OLY_LONG_RUN_ALLOW_DEV_SERVER:-0}"
export OLY_LONG_RUN_OUTPUT_DIR="$OUT"

log() { echo "[resume] $(date -Iseconds) $*" | tee -a "$OUT/pipeline-resume.log"; }

observe_slow() {
  local phase="$1" start="$2" season="${3:-}"
  local elapsed=$(( $(date +%s) - start ))
  local args=(--output-dir "$OUT" --slow-phase "$phase" --duration-ms $(( elapsed * 1000 )))
  [[ -n "$season" ]] && args+=(--season-id "$season")
  node --import tsx scripts/append-long-run-observation.ts "${args[@]}" 2>/dev/null || true
}

observe_audit() {
  local audit_json="$1"
  [[ -f "$audit_json" ]] && node --import tsx scripts/append-long-run-observation.ts \
    --output-dir "$OUT" --from-audit "$audit_json" 2>/dev/null || true
}

observe_latest_audit() {
  local phase="$1"
  local audit_json
  audit_json=$(ls -t "$OUT"/long-run-audit-"${phase}"-"${SAVE_ID}".json 2>/dev/null | head -1)
  observe_audit "$audit_json"
}

echo "OUT=$OUT" > "$OUT/run-manifest.txt"
echo "SAVE_ID=$SAVE_ID" >> "$OUT/run-manifest.txt"

log "Phase 3: S2"
PHASE3_START=$(date +%s)
OLY_LONG_RUN_SAVE_ID="$SAVE_ID" OLY_LONG_RUN_FINAL_SEASON=2 OLY_LONG_RUN_STOP_AFTER=season_end \
  OLY_LONG_RUN_LABEL="Fresh S10 S2" node --import tsx scripts/long-run-sandbox-s1-s6.ts 2>&1 | tee "$OUT/phase3-s2.log" || log "S2 non-zero exit"
observe_slow season_end "$PHASE3_START" season-2
observe_latest_audit season_end

log "Phase 4: Resilient S3-S10"
node --import tsx scripts/run-resilient-multiseason.ts --save-id "$SAVE_ID" --seasons 10 --output-dir "$OUT" 2>&1 | tee "$OUT/phase4-s3-s10.log" || log "Resilient non-zero exit"
if [[ -f "$OUT/RUN-PAUSED.json" ]]; then
  log "RUN-PAUSED detected — see long-run-observations.md"
fi

log "Phase 5: Exports"
npx tsx scripts/multiseason-final-audit.ts --save-id "$SAVE_ID" --history > "$OUT/multiseason-final-audit-history.txt" 2>&1 || true
npx tsx scripts/export-team-kpi-table.ts --save-id "$SAVE_ID" --output "$OUT/team-kpi-table.md" 2>&1 | tee "$OUT/export-kpi.log" || true
npx tsx scripts/export-team-finance-season-table.ts --save-id "$SAVE_ID" > "$OUT/team-finance-season-table.md" 2>&1 || true
npx tsx scripts/export-player-progression-rankings.ts --save-id "$SAVE_ID" > "$OUT/player-progression-rankings.md" 2>&1 || true
npx tsx scripts/dump-facility-levels.ts --save-id "$SAVE_ID" > "$OUT/facility-levels.txt" 2>&1 || true
node --import tsx scripts/generate-long-run-s10-recap.ts --save-id "$SAVE_ID" --output-dir "$OUT" 2>&1 | tee "$OUT/phase5-recap.log" || true

log "DONE"
