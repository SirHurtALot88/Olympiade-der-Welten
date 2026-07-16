import { describe, expect, it } from "vitest";

import {
  applySeasonEndRosterStressLedger,
  buildTeamRosterStressRecord,
  computeDepthStressScore,
  resolveOptBumpFromDepthStress,
} from "@/lib/ai/season-roster-stress-service";
import type { GameState, LineupDraft, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { resolvePlannerRosterTargets } from "@/lib/foundation/roster-limits";

function baseGameState(input?: Partial<GameState>): GameState {
  const team: Team = {
    teamId: "team-nn",
    name: "Nunchuck Ninjas",
    shortCode: "N-N",
    cash: 40,
    rosterLimit: 14,
    humanControlled: false,
  };
  const identity: TeamIdentity = {
    teamId: "team-nn",
    playerType: null,
    pow: 0,
    spe: 0,
    men: 0,
    soc: 0,
    ambition: 7,
    finances: 5,
    boardConfidence: 5,
    harmony: 5,
    manners: 5,
    popularity: 5,
    cooperation: 5,
    playerMin: 7,
    playerOpt: 9,
    sourceNote: "test",
  };

  return {
    teams: [team],
    teamIdentities: [identity],
    rosters: Array.from({ length: 7 }, (_, index) => ({
      teamId: "team-nn",
      playerId: `player-${index + 1}`,
      contractLength: 2,
      salary: 5,
      upkeep: 5,
    })),
    players: [],
    disciplines: [
      {
        id: "disc-power",
        name: "Power",
        category: "power",
        playerCount: 4,
        displayOrder: 1,
        originalOrder: 1,
      },
      {
        id: "disc-speed",
        name: "Speed",
        category: "speed",
        playerCount: 4,
        displayOrder: 2,
        originalOrder: 2,
      },
    ],
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 10,
      matchdayIds: ["md-1", "md-2"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "md-1",
          matchdayIndex: 1,
          matchdayLabel: "MD1",
          discipline1: {
            disciplineId: "disc-power",
            displayName: "Power",
            order: 1,
            playerCount: 4,
            category: "power",
          },
          discipline2: {
            disciplineId: "disc-speed",
            displayName: "Speed",
            order: 2,
            playerCount: 4,
            category: "speed",
          },
          sourceStatus: "seeded",
          sourceNote: null,
        },
        {
          seasonId: "season-1",
          matchdayId: "md-2",
          matchdayIndex: 2,
          matchdayLabel: "MD2",
          discipline1: {
            disciplineId: "disc-power",
            displayName: "Power",
            order: 1,
            playerCount: 4,
            category: "power",
          },
          discipline2: {
            disciplineId: "disc-speed",
            displayName: "Speed",
            order: 2,
            playerCount: 4,
            category: "speed",
          },
          sourceStatus: "seeded",
          sourceNote: null,
        },
      ],
      lineupDrafts: [],
    },
    matchdayState: {
      matchdayId: "md-2",
      status: "resolved",
      pendingTeamIds: [],
      resolvedFixtureIds: [],
    },
    transferHistory: [],
    logs: [],
    ...input,
  } as GameState;
}

function lineupDraft(partial: Partial<LineupDraft> & Pick<LineupDraft, "matchdayId">): LineupDraft {
  return {
    lineupId: `lineup-${partial.matchdayId}`,
    saveId: "save-1",
    seasonId: "season-1",
    teamId: "team-nn",
    status: "submitted",
    entries: partial.entries ?? [],
    modifiers: partial.modifiers ?? { d1: { intensity: "normal" }, d2: { intensity: "normal" } },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    matchdayId: partial.matchdayId,
  };
}

describe("season-roster-stress-service", () => {
  it("computes opt bump from depth stress score", () => {
    expect(resolveOptBumpFromDepthStress(0)).toBe(0);
    expect(resolveOptBumpFromDepthStress(1)).toBe(1);
    expect(resolveOptBumpFromDepthStress(2)).toBe(1);
    expect(resolveOptBumpFromDepthStress(3)).toBe(2);
  });

  it("scores repeated slot gaps and ending below base opt", () => {
    const score = computeDepthStressScore({
      matchdaysTotal: 10,
      matchdaysWithSlotGaps: 5,
      matchdaysWithRosterLimited: 3,
      conserveSideUses: 4,
      endedBelowBaseOpt: true,
    });
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it("builds stress record for thin squads with underfilled matchdays", () => {
    const gameState = baseGameState({
      seasonState: {
        ...baseGameState().seasonState,
        lineupDrafts: [
          lineupDraft({
            matchdayId: "md-1",
            entries: [
              { disciplineId: "disc-power", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "p1" },
              { disciplineId: "disc-power", disciplineSide: "d1", slotIndex: 1, playerId: "p2", activePlayerId: "p2" },
            ],
            modifiers: { d1: { intensity: "conserve" }, d2: { intensity: "conserve" } },
          }),
          lineupDraft({
            matchdayId: "md-2",
            entries: [
              { disciplineId: "disc-power", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "p1" },
            ],
          }),
        ],
      },
    });

    const record = buildTeamRosterStressRecord(gameState, "team-nn", "season-1");
    expect(record).not.toBeNull();
    expect(record?.matchdaysWithSlotGaps).toBe(2);
    expect(record?.endedBelowBaseOpt).toBe(true);
    expect(record?.optBump).toBeGreaterThanOrEqual(1);
  });

  it("raises planner opt target after season-end ledger apply", () => {
    const gameState = baseGameState({
      seasonState: {
        ...baseGameState().seasonState,
        lineupDrafts: [
          lineupDraft({
            matchdayId: "md-1",
            entries: [{ disciplineId: "disc-power", disciplineSide: "d1", slotIndex: 0, playerId: "p1", activePlayerId: "p1" }],
          }),
        ],
      },
    });

    const next = applySeasonEndRosterStressLedger(gameState, "season-1");
    const targets = resolvePlannerRosterTargets(next, "team-nn");
    expect(targets.basePlayerOpt).toBe(9);
    expect(targets.playerOpt).toBeGreaterThan(9);
    expect(targets.depthRepairMandate).toBe(true);
  });
});
