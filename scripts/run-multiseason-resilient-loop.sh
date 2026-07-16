#!/bin/bash
# Auto-resuming driver around run-resilient-multiseason.ts.
#
# The sandbox environment occasionally recycles and silently kills long-running background
# processes (no crash log, no exit code — the process just disappears). run-resilient-multiseason.ts
# itself already loops season-by-season and only stops cleanly on completion or a real audit-RED
# pause (writing RUN-PAUSED.json). This wrapper adds a layer above that: if the underlying process
# ever disappears without writing RUN-PAUSED.json and without the save reaching the target season,
# it's treated as an environment kill and the run is simply re-invoked with the same save-id (which
# resumes from wherever the save currently is) — no manual re-triggering needed.
#
# Usage: ./scripts/run-multiseason-resilient-loop.sh <save-id> <target-seasons> <output-dir>
set -uo pipefail

SAVE_ID="$1"
TARGET_SEASONS="${2:-5}"
OUTPUT_DIR="$3"
PROGRESS_LOG="$OUTPUT_DIR/progress-log.md"
MAX_AUTO_RESUMES=25

mkdir -p "$OUTPUT_DIR"

log_progress() {
  echo "- $(date -u +"%Y-%m-%dT%H:%M:%SZ") — $1" >> "$PROGRESS_LOG"
}

unset OLY_LONG_RUN_ALLOW_DEV_SERVER
export OLY_UNIFIED_PICK=1
export OLY_LONG_RUN_BALANCE_PROFILE=iterate
export OLY_LONG_RUN_REQUIRE_NO_DEV_SERVER=1
export NODE_OPTIONS="--max-old-space-size=8192"

resume_count=0
while [ "$resume_count" -lt "$MAX_AUTO_RESUMES" ]; do
  resume_count=$((resume_count + 1))
  log_progress "run-multiseason-resilient-loop: Start Versuch $resume_count/$MAX_AUTO_RESUMES (Save $SAVE_ID)"
  node --import tsx scripts/run-resilient-multiseason.ts --save-id "$SAVE_ID" --seasons "$TARGET_SEASONS" --output-dir "$OUTPUT_DIR" >> "$OUTPUT_DIR/run.log" 2>&1
  EXIT_CODE=$?

  CURRENT_SEASON=$(node --import tsx -e "
    import { createPersistenceService } from '@/lib/persistence/persistence-service';
    const persistence = createPersistenceService();
    const save = persistence.getSaveById(process.env.SAVE_ID);
    console.log(save.gameState.season.id + ':' + save.gameState.gamePhase);
  " 2>/dev/null)
  log_progress "run-multiseason-resilient-loop: Prozess beendet (exit=$EXIT_CODE), Save-Stand: $CURRENT_SEASON"

  if echo "$CURRENT_SEASON" | grep -q "season-$TARGET_SEASONS:season_completed"; then
    log_progress "run-multiseason-resilient-loop: Ziel-Season $TARGET_SEASONS erreicht — fertig."
    exit 0
  fi

  if [ -f "$OUTPUT_DIR/RUN-PAUSED.json" ]; then
    PAUSE_AGE=$(( $(date +%s) - $(date -r "$OUTPUT_DIR/RUN-PAUSED.json" +%s 2>/dev/null || echo 0) ))
    if [ "$PAUSE_AGE" -lt 20 ]; then
      log_progress "run-multiseason-resilient-loop: RUN-PAUSED.json frisch geschrieben — echter Blocker, breche Auto-Resume ab. Bitte manuell prüfen."
      exit 2
    fi
  fi

  log_progress "run-multiseason-resilient-loop: Kein frischer PAUSED-Marker — vermutlich Umgebungs-Kill. Auto-Resume..."
  sleep 2
done

log_progress "run-multiseason-resilient-loop: Max. Auto-Resumes ($MAX_AUTO_RESUMES) erreicht ohne Zielerreichung."
exit 1
