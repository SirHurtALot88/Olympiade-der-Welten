import { describe, expect, it } from "vitest";

import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import {
  buildLeagueTeamQualityRanks,
  computeSponsorTeamQualityRank,
  getMaxRarityForQualityRank,
  getPercentileTargetRarity,
} from "@/lib/sponsor/sponsor-team-quality-rank";
import { SPONSOR_RARITIES } from "@/lib/sponsor/sponsor-curve-shapes";

function createRow(input: {
  teamId: string;
  teamName: string;
  rank: number;
  startplatz?: number;
  budget: number;
  marketValueTotal?: number | null;
  historicalRanks?: Array<number | null>;
}): TeamManagementSnapshotRow {
  return {
    team: {
      teamId: input.teamId,
      shortCode: input.teamId,
      name: input.teamName,
      budget: input.budget,
      cash: input.budget,
      identityId: input.teamId,
      humanControlled: false,
      rosterLimit: 12,
    },
    teamId: input.teamId,
    teamCode: input.teamId,
    teamName: input.teamName,
    generalManagerName: null,
    generalManagerTitle: null,
    generalManagerInfluencePct: null,
    rank: input.rank,
    points: null,
    rosterCount: 12,
    salaryTotal: 45,
    avgContractLength: 2,
    marketValueTotal: input.marketValueTotal ?? input.budget * 2,
    cash: input.budget,
    cashFc: null,
    budget: input.budget,
    formAvg: null,
    financeForm: null,
    needScore: null,
    avgMarketValue: null,
    avgPps: null,
    avgOvr: null,
    ppsTotal: null,
    ppsPow: null,
    ppsSpe: null,
    ppsMen: null,
    ppsSoc: null,
    playerMin: null,
    playerOpt: null,
    rosterTarget: null,
    transferCount: 0,
    transferBuyTotal: 0,
    transferSellTotal: 0,
    transferNet: 0,
    transfersSeasonValue: 0,
    cashDelta: null,
    startplatz: input.startplatz ?? input.rank,
    rankDiff: null,
    sponsorBasis: null,
    sponsorRank: null,
    sponsorTotal: null,
    sponsorSeason: null,
    guv: null,
    cashTotal: null,
    historicalPow: null,
    historicalSpe: null,
    historicalMen: null,
    historicalSoc: null,
    historicalGoldCount: 0,
    historicalSilverCount: 0,
    historicalBronzeCount: 0,
    historicalTop5Count: 0,
    historicalTop10Count: 0,
    historicalAvgRank: null,
    historicalAvgPoints: null,
    historicalPointsTotal: null,
    historicalPointsBySeason: (input.historicalRanks ?? []).map((rank, index) => ({
      seasonId: `season-${index + 1}`,
      seasonName: `Season ${index + 1}`,
      points: rank != null ? 50 - rank : null,
      rank,
    })),
    historicalSeasonsPlayed: input.historicalRanks?.length ?? 0,
    historicalBestRank: input.historicalRanks?.length ? Math.min(...input.historicalRanks.filter((rank): rank is number => rank != null)) : null,
    historicalLastSeasonRank: input.historicalRanks?.at(-1) ?? null,
    historicalLastSeasonPoints: null,
    historicalHasData: (input.historicalRanks?.length ?? 0) > 0,
    disciplineValues: {},
    roster: [],
    rosterPlayers: [],
  };
}

describe("sponsor team quality rank", () => {
  it("ranks elite teams with strong history and market value near the top", () => {
    const rows = Array.from({ length: 32 }, (_, index) => {
      const rank = index + 1;
      return createRow({
        teamId: `T-${String(rank).padStart(2, "0")}`,
        teamName: `Team ${rank}`,
        rank,
        budget: 200 - index * 4,
        marketValueTotal: 500 - index * 12,
        historicalRanks: [rank, rank + 1, rank + 2],
      });
    });

    const top = computeSponsorTeamQualityRank({ rows, teamId: "T-01" });
    const bottom = computeSponsorTeamQualityRank({ rows, teamId: "T-32" });

    expect(top?.qualityRank).toBeLessThan(bottom?.qualityRank ?? 32);
    expect(SPONSOR_RARITIES[top!.targetRarity].order).toBeGreaterThan(SPONSOR_RARITIES[bottom!.targetRarity].order);

    // Top-Team (bestes qualityRank, Rang 1) muss die höchste erreichbare Rarity-Decke (legendär) tragen;
    // Bottom-Team (schlechtestes) die niedrigste (gewöhnlich).
    expect(top?.maxRarity).toBe("legendär");
    expect(bottom?.maxRarity).toBe("gewöhnlich");
  });

  it("falls back to budget rank when market value is missing", () => {
    const rows = [
      createRow({ teamId: "A", teamName: "A", rank: 8, budget: 150, marketValueTotal: null }),
      createRow({ teamId: "B", teamName: "B", rank: 20, budget: 90, marketValueTotal: null }),
    ];

    const ranks = buildLeagueTeamQualityRanks(rows);
    expect(ranks.get("A")?.qualityRank).toBeLessThan(ranks.get("B")?.qualityRank ?? 32);
  });

  it("redistributes history weights when fewer than five seasons exist", () => {
    const rows = [
      createRow({ teamId: "NEW", teamName: "New FC", rank: 10, budget: 100, historicalRanks: [12] }),
      createRow({ teamId: "OLD", teamName: "Old FC", rank: 10, budget: 100, historicalRanks: [10, 10, 10, 10, 10] }),
    ];

    const fresh = computeSponsorTeamQualityRank({ rows, teamId: "NEW" });
    expect(fresh?.components.some((component) => component.key === "seasonN1")).toBe(true);
    expect(fresh?.components.some((component) => component.key === "seasonN5")).toBe(false);
    expect(fresh?.qualityRank).toBeGreaterThan(0);
  });

  it("maps quality rank and league percentile to rarities (same bucketing as the old star tiers)", () => {
    // Old star-tier breakpoints: qualityRank<=4 -> ★5(legendär), <=10 -> ★4(selten), <=18 -> ★3(magisch),
    // <=26 -> ★2(gewöhnlich), else -> ★1(gewöhnlich). Rarity-keyed equivalents assert the identical bucketing.
    expect(getMaxRarityForQualityRank(2)).toBe("legendär");
    expect(getMaxRarityForQualityRank(20)).toBe("gewöhnlich");
    expect(getPercentileTargetRarity(1, 32)).toBe("legendär");
    expect(getPercentileTargetRarity(32, 32)).toBe("gewöhnlich");
  });

  it("derives maxRarity/targetRarity consistently (target never exceeds max) for every ranked team", () => {
    const rows = Array.from({ length: 32 }, (_, index) => {
      const rank = index + 1;
      return createRow({
        teamId: `T-${String(rank).padStart(2, "0")}`,
        teamName: `Team ${rank}`,
        rank,
        budget: 200 - index * 4,
        marketValueTotal: 500 - index * 12,
        historicalRanks: [rank, rank + 1, rank + 2],
      });
    });
    const ranks = buildLeagueTeamQualityRanks(rows);
    expect(ranks.size).toBe(32);
    for (const entry of ranks.values()) {
      expect(SPONSOR_RARITIES[entry.targetRarity].order).toBeLessThanOrEqual(SPONSOR_RARITIES[entry.maxRarity].order);
    }
    // Rang 1 muss die Elite-Decke (legendär) tragen, Rang 32 die niedrigste (gewöhnlich).
    expect(ranks.get("T-01")?.maxRarity).toBe("legendär");
    expect(ranks.get("T-32")?.maxRarity).toBe("gewöhnlich");
  });
});
