import { describe, expect, it } from "vitest";

import type { TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import { buildTeamStrategyScores } from "@/lib/foundation/team-strategy-score-service";
import { createDefaultTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";

function identity(partial: Partial<TeamIdentity> & Pick<TeamIdentity, "teamId">): TeamIdentity {
  return {
    teamId: partial.teamId,
    pow: partial.pow ?? 5,
    spe: partial.spe ?? 5,
    men: partial.men ?? 5,
    soc: partial.soc ?? 5,
    ambition: partial.ambition ?? 5,
    finances: partial.finances ?? 5,
    boardConfidence: partial.boardConfidence ?? 5,
    harmony: partial.harmony ?? 5,
    manners: partial.manners ?? 5,
    popularity: partial.popularity ?? 5,
    cooperation: partial.cooperation ?? 5,
    playerMin: partial.playerMin ?? 8,
    playerOpt: partial.playerOpt ?? 10,
  };
}

function profile(teamId: string, partial: Partial<TeamStrategyProfile> = {}): TeamStrategyProfile {
  return createDefaultTeamStrategyProfile(
    {
      teamId,
      id: teamId,
      name: partial.teamName ?? teamId,
      shortCode: teamId,
      color: "#000",
      cash: 100,
      reputation: 50,
      strategy: "balanced",
      division: "A",
      founded: 2026,
      logoRef: null,
    },
    identity({ teamId }),
  ) as TeamStrategyProfile;
}

describe("team strategy score service", () => {
  it("turns an aggressive contender profile into star/risk scores", () => {
    const scores = buildTeamStrategyScores({
      identity: identity({ teamId: "M-M", ambition: 10, finances: 7, harmony: 5, manners: 4 }),
      profile: {
        ...profile("M-M"),
        bias: {
          cashPriority: 3,
          valuePriority: 5,
          starPriority: 10,
          riskTolerance: 8,
          wageSensitivity: 3,
          sellForProfitAggression: 6,
          shortContractPreference: 4,
          longContractPreference: 7,
          loyaltyBias: 5,
          harmonyStrictness: 5,
          rosterDepthPreference: 4,
          eliteSmallRosterPreference: 9,
        },
      },
    });

    expect(scores.archetype).toBe("all_in_contender");
    expect(scores.starHunting).toBeGreaterThanOrEqual(75);
    expect(scores.riskAppetite).toBeGreaterThanOrEqual(70);
    expect(scores.overpayTolerance).toBeGreaterThan(scores.salaryDiscipline);
  });

  it("turns a ratio trader into salary/value scores", () => {
    const scores = buildTeamStrategyScores({
      identity: identity({ teamId: "R-R", ambition: 4, finances: 9, harmony: 8, manners: 6 }),
      profile: {
        ...profile("R-R"),
        strategySummary: "Fish-/Alien-Ratio-Team mit MW-zu-Gehalt Fokus.",
        bias: {
          cashPriority: 9,
          valuePriority: 9,
          starPriority: 5,
          riskTolerance: 4,
          wageSensitivity: 9,
          sellForProfitAggression: 6,
          shortContractPreference: 8,
          longContractPreference: 3,
          loyaltyBias: 7,
          harmonyStrictness: 8,
          rosterDepthPreference: 6,
          eliteSmallRosterPreference: 4,
        },
      },
    });

    expect(scores.archetype).toBe("salary_value_trader");
    expect(scores.valueDiscipline).toBeGreaterThanOrEqual(80);
    expect(scores.salaryDiscipline).toBeGreaterThanOrEqual(75);
    expect(scores.riskAppetite).toBeLessThan(scores.valueDiscipline);
  });

  it("keeps harmony teams conservative around team chemistry", () => {
    const scores = buildTeamStrategyScores({
      identity: identity({ teamId: "M-S", ambition: 5, finances: 5, harmony: 10, manners: 9, cooperation: 10 }),
      profile: {
        ...profile("M-S"),
        strategySummary: "Fun Squad mit Harmonie und Team Chemistry.",
        preferredArchetypes: ["harmony", "friendly", "social"],
        hardNoGos: ["toxic"],
        bias: {
          cashPriority: 4,
          valuePriority: 5,
          starPriority: 6,
          riskTolerance: 4,
          wageSensitivity: 5,
          sellForProfitAggression: 4,
          shortContractPreference: 4,
          longContractPreference: 7,
          loyaltyBias: 7,
          harmonyStrictness: 10,
          rosterDepthPreference: 5,
          eliteSmallRosterPreference: 5,
        },
      },
    });

    expect(scores.harmonyProtection).toBeGreaterThanOrEqual(90);
    expect(scores.themeCommitment).toBeGreaterThanOrEqual(75);
    expect(scores.riskAppetite).toBeLessThan(60);
  });
});
