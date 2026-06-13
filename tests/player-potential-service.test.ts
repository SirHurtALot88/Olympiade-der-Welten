import { describe, expect, it } from "vitest";

import {
  buildPlayerPotentialRecord,
  buildPlayerScoutPotential,
  buildPlayerScoutPotentialFromGameState,
  revealPlayerPotentialRecord,
} from "@/lib/progression/player-potential-service";

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
    expect(potential.starRating).toBe("4.5 Sterne");
    expect(potential.band).toBe("elite");
    expect(potential.ceilingMode).toBe("soft_range_no_hard_ceiling");
  });

  it("turns high potential into training speed and economy preview premiums", () => {
    const potential = buildPlayerScoutPotential({ player: { potential: 95 }, scoutingLevel: 5 });

    expect(potential.trainingSpeedMultiplier).toBeGreaterThan(1);
    expect(potential.marketValuePotentialPremiumPct).toBeGreaterThan(0);
    expect(potential.salaryExpectationPremiumPct).toBeGreaterThan(0);
    expect(potential.reasons).toContain("market_value_potential_premium_preview");
  });

  it("keeps missing potential neutral and auditable", () => {
    const potential = buildPlayerScoutPotential({ player: { potential: 0 } });

    expect(potential.scoutRating).toBeNull();
    expect(potential.trainingSpeedMultiplier).toBe(1);
    expect(potential.certainty).toBe("missing_source");
    expect(potential.warnings).toContain("potential_source_missing");
  });

  it("generates stable save-specific hidden potential records", () => {
    const player = makePlayer();
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
});
