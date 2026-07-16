// term: seasonPlannerEngine
// id: seasonPlannerLastResult
// type: datasource
// subtype: JavascriptQuery
// page: Einsatzliste
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Recalculates exhaustion-driven current_score_x10 for Spieltag 1–10 in correct chronological order.
//   Why this exists:
//   - If users save matchdays out of order (e.g., save ST2 first, then ST1), a single recompute
//     for the currently selected spieltag can leave ST2 with an outdated / non-fatigued current_score.
//   - This query forces a deterministic recompute from ST1 -> ST10.
//
//   Season behavior:
//   - Lineups are stored as season=1.
//   - Fatigue/exhaustion is computed season-agnostic inside updateCurrentScoreX10Query.
//   - To ensure we recompute the correct persisted rows, we temporarily set currentSeasonEinsatz to 1.
//
// Returns:
//   { ok: boolean, processed: number, notes: string[] }
;

const notes = [];
const originalSpieltag = Number(selectSpieltag.value || 1);
const originalSeason = Number(currentSeasonEinsatz.value || 1);

try {
  if (originalSeason !== 1) {
    await currentSeasonEinsatz.setValue(1);
  }

  let processed = 0;
  for (let st = 1; st <= 10; st++) {
    await selectSpieltag.setValue(st);
    await updateCurrentScoreX10Query.trigger();
    processed++;
  }

  return { ok: true, processed, notes };
} catch (e) {
  console.warn('[recalculateAllExhaustion] failed', e);
  notes.push(String(e?.message || e));
  return { ok: false, processed: 0, notes };
} finally {
  // restore UI state
  try {await selectSpieltag.setValue(originalSpieltag);} catch (e) {}
  try {await currentSeasonEinsatz.setValue(originalSeason);} catch (e) {}
}
