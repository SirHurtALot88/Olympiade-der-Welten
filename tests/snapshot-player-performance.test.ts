import { describe, expect, it } from "vitest";

import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { resolveSnapshotPlayerPerformanceRow } from "@/lib/foundation/snapshot-player-performance";

function createGameState(): GameState {
  return {
    disciplines: [
      { id: "pow-1", name: "Power Test", category: "power", weight: 1, playerCount: 6 },
      { id: "soc-1", name: "Social Test", category: "social", weight: 1, playerCount: 6 },
    ],
    players: [{ id: "player-1", name: "Recovered Hero" }],
    teams: [{ teamId: "A-A", name: "Alpha", shortCode: "ALP" }],
    season: { id: "season-2", name: "Season 2", year: 2, currentMatchday: 1, matchdayIds: [] },
    seasonState: { seasonId: "season-2", seasonSnapshots: [] },
  } as unknown as GameState;
}

function createLegacyMetricPoorSnapshot(): SeasonSnapshotRecord {
  return {
    snapshotId: "snapshot-season-1",
    seasonId: "season-1",
    seasonName: "Season 1",
    status: "completed",
    matchdayResults: [],
    // Legacy row: has appearances but no axis metrics / points / breakdown.
    playerPerformances: [
      {
        playerId: "player-1",
        playerName: "Recovered Hero",
        teamId: "A-A",
        seasonId: "season-1",
        appearances: 2,
        totalContribution: null,
        totalPoints: null,
        powPoints: null,
        spePoints: null,
        menPoints: null,
        socPoints: null,
        ovr: null,
        pps: null,
        mvs: null,
        disciplineBreakdown: [],
        warnings: [],
      },
    ],
    playerPerformanceSnapshots: [],
    // Raw discipline rows ARE archived (every snapshot stores these).
    playerDisciplinePerformances: [
      {
        playerId: "player-1",
        teamId: "A-A",
        disciplineId: "pow-1",
        matchdayResultId: "md-1",
        scoreContribution: 3,
        finalPlayerScore: 30,
        isTop10: true,
        isMvpCandidate: false,
      },
      {
        playerId: "player-1",
        teamId: "A-A",
        disciplineId: "soc-1",
        matchdayResultId: "md-2",
        scoreContribution: 4,
        finalPlayerScore: 40,
        isTop10: false,
        isMvpCandidate: true,
      },
    ],
  } as unknown as SeasonSnapshotRecord;
}

describe("resolveSnapshotPlayerPerformanceRow metric backfill", () => {
  it("backfills axis points and totals for a legacy metric-poor row from archived raw discipline rows", () => {
    const gameState = createGameState();
    const snapshot = createLegacyMetricPoorSnapshot();

    const row = resolveSnapshotPlayerPerformanceRow(gameState, snapshot, "player-1");

    expect(row).not.toBeNull();
    expect(row?.powPoints).toBe(3);
    expect(row?.socPoints).toBe(4);
    expect(row?.totalPoints).toBe(7);
    expect(row?.appearances).toBe(2);
    expect(row?.warnings).toContain("snapshot_player_metrics_backfilled_from_discipline_rows");
    // Rating fields that cannot be re-derived from raw rows stay honestly null.
    expect((row as { ovr: number | null }).ovr).toBeNull();
    expect((row as { mvs: number | null }).mvs).toBeNull();
  });

  it("leaves honest nulls when there are no raw discipline rows to re-derive from", () => {
    const gameState = createGameState();
    const snapshot = createLegacyMetricPoorSnapshot();
    snapshot.playerDisciplinePerformances = [];

    const row = resolveSnapshotPlayerPerformanceRow(gameState, snapshot, "player-1");

    expect(row).not.toBeNull();
    expect(row?.powPoints ?? null).toBeNull();
    expect(row?.totalPoints ?? null).toBeNull();
  });

  it("returns a well-formed row unchanged (no backfill warning)", () => {
    const gameState = createGameState();
    const snapshot = createLegacyMetricPoorSnapshot();
    snapshot.playerPerformances = [
      {
        playerId: "player-1",
        playerName: "Recovered Hero",
        teamId: "A-A",
        seasonId: "season-1",
        appearances: 2,
        totalPoints: 7,
        powPoints: 3,
        spePoints: 0,
        menPoints: 0,
        socPoints: 4,
        ovr: 88,
        pps: 7,
        mvs: 12,
        disciplineBreakdown: [],
        warnings: [],
      },
    ] as unknown as SeasonSnapshotRecord["playerPerformances"];

    const row = resolveSnapshotPlayerPerformanceRow(gameState, snapshot, "player-1");

    expect((row as { ovr: number | null }).ovr).toBe(88);
    expect((row as { mvs: number | null }).mvs).toBe(12);
    expect(row?.warnings ?? []).not.toContain("snapshot_player_metrics_backfilled_from_discipline_rows");
  });
});
