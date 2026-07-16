import { describe, expect, it } from "vitest";

import { buildPlayerProgressSummary, formatProgressDelta } from "@/lib/foundation/player-progress-summary";

describe("player progress summary", () => {
  it("returns null when no history rows exist", () => {
    expect(buildPlayerProgressSummary([])).toBeNull();
  });

  it("computes metric deltas and axis sum from first to last season", () => {
    const summary = buildPlayerProgressSummary([
      {
        seasonId: "season-1",
        seasonName: "Season 1",
        isActiveSeason: false,
        ovr: 88.1,
        pow: 0.7,
        spe: 9.4,
        men: 6.1,
        soc: 7.9,
      },
      {
        seasonId: "season-2",
        seasonName: "Season 2",
        isActiveSeason: false,
        ovr: 85.4,
        pow: 2.1,
        spe: 7.3,
        men: 3.0,
        soc: 7.1,
      },
      {
        seasonId: "season-3",
        seasonName: "Season 3",
        isActiveSeason: true,
        ovr: 76.7,
        pow: 0.2,
        spe: 3.8,
        men: 0.4,
        soc: 6.1,
      },
    ]);

    expect(summary?.firstSeasonName).toBe("Season 1");
    expect(summary?.lastSeasonName).toBe("Season 3");
    expect(summary?.lastSeasonIsLive).toBe(true);
    expect(summary?.metrics.find((metric) => metric.id === "ovr")?.delta).toBe(-11.4);
    expect(summary?.metrics.find((metric) => metric.id === "pow")?.delta).toBe(-0.5);
    expect(summary?.metrics.find((metric) => metric.id === "spe")?.delta).toBe(-5.6);
    expect(summary?.metrics.find((metric) => metric.id === "men")?.delta).toBe(-5.7);
    expect(summary?.metrics.find((metric) => metric.id === "soc")?.delta).toBe(-1.8);
    expect(summary?.axisSumDelta).toBe(-13.6);
    expect(summary?.metrics.find((metric) => metric.id === "ovr")?.tone).toBe("negative");
    expect(summary?.axisSumTone).toBe("negative");
  });

  it("marks missing axis values as neutral axis sum", () => {
    const summary = buildPlayerProgressSummary([
      {
        seasonId: "season-1",
        seasonName: "Season 1",
        isActiveSeason: false,
        ovr: 80,
        pow: 1,
        spe: null,
        men: 2,
        soc: 3,
      },
      {
        seasonId: "season-2",
        seasonName: "Season 2",
        isActiveSeason: true,
        ovr: 82,
        pow: 2,
        spe: 4,
        men: 2,
        soc: 3,
      },
    ]);

    expect(summary?.axisSumDelta).toBeNull();
    expect(summary?.metrics.find((metric) => metric.id === "ovr")?.delta).toBe(2);
  });

  it("formats signed deltas in de-DE", () => {
    expect(formatProgressDelta(-11.4)).toBe("-11,4");
    expect(formatProgressDelta(2)).toBe("+2");
    expect(formatProgressDelta(null)).toBe("—");
  });
});
