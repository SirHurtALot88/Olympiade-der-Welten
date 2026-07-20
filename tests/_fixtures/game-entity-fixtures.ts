// Shared fixture factories for building minimal-but-schema-valid production entities in tests.
//
// Why this file exists: several test files hand-roll partial `Player`/`Team`/`RosterEntry`/etc.
// object literals that drift out of sync with the production schema in
// `lib/data/olyDataTypes.ts` (see docs/VERBESSERUNGS-BACKLOG-2026-07.md, T-090/T-092/T-093/T-094).
// These helpers provide sensible defaults for every REQUIRED field so call sites only need to
// specify the values that matter for the scenario under test, via a `Partial<T>` overrides object.
//
// Keep these helpers boring: no business logic, no randomness, just schema-complete defaults.

import type {
  DisciplineCategory,
  Player,
  RosterEntry,
  SeasonDisciplineScheduleEntry,
  SeasonDisciplineScheduleSlot,
  Team,
  TeamIdentity,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";

export function makePlayer(overrides: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return {
    portraitPath: null,
    portraitUrl: null,
    rating: 50,
    marketValue: 10,
    salaryDemand: 3,
    displayMarketValue: 10,
    displaySalary: 3,
    className: "Fighter",
    race: "Human",
    alignment: "Neutral",
    gender: "diverse",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 50,
    potential: 50,
    ...overrides,
  };
}

export function makeRosterEntry(
  overrides: Partial<RosterEntry> & Pick<RosterEntry, "id" | "teamId" | "playerId">,
): RosterEntry {
  return {
    contractLength: 3,
    salary: 3,
    upkeep: 3,
    roleTag: "starter",
    joinedSeasonId: "season-1",
    ...overrides,
  };
}

export function makeTeam(overrides: Partial<Team> & Pick<Team, "teamId">): Team {
  const teamId = overrides.teamId;
  return {
    shortCode: teamId,
    name: teamId,
    budget: 0,
    cash: 100,
    identityId: teamId,
    humanControlled: false,
    rosterLimit: 20,
    ...overrides,
  };
}

export function makeTeamIdentity(overrides: Partial<TeamIdentity> & Pick<TeamIdentity, "teamId">): TeamIdentity {
  return {
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
    playerMin: 8,
    playerOpt: 12,
    ...overrides,
  };
}

export function makeTeamStrategyProfile(
  teamId: string,
  overrides: Partial<TeamStrategyProfile> = {},
): TeamStrategyProfile {
  return {
    teamId,
    strategySummary: "Test profile",
    buyStyle: "balanced",
    sellStyle: "balanced",
    contractStyle: "balanced",
    rosterStyle: "balanced",
    preferredArchetypes: [],
    secondaryArchetypes: [],
    avoidedArchetypes: [],
    preferredRaces: [],
    avoidedRaces: [],
    preferredClasses: [],
    avoidedClasses: [],
    hardNoGos: [],
    bias: {
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
    },
    ...overrides,
  };
}

export function makeScheduleSlot(
  overrides: Partial<SeasonDisciplineScheduleSlot> & Pick<SeasonDisciplineScheduleSlot, "disciplineId">,
): SeasonDisciplineScheduleSlot {
  const category: DisciplineCategory = overrides.category ?? "power";
  return {
    displayName: overrides.disciplineId,
    order: 1,
    playerCount: 4,
    ...overrides,
    category,
  };
}

export function makeScheduleEntry(
  overrides: Partial<SeasonDisciplineScheduleEntry> & Pick<SeasonDisciplineScheduleEntry, "seasonId" | "matchdayId">,
): SeasonDisciplineScheduleEntry {
  return {
    matchdayIndex: 1,
    matchdayLabel: "Spieltag 1",
    discipline1: null,
    discipline2: null,
    sourceStatus: "season_seed",
    sourceNote: null,
    ...overrides,
  };
}
