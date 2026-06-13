import { describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import {
  applyContractRenewalAction,
  applySeasonEndContractTick,
  previewContractRenewalAction,
  previewSeasonEndContracts,
} from "@/lib/contracts/contract-renewal-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

function createTeam(partial?: Partial<Team>): Team {
  return {
    teamId: partial?.teamId ?? "A-A",
    shortCode: partial?.shortCode ?? "A-A",
    name: partial?.name ?? "Armageddon Aftermath",
    budget: partial?.budget ?? 100,
    cash: partial?.cash ?? 100,
    identityId: partial?.identityId ?? "A-A",
    humanControlled: partial?.humanControlled ?? false,
    rosterLimit: partial?.rosterLimit ?? 12,
    logoPath: partial?.logoPath ?? null,
  };
}

function createPlayer(id: string, partial?: Partial<Player>): Player {
  return {
    id,
    name: partial?.name ?? id,
    rating: partial?.rating ?? 70,
    marketValue: partial?.marketValue ?? 45,
    salaryDemand: partial?.salaryDemand ?? 7,
    displayMarketValue: partial?.displayMarketValue ?? partial?.marketValue ?? 45,
    displaySalary: partial?.displaySalary ?? partial?.salaryDemand ?? 7,
    cost: partial?.cost,
    upkeepBase: partial?.upkeepBase,
    className: partial?.className ?? "Hero",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "f",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 40, spe: 40, men: 40, soc: 40 },
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? { climb: 70, chess: 65 },
    disciplineTierCounts:
      partial?.disciplineTierCounts ?? {
        above20: 2,
        above40: 2,
        above60: 2,
        above80: 0,
      },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
    attributeSheetStats: partial?.attributeSheetStats,
    attributeSheetRatings: partial?.attributeSheetRatings,
    currentXP: partial?.currentXP,
    spentXP: partial?.spentXP,
    lifetimeXP: partial?.lifetimeXP,
  };
}

function createRosterEntry(playerId: string, partial?: Partial<RosterEntry>): RosterEntry {
  return {
    id: partial?.id ?? `roster:${partial?.teamId ?? "A-A"}:${playerId}`,
    teamId: partial?.teamId ?? "A-A",
    playerId,
    contractLength: partial?.contractLength ?? 2,
    contractStatus: partial?.contractStatus,
    salary: partial?.salary ?? 7,
    upkeep: partial?.upkeep ?? partial?.salary ?? 7,
    purchasePrice: partial?.purchasePrice ?? 45,
    currentValue: partial?.currentValue ?? 45,
    roleTag: partial?.roleTag ?? "starter",
    joinedSeasonId: partial?.joinedSeasonId ?? "season-1",
  };
}

function createGameState(input?: {
  teams?: Team[];
  players?: Player[];
  rosters?: RosterEntry[];
}): GameState {
  const teams = input?.teams ?? [createTeam()];
  return {
    gamePhase: "preseason_management",
    season: {
      id: "season-2",
      name: "Season 2",
      year: 2026,
      currentMatchday: 10,
      matchdayIds: ["matchday-1"],
    },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: Object.fromEntries(teams.map((team) => [team.teamId, { points: 0 }])),
      teamControlSettings: Object.fromEntries(
        teams.map((team) => [
          team.teamId,
          {
            teamId: team.teamId,
            controlMode: team.humanControlled ? "manual" : "ai",
            ownerId: team.humanControlled ? "user_local" : "ai",
            ownerSlot: team.humanControlled ? "user" : "ai",
            displayLabel: team.shortCode,
            aiLineupPreviewEnabled: !team.humanControlled,
            aiLineupApplyEnabled: false,
            aiLineupAutoApplyEnabled: false,
            aiTransferPreviewEnabled: !team.humanControlled,
            aiTransferAutoApplyEnabled: false,
            aiSellPreviewEnabled: !team.humanControlled,
            aiSellAutoApplyEnabled: false,
          },
        ]),
      ),
    },
    matchdayState: {
      matchdayId: "matchday-1",
      status: "resolved",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    teams,
    teamIdentities: [],
    players: input?.players ?? [],
    disciplines: [],
    rosters: input?.rosters ?? [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerProgressionEvents: [],
    logs: [],
    mappingReport: {
      mappingSource: "",
      teamSource: "",
      generatedAt: "",
      processedMappingRows: 0,
      importedPlayerCount: input?.players?.length ?? 0,
      matchedRosterCount: input?.rosters?.length ?? 0,
      teamCount: teams.length,
      unmappedPlayers: [],
      teamsWithoutPlayers: [],
      mappingRowsWithoutPlayerMatch: [],
      duplicateMappedPlayers: [],
      unknownTeamCodes: [],
      duplicateTeamCodes: [],
      warnings: [],
    },
  };
}

function createSave(gameState: GameState): PersistedSaveGame {
  return {
    saveId: "contract-test-save",
    name: "Contract Test Save",
    status: "active",
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    gameState,
  };
}

function createPersistenceMock() {
  return {
    saveSingleplayerState: vi.fn(),
  } as unknown as PersistenceService;
}

describe("contract renewal service", () => {
  it("previews expiring contracts and renewal salary without writing", () => {
    const player = createPlayer("p1");
    const save = createSave(createGameState({ players: [player], rosters: [createRosterEntry("p1", { contractLength: 1 })] }));

    const preview = previewSeasonEndContracts(save);

    expect(preview.expiringCount).toBe(1);
    expect(preview.outOfContractAfterTickCount).toBe(1);
    expect(preview.rows[0]?.statusBeforeTick).toBe("expiring");
    expect(preview.rows[0]?.statusAfterTick).toBe("out_of_contract");
    expect(preview.rows[0]?.renewalSalaryPreview).toBeGreaterThan(0);
  });

  it("decrements contract length at season end and keeps active roster entries", () => {
    const player = createPlayer("p1");
    const save = createSave(createGameState({ players: [player], rosters: [createRosterEntry("p1", { contractLength: 3 })] }));
    const persistence = createPersistenceMock();
    const token = previewSeasonEndContracts(save).confirmToken;

    const result = applySeasonEndContractTick(save, token, persistence);
    const savedGameState = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1];

    expect(result.applied).toBe(true);
    expect(savedGameState?.rosters[0]?.contractLength).toBe(2);
    expect(savedGameState?.rosters[0]?.contractStatus).toBe("active");
    expect(savedGameState?.seasonState.contractEvents ?? []).toHaveLength(0);
  });

  it("keeps manual LZ 1 players pending for a human renewal decision", () => {
    const team = createTeam({ humanControlled: true });
    const player = createPlayer("p1");
    const save = createSave(createGameState({ teams: [team], players: [player], rosters: [createRosterEntry("p1", { contractLength: 1 })] }));
    const persistence = createPersistenceMock();
    const token = previewSeasonEndContracts(save).confirmToken;

    const result = applySeasonEndContractTick(save, token, persistence);
    const savedGameState = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1];

    expect(result.releasedPlayers).toBe(0);
    expect(savedGameState?.rosters).toHaveLength(1);
    expect(savedGameState?.rosters[0]?.contractLength).toBe(0);
    expect(savedGameState?.rosters[0]?.contractStatus).toBe("renewal_pending");
    expect(savedGameState?.seasonState.contractEvents ?? []).toHaveLength(0);
  });

  it("lets AI renew valuable LZ 1 players and writes a renewal event", () => {
    const player = createPlayer("p1", { rating: 95 });
    const save = createSave(createGameState({ players: [player], rosters: [createRosterEntry("p1", { contractLength: 1, salary: 6 })] }));
    const persistence = createPersistenceMock();
    const token = previewSeasonEndContracts(save).confirmToken;

    const result = applySeasonEndContractTick(save, token, persistence);
    const savedGameState = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1];

    expect(result.renewedPlayers).toBe(1);
    expect(savedGameState?.rosters).toHaveLength(1);
    expect(savedGameState?.rosters[0]?.contractLength).toBeGreaterThan(0);
    expect(savedGameState?.rosters[0]?.contractStatus).not.toBe("renewal_pending");
    expect(savedGameState?.seasonState.contractEvents?.[0]?.eventType).toBe("contract_renewed");
    expect(savedGameState?.seasonState.contractEvents?.[0]?.source).toBe("ai_contract_renewal");
  });

  it("moves AI release candidates back to the free-agent pool and writes a release event", () => {
    const player = createPlayer("p1", { rating: 15, marketValue: 8, displayMarketValue: 8, salaryDemand: 14, displaySalary: 14 });
    const save = createSave(createGameState({ players: [player], rosters: [createRosterEntry("p1", { contractLength: 1, salary: 14, purchasePrice: 10, currentValue: 8 })] }));
    const persistence = createPersistenceMock();
    const token = previewSeasonEndContracts(save).confirmToken;

    const result = applySeasonEndContractTick(save, token, persistence);
    const savedGameState = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1];

    expect(result.releasedPlayers).toBe(1);
    expect(savedGameState?.rosters).toHaveLength(0);
    expect(savedGameState?.teams[0]?.cash).toBe(108);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.eventType).toBe("contract_expired_exit");
    expect(savedGameState?.seasonState.contractEvents?.[0]?.exitValue).toBe(8);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.saleFactor).toBe(1);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.marketValueAtExit).toBe(8);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.purchasePrice).toBe(10);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.profitLoss).toBe(-2);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.newLength).toBe(0);
    expect(savedGameState?.transferHistory[0]?.transferType).toBe("contract_exit");
    expect(savedGameState?.transferHistory[0]?.fee).toBe(8);
  });

  it("blocks season-end contract apply without confirm token", () => {
    const player = createPlayer("p1");
    const save = createSave(createGameState({ players: [player], rosters: [createRosterEntry("p1", { contractLength: 1 })] }));
    const persistence = createPersistenceMock();

    const result = applySeasonEndContractTick(save, null, persistence);

    expect(result.applied).toBe(false);
    expect(result.blockingReasons).toContain("confirm_token_required");
    expect(vi.mocked(persistence.saveSingleplayerState)).not.toHaveBeenCalled();
  });

  it("renews a contract only through preview token and writes salary, length, and event", () => {
    const player = createPlayer("p1");
    const save = createSave(createGameState({ players: [player], rosters: [createRosterEntry("p1", { contractLength: 1, salary: 6 })] }));
    const persistence = createPersistenceMock();
    const preview = previewContractRenewalAction({
      save,
      teamId: "A-A",
      playerId: "p1",
      action: "renew",
      contractLength: 4,
      offeredSalary: 8,
    });

    const result = applyContractRenewalAction({
      save,
      teamId: "A-A",
      playerId: "p1",
      action: "renew",
      contractLength: 4,
      offeredSalary: 8,
      confirmToken: preview.confirmToken,
      persistence,
      source: "manual_contract_renewal",
    });
    const savedGameState = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1];

    expect(result.applied).toBe(true);
    expect(savedGameState?.rosters[0]?.contractLength).toBe(4);
    expect(savedGameState?.rosters[0]?.salary).toBe(8);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.eventType).toBe("contract_renewed");
  });

  it("applies morale to renewal salary and limits very unhappy players to short bridge deals", () => {
    const player = createPlayer("p1", {
      salaryDemand: 12,
      displaySalary: 12,
      traitsNegative: ["Lazy", "Diva", "Mercenary", "Renegade"],
      trainingMode: "hart",
    });
    const save = createSave(
      createGameState({
        players: [player],
        rosters: [createRosterEntry("p1", { contractLength: 1, salary: 3, roleTag: "starter" })],
      }),
    );

    const shortPreview = previewContractRenewalAction({
      save,
      teamId: "A-A",
      playerId: "p1",
      action: "renew",
      contractLength: 1,
    });
    const longPreview = previewContractRenewalAction({
      save,
      teamId: "A-A",
      playerId: "p1",
      action: "renew",
      contractLength: 4,
    });

    expect(shortPreview.morale?.contractIntent).toBe("considering_exit");
    expect(shortPreview.morale?.salaryModifier).toBeGreaterThan(1);
    expect(shortPreview.moraleAdjustedExpectedSalary).toBeGreaterThan(shortPreview.negotiationPreview?.expectedSalary ?? 0);
    expect(longPreview.ok).toBe(false);
    expect(longPreview.blockingReasons).toContain("morale_contract_length_limited");
  });

  it("pays current VK and writes contract_exit history when a human releases a player", () => {
    const team = createTeam({ humanControlled: true, cash: 73 });
    const player = createPlayer("p1", { marketValue: 40, displayMarketValue: 40, salaryDemand: 9, displaySalary: 9 });
    const save = createSave(
      createGameState({
        teams: [team],
        players: [player],
        rosters: [createRosterEntry("p1", { contractLength: 0, contractStatus: "renewal_pending", salary: 9, purchasePrice: 30, currentValue: 40 })],
      }),
    );
    const persistence = createPersistenceMock();
    const preview = previewContractRenewalAction({
      save,
      teamId: "A-A",
      playerId: "p1",
      action: "release",
    });

    const result = applyContractRenewalAction({
      save,
      teamId: "A-A",
      playerId: "p1",
      action: "release",
      confirmToken: preview.confirmToken,
      persistence,
      source: "manual_player_release",
    });
    const savedGameState = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1];

    expect(result.applied).toBe(true);
    expect(savedGameState?.rosters).toHaveLength(0);
    expect(savedGameState?.teams[0]?.cash).toBe(113);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.eventType).toBe("player_released");
    expect(savedGameState?.seasonState.contractEvents?.[0]?.exitValue).toBe(40);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.saleFactor).toBe(1);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.marketValueAtExit).toBe(40);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.purchasePrice).toBe(30);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.profitLoss).toBe(10);
    expect(savedGameState?.transferHistory[0]?.transferType).toBe("contract_exit");
    expect(savedGameState?.transferHistory[0]?.fee).toBe(40);
    expect(savedGameState?.transferHistory[0]?.salary).toBe(9);
  });

  it("lets AI teams have auto-renewal candidates while human teams require manual decisions", () => {
    const aiTeam = createTeam({ teamId: "AI", shortCode: "AI", humanControlled: false });
    const humanTeam = createTeam({ teamId: "H-U", shortCode: "H-U", humanControlled: true });
    const players = [
      createPlayer("ai-player", { rating: 90 }),
      createPlayer("human-player", { rating: 50 }),
    ];
    const rosters = [
      createRosterEntry("ai-player", { teamId: "AI", contractLength: 1 }),
      createRosterEntry("human-player", { teamId: "H-U", contractLength: 1 }),
    ];
    const save = createSave(createGameState({ teams: [aiTeam, humanTeam], players, rosters }));

    const preview = previewSeasonEndContracts(save);
    const aiRow = preview.rows.find((row) => row.teamId === "AI");
    const humanRow = preview.rows.find((row) => row.teamId === "H-U");

    expect(aiRow?.recommendedAction).toBe("renew");
    expect(preview.aiRenewalCandidates).toBe(1);
    expect(humanRow?.recommendedAction).toBe("manual_decision");
    expect(preview.manualDecisionCount).toBe(1);
  });
});
