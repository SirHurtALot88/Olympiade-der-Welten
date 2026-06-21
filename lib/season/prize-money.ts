import type { PrizeMoneyRow, SponsorPlacementRow, TeamPrizeSummaryRow } from "@/lib/season/types";
import type { AdminBalancingConfigInput } from "@/lib/data/olyDataTypes";
import { resolveAdminBalancingConfig } from "@/lib/admin/balancing-config";

const SPONSOR_SEASON_PERCENTS = [
  7.67, 7.29, 6.9, 6.52, 6.13, 5.75, 5.37, 4.98, 4.6, 4.22, 3.99, 3.76, 3.53, 3.3, 3.07, 2.84,
  2.61, 2.38, 2.15, 1.92, 1.76, 1.61, 1.46, 1.3, 1.15, 1, 0.84, 0.69, 0.54, 0.38, 0.23, 0.08,
] as const;

const BASIS_DIFFS = [
  0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 4.4, 4.8, 5.2, 5.6, 6, 6, 6.3, 6.6, 6.9,
  7.2, 7.5, 7.8, 8.1, 8.4, 8.7, 9, 9.3, 9.6, 9.9, 10.2, 10.5,
] as const;

const SPONSOR_PLACEMENT_POSITIVE = Array.from({ length: 31 }, (_, index) => {
  const rankDelta = 31 - index;
  const placement = Number((30.68 - index * 0.745).toFixed(2));
  const percent = Number((20.5 - index * 0.5).toFixed(1));
  return {
    rankDelta,
    placement,
    percent,
  };
});

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function getSponsorPlacementRows(): SponsorPlacementRow[] {
  return [
    ...SPONSOR_PLACEMENT_POSITIVE,
    { rankDelta: 0, placement: 0, percent: 0 },
    ...SPONSOR_PLACEMENT_POSITIVE.map((row) => ({
      rankDelta: -row.rankDelta,
      placement: -row.placement,
      percent: -row.percent,
    })),
  ].sort((left, right) => right.rankDelta - left.rankDelta);
}

export function getSponsorPlacementLookup() {
  return Object.fromEntries(getSponsorPlacementRows().map((row) => [row.rankDelta, row.placement]));
}

export function buildPrizeMoneyTable(teamSalaries: number[], salaryFactor = 1, adminConfig?: AdminBalancingConfigInput | null): PrizeMoneyRow[] {
  const sortedSalaries = [...teamSalaries].filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  const basisBase = sortedSalaries.length >= 4 ? sortedSalaries[3] : 0;
  const sponsorSeasonPercents = adminConfig ? resolveAdminBalancingConfig(adminConfig).prizeMoneyPercents : [...SPONSOR_SEASON_PERCENTS];
  const sumPercent = sponsorSeasonPercents.reduce((sum, value) => sum + value, 0);

  const rows = sponsorSeasonPercents.map((percent, index) => {
    const rank = index + 1;
    const diff = BASIS_DIFFS[index] ?? 0;
    const basis = basisBase + diff;
    return {
      rank,
      basis,
      percent,
      diff,
      seasonShare: 0,
      totalPrizeMoney: 0,
    };
  });

  const sumBasis = rows.reduce((sum, row) => sum + row.basis, 0);
  const totalSalaries = sortedSalaries.reduce((sum, value) => sum + value, 0);
  const seasonTotal = Math.max(0, totalSalaries * salaryFactor - sumBasis);

  return rows.map((row) => {
    const seasonShare = round2(seasonTotal * (row.percent / sumPercent));
    return {
      ...row,
      basis: round2(row.basis),
      seasonShare,
      totalPrizeMoney: round2(row.basis + seasonShare),
    };
  });
}

export function buildTeamPrizeSummary(
  seasonStandRows: Array<{
    rank: number;
    startPlace?: number;
    team: { teamId: string; name: string; cash: number };
    upkeep: number;
    transfers?: number;
  }>,
  salaryFactor = 1,
  adminConfig?: AdminBalancingConfigInput | null,
): TeamPrizeSummaryRow[] {
  const prizeRows = buildPrizeMoneyTable(seasonStandRows.map((row) => row.upkeep), salaryFactor, adminConfig);
  const prizeMap = new Map(prizeRows.map((row) => [row.rank, row]));
  const placementMap = getSponsorPlacementLookup();

  return seasonStandRows.map((row, index) => {
    const prize = prizeMap.get(row.rank);
    const startPlace = row.startPlace ?? index + 1;
    const rankDiff = startPlace - row.rank;
    const transfers = round2(row.transfers ?? 0);
    const basis = prize?.basis ?? 0;
    const sponsorSeason = prize?.seasonShare ?? 0;
    const placementBonus = placementMap[rankDiff] ?? 0;
    const sponsorTotal = round2(basis + sponsorSeason + placementBonus);
    const profitLoss = round2(sponsorTotal - row.upkeep);
    // `team.cash` is already the local in-season cash state, including transfer effects.
    // Season-end preview must not subtract transfer spend a second time.
    const cashForecast = round2(row.team.cash - row.upkeep);
    const cashTotal = round2(cashForecast + sponsorTotal);

    return {
      teamId: row.team.teamId,
      teamName: row.team.name,
      place: row.rank,
      startPlace,
      rankDiff,
      salary: round2(row.upkeep),
      cash: round2(row.team.cash),
      transfers,
      basis: round2(basis),
      sponsorSeason: round2(sponsorSeason),
      placementBonus: round2(placementBonus),
      sponsorTotal,
      profitLoss,
      cashForecast,
      cashTotal,
    };
  });
}

export function getDefaultSalaryFactors() {
  return [1, 1, 1, 1, 1];
}
