import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";

const buildAiTransfermarktSellPreview = vi.hoisted(() => vi.fn());
const createLocalTransfermarktRunContext = vi.hoisted(() => vi.fn());
const executeLocalTransfermarktSell = vi.hoisted(() => vi.fn());
const flushLocalTransfermarktRunContext = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/ai-transfermarkt-sell-preview-service", () => ({
  buildAiTransfermarktSellPreview,
}));

vi.mock("@/lib/market/transfermarkt-local-service", () => ({
  createLocalTransfermarktRunContext,
  executeLocalTransfermarktSell,
  flushLocalTransfermarktRunContext,
}));

import {
  PRESEASON_CASH_BUFFER_TARGET,
  PRESEASON_CASH_PRESSURE_THRESHOLD,
  assessPreseasonCashRecoveryNeed,
  getTeamsBelowPreseasonCashBuffer,
  isPreseasonProactiveCashRecoverySeason,
  runPreseasonProactiveCashRecovery,
} from "@/lib/ai/preseason-cash-recovery-service";

function buildGameState(overrides?: Partial<GameState>): GameState {
  return {
    season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["md-1"] },
    seasonState: {
      seasonId: "season-2",
      schedule: [],
      standings: {},
      teamControlSettings: {},
      teamStrategyProfiles: {},
      disciplineSchedule: [{ seasonId: "season-2", discipline1: { playerCount: 4 }, discipline2: { playerCount: 4 } }],
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      { teamId: "team-a", name: "Team A", shortCode: "TMA", cash: 6, humanControlled: false },
      { teamId: "team-b", name: "Team B", shortCode: "TMB", cash: 40, humanControlled: false },
    ],
    teamIdentities: [
      { teamId: "team-a", identityId: "team-a", playerMin: 8, playerMax: 14, playerOpt: 10 },
      { teamId: "team-b", identityId: "team-b", playerMin: 8, playerMax: 14, playerOpt: 10 },
    ],
    rosters: Array.from({ length: 10 }, (_, index) => ({
      id: `r-a-${index}`,
      teamId: "team-a",
      playerId: `p-a-${index}`,
      slot: index,
      salary: 5,
      contractLength: 2,
      currentValue: 20,
    })),
    players: Array.from({ length: 10 }, (_, index) => ({
      id: `p-a-${index}`,
      name: `Player ${index}`,
      className: "Warrior",
      race: "human",
      coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
      marketValue: 20,
      displayMarketValue: 20,
      salaryDemand: 5,
      displaySalary: 5,
    })),
    transferHistory: [],
    ...overrides,
  } as GameState;
}

describe("preseason cash recovery service", () => {
  beforeEach(() => {
    buildAiTransfermarktSellPreview.mockReset();
    createLocalTransfermarktRunContext.mockReset();
    executeLocalTransfermarktSell.mockReset();
    flushLocalTransfermarktRunContext.mockReset();
  });

  it("enables proactive recovery from season 2 onward", () => {
    expect(isPreseasonProactiveCashRecoverySeason("season-1")).toBe(false);
    expect(isPreseasonProactiveCashRecoverySeason("season-2")).toBe(true);
  });

  it("flags teams below the pressure threshold in season 2", () => {
    const gameState = buildGameState();
    const assessment = assessPreseasonCashRecoveryNeed({
      gameState,
      teamId: "team-a",
      seasonId: "season-2",
    });

    expect(assessment.needed).toBe(true);
    expect(assessment.maxSells).toBeGreaterThan(0);
    expect(assessment.targetCash).toBe(PRESEASON_CASH_BUFFER_TARGET);
    expect(assessment.reason).toContain(String(PRESEASON_CASH_PRESSURE_THRESHOLD));
  });

  it("does not flag healthy cash teams without pressure", () => {
    const gameState = buildGameState();
    const assessment = assessPreseasonCashRecoveryNeed({
      gameState,
      teamId: "team-b",
      seasonId: "season-2",
    });

    expect(assessment.needed).toBe(false);
    expect(assessment.maxSells).toBe(0);
  });

  it("skips proactive pressure in season 1 except for negative cash", () => {
    const gameState = buildGameState({
      season: { id: "season-1", name: "Season 1", year: 2026, currentMatchday: 1, matchdayIds: ["md-1"] },
      teams: [{ teamId: "team-a", name: "Team A", shortCode: "TMA", cash: 4, humanControlled: false }],
    });

    expect(
      assessPreseasonCashRecoveryNeed({ gameState, teamId: "team-a", seasonId: "season-1" }).needed,
    ).toBe(false);
    expect(
      assessPreseasonCashRecoveryNeed({
        gameState: {
          ...gameState,
          teams: [{ teamId: "team-a", name: "Team A", shortCode: "TMA", cash: -2, humanControlled: false }],
        },
        teamId: "team-a",
        seasonId: "season-1",
      }).needed,
    ).toBe(true);
  });

  it("lists teams below the cash buffer target", () => {
    const gameState = buildGameState();
    expect(getTeamsBelowPreseasonCashBuffer(gameState, "season-2")).toEqual([
      expect.objectContaining({ teamId: "team-a", cash: 6 }),
    ]);
  });

  it("executes proactive sells via the AI sell preview pipeline", async () => {
    const gameState = buildGameState();
    const persistence = {
      getSaveById: () => ({ saveId: "save-1", gameState }),
    };

    buildAiTransfermarktSellPreview.mockResolvedValue({
      teams: [
        {
          teamId: "team-a",
          sellCandidates: [
            {
              activePlayerId: "r-a-0",
              sellPriority: 72,
              expectedSellValue: 18,
              marketValue: 20,
              reasonToSell: ["Teamcash ist kritisch niedrig."],
              warnings: [],
            },
          ],
        },
      ],
    });

    const runContext = {
      save: { saveId: "save-1", gameState: structuredClone(gameState) },
      deferredWrites: 0,
    };
    createLocalTransfermarktRunContext.mockReturnValue(runContext);
    executeLocalTransfermarktSell.mockImplementation(({ activePlayerId }) => {
      const team = runContext.save.gameState.teams.find((entry) => entry.teamId === "team-a");
      if (team) team.cash += 18;
      runContext.save.gameState.rosters = runContext.save.gameState.rosters.filter(
        (entry) => entry.id !== activePlayerId,
      );
      return { canSell: true, blockingReasons: [] };
    });
    flushLocalTransfermarktRunContext.mockImplementation(() => runContext.save);

    const result = await runPreseasonProactiveCashRecovery({
      saveId: "save-1",
      seasonId: "season-2",
      persistence: persistence as never,
    });

    expect(buildAiTransfermarktSellPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        saveId: "save-1",
        allowSellBelowRosterMin: true,
        teamScope: "all",
      }),
    );
    expect(executeLocalTransfermarktSell).toHaveBeenCalledWith(
      expect.objectContaining({
        transferSource: "preseason_proactive_cash_recovery_sell",
        activePlayerId: "r-a-0",
      }),
    );
    expect(result.sold).toBe(1);
    expect(result.teamsAffected).toBe(1);
    expect(result.teamResults[0]?.cashAfter).toBeGreaterThan(result.teamResults[0]?.cashBefore ?? 0);
  });
});
