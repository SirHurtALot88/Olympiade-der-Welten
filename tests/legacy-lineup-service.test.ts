import { describe, expect, it } from "vitest";

import { LegacyLineupService } from "@/lib/lineups/legacy-lineup-service";
import type {
  LegacyLineupDraft,
  LegacyLineupEntryInput,
  LegacyLineupKeyParams,
  LegacyLineupRepositoryContext,
} from "@/lib/lineups/legacy-lineup-types";

const baseParams: LegacyLineupKeyParams = {
  saveId: "save-1",
  seasonId: "season-1",
  matchdayId: "matchday-1",
  teamId: "A-A",
};

function createEntries(): LegacyLineupEntryInput[] {
  return [
    { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 0, playerId: "player-1", activePlayerId: "active-1" },
    { disciplineId: "tdm", disciplineSide: "d1", slotIndex: 1, playerId: "player-2", activePlayerId: "active-2" },
    { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 0, playerId: "player-3", activePlayerId: "active-3" },
    { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 1, playerId: "player-4", activePlayerId: "active-4" },
  ];
}

function createContext(entries: LegacyLineupEntryInput[]): LegacyLineupRepositoryContext {
  return {
    ...baseParams,
    entries,
    disciplinePlayerCounts: { tdm: 2 },
    activePlayers: [
      { id: "active-1", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
      { id: "active-2", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-2" },
      { id: "active-3", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-3" },
      { id: "active-4", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-4" },
    ],
    disciplineScores: [
      { playerId: "player-1", disciplineId: "tdm", score: 10 },
      { playerId: "player-2", disciplineId: "tdm", score: 20 },
      { playerId: "player-3", disciplineId: "tdm", score: 30 },
      { playerId: "player-4", disciplineId: "tdm", score: 40 },
    ],
  };
}

class FakeLegacyLineupRepository {
  private draft: LegacyLineupDraft | null = null;
  public slotWriteCount = 0;

  constructor(private readonly contextFactory: (entries: LegacyLineupEntryInput[]) => LegacyLineupRepositoryContext | null) {}

  async getLegacyLineupDraft() {
    return this.draft;
  }

  async getLegacyLineupRepositoryContext(_params: LegacyLineupKeyParams, entries: LegacyLineupEntryInput[]) {
    return this.contextFactory(entries);
  }

  async saveLegacyLineupDraft(params: LegacyLineupKeyParams, entries: LegacyLineupEntryInput[]) {
    this.slotWriteCount += entries.length;
    this.draft = {
      lineupId: "lineup-1",
      ...params,
      status: "draft",
      entries: [...entries],
      createdAt: this.draft?.createdAt ?? new Date("2026-06-03T00:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-06-03T00:05:00.000Z").toISOString(),
    };
    return this.draft;
  }
}

describe("legacy lineup draft service", () => {
  it("saves a draft lineup and loads it again", async () => {
    const entries = createEntries();
    const repository = new FakeLegacyLineupRepository((currentEntries) => createContext(currentEntries));
    const service = new LegacyLineupService(repository);

    const saveResult = await service.saveLegacyLineupDraft(baseParams, entries);

    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) {
      return;
    }

    const loaded = await service.getLegacyLineupDraft(baseParams);
    expect(loaded?.entries).toEqual(entries);
  });

  it("replaces old slots instead of duplicating them", async () => {
    const repository = new FakeLegacyLineupRepository((currentEntries) => createContext(currentEntries));
    const service = new LegacyLineupService(repository);

    await service.saveLegacyLineupDraft(baseParams, createEntries());
    const replacementEntries = createEntries().slice(0, 2).concat([
      { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 0, playerId: "player-4", activePlayerId: "active-4" },
      { disciplineId: "tdm", disciplineSide: "d2", slotIndex: 1, playerId: "player-3", activePlayerId: "active-3" },
    ]);

    const saveResult = await service.saveLegacyLineupDraft(baseParams, replacementEntries);

    expect(saveResult.ok).toBe(true);
    if (!saveResult.ok) {
      return;
    }

    expect(saveResult.draft.entries).toEqual(replacementEntries);
    expect(saveResult.draft.entries).toHaveLength(4);
  });

  it("rejects duplicate players across d1 and d2", async () => {
    const entries = createEntries();
    entries[2] = { ...entries[2], playerId: "player-1", activePlayerId: "active-1" };
    const repository = new FakeLegacyLineupRepository((currentEntries) => createContext(currentEntries));
    const service = new LegacyLineupService(repository);

    const saveResult = await service.saveLegacyLineupDraft(baseParams, entries);

    expect(saveResult.ok).toBe(false);
    if (saveResult.ok) {
      return;
    }
    expect(saveResult.errors.some((error) => error.includes("used more than once"))).toBe(true);
  });

  it("rejects players outside the team roster", async () => {
    const repository = new FakeLegacyLineupRepository((currentEntries) => {
      const context = createContext(currentEntries);
      context.activePlayers = context.activePlayers.filter((entry) => entry.id !== "active-4");
      return context;
    });
    const service = new LegacyLineupService(repository);

    const saveResult = await service.saveLegacyLineupDraft(baseParams, createEntries());

    expect(saveResult.ok).toBe(false);
    if (saveResult.ok) {
      return;
    }
    expect(saveResult.errors.some((error) => error.includes("does not exist in the provided team roster"))).toBe(true);
  });

  it("rejects invalid player counts", async () => {
    const repository = new FakeLegacyLineupRepository((currentEntries) => createContext(currentEntries));
    const service = new LegacyLineupService(repository);

    const saveResult = await service.saveLegacyLineupDraft(baseParams, createEntries().slice(0, 3));

    expect(saveResult.ok).toBe(false);
    if (saveResult.ok) {
      return;
    }
    expect(saveResult.errors).toContain("Discipline tdm on d2 expects 2 entries, but received 1.");
  });

  it("builds preview scores from stored lineup data", async () => {
    const entries = createEntries();
    entries[0] = { ...entries[0], isCaptain: true };
    const repository = new FakeLegacyLineupRepository((currentEntries) => createContext(currentEntries));
    const service = new LegacyLineupService(repository);

    await service.saveLegacyLineupDraft(baseParams, entries);
    const preview = await service.calculateLegacyLineupPreview(baseParams);

    expect(preview?.totalScore).toBe(110);
    expect(preview?.disciplineSideScores).toHaveLength(2);
    expect(preview?.disciplineSideScores.find((entry) => entry.disciplineSide === "d1")?.captainBonusTotal).toBe(10);
    expect(preview?.disciplineSideScores.find((entry) => entry.disciplineSide === "d1")?.totalScore).toBe(40);
    expect(preview?.disciplineSideScores.find((entry) => entry.disciplineSide === "d2")?.totalScore).toBe(70);
  });

  it("keeps preview limited to base score plus captain bonus", async () => {
    const entries = createEntries();
    entries[0] = { ...entries[0], isCaptain: true };
    const repository = new FakeLegacyLineupRepository((currentEntries) => createContext(currentEntries));
    const service = new LegacyLineupService(repository);

    await service.saveLegacyLineupDraft(baseParams, entries);
    const preview = await service.calculateLegacyLineupPreview(baseParams);

    expect(preview?.scorePreview.baseScore).toBe(100);
    expect(preview?.scorePreview.fatigueModifier).toBeNull();
    expect(preview?.scorePreview.captainBonusTotal).toBe(10);
    expect(preview?.totalScore).toBe(110);
    expect(preview?.missingScores).toEqual([]);
    expect(preview?.validationWarnings).toContain(
      "Captain bonus for tdm/d1 follows the strongest selected player score, not a separate stored captain player identity.",
    );
    expect(preview?.scorePreview.modifierWarnings).toContain("Fatigue source is missing for tdm/d1.");
    expect(preview?.scorePreview.modifierWarnings).toContain("Form card source is missing for tdm/d1.");
    expect(preview?.scorePreview.modifierWarnings).toContain("Mutator score source is missing for tdm/d1.");
  });
});
