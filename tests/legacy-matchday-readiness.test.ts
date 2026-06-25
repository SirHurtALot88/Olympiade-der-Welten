import { describe, expect, it } from "vitest";

import { buildLegacyMatchdayReadiness as buildLineupReadiness, isLegacyLineupDraftComplete } from "@/lib/lineups/legacy-matchday-readiness";
import { buildLegacyMatchdayReadiness as buildResolveReadiness } from "@/lib/resolve/legacy-matchday-readiness";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

function createContext(input: {
  activePlayersCount: number;
  d1Required: number;
  d2Required: number;
  d1Selected?: number;
  d2Selected?: number;
}): LegacyLineupLoadedContext {
  const d1Selected = input.d1Selected ?? input.d1Required;
  const d2Selected = input.d2Selected ?? input.d2Required;
  const entries = [
    ...Array.from({ length: d1Selected }, (_, index) => ({
      disciplineId: "mini-dm",
      disciplineSide: "d1" as const,
      slotIndex: index + 1,
      playerId: `p-d1-${index + 1}`,
      activePlayerId: `ap-d1-${index + 1}`,
    })),
    ...Array.from({ length: d2Selected }, (_, index) => ({
      disciplineId: "fechten",
      disciplineSide: "d2" as const,
      slotIndex: index + 1,
      playerId: `p-d2-${index + 1}`,
      activePlayerId: `ap-d2-${index + 1}`,
    })),
  ];

  return {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: "A-A",
    entries,
    disciplinePlayerCounts: {
      "mini-dm": input.d1Required,
      fechten: input.d2Required,
    },
    disciplineSidePlayerCounts: {
      "mini-dm::d1": input.d1Required,
      "fechten::d2": input.d2Required,
    },
    activePlayers: Array.from({ length: input.activePlayersCount }, (_, index) => ({
      id: index < d1Selected
        ? `ap-d1-${index + 1}`
        : index < d1Selected + d2Selected
          ? `ap-d2-${index - d1Selected + 1}`
          : `bench-${index + 1}`,
      saveId: "save-1",
      seasonId: "season-1",
      teamId: "A-A",
      playerId: index < d1Selected
        ? `p-d1-${index + 1}`
        : index < d1Selected + d2Selected
          ? `p-d2-${index - d1Selected + 1}`
          : `bench-player-${index + 1}`,
      upkeep: 10,
    })),
    disciplineScores: entries.map((entry, index) => ({
      playerId: entry.playerId,
      disciplineId: entry.disciplineId,
      score: 50 - index,
    })),
    save: { id: "save-1", name: "Local Save", status: "active" },
    season: {
      id: "season-1",
      saveId: "save-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 1,
      status: "active",
    },
    matchday: {
      id: "matchday-1",
      seasonId: "season-1",
      index: 1,
      label: "Matchday 1",
      status: "planning",
    },
    team: { id: "A-A", shortCode: "A-A", name: "Alpha" },
    teamSeasonState: {
      id: "tss-1",
      saveId: "save-1",
      seasonId: "season-1",
      teamId: "A-A",
      cash: 100,
      budget: 100,
      rosterLimit: 12,
      playerOpt: 10,
    },
    teamIdentity: { pow: 1, spe: 1, men: 1, soc: 1 },
    rosterPlayers: entries.map((entry) => ({
      id: entry.playerId,
      name: entry.playerId,
      coreStats: { pow: 1, spe: 1, men: 1, soc: 1 },
    })),
    disciplines: [
      { id: "mini-dm", name: "Mini DM", category: "mental" },
      { id: "fechten", name: "Fechten", category: "speed" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: "mini-dm", originalOrder: 1, displayOrder: 1, playerCount: input.d1Required, mutator1: null, mutator2: null },
      { disciplineId: "fechten", originalOrder: 2, displayOrder: 2, playerCount: input.d2Required, mutator1: null, mutator2: null },
    ],
    existingDraft: {
      lineupId: "lineup-1",
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: "A-A",
      status: "draft",
      entries,
      modifiers: {},
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    } as LegacyLineupLoadedContext["existingDraft"],
    contextMeta: {
      saveId: "save-1",
      seasonId: "season-1",
      matchdayId: "matchday-1",
      teamId: "A-A",
      d1DisciplineId: "mini-dm",
      d2DisciplineId: "fechten",
    },
    fatigueByPlayerId: {},
    fatigueSourceStatus: "mapped",
    formCardSource: {
      selectionStatus: "ready",
      effectStatus: "ready",
      sourceLabel: "Local legacy form card pool",
      warnings: [],
    },
    mutatorSource: {
      selectionStatus: "ready",
      effectStatus: "ready",
      sourceLabel: "MVP forced mutator mode",
      warnings: [],
    },
    formCards: [],
    mutatorTraitOptions: [],
  };
}

describe("legacy matchday readiness", () => {
  it("blocks only when the roster drops below the minimum of 7 players", () => {
    const context = createContext({
      activePlayersCount: 6,
      d1Required: 2,
      d2Required: 5,
      d1Selected: 2,
      d2Selected: 4,
    });

    const lineupReadiness = buildLineupReadiness(context);
    const resolveReadiness = buildResolveReadiness(context);

    expect(lineupReadiness.readinessStatus).toBe("underfilled_roster");
    expect(lineupReadiness.reasonCodes).toContain("under_minimum_matchday_players");
    expect(resolveReadiness.readinessStatus).toBe("underfilled_roster");
    expect(resolveReadiness.reasonCodes).toContain("under_minimum_matchday_players");
  });

  it("allows partial lineups once 7 active players are available", () => {
    const context = createContext({
      activePlayersCount: 7,
      d1Required: 4,
      d2Required: 5,
      d1Selected: 4,
      d2Selected: 3,
    });

    const lineupReadiness = buildLineupReadiness(context);
    const resolveReadiness = buildResolveReadiness(context);

    expect(lineupReadiness.readinessStatus).toBe("ready");
    expect(lineupReadiness.reasonCodes).toContain("partial_lineup_allowed");
    expect(resolveReadiness.readinessStatus).toBe("ready");
    expect(resolveReadiness.reasonCodes).toContain("partial_lineup_allowed");
  });

  it("treats missing discipline-side slots as incomplete even when matchdayReady", () => {
    const context = createContext({
      activePlayersCount: 7,
      d1Required: 4,
      d2Required: 5,
      d1Selected: 4,
      d2Selected: 3,
    });

    expect(buildLineupReadiness(context).matchdayReady).toBe(true);
    expect(isLegacyLineupDraftComplete(context)).toBe(false);
  });

  it("flags a one-sided draft as incomplete", () => {
    const context = createContext({
      activePlayersCount: 12,
      d1Required: 4,
      d2Required: 8,
      d1Selected: 0,
      d2Selected: 10,
    });

    expect(isLegacyLineupDraftComplete(context)).toBe(false);
  });
  it("accepts a draft once both discipline sides meet their slot counts", () => {
    const context = createContext({
      activePlayersCount: 12,
      d1Required: 4,
      d2Required: 8,
      d1Selected: 4,
      d2Selected: 8,
    });

    expect(isLegacyLineupDraftComplete(context)).toBe(true);
  });
});
