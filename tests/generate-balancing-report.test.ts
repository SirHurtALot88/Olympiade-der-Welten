import { describe, expect, it } from "vitest";

import { buildBalancingReportLines } from "@/scripts/generate-balancing-report";
import type { GameState } from "@/lib/data/olyDataTypes";

function minimalGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    season: { id: "season-3", label: "Season 3" },
    gamePhase: "season_completed",
    teams: Array.from({ length: 32 }, (_, index) => ({
      teamId: `team-${index}`,
      shortCode: `T${index}`,
      name: `Team ${index}`,
      cash: 100,
    })),
    players: [],
    rosters: [],
    transferHistory: [
      { id: "t1", seasonId: "season-1", transferType: "buy", source: "season1_draft", fee: 10, toTeamId: "team-0" },
      { id: "t2", seasonId: "season-2", transferType: "buy", source: "ai_preseason_market_buy", fee: 30, toTeamId: "team-0" },
      { id: "t3", seasonId: "season-2", transferType: "buy", source: "preseason_roster_repair_buy", fee: 5, toTeamId: "team-1" },
      { id: "t4", seasonId: "season-3", transferType: "buy", source: "ai_preseason_market_buy", fee: 25, toTeamId: "team-0" },
      { id: "t5", seasonId: "season-3", transferType: "sell", source: "ai_preseason_market_sell", fee: 20, fromTeamId: "team-0" },
    ],
    seasonState: { standings: {}, matchdayResults: [], seasonSnapshots: [] },
    teamIdentities: [],
    ...overrides,
  } as GameState;
}

describe("generate-balancing-report", () => {
  it("includes S3–S5 columns and pick-fidelity rows", () => {
    const lines = buildBalancingReportLines({
      saveId: "test-save",
      seasonIds: ["season-1", "season-2", "season-3", "season-4", "season-5"],
      gs: minimalGameState(),
    });
    const report = lines.join("\n");
    expect(report).toContain("Balancing Report S1+S2+S3+S4+S5");
    expect(report).toContain("| S3 |");
    expect(report).toContain("| S4 |");
    expect(report).toContain("| S5 |");
    expect(report).toContain("## Pick-Fidelity");
    expect(report).toContain("| season-2 |");
    expect(report).toContain("| season-3 |");
    expect(report).toContain("Emergency-Filler");
  });
});
