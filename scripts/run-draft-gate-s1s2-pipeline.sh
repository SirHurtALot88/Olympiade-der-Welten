#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${OUT:-outputs/draft-gate-s1s2-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"
export OLY_LONG_RUN_ALLOW_DEV_SERVER="${OLY_LONG_RUN_ALLOW_DEV_SERVER:-0}"
export OLY_LONG_RUN_BALANCE_PROFILE="${OLY_LONG_RUN_BALANCE_PROFILE:-iterate}"
export OLY_LONG_RUN_PLANNER_MAX_ROUNDS="${OLY_LONG_RUN_PLANNER_MAX_ROUNDS:-5}"
export OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES="${OLY_LONG_RUN_PLANNER_MAX_TEAM_CYCLES:-5}"
export OLY_UNIFIED_PICK="${OLY_UNIFIED_PICK:-1}"
export OLY_LONG_RUN_OUTPUT_DIR="$OUT"

log() { echo "[draft-gate] $(date -Iseconds) $*" | tee -a "$OUT/pipeline.log"; }

log "OUT=$OUT"
log "Phase 1: S1 draft only (STOP_AFTER=draft)"
PHASE1_START=$(date +%s)
OLY_LONG_RUN_STOP_AFTER=draft node --import tsx scripts/long-run-sandbox-s1-s6.ts 2>&1 | tee "$OUT/phase1-draft.log"
SAVE_ID=$(grep -oE 'fresh-season-1-[0-9]+' "$OUT/phase1-draft.log" | head -1)
if [[ -z "$SAVE_ID" ]]; then
  SAVE_ID=$(grep -oE 'STOP_AFTER=draft — Save `fresh-season-1-[0-9]+`' "$OUT/phase1-draft.log" | grep -oE 'fresh-season-1-[0-9]+' | head -1)
fi
if [[ -z "$SAVE_ID" ]]; then log "ERROR: no SAVE_ID"; exit 1; fi
echo "SAVE_ID=$SAVE_ID" >> "$OUT/run-manifest.txt"

AUDIT_JSON=$(ls -t "$OUT"/long-run-audit-draft-"${SAVE_ID}".json 2>/dev/null | head -1)
log "SAVE_ID=$SAVE_ID audit=$AUDIT_JSON"

log "Phase 1b: validate draft gate"
if ! node --import tsx scripts/validate-draft-gate.ts --save-id "$SAVE_ID" ${AUDIT_JSON:+--audit-json "$AUDIT_JSON"} 2>&1 | tee "$OUT/draft-gate-validation.json"; then
  log "DRAFT GATE FAILED — stopping before S1/S2"
  exit 2
fi

log "Phase 1c: validate draft theme gate (warn-only)"
node --import tsx scripts/validate-draft-theme-gate.ts --save-id "$SAVE_ID" 2>&1 | tee "$OUT/draft-theme-gate-validation.json"
if grep -q '"pass": false' "$OUT/draft-theme-gate-validation.json" 2>/dev/null; then
  log "DRAFT THEME GATE WARN — continuing to S1/S2"
fi

log "Phase 2: S1 season_end"
OLY_LONG_RUN_SAVE_ID="$SAVE_ID" OLY_LONG_RUN_FINAL_SEASON=1 OLY_LONG_RUN_STOP_AFTER=season_end \
  OLY_LONG_RUN_LABEL="Draft-gate S1" \
  node --import tsx scripts/long-run-sandbox-s1-s6.ts 2>&1 | tee "$OUT/phase2-s1.log"

log "Phase 3: S2 season_end"
OLY_LONG_RUN_SAVE_ID="$SAVE_ID" OLY_LONG_RUN_FINAL_SEASON=2 OLY_LONG_RUN_STOP_AFTER=season_end \
  OLY_LONG_RUN_LABEL="Draft-gate S2" \
  node --import tsx scripts/long-run-sandbox-s1-s6.ts 2>&1 | tee "$OUT/phase3-s2.log"

log "Phase 4: exports"
npx tsx scripts/export-team-kpi-table.ts --save-id "$SAVE_ID" --output "$OUT/team-kpi-table.md" 2>&1 | tee "$OUT/export-kpi.log" || true
node --import tsx scripts/generate-balancing-report.ts --save-id "$SAVE_ID" --output-dir "$OUT" 2>&1 | tee "$OUT/balancing-report.log" || true

log "DONE save=$SAVE_ID out=$OUT"
