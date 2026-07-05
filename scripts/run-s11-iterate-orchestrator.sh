#!/usr/bin/env bash
# Run S11 iterate loop: for each iteration restore→sell→buy→audit→review brief.
# Review/fix steps are manual or via Cursor subagents between iterations.
#
# Usage:
#   ./scripts/run-s11-iterate-orchestrator.sh 1 10
#   ./scripts/run-s11-iterate-orchestrator.sh 3 3   # single iteration
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FROM="${1:-1}"
TO="${2:-10}"
OUTPUT_DIR="${OUTPUT_DIR:-outputs/s11-iterate-10x}"
SAVE_ID="${SAVE_ID:-fresh-season-1-1783169019878}"
SOURCE_DB="${SOURCE_DB:-outputs/s1-s10-validated-run-1/balancing-run.sqlite}"

export OLY_APP_SQLITE_PATH="${OLY_APP_SQLITE_PATH:-data/persistence/oly-app.sqlite}"
export OLY_LONG_RUN_ISOLATED_DB=0

mkdir -p "$OUTPUT_DIR"

for i in $(seq "$FROM" "$TO"); do
  echo "=== S11 Iterate iteration $i / $TO ==="
  npx tsx scripts/run-s11-iterate-iteration.ts \
    --iteration "$i" \
    --output-dir "$OUTPUT_DIR" \
    --save-id "$SAVE_ID" \
    --source-db "$SOURCE_DB"

  npx tsx scripts/build-s11-reviewer-brief.ts \
    --iteration "$i" \
    --output-dir "$OUTPUT_DIR"

  npx tsx scripts/aggregate-s11-iterate-trend.ts \
    --output-dir "$OUTPUT_DIR"

  echo "Iteration $i done. Review: $OUTPUT_DIR/iter-$(printf '%02d' "$i")/REVIEW_PROMPT.md"
done

echo "Orchestrator complete. Trend: $OUTPUT_DIR/trend.md"
