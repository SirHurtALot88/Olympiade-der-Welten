import { describe, expect, it } from "vitest";

import { getImportedPlayerDisplayMarketValue, getImportedPlayerDisplaySalary } from "@/lib/data/player-economy-display";
import { getImportedPlayerOvrScale, normalizePlayerOvr } from "@/lib/data/player-ovr-scale";
import { enrichPlayerDerivedStats, loadImportedPlayerStats } from "@/lib/data/playerStatsAdapter";
import { buildPlayerRatingContractRows } from "@/lib/foundation/player-rating-contract";
import type { Player } from "@/lib/data/olyDataTypes";

function createPlayer(partial?: Partial<Player>): Player {
  return {
    id: partial?.id ?? "player-1",
    name: partial?.name ?? "Player One",
    rating: partial?.rating ?? 61.5,
    marketValue: partial?.marketValue ?? 85000,
    salaryDemand: partial?.salaryDemand ?? 8000,
    displayMarketValue: partial?.displayMarketValue ?? 72.57,
    displaySalary: partial?.displaySalary ?? 16.54,
    pps: partial?.pps,
    ovr: partial?.ovr,
    cost: partial?.cost ?? 85,
    upkeepBase: partial?.upkeepBase ?? 8,
    className: partial?.className ?? "Berserker",
    race: partial?.race ?? "Human",
    alignment: partial?.alignment ?? "N",
    gender: partial?.gender ?? "m",
    referenceClass: partial?.referenceClass ?? null,
    imageSource: partial?.imageSource ?? null,
    bracketLabel: partial?.bracketLabel ?? null,
    subclasses: partial?.subclasses ?? [],
    traitsPositive: partial?.traitsPositive ?? [],
    traitsNegative: partial?.traitsNegative ?? [],
    coreStats: partial?.coreStats ?? { pow: 50, spe: 50, men: 50, soc: 50 },
    attributeSheetStats: partial?.attributeSheetStats,
    attributeSheetRatings: partial?.attributeSheetRatings,
    preferredDisciplineIds: partial?.preferredDisciplineIds ?? [],
    disciplineRatings: partial?.disciplineRatings ?? { d1: 60, d2: 66 },
    disciplineTierCounts:
      partial?.disciplineTierCounts ?? { above20: 2, above40: 2, above60: 1, above80: 0 },
    flavorEn: partial?.flavorEn ?? "",
    flavorDe: partial?.flavorDe ?? "",
    fatigue: partial?.fatigue ?? 0,
    form: partial?.form ?? 0,
    potential: partial?.potential ?? 0,
    portraitPath: partial?.portraitPath ?? null,
    portraitUrl: partial?.portraitUrl ?? null,
  };
}

describe("player stats adapter", () => {
  it("derives pps and normalized ovr from imported player JSON fields", () => {
    const result = enrichPlayerDerivedStats(
      createPlayer({
        rating: 65.32,
        displayMarketValue: 72.57,
        disciplineRatings: { a: 60, b: 70, c: 66 },
      }),
    );

    expect(result.ovr).toBe(normalizePlayerOvr(65.32));
    expect(result.pps).toBe(65.33);
  });

  it("loads imported players with derived stats attached", () => {
    const players = loadImportedPlayerStats();
    expect(players.length).toBeGreaterThan(100);
    expect(players[0]?.pps).not.toBeUndefined();
    expect(players[0]?.ovr).toBe(normalizePlayerOvr(players[0]?.rating));
    expect(players[0]?.potential).toBeDefined();
  });

  it("does not invent mvs when the imported JSON has no dedicated mvs field", () => {
    const players = loadImportedPlayerStats();
    const first = players[0] as Record<string, unknown> | undefined;

    expect(first).toBeTruthy();
    expect("mvs" in (first ?? {})).toBe(false);
  });

  it("keeps market value separate from rating metrics", () => {
    const result = enrichPlayerDerivedStats(
      createPlayer({
        rating: 65.32,
        marketValue: 85000,
        displayMarketValue: 72.57,
      }),
    );

    expect(result.ovr).toBe(normalizePlayerOvr(65.32));
    expect(result.displayMarketValue).toBe(72.57);
    expect((result as Record<string, unknown>).mvs).toBeUndefined();
  });

  it("keeps imported display market value and salary as the visible transition source", () => {
    const player = createPlayer({
      marketValue: 85000,
      displayMarketValue: 72.57,
      salaryDemand: 8000,
      displaySalary: 16.54,
    });

    expect(getImportedPlayerDisplayMarketValue(player)).toBe(72.57);
    expect(getImportedPlayerDisplaySalary(player)).toBe(16.54);
  });

  it("normalizes imported player ratings to a visible 1-100 ovr scale", () => {
    const scale = getImportedPlayerOvrScale();

    expect(normalizePlayerOvr(scale.min)).toBe(1);
    expect(normalizePlayerOvr(scale.max)).toBe(100);
    expect(normalizePlayerOvr((scale.min + scale.max) / 2)).toBeGreaterThan(1);
  });

  it("builds Retool-style season ovr from skills, thresholds, PPs and MVS instead of imported rating", () => {
    const players = [
      createPlayer({ id: "weak", rating: 100, coreStats: { pow: 10, spe: 10, men: 10, soc: 10 } }),
      createPlayer({ id: "mid", rating: 55, coreStats: { pow: 55, spe: 55, men: 55, soc: 55 } }),
      createPlayer({ id: "top", rating: 10, coreStats: { pow: 100, spe: 100, men: 100, soc: 100 } }),
    ];

    const result = buildPlayerRatingContractRows({ players, mvsPerformances: [] });
    const weak = result.find((entry) => entry.playerId === "weak");
    const mid = result.find((entry) => entry.playerId === "mid");
    const top = result.find((entry) => entry.playerId === "top");

    expect(top?.ovrNormalized).toBe(100);
    expect(weak?.ovrNormalized).toBe(0);
    expect((mid?.ovrNormalized ?? 0) > 0).toBe(true);
    expect((mid?.ovrNormalized ?? 0) < 100).toBe(true);
  });

  it("derives mvs from stored season placings via the rank-to-mw table", () => {
    const players = [
      createPlayer({ id: "weak", rating: 10, disciplineRatings: { a: 20, b: 21 } }),
      createPlayer({ id: "mid", rating: 55, disciplineRatings: { a: 45, b: 44 } }),
      createPlayer({ id: "top", rating: 100, disciplineRatings: { a: 90, b: 91 } }),
    ];

    const result = buildPlayerRatingContractRows({
      players,
      mvsPerformances: [
        {
          id: "perf-1",
          matchdayResultId: "result-1",
          teamId: "team-1",
          playerId: "top",
          activePlayerId: "roster-1",
          disciplineId: "a",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 0,
          finalPlayerScore: 90,
          scoreContribution: 1,
          rankInTeam: 1,
          rankInDiscipline: 1,
          isTop10: true,
          isMvpCandidate: true,
          storyWeight: null,
          createdAt: "2026-06-07T00:00:00.000Z",
        },
        {
          id: "perf-2",
          matchdayResultId: "result-1",
          teamId: "team-1",
          playerId: "mid",
          activePlayerId: "roster-2",
          disciplineId: "a",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 0,
          finalPlayerScore: 45,
          scoreContribution: 1,
          rankInTeam: 1,
          rankInDiscipline: 50,
          isTop10: false,
          isMvpCandidate: false,
          storyWeight: null,
          createdAt: "2026-06-07T00:00:00.000Z",
        },
        {
          id: "perf-3",
          matchdayResultId: "result-1",
          teamId: "team-1",
          playerId: "weak",
          activePlayerId: "roster-3",
          disciplineId: "a",
          disciplineSide: "d1",
          slotIndex: 0,
          baseValue: 0,
          finalPlayerScore: 20,
          scoreContribution: 1,
          rankInTeam: 1,
          rankInDiscipline: 100,
          isTop10: false,
          isMvpCandidate: false,
          storyWeight: null,
          createdAt: "2026-06-07T00:00:00.000Z",
        },
      ],
    });
    const weak = result.find((entry) => entry.playerId === "weak");
    const mid = result.find((entry) => entry.playerId === "mid");
    const top = result.find((entry) => entry.playerId === "top");

    expect(top?.mvs).not.toBeNull();
    expect(mid?.mvs).not.toBeNull();
    expect(weak?.mvs).not.toBeNull();
    expect((top?.mvs ?? 0) > (mid?.mvs ?? 0)).toBe(true);
    expect((mid?.mvs ?? 0) > (weak?.mvs ?? 0)).toBe(true);
    expect(top?.sourceStatus.mvs).toBe("ready");
    expect(top?.warnings).not.toContain("mvs_source_missing");
  });

  it("starts season mvs at zero when a season source exists but the player has no placings yet", () => {
    const players = [createPlayer({ id: "new-season-player", rating: 55 })];

    const result = buildPlayerRatingContractRows({
      players,
      mvsPerformances: [],
    });

    expect(result[0]?.mvs).toBe(0);
    expect(result[0]?.sourceStatus.mvs).toBe("ready");
    expect(result[0]?.warnings).not.toContain("mvs_source_missing");
  });

  it("can normalize ovr against an active-player pool while still rating all rows", () => {
    const players = [
      createPlayer({ id: "active-top", coreStats: { pow: 70, spe: 70, men: 70, soc: 70 } }),
      createPlayer({ id: "active-low", coreStats: { pow: 40, spe: 40, men: 40, soc: 40 } }),
      createPlayer({ id: "free-agent-elite", coreStats: { pow: 100, spe: 100, men: 100, soc: 100 } }),
    ];

    const result = buildPlayerRatingContractRows({
      players,
      mvsPerformances: [],
      normalizationPoolPlayerIds: ["active-top", "active-low"],
    });

    expect(result.find((entry) => entry.playerId === "active-top")?.ovrNormalized).toBe(100);
    expect(result.find((entry) => entry.playerId === "active-low")?.ovrNormalized).toBe(0);
    expect(result.find((entry) => entry.playerId === "free-agent-elite")?.ovrNormalized).toBe(100);
  });

  it("does not fake pool ovr when the core-stat source is missing", () => {
    const result = buildPlayerRatingContractRows({
      players: [
        createPlayer({ id: "raw-missing", coreStats: {} as Player["coreStats"] }),
        createPlayer({ id: "source-player", coreStats: { pow: 55, spe: 55, men: 55, soc: 55 } }),
      ],
      mvsPerformances: [],
    });

    const missing = result.find((entry) => entry.playerId === "raw-missing");

    expect(missing?.rawOvrScore).toBeNull();
    expect(missing?.ovrNormalized).toBeNull();
    expect(missing?.warnings).toContain("ovr_raw_source_missing");
  });

  it("matches Retool no-spread behavior by returning zero instead of blocking ovr", () => {
    const result = buildPlayerRatingContractRows({
      players: [
        createPlayer({ id: "same-1", coreStats: { pow: 33, spe: 33, men: 33, soc: 33 } }),
        createPlayer({ id: "same-2", coreStats: { pow: 33, spe: 33, men: 33, soc: 33 } }),
      ],
      mvsPerformances: [],
    });

    expect(result[0]?.ovrNormalized).toBe(0);
    expect(result[1]?.ovrNormalized).toBe(0);
    expect(result[0]?.warnings).not.toContain("ovr_pool_no_spread");
    expect(result[1]?.warnings).not.toContain("ovr_pool_no_spread");
  });
});
