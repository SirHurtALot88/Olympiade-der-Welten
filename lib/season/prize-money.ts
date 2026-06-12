import type { PrizeMoneyRow, SponsorPlacementRow, TeamPrizeSummaryRow } from "@/lib/season/types";

const SPONSOR_SEASON_PERCENTS = [
  6.825, 6.521, 6.215, 5.921, 5.632, 5.35, 5.076, 4.809, 4.548, 4.295, 4.049, 3.811, 3.579, 3.354,
  3.134, 2.924, 2.721, 2.523, 2.334, 2.152, 1.977, 1.807, 1.645, 1.491, 1.343, 1.202, 1.069, 0.949,
  0.842, 0.746, 0.661, 0.5,
] as const;

const BASIS_DIFFS = [
  -11, -10.6, -10.2, -9.8, -9.4, -9, -8.6, -8.2, -7.8, -7.4, -7, -6.6, -6.2, -5.8, -5.4, -5, -5,
  -4.7, -4.4, -4.1, -3.8, -3.5, -3.2, -2.9, -2.6, -2.3, -2, -1.7, -1.4, -1.1, -0.8, -0.5,
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

export function buildPrizeMoneyTable(teamSalaries: number[], salaryFactor = 1): PrizeMoneyRow[] {
  const sortedSalaries = [...teamSalaries].filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  const basisBase = sortedSalaries.length >= 4 ? sortedSalaries[3] : 0;
  const sumPercent = SPONSOR_SEASON_PERCENTS.reduce((sum, value) => sum + value, 0);

  const rows = SPONSOR_SEASON_PERCENTS.map((percent, index) => {
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
  const seasonTotal = totalSalaries * salaryFactor - sumBasis;

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
): TeamPrizeSummaryRow[] {
  const prizeRows = buildPrizeMoneyTable(seasonStandRows.map((row) => row.upkeep), salaryFactor);
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
