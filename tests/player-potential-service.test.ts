import { describe, expect, it } from "vitest";

import { buildPlayerScoutPotential } from "@/lib/progression/player-potential-service";

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
});
