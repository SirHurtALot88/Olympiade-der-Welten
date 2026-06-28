import { describe, expect, it } from "vitest";

import { buildPlayerAttributeHistoryRows } from "@/lib/foundation/player-attribute-history";
import { buildPlayerTrainingHistoryRows } from "@/lib/foundation/player-training-history";

describe("player attribute history", () => {
  it("reconstructs attribute values per season from progression events", () => {
    const rows = buildPlayerAttributeHistoryRows({
      seasonAnchors: [
        { seasonId: "season-1", seasonName: "Season 1", isActiveSeason: false },
        { seasonId: "season-2", seasonName: "Season 2", isActiveSeason: false },
        { seasonId: "season-3", seasonName: "Season 3", isActiveSeason: true },
      ],
      baselineAttributes: { power: 42, intelligence: 65 },
      currentAttributes: { power: 41, intelligence: 69 },
      progressionEvents: [
        {
          seasonId: "season-2",
          timestamp: "2026-01-02T00:00:00.000Z",
          upgrades: [
            { attribute: "power", fromValue: 42, toValue: 41.4 },
            { attribute: "intelligence", fromValue: 65, toValue: 66 },
          ],
        },
        {
          seasonId: "season-3",
          timestamp: "2026-01-03T00:00:00.000Z",
          upgrades: [
            { attribute: "power", fromValue: 41.4, toValue: 41 },
            { attribute: "intelligence", fromValue: 68, toValue: 69 },
          ],
        },
      ],
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]?.attributes.power).toBe(42);
    expect(rows[1]?.attributes.intelligence).toBe(66);
    expect(rows[2]?.attributes.power).toBe(41);
    expect(rows[2]?.attributes.intelligence).toBe(69);
  });
});

describe("player training history", () => {
  it("maps organic progression events to class training rows", () => {
    const rows = buildPlayerTrainingHistoryRows({
      progressionEvents: [
        {
          eventId: "evt-1",
          seasonId: "season-3",
          teamId: "team-1",
          playerId: "player-1",
          upgrades: [{ playerId: "player-1", attribute: "charisma", fromValue: 7.9, toValue: 6.1, cost: 0, source: "organic_season_progression" }],
          xpSpent: 0,
          timestamp: "2026-01-03T00:00:00.000Z",
          source: "organic_season_progression",
          organicMeta: {
            trainingClass: "Bard",
            secondaryTrainingClass: null,
            trainingMode: "mittel",
            classBefore: "Bard",
            classAfter: "Bard",
            netSetpoints: -1.2,
            trainingSetpoints: 2.8,
            performanceSetpoints: 0.4,
            traitModifierPct: 12,
          },
        },
      ],
      classHistory: [],
      currentTrainingClass: "Bard",
      currentTrainingMode: "mittel",
    });

    expect(rows[0]?.source).toBe("organic");
    expect(rows[0]?.trainingClass).toBe("Bard");
    expect(rows[0]?.trainingMode).toBe("mittel");
    expect(rows[0]?.traitModifierPct).toBe(12);
    expect(rows[0]?.netSetpoints).toBe(-1.2);
    expect(rows[0]?.attributeSummary).toContain("charisma 7.9→6.1");
  });
});
