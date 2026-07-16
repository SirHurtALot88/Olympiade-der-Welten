import { describe, expect, it } from "vitest";

import { applyGmArchetypeSellScoreModifier } from "@/lib/ai/gm-sell-archetype-modifier";
import { getTeamDevelopmentTendency } from "@/lib/foundation/team-development-tendency";
import { recommendContractOfferForPlayer } from "@/lib/market/contract-negotiation-preview";
import { buildAiTeamManagementPreview } from "@/lib/ai/ai-team-management-preview-service";
import type {
  GameState,
  Player,
  Team,
  TeamGeneralManagerProfile,
  TeamIdentity,
} from "@/lib/data/olyDataTypes";

function gmProfile(archetype: string): TeamGeneralManagerProfile {
  return { archetype } as unknown as TeamGeneralManagerProfile;
}

function testPlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: overrides.name ?? id,
    rating: overrides.rating ?? 68,
    marketValue: overrides.marketValue ?? 20,
    salaryDemand: overrides.salaryDemand ?? 5,
    displayMarketValue: overrides.displayMarketValue ?? overrides.marketValue ?? 20,
    displaySalary: overrides.displaySalary ?? overrides.salaryDemand ?? 5,
    className: overrides.className ?? "Hero",
    race: overrides.race ?? "Human",
    alignment: overrides.alignment ?? "N",
    gender: overrides.gender ?? "m",
    subclasses: overrides.subclasses ?? [],
    traitsPositive: overrides.traitsPositive ?? [],
    traitsNegative: overrides.traitsNegative ?? [],
    coreStats: overrides.coreStats ?? { pow: 60, spe: 60, men: 60, soc: 60 },
    preferredDisciplineIds: overrides.preferredDisciplineIds ?? [],
    disciplineRatings: overrides.disciplineRatings ?? {},
    disciplineTierCounts: overrides.disciplineTierCounts ?? { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: overrides.fatigue ?? 20,
    form: overrides.form ?? 50,
    potential: overrides.potential ?? 50,
  } as unknown as Player;
}

// ---------- Fix 1 + Fix 4: gm-sell-archetype-modifier ----------
describe("gm-sell-archetype-modifier archetype hooks", () => {
  it("bargain_hunter adds the stronger (+10) profit_window bonus", () => {
    const adjusted = applyGmArchetypeSellScoreModifier({
      baseScore: 40,
      gmProfile: gmProfile("bargain_hunter"),
      pressure: null,
      sellReasonCodes: ["profit_window"],
    });
    expect(adjusted).toBe(50);
  });

  it("culture_keeper pushes good/core players well below the sell score", () => {
    const base = 60;
    const neutral = applyGmArchetypeSellScoreModifier({
      baseScore: base,
      gmProfile: gmProfile("systems_tinkerer"),
      pressure: null,
      keepReasonCodes: ["star_core_protection", "strong_contribution", "top10_presence"],
    });
    const cultureKeeper = applyGmArchetypeSellScoreModifier({
      baseScore: base,
      gmProfile: gmProfile("culture_keeper"),
      pressure: null,
      keepReasonCodes: ["star_core_protection", "strong_contribution", "top10_presence"],
      contractLength: 2,
    });
    // 12 + 10 + 8 (keep reasons) + 6 (medium contract loyalty malus) = 36 below neutral
    expect(cultureKeeper).toBeLessThan(neutral);
    expect(cultureKeeper).toBeLessThanOrEqual(base - 30);
  });
});

// ---------- Fix 2: talent_builder development tendency ----------
describe("talent_builder development tendency hook", () => {
  const team = { teamId: "T-1", shortCode: "T1", name: "Dev Team" } as unknown as Team;

  it("talent_builder raises the development score above a non-talent_builder team", () => {
    const neutral = getTeamDevelopmentTendency({ team });
    const talentBuilder = getTeamDevelopmentTendency({ team, gmArchetype: "talent_builder" });
    expect(talentBuilder.score).toBeGreaterThan(neutral.score);
    expect(talentBuilder.trainingCenterBonusPct).toBeGreaterThan(neutral.trainingCenterBonusPct);
    // additive bump is per-player weighting, not scaled by roster size
    expect(talentBuilder.score - neutral.score).toBeGreaterThanOrEqual(0.24);
  });
});

// ---------- Fix 4: culture_keeper contract length floor ----------
describe("culture_keeper contract length floor", () => {
  it("floors a good player's contract at >= 3 seasons vs a non-highValue baseline", () => {
    const player = testPlayer("ck", { marketValue: 18 });
    const common = {
      player,
      teamStrategyProfile: null,
      teamIdentity: null,
      teamCash: 60,
      marketValue: 18,
      teamFit: 10,
      dealRole: "depth",
      isFirstSeason: false,
    } as const;
    const cultureKeeperGood = recommendContractOfferForPlayer({
      ...common,
      gmArchetype: "culture_keeper",
      highValue: true,
    });
    const cultureKeeperReserve = recommendContractOfferForPlayer({
      ...common,
      gmArchetype: "culture_keeper",
      highValue: false,
    });
    expect(cultureKeeperGood.contractLength).toBeGreaterThanOrEqual(3);
    expect(cultureKeeperGood.contractLength).toBeGreaterThan(cultureKeeperReserve.contractLength);
  });
});

// ---------- Fix 3: facility_architect building leadership ----------
function buildFacilityGameState(gmId: string | null): GameState {
  const team: Team = {
    teamId: "F-1",
    shortCode: "F1",
    name: "Facility Team",
    budget: 300,
    cash: 300,
    identityId: "id-f1",
    humanControlled: false,
    rosterLimit: 20,
    rosterMinTarget: 4,
    rosterOptTarget: 4,
  } as unknown as Team;
  const identity: TeamIdentity = {
    teamId: "F-1",
    pow: 60,
    spe: 60,
    men: 60,
    soc: 60,
    ambition: 70,
    finances: 80,
    boardConfidence: 60,
    harmony: 60,
    manners: 60,
    popularity: 60,
    cooperation: 60,
    playerMin: 4,
    playerOpt: 4,
  } as unknown as TeamIdentity;
  const players = [testPlayer("f1"), testPlayer("f2"), testPlayer("f3"), testPlayer("f4")];
  return {
    gamePhase: "preseason_management",
    season: { id: "season-1", name: "Season 1", currentMatchday: 1 },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      disciplineSchedule: [],
      standings: { "F-1": { points: 0, rank: 6, sponsorSeason: 6 } },
      teamControlSettings: {
        "F-1": {
          teamId: "F-1",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupAutoApplyEnabled: true,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
      },
      teamGeneralManagers: gmId ? { "F-1": { teamId: "F-1", gmId } } : {},
      teamFacilities: {
        "F-1": {
          facilities: {
            training_center: { level: 1, enabled: true },
            recovery_center: { level: 0, enabled: false },
            scouting_office: { level: 0, enabled: false },
            analytics_room: { level: 0, enabled: false },
            fan_shop: { level: 0, enabled: false },
            arena_upgrade: { level: 0, enabled: false },
            academy: { level: 0, enabled: false },
            specialist_wing: { level: 0, enabled: false },
          },
        },
      },
      seasonSnapshots: [],
    },
    matchdayState: { matchdayId: "m1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [team],
    teamIdentities: [identity],
    players,
    disciplines: [],
    rosters: players.map((player, index) => ({
      id: `r${index + 1}`,
      teamId: "F-1",
      playerId: player.id,
      contractLength: 2,
      salary: 5,
      upkeep: 5,
      roleTag: index < 2 ? "starter" : "prospect",
      joinedSeasonId: "season-1",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerMoraleState: [],
    logs: [],
  } as unknown as GameState;
}

describe("facility_architect building leadership hook", () => {
  it("raises income-facility build scores and the building budget share vs no GM", () => {
    const neutral = buildAiTeamManagementPreview(buildFacilityGameState(null), "F-1");
    const architect = buildAiTeamManagementPreview(
      buildFacilityGameState("gm-facility-architect-01"),
      "F-1",
    );
    const neutralFanShop = neutral?.buildingPlan.find((row) => row.buildingType === "fan_shop")?.score ?? 0;
    const architectFanShop = architect?.buildingPlan.find((row) => row.buildingType === "fan_shop")?.score ?? 0;
    expect(architectFanShop).toBeGreaterThan(neutralFanShop);
    expect((architect?.budgetPlan.bucketsBefore.buildingBudget ?? 0)).toBeGreaterThan(
      neutral?.budgetPlan.bucketsBefore.buildingBudget ?? 0,
    );
  });
});
