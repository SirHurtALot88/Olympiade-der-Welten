import { describe, expect, it } from "vitest";

import {
  computeCompositeTopSixAverage,
  computeDisciplineTopSixImpact,
  computeTopSixAxisImpact,
  computeCandidateAxisTeamRankEstimates,
  formatTeamRankEstimateLabel,
} from "@/lib/market/transfermarkt-roster-impact";

describe("transfermarkt-roster-impact", () => {
  it("computes top-six axis impact for a candidate purchase", () => {
    const roster = [
      { pow: 80, spe: 70, men: 60, soc: 50 },
      { pow: 70, spe: 65, men: 55, soc: 45 },
      { pow: 60, spe: 60, men: 50, soc: 40 },
      { pow: 50, spe: 55, men: 45, soc: 35 },
      { pow: 40, spe: 50, men: 40, soc: 30 },
      { pow: 30, spe: 45, men: 35, soc: 25 },
      { pow: 20, spe: 40, men: 30, soc: 20 },
    ];
    const impact = computeTopSixAxisImpact(roster, { pow: 72, spe: 59, men: 59, soc: 57 }, 6);
    const powImpact = impact.find((row) => row.axis === "pow");

    expect(powImpact?.before).toBe(55);
    expect(powImpact?.after).toBeGreaterThan(powImpact?.before ?? 0);
    expect(computeCompositeTopSixAverage(impact, "after")).toBeGreaterThan(
      computeCompositeTopSixAverage(impact, "before") ?? 0,
    );
  });

  it("computes discipline top-six impact with candidate score", () => {
    const roster = [
      { disciplineRatings: { d1: 70, d2: 40 } },
      { disciplineRatings: { d1: 60, d2: 50 } },
      { disciplineRatings: { d1: 50, d2: 45 } },
    ];
    const impact = computeDisciplineTopSixImpact(
      roster,
      [{ disciplineId: "d1", disciplineName: "Battlefield", displayedScore: 82, tierWindow: "B-C" }],
      3,
    );

    expect(impact[0]?.beforeTopSixAvg).toBe(60);
    expect(impact[0]?.afterTopSixAvg).toBeGreaterThan(60);
    expect(impact[0]?.tierWindow).toBe("B-C");
  });

  it("estimates axis team rank with scouting uncertainty", () => {
    const roster = [
      { pow: 80, spe: 70, men: 60, soc: 50 },
      { pow: 70, spe: 65, men: 55, soc: 45 },
      { pow: 60, spe: 60, men: 50, soc: 40 },
    ];
    const candidate = { pow: 72, spe: 59, men: 59, soc: 57 };
    const exact = computeCandidateAxisTeamRankEstimates(roster, candidate, 80);
    const fuzzy = computeCandidateAxisTeamRankEstimates(roster, candidate, 20);

    expect(formatTeamRankEstimateLabel(exact.find((row) => row.axis === "pow"), 80)).toBe("#2/4");
    expect(formatTeamRankEstimateLabel(fuzzy.find((row) => row.axis === "pow"), 20)).toMatch(/ca\. #/);
  });
});
