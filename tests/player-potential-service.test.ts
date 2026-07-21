import { describe, expect, it } from "vitest";

import {
  applySeasonEndPotentialUpdate,
  buildPotentialAiUsagePreview,
  buildPlayerDevelopmentInsight,
  buildPlayerPotentialRecord,
  buildPlayerScoutPotential,
  buildPlayerScoutPotentialFromGameState,
  buildPotentialRangeStarSlots,
  potentialScoreToStars,
  revealPlayerPotentialRecord,
  shouldShowPotentialRangeStars,
} from "@/lib/progression/player-potential-service";
import { buildPlayerAxisStarProfile } from "@/lib/scouting/player-axis-star-rating";

function makePlayer(overrides = {}) {
  return {
    id: "player-1",
    name: "Scout Kid",
    potential: 0,
    coreStats: { pow: 58, spe: 64, men: 70, soc: 52 },
    disciplineRatings: { tdm: 68, chess: 72 },
    traitsPositive: ["Ambitious", "Diligent"],
    traitsNegative: [],
    ...overrides,
  } as never;
}

describe("player potential service", () => {
  it("builds a flexible scout range instead of a hard skill ceiling", () => {
    const potential = buildPlayerScoutPotential({ player: { potential: 90 }, scoutingLevel: 2 });

    expect(potential.scoutRating).toBe(90);
    expect(potential.potentialRange).toEqual({ min: 82, max: 98 });
    expect(potential.starRating).toBe("5.0 Sterne");
    expect(potential.band).toBe("elite");
    expect(potential.ceilingMode).toBe("soft_range_no_hard_ceiling");
  });

  it("maps potential ranges to FM-style min/max star slots", () => {
    // Recalibrated CA/PO star curve with a real 0.5★ floor: weak players read as weak.
    expect(potentialScoreToStars(22)).toBe(0.5);
    expect(potentialScoreToStars(30)).toBe(1);
    expect(potentialScoreToStars(47)).toBe(2.5);
    expect(potentialScoreToStars(58)).toBe(3.5);
    expect(potentialScoreToStars(70)).toBe(4.5);
    expect(potentialScoreToStars(78)).toBe(5);
    // Sub-floor scores clamp to 0.5★, not the old 1.5★ floor.
    expect(potentialScoreToStars(10)).toBe(0.5);
    expect(shouldShowPotentialRangeStars(58, 78)).toBe(true);
    expect(shouldShowPotentialRangeStars(88, 93)).toBe(false);

    const slots = buildPotentialRangeStarSlots(58, 78);
    expect(slots[3]).toMatchObject({ minFill: 0.5, maxFill: 1, showUncertain: true });
    expect(slots[4]).toMatchObject({ minFill: 0, maxFill: 1, showUncertain: true });
  });

  it("turns high potential into training speed and economy preview premiums", () => {
    const potential = buildPlayerScoutPotential({ player: { potential: 95 }, scoutingLevel: 5 });

    expect(potential.trainingSpeedMultiplier).toBeGreaterThan(1);
    expect(potential.marketValuePotentialPremiumPct).toBeGreaterThan(0);
    expect(potential.salaryExpectationPremiumPct).toBeGreaterThan(0);
    expect(potential.reasons).toContain("market_value_potential_premium_preview");
  });

  it("caps market and salary premium when scout confidence is low", () => {
    const low = buildPlayerScoutPotential({ player: { potential: 95 }, scoutingLevel: 0 });
    const high = buildPlayerScoutPotential({ player: { potential: 95 }, scoutingLevel: 5 });

    expect(low.marketValuePotentialPremiumPct).toBeLessThan(high.marketValuePotentialPremiumPct);
    expect(low.salaryExpectationPremiumPct).toBeLessThan(high.salaryExpectationPremiumPct);
    expect(low.reasons).toContain("low_confidence_caps_premium");
  });

  it("keeps missing potential neutral and auditable", () => {
    const potential = buildPlayerScoutPotential({ player: { potential: 0 } });

    expect(potential.scoutRating).toBeNull();
    expect(potential.trainingSpeedMultiplier).toBe(1);
    expect(potential.certainty).toBe("missing_source");
    expect(potential.warnings).toContain("potential_source_missing");
  });

  it("generates a CA-decoupled potential distribution with a thin elite tail", () => {
    // Regression guard for the CA→PO HEADROOM generator. Potential is drawn as
    // CA + a decoupled gap (`GAP_QUANTILE_ANCHORS` / `seedToPotentialGap` in
    // player-potential-service.ts): an upside draw ABOVE current ability that is
    // independent of CA. This replaces the earlier absolute-PO curve, which drew
    // a score with a median well above the median CA and floored it at CA
    // (`max(rawRoll, CA)`) — automatically lifting genuinely weak players to a
    // ~2.5★ floor and making the CA→PO gap suspiciously stable/CA-coupled.
    //
    // The gap curve is deliberately TIGHT and right-skewed: most players carry
    // little headroom (median ~0.5★), the elite tail stays THIN (the top is NOT
    // broadened — a 3★→5★ wonder kid is a rare outlier), and genuine low-ceiling
    // players persist. Each synthetic player gets a realistic, low-centered CA
    // (median ~40, a deterministic min-of-two-hashes mirroring the real catalog)
    // so the gap shows through without the [35,99] band dominating.
    const N = 6000;
    const stars: number[] = [];
    for (let i = 0; i < N; i += 1) {
      const h1 = ((i * 2654435761) % 100000) / 100000;
      const h2 = ((i * 40503 + 12345) % 100000) / 100000;
      const base = 20 + Math.min(h1, h2) * 68;
      const player = makePlayer({
        id: `dist-${i}`,
        coreStats: { pow: base, spe: base, men: base, soc: base },
        traitsPositive: [],
        traitsNegative: [],
      });
      const record = buildPlayerPotentialRecord({ saveId: "dist-check", player });
      stars.push(potentialScoreToStars(record.hiddenPotentialScore!));
    }
    stars.sort((a, b) => a - b);
    const median = stars[Math.floor(0.5 * (N - 1))]!;
    const shareAtLeast = (threshold: number) => stars.filter((s) => s >= threshold).length / N;
    const shareAtMost = (threshold: number) => stars.filter((s) => s <= threshold).length / N;
    const pinnedAtFive = stars.filter((s) => s >= 4.99).length / N;

    // Lower-centered: median stays in the ~2.5-3.0★ band, not lifted to ~4.3★.
    expect(median).toBeGreaterThanOrEqual(2.2);
    expect(median).toBeLessThanOrEqual(3.0);
    // Thin elite tail — the top is NOT broadened (well under the old ~40% pin).
    expect(pinnedAtFive).toBeLessThan(0.14);
    expect(shareAtLeast(4.5)).toBeLessThan(0.22);
    // ...genuine high-ceiling talent still exists (rare 3★→5★ wonder kids).
    expect(shareAtLeast(4.0)).toBeGreaterThan(0.1);
    // ...and so do genuine low-ceiling players — the bottom is not auto-lifted.
    expect(shareAtMost(1.5)).toBeGreaterThan(0.1);
  });

  it("generates stable save-specific hidden potential records", () => {
    // Mid-CA player (CA ~45): potential is now CA + a save-specific gap draw, so
    // the [35,99] band must not bind for the save-variation to show. A very low CA
    // would let a small gap round back down to the 35 floor in more than one save
    // (collapsing the records); a very high CA would saturate at the 99/5★ ceiling.
    // A mid CA keeps both bounds off so the gap draw shows through.
    const player = makePlayer({ coreStats: { pow: 45, spe: 45, men: 45, soc: 45 } });
    const first = buildPlayerPotentialRecord({ saveId: "save-a", player });
    const second = buildPlayerPotentialRecord({ saveId: "save-a", player });
    const otherSave = buildPlayerPotentialRecord({ saveId: "save-b", player });

    expect(first.hiddenPotentialScore).toBe(second.hiddenPotentialScore);
    expect(first.hiddenPotentialScore).not.toBe(otherSave.hiddenPotentialScore);
    expect(first.source).toBe("generated");
  });

  it("uses saved potential records and scouting office level to narrow uncertainty", () => {
    const player = makePlayer();
    const gameState = {
      season: { id: "season-1" },
      playerPotential: [
        {
          playerId: "player-1",
          potentialBand: "high",
          hiddenPotentialScore: 84,
          confidence: 0,
          source: "generated",
        },
      ],
    } as never;

    const level0 = buildPlayerScoutPotentialFromGameState({ gameState, player, saveId: "save-a", scoutingLevel: 0 });
    const level3 = buildPlayerScoutPotentialFromGameState({ gameState, player, saveId: "save-a", scoutingLevel: 3 });

    expect(level3.confidence).toBeGreaterThan(level0.confidence);
    expect(level3.potentialRange!.max - level3.potentialRange!.min).toBeLessThan(
      level0.potentialRange!.max - level0.potentialRange!.min,
    );
  });

  it("reveals scout info without changing the hidden save-stable potential score", () => {
    const player = makePlayer();
    const record = buildPlayerPotentialRecord({ saveId: "save-a", player });

    const unscouted = revealPlayerPotentialRecord({ record, scoutingLevel: 0 });
    const scouted = revealPlayerPotentialRecord({ record, scoutingLevel: 3 });

    expect(unscouted.hiddenPotentialScore).toBe(record.hiddenPotentialScore);
    expect(scouted.hiddenPotentialScore).toBe(record.hiddenPotentialScore);
    expect(scouted.source).toBe("scouted");
    expect(scouted.confidence).toBeGreaterThan(unscouted.confidence);
    expect(scouted.revealedPotentialRange!.max - scouted.revealedPotentialRange!.min).toBeLessThan(
      unscouted.revealedPotentialRange!.max - unscouted.revealedPotentialRange!.min,
    );
  });

  it("does not display a potential ceiling below current rating", () => {
    const player = makePlayer({ rating: 82, potential: 60, traitsNegative: ["Lazy"] });
    const insight = buildPlayerDevelopmentInsight({
      player,
      currentRating: 82,
      scoutPotential: buildPlayerScoutPotential({ player: { potential: 60 }, scoutingLevel: 3 }),
    });

    expect(insight.potentialRangeRaw?.max).toBeLessThan(82);
    expect(insight.potentialRangeDisplay).toEqual({ min: 82, max: 82 });
    expect(insight.potentialLabel).toBe("Regression Risk");
    expect(insight.warnings).toContain("potential_range_below_current_clamped");
  });

  it("turns low confidence into wider range and scout warning", () => {
    const player = makePlayer({ potential: 84 });
    const low = buildPlayerDevelopmentInsight({
      player,
      currentRating: 62,
      scoutPotential: buildPlayerScoutPotential({ player: { potential: 84 }, scoutingLevel: 0 }),
    });
    const high = buildPlayerDevelopmentInsight({
      player,
      currentRating: 62,
      scoutPotential: buildPlayerScoutPotential({ player: { potential: 84 }, scoutingLevel: 5 }),
    });

    expect((low.potentialRangeRaw!.max - low.potentialRangeRaw!.min)).toBeGreaterThan(
      high.potentialRangeRaw!.max - high.potentialRangeRaw!.min,
    );
    expect(low.warnings).toContain("scout_confidence_low");
  });

  it("uses growth traits and risk traits for outlook and recommendation", () => {
    const diligent = buildPlayerDevelopmentInsight({
      player: makePlayer({ potential: 92, traitsPositive: ["Diligent", "Disciplined", "Motivated"], traitsNegative: [] }),
      currentRating: 60,
      scoutPotential: buildPlayerScoutPotential({ player: { potential: 92 }, scoutingLevel: 5 }),
    });
    const risky = buildPlayerDevelopmentInsight({
      player: makePlayer({ potential: 58, traitsPositive: [], traitsNegative: ["Lazy", "Diva"] }),
      currentRating: 66,
      scoutPotential: buildPlayerScoutPotential({ player: { potential: 58 }, scoutingLevel: 2 }),
    });

    expect(diligent.growthOutlook).toBe("breakout");
    expect(diligent.recommendation).toContain("Prospect");
    expect(risky.growthOutlook).toBe("regression_risk");
    expect(risky.risk).toBe("high");
  });

  it("exposes net development factors for training and development systems", () => {
    const insight = buildPlayerDevelopmentInsight({
      player: makePlayer({ rating: 55, potential: 88, traitsPositive: ["Diligent", "Motivated"] }),
      currentRating: 55,
      scoutPotential: buildPlayerScoutPotential({ player: { potential: 88 }, scoutingLevel: 4 }),
    });

    expect(insight.netDevelopmentXP).toEqual(expect.any(Number));
    expect(insight.developmentFactors.potentialGapFactor).toBeGreaterThan(1);
    expect(insight.developmentFactors.trainingFormFactor).toBeGreaterThan(1);
    expect(insight.developmentFactors.routeFitFactor).toBeGreaterThan(0);
    expect(insight.developmentFactors.regressionPressure).toBeGreaterThanOrEqual(0);
    expect(insight.reasonChips.length).toBeGreaterThan(0);
  });

  it("lets AI contexts value potential differently from current ability", () => {
    const prospect = makePlayer({ id: "prospect", rating: 45, potential: 92, traitsPositive: ["Diligent"] });
    const veteran = makePlayer({ id: "veteran", rating: 82, potential: 84, traitsPositive: [] });

    const rebuildProspect = buildPotentialAiUsagePreview({
      player: prospect,
      context: "rebuild",
      currentRating: 45,
      marketValue: 20,
      scoutPotential: buildPlayerScoutPotential({ player: { potential: 92 }, scoutingLevel: 5 }),
    });
    const winNowProspect = buildPotentialAiUsagePreview({
      player: prospect,
      context: "win_now",
      currentRating: 45,
      marketValue: 20,
      scoutPotential: buildPlayerScoutPotential({ player: { potential: 92 }, scoutingLevel: 5 }),
    });
    const winNowVeteran = buildPotentialAiUsagePreview({
      player: veteran,
      context: "win_now",
      currentRating: 82,
      marketValue: 40,
      scoutPotential: buildPlayerScoutPotential({ player: { potential: 84 }, scoutingLevel: 5 }),
    });

    expect(rebuildProspect.potentialPriority).toBeGreaterThan(winNowProspect.potentialPriority);
    expect(winNowVeteran.currentPriority).toBeGreaterThan(winNowProspect.currentPriority);
  });

  it("blocks toxic high-potential risk harder for high-harmony contexts", () => {
    const toxic = makePlayer({ rating: 70, potential: 94, traitsNegative: ["Diva", "Lazy"] });
    const balanced = buildPotentialAiUsagePreview({
      player: toxic,
      context: "balanced",
      currentRating: 70,
      marketValue: 35,
      scoutPotential: buildPlayerScoutPotential({ player: { potential: 94 }, scoutingLevel: 5 }),
    });
    const harmony = buildPotentialAiUsagePreview({
      player: toxic,
      context: "high_harmony",
      currentRating: 70,
      marketValue: 35,
      scoutPotential: buildPlayerScoutPotential({ player: { potential: 94 }, scoutingLevel: 5 }),
    });

    expect(harmony.riskPenalty).toBeGreaterThan(balanced.riskPenalty);
    expect(harmony.recommendation).toBe("avoid");
  });

  it("changes expected salary premium preview without changing contract salary", () => {
    const rosterContractSalary = 12.5;
    const lowConfidence = buildPlayerScoutPotential({ player: { potential: 94 }, scoutingLevel: 0 });
    const highConfidence = buildPlayerScoutPotential({ player: { potential: 94 }, scoutingLevel: 5 });
    const lowExpectedPremium = rosterContractSalary * (lowConfidence.salaryExpectationPremiumPct / 100);
    const highExpectedPremium = rosterContractSalary * (highConfidence.salaryExpectationPremiumPct / 100);

    expect(highExpectedPremium).toBeGreaterThan(lowExpectedPremium);
    expect(rosterContractSalary).toBe(12.5);
  });

  it("always applies season-end score drift and stores axis snapshot", () => {
    const target = makePlayer();
    const record = buildPlayerPotentialRecord({ saveId: "save-a", player: target });
    const gameState = {
      season: { id: "season-1" },
      players: [target],
      disciplines: [
        { id: "d_pow", name: "Pow", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 1 },
        { id: "d_spe", name: "Spe", category: "speed", displayOrder: 2, originalOrder: 2, playerCount: 1 },
        { id: "d_men", name: "Men", category: "mental", displayOrder: 3, originalOrder: 3, playerCount: 1 },
        { id: "d_soc", name: "Soc", category: "social", displayOrder: 4, originalOrder: 4, playerCount: 1 },
      ],
    } as never;

    const updated = applySeasonEndPotentialUpdate({
      saveId: "save-a",
      seasonId: "season-1",
      player: target,
      record,
      growthOutlook: "stable",
      gameState,
    });

    expect(updated.hiddenPotentialScore).not.toBe(record.hiddenPotentialScore);
    expect(updated.lastSeasonSnapshot?.seasonId).toBe("season-1");
    expect(updated.lastSeasonSnapshot?.hiddenPotentialScore).toBe(record.hiddenPotentialScore);
    expect(updated.hiddenPotentialCeilingByAxis).toBeDefined();
    expect(updated.hiddenAttributeCeiling).toBeDefined();
  });

  it("drifts axis ceilings by at most 1 star per season", () => {
    const target = makePlayer();
    const record = buildPlayerPotentialRecord({ saveId: "save-a", player: target });
    const gameState = {
      season: { id: "season-1" },
      players: [target],
      disciplines: [
        { id: "d_pow", name: "Pow", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 1 },
        { id: "d_spe", name: "Spe", category: "speed", displayOrder: 2, originalOrder: 2, playerCount: 1 },
        { id: "d_men", name: "Men", category: "mental", displayOrder: 3, originalOrder: 3, playerCount: 1 },
        { id: "d_soc", name: "Soc", category: "social", displayOrder: 4, originalOrder: 4, playerCount: 1 },
      ],
    } as never;
    const before = buildPlayerAxisStarProfile({ gameState, player: target });
    const beforeRecord = applySeasonEndPotentialUpdate({
      saveId: "save-a",
      seasonId: "season-1",
      player: target,
      record,
      growthOutlook: "stable",
      gameState,
    });
    const snapshot = beforeRecord.lastSeasonSnapshot!;

    for (const axis of ["pow", "spe", "men", "soc"] as const) {
      const delta = Math.abs((beforeRecord.hiddenPotentialCeilingByAxis?.[axis] ?? 0) - snapshot.byAxis[axis]);
      expect(delta).toBeLessThanOrEqual(1);
    }
    expect(before.overall).toBeGreaterThan(0);
  });
});
