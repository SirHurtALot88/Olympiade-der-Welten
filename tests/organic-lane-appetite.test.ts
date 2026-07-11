import { describe, expect, it } from "vitest";

import {
  applyGmBiasToLaneAppetite,
  applyThemeAnchorToLaneAppetite,
  computeIdentityLaneAppetite,
} from "@/lib/ai/ai-needs-picks-compare-service";
import type { GameState, Player, Team, TeamGeneralManagerProfile, TeamIdentity, TeamStrategyBias } from "@/lib/data/olyDataTypes";

function identity(partial: Partial<TeamIdentity> & Pick<TeamIdentity, "teamId">): TeamIdentity {
  return {
    teamId: partial.teamId,
    pow: partial.pow ?? 50,
    spe: partial.spe ?? 50,
    men: partial.men ?? 50,
    soc: partial.soc ?? 50,
    ambition: partial.ambition ?? 50,
    finances: partial.finances ?? 50,
    boardConfidence: partial.boardConfidence ?? 50,
    harmony: partial.harmony ?? 50,
    manners: partial.manners ?? 50,
    popularity: partial.popularity ?? 50,
    cooperation: partial.cooperation ?? 50,
    playerMin: partial.playerMin ?? 8,
    playerOpt: partial.playerOpt ?? 10,
    sourceNote: partial.sourceNote,
  };
}

function bias(partial: Partial<TeamStrategyBias>): TeamGeneralManagerProfile["bias"] {
  return {
    cashPriority: 5,
    valuePriority: 5,
    starPriority: 5,
    riskTolerance: 5,
    wageSensitivity: 5,
    sellForProfitAggression: 5,
    shortContractPreference: 5,
    longContractPreference: 5,
    loyaltyBias: 5,
    harmonyStrictness: 5,
    rosterDepthPreference: 5,
    eliteSmallRosterPreference: 5,
    ...partial,
  };
}

function gmProfile(archetype: TeamGeneralManagerProfile["archetype"], biasPartial: Partial<TeamStrategyBias>): TeamGeneralManagerProfile {
  return {
    gmId: `gm-${archetype}`,
    name: archetype,
    archetype,
    title: archetype,
    description: archetype,
    pow: 50,
    spe: 50,
    men: 50,
    soc: 50,
    ambition: 50,
    finances: 50,
    boardConfidence: 50,
    harmony: 50,
    manners: 50,
    popularity: 50,
    cooperation: 50,
    playerOptDelta: 0,
    preferredTraits: [],
    facilityPriorities: [],
    marketDoctrine: "balanced",
    lineupDoctrine: "balanced",
    bias: bias(biasPartial),
  };
}

function player(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    portraitPath: null,
    portraitUrl: null,
    rating: partial?.rating ?? 50,
    marketValue: partial?.marketValue ?? 20,
    salaryDemand: partial?.salaryDemand ?? 4,
    displayMarketValue: partial?.marketValue ?? 20,
    displaySalary: partial?.salaryDemand ?? 4,
    pps: null,
    ovr: null,
    className: partial?.className ?? "Warrior",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "m",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: [],
    disciplineRatings: partial?.disciplineRatings ?? {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: partial?.potential ?? 60,
    trainingMode: "mittel",
    trainingClass: null,
  } as Player;
}

function team(partial: Partial<Team> & Pick<Team, "teamId">): Team {
  return {
    teamId: partial.teamId,
    shortCode: partial.shortCode ?? partial.teamId,
    name: partial.name ?? partial.teamId,
    budget: partial.budget ?? 100,
    cash: partial.cash ?? 100,
    identityId: partial.identityId ?? partial.teamId,
    humanControlled: partial.humanControlled ?? false,
    rosterLimit: partial.rosterLimit ?? 12,
    logoPath: null,
  };
}

function gameStateWithRoster(teamId: string, players: Player[]): GameState {
  return {
    players,
    rosters: players.map((entry, index) => ({
      id: `r-${index}`,
      teamId,
      playerId: entry.id,
      activePlayerId: entry.id,
      salary: entry.salaryDemand,
      currentValue: entry.marketValue,
      contractLength: 3,
    })),
    teamIdentities: [],
    disciplines: [],
  } as unknown as GameState;
}

describe("computeIdentityLaneAppetite (organic, no team-code)", () => {
  it("gives an ambitious, board-pressured, mid-finance team a higher premium appetite than a low-ambition, well-funded, low-pressure team", () => {
    const ambitious = computeIdentityLaneAppetite(
      identity({ teamId: "X-1", ambition: 85, finances: 45, boardConfidence: 25, harmony: 50 }),
    );
    const comfortable = computeIdentityLaneAppetite(
      identity({ teamId: "X-2", ambition: 30, finances: 80, boardConfidence: 80, harmony: 50 }),
    );

    expect(ambitious.premiumAppetite).toBeGreaterThan(comfortable.premiumAppetite);
    expect(ambitious.premiumCap).toBeGreaterThanOrEqual(comfortable.premiumCap);
    expect(comfortable.preferDepthOverStars).toBe(true);
  });

  it("has no hardcoded team-code branches — two different teamIds with identical identity produce identical appetite", () => {
    const a = computeIdentityLaneAppetite(identity({ teamId: "T-T", ambition: 60, finances: 55, boardConfidence: 50, harmony: 50 }));
    const b = computeIdentityLaneAppetite(identity({ teamId: "M-M", ambition: 60, finances: 55, boardConfidence: 50, harmony: 50 }));
    expect(a).toEqual(b);
  });

  it("falls back to neutral defaults when identity is missing", () => {
    const philosophy = computeIdentityLaneAppetite(null);
    expect(philosophy.premiumCap).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(philosophy.premiumAppetite)).toBe(true);
  });
});

describe("applyGmBiasToLaneAppetite (organic GM tilt across all bias dimensions)", () => {
  it("a star-hunting GM raises premium appetite for the same team identity vs a depth-spamming GM", () => {
    const base = computeIdentityLaneAppetite(identity({ teamId: "X-3", ambition: 55, finances: 55, boardConfidence: 50, harmony: 50 }));

    const starChaserGm = gmProfile("star_chaser", {
      starPriority: 9,
      eliteSmallRosterPreference: 8,
      riskTolerance: 8,
      valuePriority: 2,
      cashPriority: 3,
      rosterDepthPreference: 2,
    });
    const depthSpammerGm = gmProfile("depth_spammer", {
      starPriority: 2,
      eliteSmallRosterPreference: 2,
      riskTolerance: 3,
      valuePriority: 7,
      cashPriority: 7,
      rosterDepthPreference: 9,
    });

    const withStarChaser = applyGmBiasToLaneAppetite(base, starChaserGm);
    const withDepthSpammer = applyGmBiasToLaneAppetite(base, depthSpammerGm);

    expect(withStarChaser.premiumAppetite).toBeGreaterThan(withDepthSpammer.premiumAppetite);
    expect(withStarChaser.premiumCap).toBeGreaterThanOrEqual(withDepthSpammer.premiumCap);
    expect(withDepthSpammer.depthBias).toBeGreaterThan(withStarChaser.depthBias);
  });

  it("the same GM tilts two different team identities differently (no dead zone collapsing everything to one scalar)", () => {
    const richTeam = computeIdentityLaneAppetite(identity({ teamId: "X-4", ambition: 40, finances: 85, boardConfidence: 70, harmony: 50 }));
    const strugglingTeam = computeIdentityLaneAppetite(identity({ teamId: "X-5", ambition: 75, finances: 30, boardConfidence: 20, harmony: 50 }));

    const starChaserGm = gmProfile("star_chaser", { starPriority: 9, eliteSmallRosterPreference: 8, riskTolerance: 8 });

    const richTilted = applyGmBiasToLaneAppetite(richTeam, starChaserGm);
    const strugglingTilted = applyGmBiasToLaneAppetite(strugglingTeam, starChaserGm);

    expect(strugglingTilted.premiumAppetite).toBeGreaterThan(richTilted.premiumAppetite);
  });

  it("returns the base philosophy unchanged when the GM has no bias", () => {
    const base = computeIdentityLaneAppetite(identity({ teamId: "X-6", ambition: 50, finances: 50, boardConfidence: 50, harmony: 50 }));
    expect(applyGmBiasToLaneAppetite(base, null)).toEqual(base);
  });
});

describe("applyThemeAnchorToLaneAppetite (generic, applies to all 32 teams via existing theme config)", () => {
  it("nudges core appetite up for T-T when the roster has zero Teacher/Mentor/Leader matches", () => {
    const base = computeIdentityLaneAppetite(identity({ teamId: "T-T", ambition: 50, finances: 55, boardConfidence: 50, harmony: 50 }));
    const teamRow = team({ teamId: "T-T" });
    const emptyRosterState = gameStateWithRoster("T-T", [player("p1", { className: "Warrior" })]);

    const anchored = applyThemeAnchorToLaneAppetite(base, emptyRosterState, teamRow);

    expect(anchored.coreBias).toBeGreaterThan(base.coreBias);
    expect(anchored.label).toContain("theme_anchor");
  });

  it("does not nudge core appetite once T-T already has a Teacher-tagged player on the roster", () => {
    const base = computeIdentityLaneAppetite(identity({ teamId: "T-T", ambition: 50, finances: 55, boardConfidence: 50, harmony: 50 }));
    const teamRow = team({ teamId: "T-T" });
    const rosterWithTeacher = gameStateWithRoster("T-T", [player("p1", { className: "Teacher" })]);

    const anchored = applyThemeAnchorToLaneAppetite(base, rosterWithTeacher, teamRow);

    expect(anchored.coreBias).toBeCloseTo(base.coreBias, 6);
    expect(anchored.label).not.toContain("theme_anchor");
  });

  it("is a no-op for teams without a theme target (no teamCode branch — pure config lookup)", () => {
    const base = computeIdentityLaneAppetite(identity({ teamId: "ZZ-NOPE", ambition: 50, finances: 55, boardConfidence: 50, harmony: 50 }));
    const teamRow = team({ teamId: "ZZ-NOPE" });
    const emptyRosterState = gameStateWithRoster("ZZ-NOPE", []);

    const anchored = applyThemeAnchorToLaneAppetite(base, emptyRosterState, teamRow);

    expect(anchored).toEqual(base);
  });
});
