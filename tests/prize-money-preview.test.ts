import { describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";
import { buildPrizeMoneyPreview } from "@/lib/season/prize-money-preview";

vi.mock("@/lib/season/prize-money-sheet", () => ({
  readNormalizedPrizeMoneyRows: vi.fn(async () =>
    Array.from({ length: 32 }, (_, index) => ({
      rank: index + 1,
      prizeMoney: index === 0 ? 91.4 : index === 1 ? 88 : 80 - index,
      basis: index === 0 ? 15 : index === 1 ? 15.4 : 16 + index * 0.2,
      season: index === 0 ? "76.3" : index === 1 ? "72.5" : String(64 - index),
    })),
  ),
  readPrizeMoneySourceBundle: vi.fn(async () => ({
    normalizedRows: [],
    placementRows: [
      { rankDelta: 10, placementAmount: 12.84, percent: 10, sourceRow: 24 },
      { rankDelta: 1, placementAmount: 1.28, percent: 1, sourceRow: 34 },
      { rankDelta: 0, placementAmount: 0, percent: 0, sourceRow: 35 },
      { rankDelta: -1, placementAmount: -0.96, percent: -0.75, sourceRow: 36 },
      { rankDelta: -10, placementAmount: -7.32, percent: -5.7, sourceRow: 44 },
    ],
    seasonFactors: [
      { seasonLabel: "Aktuell", factor: 1.09, sourceRow: 4 },
      { seasonLabel: "Season +1", factor: 1.21, sourceRow: 5 },
      { seasonLabel: "Season +2", factor: 1.16, sourceRow: 6 },
      { seasonLabel: "Season +3", factor: 0.97, sourceRow: 7 },
      { seasonLabel: "Season +4", factor: 0.9, sourceRow: 8 },
    ],
  })),
}));

function createPersistenceMock() {
  const save: PersistedSaveGame = {
    saveId: "save-local",
    name: "Local",
    status: "active",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    gameState: {
      season: {
        id: "season-1",
        name: "Season 1",
        year: 1,
        currentMatchday: 1,
        matchdayIds: ["matchday-1"],
      },
      seasonState: {
        seasonId: "season-1",
        schedule: [],
        standings: {
          "W-W": { points: 22, rank: 1, startplatz: 11 },
          "P-S": { points: 19, rank: 2, startplatz: 1 },
          "U-U": { points: 18, rank: 3, startplatz: 3 },
          "X-X": { points: 17, rank: undefined },
        },
        // The salary factor is a per-save random roll now (see season-economy-factors); pin an explicit
        // window here so the prize-math assertions stay deterministic and independent of the roll.
        seasonEconomyFactors: [1.09, 1.21, 1.16, 0.97, 0.9].map((factor, horizonIndex) => ({
          seasonId: "season-1",
          seasonLabel: horizonIndex === 0 ? "Aktuell" : `Season +${horizonIndex}`,
          horizonIndex,
          factor,
          source: "sheet_seed" as const,
          rollSeed: null,
          carriedFromSeasonId: null,
          generatedAt: "2026-06-04T00:00:00.000Z",
        })),
      },
      matchdayState: {
        matchdayId: "matchday-1",
        status: "planning",
        pendingTeamIds: [],
        resolvedFixtureIds: [],
      },
      teams: [
        { teamId: "W-W", shortCode: "W-W", name: "Wicked Wizards", budget: 100, cash: 37.9, identityId: "a", humanControlled: true, rosterLimit: 12 },
        { teamId: "P-S", shortCode: "P-S", name: "Project Suicide", budget: 100, cash: 49.8, identityId: "b", humanControlled: true, rosterLimit: 12 },
        { teamId: "U-U", shortCode: "U-U", name: "Unchanged United", budget: 100, cash: 20, identityId: "u", humanControlled: true, rosterLimit: 12 },
        { teamId: "X-X", shortCode: "X-X", name: "X Team", budget: 100, cash: 0, identityId: "c", humanControlled: true, rosterLimit: 12 },
      ],
      teamIdentities: [],
      players: [],
      disciplines: [],
      rosters: [],
      contracts: [],
      transferListings: [],
      transferHistory: [],
      logs: [],
      mappingReport: {
        mappingSource: "test",
        teamSource: "test",
        generatedAt: "2026-06-04T00:00:00.000Z",
        processedMappingRows: 0,
        importedPlayerCount: 0,
        matchedRosterCount: 0,
        teamCount: 3,
        unmappedPlayers: [],
        teamsWithoutPlayers: [],
        mappingRowsWithoutPlayerMatch: [],
        duplicateMappedPlayers: [],
        unknownTeamCodes: [],
        duplicateTeamCodes: [],
        warnings: [],
      },
    } as GameState,
  };

  return {
    persistence: {
      bootstrapSingleplayerSave: vi.fn(() => ({ save, createdFromSeed: false })),
      getActiveSave: vi.fn(() => save),
      getSaveById: vi.fn((saveId: string) => (saveId === save.saveId ? save : null)),
      saveSingleplayerState: vi.fn(),
      createSave: vi.fn(),
      createFreshSeasonOneSave: vi.fn(),
      cloneSave: vi.fn(),
      activateSave: vi.fn(),
      listSaves: vi.fn(() => []),
    },
  };
}

describe("prize money preview", () => {
  it("maps rank 1-32 prize rows from the normalized sheet and projects cash locally", async () => {
    const { persistence } = createPersistenceMock();
    const result = await buildPrizeMoneyPreview(
      { saveId: "save-local", seasonId: "season-1", source: "sqlite" },
      persistence as never,
    );

    expect(result.source.mode).toBe("sqlite");
    expect(result.source.prizeTable).toBe("normalized_sheet");
    expect(result.items[0]).toMatchObject({
      teamId: "W-W",
      rank: 1,
      points: 22,
      currentCash: 37.9,
      prizeMoney: 91.4,
      rankChangePrize: {
        source: "sheet",
        startRankSource: "standing_startplatz",
        startRank: 11,
        finalRank: 1,
        rankDelta: 10,
        bonusMalus: 12.84,
      },
      projectedCash: 142.1,
      basisCash: 15,
      seasonCash: 76.3,
      payoutIfTenBetter: 91.4,
      payoutIfTenWorse: 84.1,
      status: "ready",
    });
    expect(result.items[1]).toMatchObject({
      teamId: "P-S",
      rank: 2,
      prizeMoney: 88,
      rankChangePrize: {
        source: "sheet",
        startRankSource: "standing_startplatz",
        startRank: 1,
        finalRank: 2,
        rankDelta: -1,
        bonusMalus: -0.96,
      },
      projectedCash: 136.8,
      status: "ready",
    });
    expect(result.items[2]).toMatchObject({
      teamId: "U-U",
      rank: 3,
      rankChangePrize: {
        source: "sheet",
        startRankSource: "standing_startplatz",
        startRank: 3,
        finalRank: 3,
        rankDelta: 0,
        bonusMalus: 0,
      },
    });
    expect(result.summary.totalRankChangePrize).toBe(11.9);
    expect(result.summary.currentFactor).toBe(1.09);
    expect(result.summary.futureSeasonCount).toBe(4);
    expect(result.items[0]?.futureSeasons).toContainEqual(
      expect.objectContaining({
        seasonLabel: "Season +1",
        factor: 1.21,
        prizeMoney: 99.7,
        salaryTotal: 0,
        projectedCash: 137.6,
      }),
    );
  });

  it("subtracts team salary from season-end projected cash instead of adding sponsor only", async () => {
    const { persistence } = createPersistenceMock();
    const save = persistence.getActiveSave();
    if (save) {
      save.gameState.rosters = [
        {
          id: "roster-wage-1",
          teamId: "W-W",
          playerId: "missing-player-ok",
          salary: 20,
          upkeep: 20,
          contractLength: 2,
          purchasePrice: 10,
          currentValue: 10,
          roleTag: "starter",
          joinedSeasonId: "season-1",
        },
      ] as GameState["rosters"];
    }

    const result = await buildPrizeMoneyPreview(
      { saveId: "save-local", seasonId: "season-1", source: "sqlite" },
      persistence as never,
    );

    const row = result.items.find((item) => item.teamId === "W-W");
    expect(row?.salaryTotal).toBe(20);
    expect(row?.projectedCash).toBe(122.1);
    expect(row?.projectedCash).not.toBe(142.1);
    expect(row?.futureSeasons.find((entry) => entry.seasonLabel === "Season +1")?.projectedCash).toBe(117.6);
  });

  it("marks missing rank without faking a zero prize", async () => {
    const { persistence } = createPersistenceMock();
    const result = await buildPrizeMoneyPreview(
      { saveId: "save-local", seasonId: "season-1", source: "sqlite" },
      persistence as never,
    );

    const row = result.items.find((item) => item.teamId === "X-X");
    expect(row?.status).toBe("missing_rank");
    expect(row?.prizeMoney).toBeNull();
    expect(row?.rankChangePrize.warning).toBe("missing_rank");
    expect(row?.projectedCash).toBeNull();
    expect(row?.warnings).toContain("missing_rank");
  });

  it("derives Season 1 start rank from start budget when no start rank is stored", async () => {
    const { persistence } = createPersistenceMock();
    const save = persistence.getActiveSave();
    if (save) {
      const teams = Array.from({ length: 32 }, (_, index) => ({
        teamId: `T-${String(index + 1).padStart(2, "0")}`,
        shortCode: `T-${String(index + 1).padStart(2, "0")}`,
        name: `Team ${index + 1}`,
        budget: 320 - index,
        cash: 20,
        identityId: `id-${index + 1}`,
        humanControlled: true,
        rosterLimit: 12,
      }));
      teams[0] = {
        teamId: "M-M",
        shortCode: "M-M",
        name: "Mayhem Mavericks",
        budget: 999,
        cash: 50,
        identityId: "m",
        humanControlled: true,
        rosterLimit: 12,
      };
      teams[31] = {
        teamId: "R-R",
        shortCode: "R-R",
        name: "Riptide Rivers",
        budget: 1,
        cash: 40,
        identityId: "r",
        humanControlled: true,
        rosterLimit: 12,
      };
      save.gameState.teams = teams;
      save.gameState.seasonState.standings = Object.fromEntries(
        teams.map((team, index) => [
          team.teamId,
          {
            points: 32 - index,
            rank: team.teamId === "M-M" ? 2 : team.teamId === "R-R" ? 22 : index + 1,
          },
        ]),
      );
    }

    const result = await buildPrizeMoneyPreview(
      { saveId: "save-local", seasonId: "season-1", source: "sqlite" },
      persistence as never,
    );

    expect(result.items.find((item) => item.teamId === "M-M")?.rankChangePrize).toMatchObject({
      source: "sheet",
      startRankSource: "season1_start_budget",
      startRank: 1,
      finalRank: 2,
      rankDelta: -1,
      bonusMalus: -0.96,
      warning: "start_rank_derived_from_season1_start_budget",
    });
    expect(result.items.find((item) => item.teamId === "R-R")?.rankChangePrize).toMatchObject({
      source: "sheet",
      startRankSource: "season1_start_budget",
      startRank: 32,
      finalRank: 22,
      rankDelta: 10,
      bonusMalus: 12.84,
      warning: "start_rank_derived_from_season1_start_budget",
    });
  });

  it("keeps the base prize visible but flags rank-change when no start rank source exists outside Season 1", async () => {
    const { persistence } = createPersistenceMock();
    const save = persistence.getActiveSave();
    if (save) {
      save.gameState.season.id = "season-2";
      save.gameState.seasonState.seasonId = "season-2";
      save.gameState.seasonState.standings["P-S"] = { points: 19, rank: 2 };
    }

    const result = await buildPrizeMoneyPreview(
      { saveId: "save-local", seasonId: "season-2", source: "sqlite" },
      persistence as never,
    );

    const row = result.items.find((item) => item.teamId === "P-S");
    expect(row).toMatchObject({
      prizeMoney: 88,
      projectedCash: 137.8,
      rankChangePrize: {
        source: "missing",
        startRankSource: "missing",
        startRank: null,
        finalRank: 2,
        rankDelta: null,
        bonusMalus: null,
        warning: "start_rank_source_missing",
      },
    });
    expect(row?.warnings).toContain("start_rank_source_missing");
  });

  it("blocks cleanly in prisma mode", async () => {
    const { persistence } = createPersistenceMock();
    const result = await buildPrizeMoneyPreview(
      { saveId: "save-local", seasonId: "season-1", source: "prisma" },
      persistence as never,
    );

    expect(result.blockedRules).toContain("prisma_read_only_preview_not_supported");
    expect(result.source.mode).toBe("prisma");
    expect(result.items).toHaveLength(0);
  });
});
