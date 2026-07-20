import path from "node:path";
import { describe, expect, it } from "vitest";

import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { applyPlannedFormCardsToModifiers, normalizeLineupModifiers } from "@/lib/foundation/form-board-plan-service";
import { getFormCardFlowStatus } from "@/lib/foundation/form-card-flow";

function lineupContext(partial?: Partial<LegacyLineupLoadedContext>): LegacyLineupLoadedContext {
  return {
    saveId: "save-1",
    seasonId: "season-2",
    matchday: { id: "season-2-md-1", index: 1, label: "MD1" },
    team: { id: "M-M", name: "M-M", logoPath: null },
    formCards: [
      {
        id: "card-1",
        playerId: "p-1",
        playerName: "p-1",
        color: "red",
        value: 4,
        isUsed: false,
        usedByLineupId: null,
      },
      {
        id: "card-2",
        playerId: "p-2",
        playerName: "p-2",
        color: "blue",
        value: 2,
        isUsed: false,
        usedByLineupId: null,
      },
    ],
    formCardPlans: [
      {
        matchdayId: "season-2-md-1",
        teamId: "M-M",
        disciplineSide: "d1",
        disciplineId: "d1-id",
        primaryFormCardId: "card-1",
        secondaryFormCardId: "card-2",
      },
    ],
    existingDraft: null,
    ...partial,
  } as LegacyLineupLoadedContext;
}

describe("form card plan sync", () => {
  it("applies current-matchday plans to modifiers without duplicate cards", () => {
    const context = lineupContext();
    const next = applyPlannedFormCardsToModifiers(context, normalizeLineupModifiers(), {
      overwriteCurrentMatchday: true,
    });

    expect(next.d1.primaryFormCardId).toBe("card-1");
    expect(next.d1.secondaryFormCardId).toBe("card-2");
    expect(next.d2.primaryFormCardId).toBeNull();
  });

  it("marks flow ready when plans exist even without modifier selections", () => {
    const state = {
      season: { id: "season-2", name: "Season 2", year: 2027, currentMatchday: 1, matchdayIds: ["season-2-md-1"] },
      seasonState: {
        seasonId: "season-2",
        schedule: [],
        standings: {},
        formCards: [
          {
            id: "card-1",
            saveId: "save-1",
            seasonId: "season-2",
            teamId: "M-M",
            playerId: "p-1",
            playerName: "p-1",
            cardColor: "red",
            cardValue: 4,
            createdAt: "2026-06-12T00:00:00.000Z",
          },
        ],
        formCardPlans: [
          {
            matchdayId: "season-2-md-1",
            teamId: "M-M",
            disciplineSide: "d1",
            disciplineId: "d1-id",
            primaryFormCardId: "card-1",
            secondaryFormCardId: null,
          },
        ],
      },
      matchdayState: { matchdayId: "season-2-md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    } as const;

    expect(getFormCardFlowStatus(state as never, "M-M")).toMatchObject({
      hasPlanSelections: true,
      hasSelections: true,
      skipped: false,
      isReady: true,
      blocker: null,
    });
  });

  it("wires game-flow form-board deep link into lineup formplan tab", async () => {
    const fs = await import("node:fs/promises");
    const foundationText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/FoundationPageClient.tsx"),
      "utf8",
    );
    expect(foundationText).toContain('targetPanel === "form-board"');
    expect(foundationText).toContain("lineupDraftBoardViewRequest");
    expect(foundationText).toContain('initialDraftBoardView={lineupDraftBoardViewRequest');
  });
});
