import { describe, expect, it } from "vitest";

import { buildLegacyLineupPreview, LegacyLineupContextLoader } from "@/lib/lineups/legacy-lineup-context-loader";
import type { LegacyLineupDraft, LegacyLineupEntryInput } from "@/lib/lineups/legacy-lineup-types";

const params = {
  saveId: "save-1",
  seasonId: "season-1",
  matchdayId: "matchday-1",
  teamId: "A-A",
};

const draftEntries: LegacyLineupEntryInput[] = [
  { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "player-1", activePlayerId: "active-1" },
  { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 1, playerId: "player-2", activePlayerId: "active-2" },
  { disciplineId: "mini-dm", disciplineSide: "d2", slotIndex: 0, playerId: "player-3", activePlayerId: "active-3" },
  { disciplineId: "mini-dm", disciplineSide: "d2", slotIndex: 1, playerId: "player-4", activePlayerId: "active-4" },
];

function createFakeDb(overrides?: {
  teamSeasonState?: null | Record<string, unknown>;
}) {
  return {
    save: {
      findUnique: async () => ({ id: "save-1", name: "Save 1", status: "active" }),
    },
    season: {
      findUnique: async () => ({ id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" }),
    },
    matchday: {
      findUnique: async () => ({ id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" }),
    },
    team: {
      findUnique: async () => ({ id: "A-A", shortCode: "A-A", name: "Armageddon Aftermath" }),
    },
    teamSeasonState: {
      findUnique: async () =>
        overrides?.teamSeasonState === undefined
          ? {
              id: "tss-1",
              saveId: "save-1",
              seasonId: "season-1",
              teamId: "A-A",
              cash: 100,
              budget: 200,
              rosterLimit: 6,
              playerOpt: 6,
              pow: 12,
              spe: 11,
              men: 10,
              soc: 9,
            }
          : overrides.teamSeasonState,
      findMany: async () => [
        {
          id: "tss-1",
          saveId: "save-1",
          seasonId: "season-1",
          teamId: "A-A",
          cash: 100,
          budget: 200,
          rosterLimit: 6,
          playerOpt: 6,
          pow: 12,
          spe: 11,
          men: 10,
          soc: 9,
        },
      ],
    },
    activePlayer: {
      findMany: async () => [
        { id: "active-1", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-1", createdAt: new Date() },
        { id: "active-2", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-2", createdAt: new Date() },
        { id: "active-3", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-3", createdAt: new Date() },
        { id: "active-4", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-4", createdAt: new Date() },
      ],
    },
    seasonDisciplineConfig: {
      findMany: async () => [
        { disciplineId: "tdm", originalOrder: 1, displayOrder: 1, playerCount: 2, mutator1: null, mutator2: null },
        { disciplineId: "mini-dm", originalOrder: 2, displayOrder: 2, playerCount: 2, mutator1: null, mutator2: null },
      ],
    },
    discipline: {
      findMany: async () => [
        { id: "tdm", name: "TDM", category: "tactics" },
        { id: "mini-dm", name: "Mini DM", category: "tactics" },
      ],
    },
    playerDisciplineScore: {
      findMany: async () => [
        { playerId: "player-1", disciplineId: "tdm", score: 11 },
        { playerId: "player-2", disciplineId: "tdm", score: 12 },
        { playerId: "player-3", disciplineId: "mini-dm", score: 13 },
        { playerId: "player-4", disciplineId: "mini-dm", score: 14 },
      ],
    },
    player: {
      findMany: async () => [
        { id: "player-1", name: "Player 1" },
        { id: "player-2", name: "Player 2" },
        { id: "player-3", name: "Player 3" },
        { id: "player-4", name: "Player 4" },
      ],
    },
    playerAttribute: {
      findMany: async () => [
        { playerId: "player-1", pow: 9, spe: 8, men: 7, soc: 6 },
        { playerId: "player-2", pow: 8, spe: 7, men: 6, soc: 5 },
        { playerId: "player-3", pow: 7, spe: 6, men: 5, soc: 4 },
        { playerId: "player-4", pow: 6, spe: 5, men: 4, soc: 3 },
      ],
    },
    disciplineWeight: {
      findMany: async () => [
        { disciplineId: "tdm", attributeKey: "power", weightPct: 28 },
        { disciplineId: "tdm", attributeKey: "health", weightPct: 20 },
        { disciplineId: "mini-dm", attributeKey: "power", weightPct: 16 },
        { disciplineId: "mini-dm", attributeKey: "torment", weightPct: 24 },
      ],
    },
  };
}

function createFakeRepository(existingDraft: LegacyLineupDraft | null) {
  return {
    getLegacyLineupDraft: async () => existingDraft,
  };
}

describe("legacy lineup context loader", () => {
  it("builds context from mock prisma data", async () => {
    const loader = new LegacyLineupContextLoader(
      createFakeDb() as never,
      createFakeRepository({
        lineupId: "lineup-1",
        ...params,
        status: "draft",
        entries: draftEntries,
        createdAt: "2026-06-03T00:00:00.000Z",
        updatedAt: "2026-06-03T00:00:00.000Z",
      }) as never,
    );

    const result = await loader.loadLegacyLineupContext(params);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.context.activePlayers).toHaveLength(4);
    expect(result.context.disciplines.map((discipline) => discipline.id)).toEqual(["tdm", "mini-dm"]);
    expect(result.context.disciplineScores).toHaveLength(4);
    expect(result.context.rosterPlayers).toHaveLength(4);
    expect(result.context.disciplineWeights).toHaveLength(4);
    expect(result.context.teamIdentity).toEqual({ pow: 12, spe: 11, men: 10, soc: 9 });
    expect(result.context.teamDisciplineRanks?.tdm?.sourceStatus).toBe("mapped_with_transform");
    expect(result.context.teamDisciplineRanks?.tdm?.rank).toBe(1);
    expect(result.context.teamDisciplineRanks?.["mini-dm"]?.sourceStatus).toBe("mapped_with_transform");
    expect(result.context.contextLoadMode).toBe("prisma_reference");
    expect(result.context.formCardSource?.effectStatus).toBe("missing_source");
    expect(result.context.mutatorSource?.effectStatus).toBe("missing_source");
    expect(result.context.teamPowerSource?.effectStatus).toBe("missing_source");
    expect(result.warnings.some((warning) => warning.includes("Prisma reference context"))).toBe(true);
  });

  it("does not fail when no lineup exists", async () => {
    const loader = new LegacyLineupContextLoader(
      createFakeDb() as never,
      createFakeRepository(null) as never,
    );

    const result = await loader.loadLegacyLineupContext(params);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.context.existingDraft).toBeNull();
    expect(result.warnings.some((warning) => warning.includes("No existing legacy lineup draft"))).toBe(true);
  });

  it("reports missing team season state cleanly", async () => {
    const loader = new LegacyLineupContextLoader(
      createFakeDb({ teamSeasonState: null }) as never,
      createFakeRepository(null) as never,
    );

    const result = await loader.loadLegacyLineupContext(params);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.some((error) => error.includes("TeamSeasonState"))).toBe(true);
  });

  it("keeps active players assigned to the requested team", async () => {
    const loader = new LegacyLineupContextLoader(
      createFakeDb() as never,
      createFakeRepository(null) as never,
    );

    const result = await loader.loadLegacyLineupContext(params);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(new Set(result.context.activePlayers.map((player) => player.teamId))).toEqual(new Set(["A-A"]));
  });

  it("loads discipline scores for the relevant disciplines", async () => {
    const loader = new LegacyLineupContextLoader(
      createFakeDb() as never,
      createFakeRepository({
        lineupId: "lineup-1",
        ...params,
        status: "draft",
        entries: draftEntries,
        createdAt: "2026-06-03T00:00:00.000Z",
        updatedAt: "2026-06-03T00:00:00.000Z",
      }) as never,
    );

    const result = await loader.loadLegacyLineupContext(params);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.context.disciplineScores.map((score) => score.disciplineId)).toEqual(["tdm", "tdm", "mini-dm", "mini-dm"]);
  });

  it("uses validator and score engine in the preview function", async () => {
    const preview = await buildLegacyLineupPreview(params, draftEntries, {
      loader: new LegacyLineupContextLoader(
        createFakeDb() as never,
        createFakeRepository({
          lineupId: "lineup-1",
          ...params,
          status: "draft",
          entries: draftEntries,
          createdAt: "2026-06-03T00:00:00.000Z",
          updatedAt: "2026-06-03T00:00:00.000Z",
        }) as never,
      ),
    });

    expect(preview.ok).toBe(true);
    if (!preview.ok) {
      return;
    }
    expect(preview.validation.isValid).toBe(true);
    expect(preview.scorePreview.totalScore).toBe(50);
  });
});
