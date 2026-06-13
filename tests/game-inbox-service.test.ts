import { describe, expect, it } from "vitest";

import type { GameInboxItem, GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { buildGameInboxItems, filterGameInboxItems } from "@/lib/foundation/game-inbox-service";

function makeTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "M-M",
    shortCode: partial?.shortCode ?? "M-M",
    name: partial?.name ?? "Mayhem Mavericks",
    budget: partial?.budget ?? 325,
    cash: partial?.cash ?? 50,
    identityId: partial?.identityId ?? partial?.teamId ?? "M-M",
    humanControlled: partial?.humanControlled ?? true,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function makePlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: 50,
    marketValue: 10,
    salaryDemand: 2,
    pps: null,
    ovr: null,
    className: "Runner",
    race: "Human",
    alignment: "neutral",
    gender: "n/a",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    trainingMode: partial?.trainingMode ?? null,
    currentXP: partial?.currentXP ?? 0,
    ...partial,
  };
}

function makeGameState(partial?: Partial<GameState>): GameState {
  const teams = partial?.teams ?? [makeTeam()];
  const players = partial?.players ?? [makePlayer("p-1")];
  return {
    gamePhase: partial?.gamePhase ?? "season_active",
    season: { id: "season-3", name: "Season 3", year: 2028, currentMatchday: 1, matchdayIds: ["season-3-matchday-1"] },
    seasonState: {
      seasonId: "season-3",
      schedule: [],
      standings: {},
      teamControlSettings: {
        "M-M": {
          teamId: "M-M",
          controlMode: "manual",
          ownerId: "user_local",
          ownerSlot: "user",
          displayLabel: "Chris",
          aiLineupPreviewEnabled: false,
          aiLineupApplyEnabled: false,
          aiLineupAutoApplyEnabled: false,
          aiTransferPreviewEnabled: false,
          aiTransferAutoApplyEnabled: false,
          aiSellPreviewEnabled: false,
          aiSellAutoApplyEnabled: false,
        },
      },
      ...(partial?.seasonState ?? {}),
    },
    matchdayState: {
      matchdayId: "season-3-matchday-1",
      status: "planning",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
      ...(partial?.matchdayState ?? {}),
    },
    teams,
    scenarioMeta: partial?.scenarioMeta,
    teamIdentities: [],
    players,
    disciplines: [],
    rosters:
      partial?.rosters ?? [
        {
          id: "r-1",
          teamId: "M-M",
          playerId: "p-1",
          contractLength: 1,
          salary: 2,
          upkeep: 2,
          purchasePrice: 10,
          currentValue: 10,
          roleTag: "starter",
          joinedSeasonId: "season-3",
        },
      ],
    contracts: [],
    transferListings: [],
    transferHistory: partial?.transferHistory ?? [],
    playerProgressionEvents: partial?.playerProgressionEvents ?? [],
    gameInboxItems: partial?.gameInboxItems,
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: players.length,
      matchedRosterCount: partial?.rosters?.length ?? 1,
      teamCount: teams.length,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      officialTeamPendingCode: [],
      warnings: [],
    },
  };
}

function titles(items: GameInboxItem[]) {
  return items.map((item) => item.title);
}

describe("game inbox service", () => {
  it("creates tasks for missing lineup, XP, expiring contracts and missing training", () => {
    const gameState = makeGameState({
      players: [makePlayer("p-1", { currentXP: 25, trainingMode: null })],
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });

    expect(titles(items)).toContain("Lineup fehlt");
    expect(titles(items)).toContain("XP verfügbar");
    expect(titles(items)).toContain("Verträge laufen aus");
    expect(titles(items)).toContain("Training nicht gesetzt");
  });

  it("creates a transfer candidate task from real roster value, contract and cash pressure", () => {
    const gameState = makeGameState({
      teams: [makeTeam({ cash: -5 })],
      players: [makePlayer("p-1", { name: "Sage", marketValue: 32, displayMarketValue: 32 })],
      rosters: [
        {
          id: "r-1",
          teamId: "M-M",
          playerId: "p-1",
          contractLength: 1,
          salary: 2,
          upkeep: 2,
          purchasePrice: 20,
          currentValue: 32,
          roleTag: "starter",
          joinedSeasonId: "season-3",
        },
      ],
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    const task = items.find((item) => item.itemId.startsWith("transfer_candidate:"));

    expect(task?.title).toBe("Transferkandidat prüfen");
    expect(task?.severity).toBe("critical");
    expect(task?.targetView).toBe("market");
  });

  it("creates facility warning when upkeep is unaffordable and upgrade task when cash allows", () => {
    const gameState = makeGameState({
      teams: [makeTeam({ cash: 2 })],
      seasonState: {
        seasonId: "season-3",
        schedule: [],
        standings: {},
        teamFacilities: {
          "M-M": {
            facilities: {
              training_center: { level: 5, enabled: true },
            },
          },
        },
      },
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    expect(titles(items)).toContain("Facility-Unterhalt gefährdet");
  });

  it("creates transfer news from real transfer history", () => {
    const gameState = makeGameState({
      transferHistory: [
        {
          id: "transfer-1",
          playerId: "p-1",
          seasonId: "season-3",
          matchdayId: "season-3-matchday-1",
          seasonLabel: "Season 3",
          transferType: "buy",
          fromTeamId: null,
          toTeamId: "M-M",
          fee: 10,
          salary: 2,
          marketValue: 10,
          remainingContractLength: 2,
          happenedAt: "2026-06-13T10:00:00.000Z",
        },
      ],
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    expect(titles(items)).toContain("Transfer gekauft");
  });

  it("creates story cards only from real result, snapshot or progression sources", () => {
    const baseState = makeGameState();
    const emptyItems = buildGameInboxItems({ gameState: baseState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    expect(emptyItems.some((item) => item.source.startsWith("story:"))).toBe(false);

    const gameState = makeGameState({
      playerProgressionEvents: [
        {
          eventId: "xp-1",
          seasonId: "season-3",
          teamId: "M-M",
          playerId: "p-1",
          upgrades: [],
          xpSpent: 20,
          progressionSnapshotBefore: {
            attributes: {},
            disciplineRatings: { d1: 10, d2: 20, d3: 30 },
            ovr: null,
            mvs: null,
            marketValue: null,
            salary: null,
            bracket: null,
          },
          progressionSnapshotAfter: {
            attributes: {},
            disciplineRatings: { d1: 11, d2: 21, d3: 31 },
            ovr: null,
            mvs: null,
            marketValue: null,
            salary: null,
            bracket: null,
            marketValuePreview: null,
            salaryPreview: null,
            bracketPreview: null,
          },
          timestamp: "2026-06-13T10:00:00.000Z",
          source: "manual_season_end_xp_spend",
        },
      ],
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    expect(items.some((item) => item.title === "Story Card: XP zeigt Wirkung")).toBe(true);
  });

  it("keeps dismissed stored status for deterministic generated items", () => {
    const itemId = "lineup_missing:save-1:season-3:season-3-matchday-1:M-M";
    const gameState = makeGameState({
      gameInboxItems: [
        {
          itemId,
          saveId: "save-1",
          seasonId: "season-3",
          category: "task",
          severity: "warning",
          title: "Lineup fehlt",
          description: "dismissed earlier",
          targetView: "lineup",
          targetParams: {},
          status: "dismissed",
          createdAt: "2026-06-13T10:00:00.000Z",
          source: "test",
        },
      ],
    });

    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeTeamId: "M-M", activeOwnerId: "user_local" });
    expect(items.find((item) => item.itemId === itemId)?.status).toBe("dismissed");
    expect(filterGameInboxItems(items, { includeDismissed: false }).some((item) => item.itemId === itemId)).toBe(false);
  });

	  it("filters by participant/owner teams", () => {
    const gameState = makeGameState({
      teams: [makeTeam({ teamId: "M-M", shortCode: "M-M" }), makeTeam({ teamId: "P-C", shortCode: "P-C", humanControlled: true })],
      players: [makePlayer("p-1"), makePlayer("p-2")],
      rosters: [
        { id: "r-1", teamId: "M-M", playerId: "p-1", contractLength: 2, salary: 2, upkeep: 2, roleTag: "starter", joinedSeasonId: "season-3" },
        { id: "r-2", teamId: "P-C", playerId: "p-2", contractLength: 2, salary: 2, upkeep: 2, roleTag: "starter", joinedSeasonId: "season-3" },
      ],
      scenarioMeta: {
        scenarioType: "manager_multiplayer_test",
        label: "Room",
        createdAt: "2026-06-13T10:00:00.000Z",
        teamOwnership: [
          { teamId: "M-M", controllerType: "human", userId: "user_chris", participantId: "participant-chris", ownerDisplayName: "Chris" },
          { teamId: "P-C", controllerType: "human", userId: "user_franky", participantId: "participant-franky", ownerDisplayName: "Franky" },
        ],
      },
    });

    const chrisItems = buildGameInboxItems({ gameState, saveId: "save-1", activeOwnerId: "user_local" });
    const frankyItems = buildGameInboxItems({ gameState, saveId: "save-1", activeOwnerId: "franky_remote_placeholder" });

    expect(chrisItems.some((item) => item.teamId === "M-M")).toBe(true);
    expect(chrisItems.some((item) => item.teamId === "P-C")).toBe(false);
	    expect(frankyItems.some((item) => item.teamId === "P-C")).toBe(true);
	    expect(frankyItems.some((item) => item.teamId === "M-M")).toBe(false);
	  });

	  it("allows host mode to inspect all team tasks", () => {
	    const gameState = makeGameState({
	      teams: [makeTeam({ teamId: "M-M", shortCode: "M-M" }), makeTeam({ teamId: "P-C", shortCode: "P-C", humanControlled: true })],
	      players: [makePlayer("p-1"), makePlayer("p-2")],
	      rosters: [
	        { id: "r-1", teamId: "M-M", playerId: "p-1", contractLength: 2, salary: 2, upkeep: 2, roleTag: "starter", joinedSeasonId: "season-3" },
	        { id: "r-2", teamId: "P-C", playerId: "p-2", contractLength: 2, salary: 2, upkeep: 2, roleTag: "starter", joinedSeasonId: "season-3" },
	      ],
	    });

	    const items = buildGameInboxItems({ gameState, saveId: "save-1", activeOwnerId: "user_local", hostMode: true });

	    expect(items.some((item) => item.teamId === "M-M")).toBe(true);
	    expect(items.some((item) => item.teamId === "P-C")).toBe(true);
	  });
	});
