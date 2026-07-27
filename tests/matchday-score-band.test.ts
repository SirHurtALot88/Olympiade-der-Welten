import { describe, expect, it } from "vitest";

import {
  calculateMatchdayProjectedPreview,
  resolveSlotRolesForDiscipline,
  type MatchdayIntensityStage,
} from "@/lib/lineups/matchday-slot-roles";
import { scoreLegacyLineupDisciplineSide } from "@/lib/lineups/legacy-score-engine";
import { computeProjectedScoreBand, getIntensityScoreRange } from "@/lib/lineups/matchday-score-band";
import { INTENSITY_SCORE_RANGE, seededIntensityShare } from "@/lib/lineups/legacy-lineup-modifiers";

const INTENSITIES: MatchdayIntensityStage[] = ["conserve", "normal", "push"];

// Single, neutral-role, zero-fatigue/zero-rivalry slot: attributeStats=null forces roleModifier
// to 0 in the preview, and no fatigue/morale/mutator/team-power/captain modifiers are wired into
// the engine call, so the pre-intensity anchor is exactly the raw discipline score on BOTH sides —
// the only thing that can still move the resolved score is the real seeded intensity draw.
function buildSingleEntrySideResult(intensity: MatchdayIntensityStage, playerId: string, disciplineId: string, matchdayId: string, baseScore: number) {
  return scoreLegacyLineupDisciplineSide({
    disciplineId,
    disciplineSide: "d1",
    matchdayId,
    entries: [{ disciplineId, disciplineSide: "d1", slotIndex: 0, playerId, activePlayerId: null }],
    disciplineScores: [{ playerId, disciplineId, score: baseScore }],
    requiredPlayers: 1,
    fatigueSourceStatus: "mapped",
    fatigueByPlayerId: { [playerId]: { count: 0, multiplier: 1 } },
    intensity,
  });
}

function buildDisplayedBand(intensity: MatchdayIntensityStage, baseScore: number) {
  const role = resolveSlotRolesForDiscipline("mini-dm", "Mini DM", 1)[0];
  return calculateMatchdayProjectedPreview({
    baseScore,
    role,
    attributeStats: null,
    currentFatigueCount: 0,
    requiredPlayers: 1,
    intensity,
    knownModifierBonus: 0,
    revealVariance: 0,
    rivalryPressure: 0,
  });
}

describe("matchday score variance: the displayed range now derives from the real resolve range", () => {
  it.each(INTENSITIES)("(a) resolved score for %s lies within the displayed projected range", (intensity) => {
    const baseScore = 50;
    const preview = buildDisplayedBand(intensity, baseScore);
    const result = buildSingleEntrySideResult(intensity, "band-test-player", "mini-dm", "matchday-band-test", baseScore);

    expect(preview.rangeLow).not.toBeNull();
    expect(preview.rangeHigh).not.toBeNull();
    expect(result.totalScore).toBeGreaterThanOrEqual(preview.rangeLow ?? 0);
    expect(result.totalScore).toBeLessThanOrEqual(preview.rangeHigh ?? 0);
    // The band must be non-degenerate (a real range, not a point) so this assertion is actually
    // exercising the fix and not passing vacuously.
    expect(preview.rangeHigh ?? 0).toBeGreaterThan(preview.rangeLow ?? 0);
  });

  it.each(INTENSITIES)("(a2) the displayed band for %s is EXACTLY [anchor + INTENSITY_SCORE_RANGE.min, anchor + .max]", (intensity) => {
    const baseScore = 77;
    const preview = buildDisplayedBand(intensity, baseScore);
    const range = INTENSITY_SCORE_RANGE[intensity];

    // knownModifierBonus=0, no fatigue/role modifier ⇒ baseRangeAnchor === baseScore exactly, and
    // rangeRiskSpread/rivalrySpread/revealVariance are all 0 here, so the band collapses to
    // precisely the real INTENSITY_SCORE_RANGE shifted by the anchor — proving there is no second,
    // independent formula left anywhere in the display path.
    expect(preview.rangeLow).toBe(Number((baseScore + range.min).toFixed(1)));
    expect(preview.rangeHigh).toBe(Number((baseScore + range.max).toFixed(1)));
  });

  it("(b) resolving the same matchday twice yields byte-identical scores (existing seed/idempotency still holds)", () => {
    const first = buildSingleEntrySideResult("push", "idempotent-player", "mini-dm", "matchday-idempotent", 62);
    const second = buildSingleEntrySideResult("push", "idempotent-player", "mini-dm", "matchday-idempotent", 62);

    expect(second.totalScore).toBe(first.totalScore);
    expect(second.intensityModifier).toBe(first.intensityModifier);
  });

  it("(c) different players, disciplines and matchdays draw independently (existing seededIntensityShare property)", () => {
    const shares = [
      seededIntensityShare("normal", "intensity|player-alpha|mini-dm|matchday-1"),
      seededIntensityShare("normal", "intensity|player-beta|mini-dm|matchday-1"),
      seededIntensityShare("normal", "intensity|player-alpha|fechten|matchday-1"),
      seededIntensityShare("normal", "intensity|player-alpha|mini-dm|matchday-2"),
    ];
    const distinctValues = new Set(shares.map((value) => String(value)));
    expect(distinctValues.size).toBeGreaterThan(1);
  });

  it("(d) conserve's displayed band is narrower than push's — the 'safe option' property holds", () => {
    const anchor = 60;
    const conserveBand = computeProjectedScoreBand({ baseRangeAnchor: anchor, intensity: "conserve" });
    const normalBand = computeProjectedScoreBand({ baseRangeAnchor: anchor, intensity: "normal" });
    const pushBand = computeProjectedScoreBand({ baseRangeAnchor: anchor, intensity: "push" });

    const width = (band: { rangeLow: number; rangeHigh: number }) => band.rangeHigh - band.rangeLow;
    expect(width(conserveBand)).toBeLessThan(width(normalBand));
    expect(width(conserveBand)).toBeLessThan(width(pushBand));
    // Matches INTENSITY_SCORE_RANGE directly: conserve is 1 point wide (-3..-2), push 4 points
    // wide (+2..+6) — an order of magnitude tighter, exactly reflecting "conserve is the safe
    // option" in absolute points, not a percentage approximation of it.
    expect(width(conserveBand)).toBeCloseTo(1, 5);
    expect(width(pushBand)).toBeCloseTo(4, 5);
  });

  it("push's real range is always positive (+2..+6) — owner's original absolute-points spec, unchanged", () => {
    const range = getIntensityScoreRange("push");
    expect(range.min).toBeGreaterThan(0);
    expect(range.max).toBeGreaterThan(0);
  });

  it("(e) existing score-engine behaviour is unaffected by this display-only fix", () => {
    // scoreLegacyLineupDisciplineSide / seededIntensityShare / INTENSITY_SCORE_RANGE are untouched
    // by this change — this is a regression guard alongside the full existing suite in
    // tests/legacy-lineup.test.ts and tests/legacy-matchday-resolve.test.ts, which assert exact
    // resolved totals and remain green.
    const a = buildSingleEntrySideResult("normal", "regression-player", "mini-dm", "matchday-regression", 40);
    const b = buildSingleEntrySideResult("normal", "regression-player", "mini-dm", "matchday-regression", 40);
    expect(a.totalScore).toBe(b.totalScore);
    expect(a.totalScore).toBe(40 + seededIntensityShare("normal", "intensity|regression-player|mini-dm|matchday-regression"));
  });
});
