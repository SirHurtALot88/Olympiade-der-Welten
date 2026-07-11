import { describe, expect, it } from "vitest";

import type { Team, TeamIdentity, TeamStrategyProfile } from "@/lib/data/olyDataTypes";
import {
  getDevelopmentWeightedFacilityUpgradeDiscount,
  getTeamDevelopmentTendency,
} from "@/lib/foundation/team-development-tendency";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";

function createTeam(overrides: Partial<Team> = {}): Team {
  return {
    teamId: "X-X",
    shortCode: "X-X",
    name: "Example Team",
    budget: 100,
    cash: 100,
    identityId: "X-X",
    humanControlled: false,
    rosterLimit: 20,
    ...overrides,
  };
}

function createIdentity(teamId: string, overrides: Partial<TeamIdentity> = {}): TeamIdentity {
  return {
    teamId,
    playerType: "C",
    pow: 5,
    spe: 5,
    men: 5,
    soc: 5,
    ambition: 5,
    finances: 5,
    boardConfidence: 5,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: 7,
    playerOpt: 10,
    ...overrides,
  };
}

function createMinimalGameState(teamId: string) {
  return {
    teams: [createTeam({ teamId, shortCode: teamId, name: teamId })],
    teamIdentities: [createIdentity(teamId)],
    season: { id: "s1" },
    seasonState: {},
    rosters: [],
  } as Parameters<typeof getTeamStrategyProfile>[0];
}

describe("team-development-tendency", () => {
  it("scores teacher-style profiles higher than generic cash teams without shortCode gates", () => {
    const teachersProfile = getTeamStrategyProfile(createMinimalGameState("T-T"), "T-T");
    const cashProfile = getTeamStrategyProfile(createMinimalGameState("C-C"), "C-C");

    const teachers = getTeamDevelopmentTendency({
      team: createTeam({ teamId: "T-T", shortCode: "T-T", name: "Terrible Teachers" }),
      identity: createIdentity("T-T"),
      profile: teachersProfile,
    });
    const cashCreators = getTeamDevelopmentTendency({
      team: createTeam({ teamId: "C-C", shortCode: "C-C", name: "Cash Creators" }),
      identity: createIdentity("C-C", { pow: 8, spe: 4, men: 4, soc: 4 }),
      profile: cashProfile,
    });

    expect(teachers.score).toBeGreaterThan(0.4);
    expect(teachers.score).toBeGreaterThan(cashCreators.score);
    expect(teachers.trainingCenterBonusPct).toBeGreaterThan(cashCreators.trainingCenterBonusPct);
    expect(teachers.trainingFacilityTargetLevel).toBeGreaterThan(cashCreators.trainingFacilityTargetLevel);
    expect(teachers.reasons.length).toBeGreaterThan(0);
  });

  it("scales facility upgrade discount softly by tendency and facility type", () => {
    const tendency = getTeamDevelopmentTendency({
      team: createTeam(),
      profile: {
        strategySummary: "Develop youth prospects with mentor teachers",
        preferredArchetypes: ["teacher", "mentor"],
        bias: {
          valuePriority: 7,
          starPriority: 5,
          loyaltyBias: 8,
          harmonyStrictness: 8,
          rosterDepthPreference: 3,
          eliteSmallRosterPreference: 7,
        },
      } as TeamStrategyProfile,
    });

    const trainingDiscount = getDevelopmentWeightedFacilityUpgradeDiscount({
      baseUpgradeCost: 100,
      facilityId: "training_center",
      tendency,
    });
    const scoutingDiscount = getDevelopmentWeightedFacilityUpgradeDiscount({
      baseUpgradeCost: 100,
      facilityId: "scouting_office",
      tendency,
    });
    const unrelatedDiscount = getDevelopmentWeightedFacilityUpgradeDiscount({
      baseUpgradeCost: 100,
      facilityId: "commercial_office",
      tendency,
    });

    expect(trainingDiscount).toBeLessThan(100);
    expect(scoutingDiscount).toBeGreaterThan(trainingDiscount);
    expect(unrelatedDiscount).toBe(100);
  });
});
