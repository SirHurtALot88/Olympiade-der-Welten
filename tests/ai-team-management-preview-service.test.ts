import { describe, expect, it } from "vitest";

import { buildAiTeamManagementPreview } from "@/lib/ai/ai-team-management-preview-service";
import type { GameState, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

function buildTeam(overrides: Partial<Team> = {}): Team {
  return {
    teamId: "T-1",
    shortCode: "T1",
    name: "Test Team",
    budget: 50,
    cash: 50,
    identityId: "id-1",
    humanControlled: false,
    rosterLimit: 20,
    rosterMinTarget: 4,
    rosterOptTarget: 6,
    ...overrides,
  };
}

function buildIdentity(overrides: Partial<TeamIdentity> = {}): TeamIdentity {
  return {
    teamId: "T-1",
    playerType: "balanced",
    pow: 70,
    spe: 60,
    men: 55,
    soc: 50,
    ambition: 60,
    finances: 60,
    boardConfidence: 60,
    harmony: 60,
    manners: 60,
    popularity: 60,
    cooperation: 60,
    playerMin: 4,
    playerOpt: 6,
    ...overrides,
  };
}

function buildPlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    rating: 60,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    className: "Hero",
    race: "Human",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 60, spe: 60, men: 60, soc: 60 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 20,
    form: 50,
    potential: 50,
    ...overrides,
  };
}

function buildGameState(input?: {
  team?: Partial<Team>;
  identity?: Partial<TeamIdentity>;
  players?: Player[];
  injuries?: string[];
}) {
  const team = buildTeam(input?.team);
  const identity = buildIdentity(input?.identity);
  const players = input?.players ?? [
    buildPlayer("p1"),
    buildPlayer("p2"),
    buildPlayer("p3"),
    buildPlayer("p4"),
  ];
  return {
    gamePhase: "preseason_management",
    season: { id: "season-1", name: "Season 1", currentMatchday: 1 },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      disciplineSchedule: [],
      standings: {
        "T-1": { points: 0, rank: 12, sponsorSeason: 6 },
      },
      teamControlSettings: {
        "T-1": {
          teamId: "T-1",
          controlMode: "ai",
          aiLineupPreviewEnabled: true,
          aiLineupAutoApplyEnabled: true,
          aiTransferPreviewEnabled: true,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: true,
          aiSellAutoApplyEnabled: false,
        },
      },
      teamFacilities: {
        "T-1": {
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
      playerAvailabilityState: (input?.injuries ?? []).map((playerId) => ({
        playerId,
        teamId: "T-1",
        seasonId: "season-1",
        status: "injured",
        fatigue: 90,
        injuryNote: "injured",
      })),
      seasonSnapshots: [],
    },
    matchdayState: {
      matchdayId: "m1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams: [team],
    teamIdentities: [identity],
    players,
    disciplines: [],
    rosters: players.map((player, index) => ({
      id: `r${index + 1}`,
      teamId: "T-1",
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
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: 0,
      matchedRosterCount: 0,
      teamCount: 1,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  } as unknown as GameState;
}

describe("ai team management preview service", () => {
  it("prioritizes recovery for high fatigue and injuries", () => {
    const gameState = buildGameState({
      players: [
        buildPlayer("p1", { fatigue: 92 }),
        buildPlayer("p2", { fatigue: 88 }),
        buildPlayer("p3", { fatigue: 74 }),
        buildPlayer("p4", { fatigue: 70 }),
      ],
      injuries: ["p1", "p2"],
    });

    const preview = buildAiTeamManagementPreview(gameState, "T-1");

    expect(preview?.trainingPlan.selectedTrainingFocus).toBe("RECOVERY");
    expect(preview?.trainingPlan.selectedTrainingIntensity).toBe("light");
    expect(preview?.buildingPlan.find((row) => row.buildingType === "recovery_center")?.score ?? 0).toBeGreaterThan(40);
  });

  it("switches to light training when a single injury or elevated injury risk is present", () => {
    const injuredOnly = buildGameState({
      injuries: ["p1"],
      players: [
        buildPlayer("p1", { fatigue: 35 }),
        buildPlayer("p2", { fatigue: 30 }),
        buildPlayer("p3", { fatigue: 28 }),
        buildPlayer("p4", { fatigue: 25 }),
      ],
    });

    expect(buildAiTeamManagementPreview(injuredOnly, "T-1")?.trainingPlan.selectedTrainingIntensity).toBe("light");
    expect(buildAiTeamManagementPreview(injuredOnly, "T-1")?.trainingPlan.selectedTrainingFocus).toBe("RECOVERY");

    const highRisk = buildGameState({
      players: [
        buildPlayer("p1", { fatigue: 78 }),
        buildPlayer("p2", { fatigue: 76 }),
        buildPlayer("p3", { fatigue: 74 }),
        buildPlayer("p4", { fatigue: 20 }),
      ],
    });

    expect(buildAiTeamManagementPreview(highRisk, "T-1")?.trainingPlan.selectedTrainingIntensity).toBe("light");
  });

  it("prioritizes training and hard intensity for young rebuild teams", () => {
    const gameState = buildGameState({
      identity: { ambition: 72, finances: 55 },
      players: [
        buildPlayer("p1", { potential: 82, fatigue: 20 }),
        buildPlayer("p2", { potential: 84, fatigue: 18 }),
        buildPlayer("p3", { potential: 78, fatigue: 22 }),
        buildPlayer("p4", { potential: 80, fatigue: 25 }),
        buildPlayer("p5", { potential: 76, fatigue: 24 }),
        buildPlayer("p6", { potential: 74, fatigue: 26 }),
        buildPlayer("p7", { potential: 72, fatigue: 28 }),
      ],
      team: { cash: 70, rosterOptTarget: 6 },
    });

    const preview = buildAiTeamManagementPreview(gameState, "T-1");

    expect(preview?.profile.strategicIntent).toBe("youth_development");
    expect(preview?.trainingPlan.selectedTrainingIntensity).toBe("hard");
    expect(preview?.buildingPlan.find((row) => row.buildingType === "training_center")?.score ?? 0).toBeGreaterThan(30);
  });

  it("protects maintenance and blocks luxury spending for cash-poor teams", () => {
    const gameState = buildGameState({
      team: { cash: 8 },
      identity: { finances: 70 },
    });

    const preview = buildAiTeamManagementPreview(gameState, "T-1");

    expect(preview?.budgetPlan.bucketsBefore.maintenanceBudget ?? 0).toBeGreaterThan(0);
    expect(preview?.budgetPlan.warnings).toContain("maintenance_priority_over_upgrades");
    const economyBuildings = preview?.buildingPlan.filter((row) => ["fan_shop", "arena_upgrade"].includes(row.buildingType)) ?? [];
    expect(economyBuildings.every((row) => row.action !== "build_new" && row.action !== "upgrade_existing")).toBe(true);
  });

  it("keeps transfer budget below full free cash once building reserve exists", () => {
    const gameState = buildGameState({
      team: { cash: 65 },
      players: [
        buildPlayer("p1"),
        buildPlayer("p2"),
        buildPlayer("p3"),
      ],
    });

    const preview = buildAiTeamManagementPreview(gameState, "T-1");
    const buckets = preview?.budgetPlan.bucketsBefore;

    expect((buckets?.buildingBudget ?? 0)).toBeGreaterThan(0);
    expect((buckets?.transferBudget ?? 0) + (buckets?.buildingBudget ?? 0)).toBeLessThan(65);
  });
});
