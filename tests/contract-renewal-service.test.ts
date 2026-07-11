import { describe, expect, it, vi } from "vitest";

import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import {
  applyContractRenewalAction,
  applySeasonEndContractTick,
  previewContractRenewalAction,
  previewSeasonEndContracts,
  resolveContractExitRenewBias,
  resolveContractRenewalTco,
} from "@/lib/contracts/contract-renewal-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { assessPlayerMorale } from "@/lib/morale/player-morale-service";

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

let contractTestSaveCounter = 0;

function createSave(gameState: GameState): PersistedSaveGame {
  contractTestSaveCounter += 1;
  return {
    saveId: `contract-test-save-${contractTestSaveCounter}`,
    name: "Contract Test Save",
    status: "active",
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    gameState,
  };
}

function createAngryRenewalGameState() {
  const team = createTeam({ teamId: "C-C", shortCode: "C-C" });
  const player = createPlayer("angry", {
    traitsNegative: ["Lazy", "Diva", "Mercenary", "Renegade"],
    trainingMode: "hart",
  });
  const teammate = createPlayer("bad-fit", { className: "Mage", race: "Elf", traitsPositive: ["Saintly"] });
  return {
    ...createGameState({
      teams: [team],
      players: [player, teammate],
      rosters: [
        createRosterEntry("angry", {
          teamId: "C-C",
          contractLength: 0,
          contractStatus: "renewal_pending",
          salary: 3,
          roleTag: "starter",
        }),
        createRosterEntry("bad-fit", { teamId: "C-C", roleTag: "bench" }),
      ],
    }),
    teamIdentities: [
      {
        teamId: "C-C",
        pow: 8,
        spe: 5,
        men: 5,
        soc: 4,
        ambition: 5,
        finances: 5,
        boardConfidence: 50,
        harmony: 5,
        manners: 5,
        popularity: 5,
        cooperation: 5,
        playerMin: 7,
        playerOpt: 10,
      },
    ],
    disciplines: [{ id: "climb", name: "Climbing", category: "power", weight: 1, playerCount: 6 }],
    seasonState: {
      ...createGameState().seasonState,
      standings: { "C-C": { points: 0, rank: 32 } },
      matchdayResults: [
        {
          id: "result-1",
          saveId: "save",
          seasonId: "season-2",
          matchdayId: "matchday-1",
          status: "preview_applied",
          sourceVersion: "test",
          teamsTotal: 1,
          teamsReady: 1,
          teamsUnderfilled: 0,
          teamsMissingLineup: 0,
          teamsInvalidLineup: 0,
          teamsMissingScoreCoverage: 0,
          warningsCount: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
      playerDisciplinePerformances: [],
    },
  } satisfies GameState;
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

  it("lets AI renew valuable players when the season tick reaches LZ 0", () => {
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

  it("lets AI choose non-balanced renewal shapes when team profile and cash context support it", () => {
    const team = createTeam({ teamId: "C-C", shortCode: "C-C", name: "Cash Creators", cash: 220, humanControlled: false });
    const player = createPlayer("value-core", { rating: 96, marketValue: 48, displayMarketValue: 48, salaryDemand: 8, displaySalary: 8 });
    const save = createSave(
      createGameState({
        teams: [team],
        players: [player],
        rosters: [createRosterEntry(player.id, { teamId: team.teamId, contractLength: 1, salary: 6, currentValue: 48 })],
      }),
    );
    const persistence = createPersistenceMock();
    const preview = previewSeasonEndContracts(save);
    const row = preview.rows.find((entry) => entry.playerId === player.id);

    const result = applySeasonEndContractTick(save, preview.confirmToken, persistence);
    const savedGameState = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1];

    expect(row?.recommendedAction).toBe("renew");
    expect(row?.recommendedContractShape).toBe("front_loaded");
    expect(row?.warnings).toContain("ai_contract_shape:front_loaded");
    expect(result.renewedPlayers).toBe(1);
    expect(savedGameState?.rosters[0]?.contractShape).toBe("front_loaded");
    expect(savedGameState?.rosters[0]?.yearlySalarySchedule?.[0]?.salary).toBeGreaterThan(
      savedGameState?.rosters[0]?.yearlySalarySchedule?.at(-1)?.salary ?? 0,
    );
  });

  it("lets AI renew useful players that are already at contract length 0", () => {
    const player = createPlayer("p1", { rating: 72, marketValue: 32, displayMarketValue: 32, salaryDemand: 6, displaySalary: 6 });
    const save = createSave(createGameState({ players: [player], rosters: [createRosterEntry("p1", { contractLength: 0, contractStatus: "out_of_contract", salary: 6, currentValue: 32 })] }));
    const persistence = createPersistenceMock();
    const preview = previewSeasonEndContracts(save);
    const row = preview.rows.find((entry) => entry.playerId === "p1");

    const result = applySeasonEndContractTick(save, preview.confirmToken, persistence);
    const savedGameState = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1];

    expect(row?.statusBeforeTick).toBe("out_of_contract");
    expect(row?.statusAfterTick).toBe("out_of_contract");
    expect(row?.recommendedAction).toBe("renew");
    expect(result.renewedPlayers).toBe(1);
    expect(savedGameState?.rosters[0]?.contractLength).toBeGreaterThan(0);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.eventType).toBe("contract_renewed");
    expect(savedGameState?.seasonState.contractEvents?.[0]?.oldLength).toBe(0);
  });

  it("does not pre-renew useful players before their contract reaches LZ 0", () => {
    const player = createPlayer("p1", { rating: 72, marketValue: 32, displayMarketValue: 32, salaryDemand: 6, displaySalary: 6 });
    const save = createSave(createGameState({ players: [player], rosters: [createRosterEntry("p1", { contractLength: 2, salary: 6, currentValue: 32 })] }));
    const persistence = createPersistenceMock();
    const preview = previewSeasonEndContracts(save);
    const row = preview.rows.find((entry) => entry.playerId === "p1");

    const result = applySeasonEndContractTick(save, preview.confirmToken, persistence);
    const savedGameState = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1];

    expect(row?.statusAfterTick).toBe("expiring");
    expect(row?.recommendedAction).toBe("no_action");
    expect(result.renewedPlayers).toBe(0);
    expect(savedGameState?.rosters).toHaveLength(1);
    expect(savedGameState?.rosters[0]?.contractLength).toBe(1);
    expect(savedGameState?.rosters[0]?.contractStatus).toBe("expiring");
    expect(savedGameState?.seasonState.contractEvents ?? []).toHaveLength(0);
  });

  it("does not pre-renew expensive low-value players just because they would be LZ 1", () => {
    const player = createPlayer("p1", { rating: 34, marketValue: 9, displayMarketValue: 9, salaryDemand: 14, displaySalary: 14 });
    const save = createSave(createGameState({ players: [player], rosters: [createRosterEntry("p1", { contractLength: 2, salary: 14, currentValue: 9 })] }));
    const persistence = createPersistenceMock();
    const preview = previewSeasonEndContracts(save);
    const row = preview.rows.find((entry) => entry.playerId === "p1");

    const result = applySeasonEndContractTick(save, preview.confirmToken, persistence);
    const savedGameState = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1];

    expect(row?.statusAfterTick).toBe("expiring");
    expect(row?.recommendedAction).toBe("no_action");
    expect(result.renewedPlayers).toBe(0);
    expect(savedGameState?.rosters[0]?.contractLength).toBe(1);
    expect(savedGameState?.seasonState.contractEvents ?? []).toHaveLength(0);
  });

  it("does not let AI renew while team cash is negative", () => {
    const team = createTeam({ cash: -3, humanControlled: false });
    const player = createPlayer("p1", { rating: 95, marketValue: 40, displayMarketValue: 40 });
    const save = createSave(
      createGameState({
        teams: [team],
        players: [player],
        rosters: [createRosterEntry("p1", { contractLength: 1, salary: 6, currentValue: 40 })],
      }),
    );
    const persistence = createPersistenceMock();
    const preview = previewSeasonEndContracts(save);
    const row = preview.rows.find((entry) => entry.playerId === "p1");

    const result = applySeasonEndContractTick(save, preview.confirmToken, persistence);
    const savedGameState = vi.mocked(persistence.saveSingleplayerState).mock.calls[0]?.[1];

    expect(row?.recommendedAction).toBe("release");
    expect(row?.warnings.some((warning) => warning.startsWith("ai_cash_buffer_required"))).toBe(true);
    expect(result.renewedPlayers).toBe(0);
    expect(savedGameState?.rosters).toHaveLength(0);
    expect(savedGameState?.seasonState.contractEvents?.[0]?.eventType).toBe("contract_expired_exit");
  });

  it("keeps Retool length bands intact before applying morale to AI renewal salary", () => {
    const player = createPlayer("lazkul-like", {
      rating: 95,
      marketValue: 34,
      displayMarketValue: 34,
      salaryDemand: 12,
      displaySalary: 12,
      className: "Warlord",
      race: "Lizard",
      traitsPositive: ["FiredUp", "Cool"],
      traitsNegative: [],
    });
    const save = createSave(
      createGameState({
        players: [player],
        rosters: [createRosterEntry(player.id, { contractLength: 0, contractStatus: "renewal_pending", salary: 9.63, roleTag: "starter" })],
      }),
    );

    const oneYear = previewContractRenewalAction({
      save,
      teamId: "A-A",
      playerId: player.id,
      action: "renew",
      contractLength: 1,
    });
    const fourYear = previewContractRenewalAction({
      save,
      teamId: "A-A",
      playerId: player.id,
      action: "renew",
      contractLength: 4,
    });
    const seasonEndRow = previewSeasonEndContracts(save).rows.find((row) => row.playerId === player.id);

    expect(fourYear.negotiationPreview?.expectedSalary ?? 0).toBeLessThan(oneYear.negotiationPreview?.expectedSalary ?? 0);
    expect(fourYear.moraleAdjustedExpectedSalary ?? 0).toBeLessThan(oneYear.moraleAdjustedExpectedSalary ?? 0);
    expect(seasonEndRow?.recommendedLength).toBeGreaterThanOrEqual(3);
    expect(seasonEndRow?.recommendedLength ?? 0).toBeLessThanOrEqual(4);
    expect(seasonEndRow?.renewalSalaryPreview ?? 0).toBeLessThan(oneYear.moraleAdjustedExpectedSalary ?? 0);
    expect(seasonEndRow?.warnings).not.toContain("long_contract_salary_discount_guard_applied");
  });

  // Root-cause regression (2026-07-04, contract-length synchronized-expiry-wave -- see
  // outputs/real-engine-s1s5-final/progress-log.md): getRecommendedLength used to return one
  // single fixed number per (roleTag, highValue, conservativeTeam) bucket, so every "bench"
  // player renewed at exactly the same length every season -- turning renewals into another
  // synchronized wave. It now reuses the same organic, trait/seed-based idealLength that new
  // signings already get (buildPlayerContractPreference) as a baseline and only uses role/value/
  // cash context as bounds, so otherwise-identical bench players spread across the allowed range.
  it("spreads recommended renewal lengths across otherwise-identical bench players instead of collapsing them onto one fixed number", () => {
    const team = createTeam({ teamId: "D-D", shortCode: "D-D", cash: 150 });
    // These specific ids are picked because their deterministic trait/seed hash (see
    // buildPlayerContractPreference) resolves to different idealLength values (2 vs. 3) --
    // demonstrating that otherwise-identical bench players no longer collapse onto one number.
    const playerIds = ["bench-1", "bench-2", "bench-9", "bench-16"];
    const players = playerIds.map((id) => createPlayer(id, { rating: 55, marketValue: 20, displayMarketValue: 20 }));
    const rosters = playerIds.map((id) =>
      createRosterEntry(id, { teamId: "D-D", roleTag: "bench", contractLength: 3, salary: 5 }),
    );
    const save = {
      ...createSave(createGameState({ teams: [team], players, rosters })),
      saveId: "contract-length-diversity-bench",
    };

    const preview = previewSeasonEndContracts(save);
    const lengths = playerIds.map((id) => preview.rows.find((row) => row.playerId === id)?.recommendedLength);

    expect(lengths.every((length) => typeof length === "number")).toBe(true);
    // Not every bench player should land on the exact same recommended length -- that uniformity
    // is precisely what caused every renewal cohort to expire together.
    expect(new Set(lengths).size).toBeGreaterThan(1);
    for (const length of lengths) {
      expect(length).toBeGreaterThanOrEqual(1);
      expect(length).toBeLessThanOrEqual(3);
    }
  });

  it("keeps renewal length bounded by role, quality and team cash after the organic-baseline fix", () => {
    const cashTightTeam = createTeam({ teamId: "E-E", shortCode: "E-E", cash: 10 });
    const benchOnTightBudget = createPlayer("bench-tight", { rating: 50, marketValue: 15, displayMarketValue: 15 });
    const tightSave = {
      ...createSave(
        createGameState({
          teams: [cashTightTeam],
          players: [benchOnTightBudget],
          rosters: [createRosterEntry(benchOnTightBudget.id, { teamId: "E-E", roleTag: "bench", contractLength: 3, salary: 4 })],
        }),
      ),
      saveId: "contract-length-bounds-cash-tight",
    };
    const tightRow = previewSeasonEndContracts(tightSave).rows.find((row) => row.playerId === benchOnTightBudget.id);
    // Cash-tight teams must still not commit long-term to a bench player, no matter what the
    // player's own organic baseline would otherwise prefer.
    expect(tightRow?.recommendedLength).toBeLessThanOrEqual(2);

    const wealthyTeam = createTeam({ teamId: "F-F", shortCode: "F-F", cash: 200 });
    const starPlayer = createPlayer("elite-starter", { rating: 99, marketValue: 90, displayMarketValue: 90 });
    const fillerPlayers = ["filler-a", "filler-b", "filler-c"].map((id) => createPlayer(id, { rating: 20, marketValue: 5, displayMarketValue: 5 }));
    const starterSave = {
      ...createSave(
        createGameState({
          teams: [wealthyTeam],
          players: [starPlayer, ...fillerPlayers],
          rosters: [
            createRosterEntry(starPlayer.id, { teamId: "F-F", roleTag: "starter", contractLength: 3, salary: 20 }),
            ...fillerPlayers.map((player) => createRosterEntry(player.id, { teamId: "F-F", roleTag: "bench", contractLength: 3, salary: 2 })),
          ],
        }),
      ),
      saveId: "contract-length-bounds-highvalue-starter",
    };
    const starterRow = previewSeasonEndContracts(starterSave).rows.find((row) => row.playerId === starPlayer.id);
    // A clear top-of-the-league starter on a wealthy team must still get a real multi-season
    // commitment -- the organic baseline only adds variety, it never overrides the security floor.
    expect(starterRow?.recommendedLength).toBeGreaterThanOrEqual(3);
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
    const save = createSave(createGameState({ players: [player], rosters: [createRosterEntry("p1", { contractLength: 0, contractStatus: "renewal_pending", salary: 6 })] }));
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

  it("blocks direct renewals until the contract is at LZ 0", () => {
    const player = createPlayer("p1");
    const save = createSave(createGameState({ players: [player], rosters: [createRosterEntry("p1", { contractLength: 1, salary: 6 })] }));

    const preview = previewContractRenewalAction({
      save,
      teamId: "A-A",
      playerId: "p1",
      action: "renew",
      contractLength: 4,
      offeredSalary: 8,
    });

    expect(preview.ok).toBe(false);
    expect(preview.blockingReasons).toContain("renewal_only_allowed_at_lz_0");
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
        rosters: [createRosterEntry("p1", { contractLength: 0, contractStatus: "renewal_pending", salary: 3, roleTag: "starter" })],
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

  it("blocks manual renewal when player refuses extension", () => {
    const gameState = createAngryRenewalGameState();
    const morale = assessPlayerMorale({
      gameState,
      playerId: "angry",
      teamId: "C-C",
      renewalSalaryPreview: 10,
    });
    expect(morale?.contractIntent).toBe("refuses_extension");

    const save = createSave(gameState);
    const preview = previewContractRenewalAction({
      save,
      teamId: "C-C",
      playerId: "angry",
      action: "renew",
      contractLength: 1,
    });

    expect(preview.morale?.contractIntent).toBe("refuses_extension");
    expect(preview.ok).toBe(false);
    expect(preview.blockingReasons).toContain("morale_refuses_extension");
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

  it("honors extend_core contract strategy for borderline rotation players", () => {
    const team = createTeam({ teamId: "A-A", cash: 40, humanControlled: false });
    const player = createPlayer("p-core", { rating: 58, marketValue: 18, salaryDemand: 4 });
    const save = createSave(
      createGameState({
        teams: [team],
        players: [player],
        rosters: [
          createRosterEntry("p-core", {
            teamId: "A-A",
            contractLength: 0,
            contractStatus: "renewal_pending",
            salary: 4,
            roleTag: "rotation",
          }),
        ],
        seasonState: {
          teamControlSettings: {
            "A-A": {
              teamId: "A-A",
              controlMode: "ai",
              aiLineupPreviewEnabled: true,
              aiLineupAutoApplyEnabled: true,
              aiTransferPreviewEnabled: true,
              aiTransferAutoApplyEnabled: true,
              aiSellPreviewEnabled: true,
              aiSellAutoApplyEnabled: true,
            },
          },
          aiManagerContractStrategies: {
            "A-A:p-core": {
              teamId: "A-A",
              playerId: "p-core",
              strategy: "extend_core",
              updatedAt: new Date().toISOString(),
            },
          },
        },
      }),
    );

    const preview = previewSeasonEndContracts(save);
    const row = preview.rows.find((entry) => entry.playerId === "p-core");
    expect(row?.recommendedAction).toBe("renew");
  });

  it("renews rotation players when roster is under min despite tight cash", () => {
    const team = createTeam({ teamId: "A-A", cash: 12, humanControlled: false });
    const players = Array.from({ length: 7 }, (_, index) =>
      createPlayer(`p-${index}`, { rating: 74, marketValue: 30, salaryDemand: 3 }),
    );
    const rosters = players.map((player) =>
      createRosterEntry(player.id, {
        teamId: "A-A",
        contractLength: 1,
        roleTag: "starter",
        salary: 3,
      }),
    );
    const gameState = createGameState({ teams: [team], players, rosters });
    gameState.teamIdentities = [{ teamId: "A-A", identityId: "A-A", playerMin: 8, playerMax: 14, playerOpt: 10 }];
    const save = createSave(gameState);

    const preview = previewSeasonEndContracts(save);
    const row = preview.rows.find((entry) => entry.playerId === "p-3");
    expect(row?.recommendedAction).toBe("renew");
    expect(row?.renewalBlockReason).not.toBe("cash_gate");
  });

  it("caps mass releases per team tick and bridges with 1-year renewals", () => {
    const team = createTeam({ teamId: "A-A", cash: 80, humanControlled: false });
    const players = Array.from({ length: 12 }, (_, index) =>
      createPlayer(`p-${index}`, { rating: 52 + index, marketValue: 40 }),
    );
    const rosters = players.map((player) =>
      createRosterEntry(player.id, {
        teamId: "A-A",
        contractLength: 1,
        roleTag: "rotation",
        salary: 3,
      }),
    );
    const save = createSave(createGameState({ teams: [team], players, rosters }));
    const preview = previewSeasonEndContracts(save);
    const releaseCandidates = preview.rows.filter((row) => row.recommendedAction === "release");
    expect(releaseCandidates.length).toBeGreaterThan(3);

    const persistence = {
      getSaveById: () => save,
      saveSingleplayerState: vi.fn((saveId: string, gameState: GameState) => {
        save.gameState = gameState;
        return { saveId, updatedAt: new Date().toISOString(), gameState };
      }),
    } as unknown as PersistenceService;

    const apply = applySeasonEndContractTick(save, preview.confirmToken, persistence, preview);
    expect(apply.applied).toBe(true);
    expect(apply.releasedPlayers).toBeLessThanOrEqual(3);
    expect(apply.renewedPlayers).toBeGreaterThan(0);
  });

  it("resolveContractExitRenewBias treats material purchase-to-exit cash loss like sell loss resistance", () => {
    const materialLoss = resolveContractExitRenewBias({
      exitProfitLoss: -5,
      exitPurchasePrice: 20,
      exitValue: 15,
      renewalSalary: 4,
      currentSalary: 4,
      ratingValue: 48,
      badValueContract: false,
    });
    const acceptableLoss = resolveContractExitRenewBias({
      exitProfitLoss: -1,
      exitPurchasePrice: 20,
      exitValue: 19,
      renewalSalary: 6,
      currentSalary: 6,
      ratingValue: 48,
      badValueContract: false,
    });

    expect(materialLoss.shouldBiasRenew).toBe(true);
    expect(materialLoss.preferRenewOverExit).toBe(true);
    expect(materialLoss.score).toBeGreaterThan(0.22);
    expect(acceptableLoss.shouldBiasRenew).toBe(false);
    expect(acceptableLoss.preferRenewOverExit).toBe(false);
  });

  it("prefers renewal over contract exit when exit cash is far below purchase price", () => {
    const player = createPlayer("p-loss", {
      rating: 38,
      marketValue: 16,
      displayMarketValue: 16,
      salaryDemand: 6,
      displaySalary: 6,
    });
    const save = createSave(
      createGameState({
        players: [player],
        rosters: [
          createRosterEntry("p-loss", {
            contractLength: 1,
            salary: 6,
            purchasePrice: 20,
            currentValue: 16,
            roleTag: "bench",
          }),
        ],
        teams: [createTeam({ cash: 40 })],
      }),
    );

    const preview = previewSeasonEndContracts(save);
    const row = preview.rows.find((entry) => entry.playerId === "p-loss");

    expect(row?.recommendedAction).toBe("renew");
    expect(row?.warnings.some((warning) => warning.startsWith("contract_exit_loss_renew_bias:"))).toBe(true);
  });

  it("resolveContractRenewalTco prefers renew when exit path is more expensive", () => {
    const tco = resolveContractRenewalTco({
      exitProfitLoss: -8,
      exitPurchasePrice: 20,
      exitValue: 12,
      renewalSalary: 4,
      currentSalary: 4,
      renewLength: 1,
      ratingValue: 46,
      badValueContract: false,
    });
    expect(tco.exitTco).toBeGreaterThan(tco.renewTco);
    expect(tco.shouldBiasRenew).toBe(true);
  });

  it("blocks release under hard min when preview recommends renew and apply matches preview", () => {
    const team = createTeam({ teamId: "A-A", cash: 18, humanControlled: false });
    const players = Array.from({ length: 7 }, (_, index) =>
      createPlayer(`p-${index}`, { rating: 62, marketValue: 22, salaryDemand: 3 }),
    );
    const rosters = players.map((player) =>
      createRosterEntry(player.id, { teamId: "A-A", contractLength: 1, salary: 3, roleTag: "rotation" }),
    );
    const gameState = createGameState({ teams: [team], players, rosters });
    gameState.teamIdentities = [{ teamId: "A-A", identityId: "A-A", playerMin: 8, playerMax: 14, playerOpt: 10 }];
    const save = createSave(gameState);
    const preview = previewSeasonEndContracts(save);
    const renewRow = preview.rows.find((row) => row.recommendedAction === "renew");
    expect(renewRow).toBeTruthy();
    expect(renewRow?.canRenewEffective).toBe(true);

    const persistence = {
      getSaveById: () => save,
      saveSingleplayerState: vi.fn((saveId: string, nextState: GameState) => {
        save.gameState = nextState;
        return { saveId, updatedAt: new Date().toISOString(), gameState: nextState };
      }),
    } as unknown as PersistenceService;
    const apply = applySeasonEndContractTick(save, preview.confirmToken, persistence, preview);
    expect(apply.applied).toBe(true);
    expect(apply.renewedPlayers).toBeGreaterThan(0);
    expect(save.gameState.rosters.length).toBeGreaterThanOrEqual(7);
  });
});
