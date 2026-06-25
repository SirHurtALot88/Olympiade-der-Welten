import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { saisonstandDisciplineColumns } from "@/lib/foundation/saisonstand-column-contract";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";
import { buildTeamPrizeSummary } from "@/lib/season/prize-money";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { buildAllTimeTableFromSnapshots } from "@/lib/season/season-snapshot-helpers";

type TeamManagementSnapshotStanding = {
  rank: number | null;
  points: number | null;
  cash: number | null;
  cashFc?: number | null;
  startplatz?: number | null;
  rankDiff?: number | null;
  sponsorBasis?: number | null;
  sponsorRank?: number | null;
  sponsorTotal?: number | null;
  sponsorSeason?: number | null;
  guv?: number | null;
  cashTotal?: number | null;
  form?: number | null;
  transfers?: number | null;
  rosterCount?: number | null;
  salaryTotal?: number | null;
  marketValueTotal?: number | null;
  budget?: number | null;
  playerMin?: number | null;
  playerOpt?: number | null;
  disciplineValues?: Record<string, number | null> | null;
};

type TeamManagementTransferSummary = {
  transferCount: number;
  transferBuyTotal: number;
  transferSellTotal: number;
  transferNet: number;
};

function buildTransferSummaryByTeamIdFromHistory(gameState: GameState) {
  const summary = new Map<string, TeamManagementTransferSummary>();

  for (const entry of gameState.transferHistory ?? []) {
    const fee = typeof entry.fee === "number" && Number.isFinite(entry.fee) ? entry.fee : 0;

    if (entry.transferType === "buy" && entry.toTeamId) {
      const current = summary.get(entry.toTeamId) ?? {
        transferCount: 0,
        transferBuyTotal: 0,
        transferSellTotal: 0,
        transferNet: 0,
      };
      current.transferCount += 1;
      current.transferBuyTotal = roundValue(current.transferBuyTotal + fee, 2);
      current.transferNet = roundValue(current.transferSellTotal - current.transferBuyTotal, 2);
      summary.set(entry.toTeamId, current);
    }

    if (entry.transferType === "sell" && entry.fromTeamId) {
      const current = summary.get(entry.fromTeamId) ?? {
        transferCount: 0,
        transferBuyTotal: 0,
        transferSellTotal: 0,
        transferNet: 0,
      };
      current.transferCount += 1;
      current.transferSellTotal = roundValue(current.transferSellTotal + fee, 2);
      current.transferNet = roundValue(current.transferSellTotal - current.transferBuyTotal, 2);
      summary.set(entry.fromTeamId, current);
    }
  }

  return Object.fromEntries(summary.entries());
}

type TeamManagementSnapshotInput = {
  gameState: GameState;
  seasonId?: string;
  preferStandingDisciplineValues?: boolean;
  standingsByTeamId?: Record<string, TeamManagementSnapshotStanding>;
  needScoreByTeamId?: Record<string, number | null | undefined>;
  transferSummaryByTeamId?: Record<string, TeamManagementTransferSummary | undefined>;
};

export type TeamManagementSnapshotRow = {
  team: Team;
  teamId: string;
  teamCode: string;
  teamName: string;
  generalManagerName: string | null;
  generalManagerTitle: string | null;
  generalManagerInfluencePct: number | null;
  rank: number | null;
  points: number | null;
  rosterCount: number;
  salaryTotal: number;
  avgContractLength: number | null;
  marketValueTotal: number | null;
  cash: number | null;
  cashFc: number | null;
  budget: number | null;
  formAvg: number | null;
  financeForm: number | null;
  needScore: number | null;
  avgMarketValue: number | null;
  avgPps: number | null;
  avgOvr: number | null;
  ppsTotal: number;
  ppsPow: number;
  ppsSpe: number;
  ppsMen: number;
  ppsSoc: number;
  playerMin: number | null;
  playerOpt: number | null;
  rosterTarget: string | null;
  transferCount: number;
  transferBuyTotal: number;
  transferSellTotal: number;
  transferNet: number;
  transfersSeasonValue: number | null;
  cashDelta: number | null;
  startplatz: number | null;
  rankDiff: number | null;
  sponsorBasis: number | null;
  sponsorRank: number | null;
  sponsorTotal: number | null;
  sponsorSeason: number | null;
  guv: number | null;
  cashTotal: number | null;
  historicalPow: number | null;
  historicalSpe: number | null;
  historicalMen: number | null;
  historicalSoc: number | null;
  historicalGoldCount: number;
  historicalSilverCount: number;
  historicalBronzeCount: number;
  historicalTop5Count: number;
  historicalTop10Count: number;
  historicalAvgRank: number | null;
  historicalAvgPoints: number | null;
  historicalPointsTotal: number | null;
  historicalPointsBySeason: Array<{
    seasonId: string;
    seasonName: string;
    points: number | null;
    rank: number | null;
  }>;
  historicalSeasonsPlayed: number;
  historicalBestRank: number | null;
  historicalLastSeasonRank: number | null;
  historicalLastSeasonPoints: number | null;
  historicalHasData: boolean;
  disciplineValues: Record<string, number | null>;
  roster: RosterEntry[];
  rosterPlayers: Array<{ entry: RosterEntry; player: Player }>;
};

function roundValue(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function deriveDisplayedCash(input: {
  teamCash: number | null;
  budget: number | null;
  transferNet: number | null;
  hasCashPrizeApply: boolean;
}) {
  if (input.teamCash != null && Number.isFinite(input.teamCash)) {
    return roundValue(input.teamCash, 2);
  }

  if (
    input.budget != null &&
    Number.isFinite(input.budget) &&
    input.transferNet != null &&
    Number.isFinite(input.transferNet)
  ) {
    return roundValue(input.budget + input.transferNet, 2);
  }

  return input.teamCash;
}

function buildStartBudgetRankMap(teams: Team[]) {
  const sorted = [...teams].sort((left, right) => {
    const leftBudget = Number.isFinite(left.budget) ? left.budget : Number.NEGATIVE_INFINITY;
    const rightBudget = Number.isFinite(right.budget) ? right.budget : Number.NEGATIVE_INFINITY;
    if (rightBudget !== leftBudget) {
      return rightBudget - leftBudget;
    }
    return left.name.localeCompare(right.name, "de");
  });

  return new Map(sorted.map((team, index) => [team.teamId, index + 1] as const));
}

function getRosterDisplaySalary(entry: RosterEntry, player?: Player | null) {
  return resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0;
}

function getRosterPlayers(
  playersById: Map<string, Player>,
  roster: RosterEntry[],
) {
  return roster
    .map((entry) => ({
      entry,
      player: playersById.get(entry.playerId),
    }))
    .filter((item): item is { entry: RosterEntry; player: Player } => Boolean(item.player));
}

const visibleSeasonPointsDisciplineKeys = saisonstandDisciplineColumns.filter(
  (columnKey) => columnKey !== "bonuspunkte",
);

function deriveVisibleSeasonPoints(
  disciplineValues: Record<string, number | null> | null | undefined,
) {
  if (!disciplineValues) {
    return null;
  }

  const numericValues = visibleSeasonPointsDisciplineKeys
    .map((disciplineKey) => disciplineValues[disciplineKey])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (numericValues.length === 0) {
    return null;
  }

  return roundValue(numericValues.reduce((sum, value) => sum + value, 0), 1);
}

function derivePpsByAreaFromDisciplineValues(
  disciplineValues: Record<string, number | null> | null | undefined,
  gameState: GameState,
) {
  const totals = {
    total: 0,
    pow: 0,
    spe: 0,
    men: 0,
    soc: 0,
  };

  if (!disciplineValues) {
    return totals;
  }

  const categoryByDisciplineKey = new Map(
    gameState.disciplines.map((discipline) => [
      normalizeLineupDisciplineFieldName(discipline.id),
      discipline.category,
    ] as const),
  );

  for (const disciplineKey of visibleSeasonPointsDisciplineKeys) {
    const value = disciplineValues[disciplineKey];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      continue;
    }

    const category = categoryByDisciplineKey.get(disciplineKey);
    totals.total += value;
    if (category === "power") totals.pow += value;
    if (category === "speed") totals.spe += value;
    if (category === "mental") totals.men += value;
    if (category === "social") totals.soc += value;
  }

  return {
    total: roundValue(totals.total, 1),
    pow: roundValue(totals.pow, 1),
    spe: roundValue(totals.spe, 1),
    men: roundValue(totals.men, 1),
    soc: roundValue(totals.soc, 1),
  };
}

function mergeSeasonDisciplineValues(input: {
  standingValues?: Record<string, number | null> | null;
  ledgerValues?: Record<string, number> | null;
}) {
  const merged = Object.fromEntries(
    saisonstandDisciplineColumns
      .filter((columnKey) => columnKey !== "bonuspunkte")
      .map((columnKey) => [columnKey, null] as const),
  ) as Record<string, number | null>;

  for (const [key, value] of Object.entries(input.standingValues ?? {})) {
    merged[key] = typeof value === "number" && Number.isFinite(value) ? roundValue(value, 1) : null;
  }

  for (const [disciplineId, value] of Object.entries(input.ledgerValues ?? {})) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      continue;
    }

    const normalizedKey = normalizeLineupDisciplineFieldName(disciplineId);
    if (!normalizedKey || !(normalizedKey in merged)) {
      continue;
    }

    merged[normalizedKey] = roundValue(value, 1);
  }

  return merged;
}

export function buildTeamSeasonOverviewRows(input: TeamManagementSnapshotInput): TeamManagementSnapshotRow[] {
  const {
    gameState,
    seasonId = gameState.season.id,
    preferStandingDisciplineValues = false,
    standingsByTeamId = {},
    needScoreByTeamId = {},
    transferSummaryByTeamId = {},
  } = input;
  const derivedTransferSummaryByTeamId = buildTransferSummaryByTeamIdFromHistory(gameState);
  const seasonSnapshots = gameState.seasonState.seasonSnapshots ?? [];
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const rostersByTeamId = new Map<string, RosterEntry[]>();
  for (const rosterEntry of gameState.rosters) {
    const existing = rostersByTeamId.get(rosterEntry.teamId);
    if (existing) {
      existing.push(rosterEntry);
      continue;
    }
    rostersByTeamId.set(rosterEntry.teamId, [rosterEntry]);
  }
  const historicalStandingsByTeamId = new Map<
    string,
    Array<{
      snapshot: (typeof seasonSnapshots)[number];
      standing: (typeof seasonSnapshots)[number]["finalStandings"][number];
    }>
  >();
  for (const snapshot of seasonSnapshots) {
    for (const standing of snapshot.finalStandings) {
      const existing = historicalStandingsByTeamId.get(standing.teamId);
      const item = { snapshot, standing };
      if (existing) {
        existing.push(item);
        continue;
      }
      historicalStandingsByTeamId.set(standing.teamId, [item]);
    }
  }
  const hasCashPrizeApply = (gameState.seasonState.cashPrizeApplyLogs ?? []).some(
    (entry) => entry.seasonId === seasonId,
  );
  const seasonPointsLedger = buildSeasonPointsLedger(gameState, seasonId);
  const playerRatingsById = buildPlayerRatingContractMap(gameState);
  const allTimeTableByTeamId = new Map(
    buildAllTimeTableFromSnapshots(seasonSnapshots, gameState.teams).map((row) => [row.teamId, row] as const),
  );
  const startBudgetRankByTeamId = buildStartBudgetRankMap(gameState.teams);
  const currentSalaryFactor =
    getSeasonEconomyFactorWindow({
      saveId: "team-management-overview",
      seasonId,
      seasonState: gameState.seasonState,
    }).find((row) => row.seasonLabel === "Aktuell")?.factor ?? 1;

  const baseRows = gameState.teams.map((team) => {
    const generalManager = getTeamGeneralManager(gameState, team.teamId);
    const roster = rostersByTeamId.get(team.teamId) ?? [];
    const rosterPlayers = getRosterPlayers(playersById, roster);
    const standing = standingsByTeamId[team.teamId] ?? null;
    const usesArchivedSnapshotValues =
      standing?.rosterCount != null ||
      standing?.salaryTotal != null ||
      standing?.marketValueTotal != null;
    const transferSummary = transferSummaryByTeamId[team.teamId] ?? derivedTransferSummaryByTeamId[team.teamId] ?? null;
    const avgContractLength =
      roster.length > 0
        ? roundValue(roster.reduce((sum, entry) => sum + entry.contractLength, 0) / roster.length, 1)
        : null;
    const salaryTotal =
      rosterPlayers.length > 0
        ? roundValue(
            rosterPlayers.reduce((sum, item) => sum + getRosterDisplaySalary(item.entry, item.player), 0),
            2,
          )
        : roundValue(roster.reduce((sum, entry) => sum + entry.salary, 0), 2);
    const marketValueTotal =
      rosterPlayers.length > 0
        ? roundValue(
            rosterPlayers.reduce(
              (sum, item) =>
                sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.entry }).marketValue ?? 0),
              0,
            ),
            2,
          )
        : null;
    const averageMarketValue =
      marketValueTotal != null && rosterPlayers.length > 0
        ? roundValue(marketValueTotal / rosterPlayers.length, 2)
        : null;
    const seasonPointsSummary = seasonPointsLedger.teamSummariesByTeamId.get(team.teamId) ?? null;
    const currentPpsTotal = roundValue(seasonPointsSummary?.totalPoints ?? 0, 1);
    const hasCurrentPps = (seasonPointsSummary?.playerDerivedTotal ?? 0) > 0;
    const fallbackPpsTotal = 0;
    const ppsValues = rosterPlayers.map((item) => seasonPointsLedger.playerSummariesByPlayerId.get(item.player.id)?.totalPoints ?? 0);
    const avgPps =
      ppsValues.length > 0
        ? roundValue(ppsValues.reduce((sum, value) => sum + value, 0) / ppsValues.length, 2)
        : null;
    const ovrValues = rosterPlayers
      .map((item) => playerRatingsById.get(item.player.id)?.ovrNormalized ?? null)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const avgOvr =
      ovrValues.length > 0
        ? roundValue(ovrValues.reduce((sum, value) => sum + value, 0) / ovrValues.length, 2)
        : null;
    const ppsPow = roundValue(
      hasCurrentPps ? seasonPointsSummary?.pointsByArea.power ?? 0 : 0,
      1,
    );
    const ppsSpe = roundValue(
      hasCurrentPps ? seasonPointsSummary?.pointsByArea.speed ?? 0 : 0,
      1,
    );
    const ppsMen = roundValue(
      hasCurrentPps ? seasonPointsSummary?.pointsByArea.mental ?? 0 : 0,
      1,
    );
    const ppsSoc = roundValue(
      hasCurrentPps ? seasonPointsSummary?.pointsByArea.social ?? 0 : 0,
      1,
    );
    const ppsTotal = hasCurrentPps ? currentPpsTotal : fallbackPpsTotal;
    const formAvg =
      rosterPlayers.length > 0
        ? roundValue(
            rosterPlayers.reduce((sum, item) => sum + item.player.form, 0) / rosterPlayers.length,
            1,
          )
        : null;
    const playerMin = standing?.playerMin ?? null;
    const playerOpt = standing?.playerOpt ?? null;
    const budget = standing?.budget ?? team.budget ?? null;
    const transferNet = standing?.transfers ?? transferSummary?.transferNet ?? 0;
    const cash = deriveDisplayedCash({
      teamCash: usesArchivedSnapshotValues ? standing?.cash ?? team.cash ?? null : team.cash ?? standing?.cash ?? null,
      budget,
      transferNet,
      hasCashPrizeApply,
    });
    const cashFc = standing?.cashFc ?? null;
    const cashDelta = budget != null && cash != null ? roundValue(cash - budget, 2) : null;
    const disciplineValues = mergeSeasonDisciplineValues({
      standingValues: standing?.disciplineValues,
      ledgerValues: preferStandingDisciplineValues ? null : seasonPointsSummary?.pointsByDiscipline ?? null,
    });
    const fallbackPpsByArea = derivePpsByAreaFromDisciplineValues(disciplineValues, gameState);
    const displayPpsTotal = hasCurrentPps ? ppsTotal : fallbackPpsByArea.total;
    const displayPpsPow = hasCurrentPps ? ppsPow : fallbackPpsByArea.pow;
    const displayPpsSpe = hasCurrentPps ? ppsSpe : fallbackPpsByArea.spe;
    const displayPpsMen = hasCurrentPps ? ppsMen : fallbackPpsByArea.men;
    const displayPpsSoc = hasCurrentPps ? ppsSoc : fallbackPpsByArea.soc;
    disciplineValues.bonuspunkte =
      hasCurrentPps && seasonPointsSummary != null && seasonPointsSummary.mutatorPpsBonus > 0
        ? roundValue(seasonPointsSummary.mutatorPpsBonus, 1)
        : disciplineValues.bonuspunkte ?? null;
    const visibleSeasonPoints = deriveVisibleSeasonPoints(disciplineValues);
    const storedStandingPoints =
      standing?.points != null && Number.isFinite(standing.points)
        ? roundValue(standing.points, 1)
        : null;
    const currentVisiblePoints =
      storedStandingPoints != null && storedStandingPoints > 0
        ? storedStandingPoints
        : visibleSeasonPoints != null && visibleSeasonPoints > 0
          ? visibleSeasonPoints
          : hasCurrentPps
            ? displayPpsTotal
            : null;
    const sponsorSeason =
      standing?.sponsorTotal != null &&
      standing?.sponsorBasis != null &&
      standing?.sponsorRank != null
        ? roundValue(standing.sponsorTotal - standing.sponsorBasis - standing.sponsorRank, 2)
        : null;
    const allTimeRow = allTimeTableByTeamId.get(team.teamId) ?? null;
    const teamHistoricalSnapshots = historicalStandingsByTeamId.get(team.teamId) ?? [];
    const historicalHasData = allTimeRow?.hasHistory ?? teamHistoricalSnapshots.length > 0;
    const historicalPointsTotal = allTimeRow?.totalHistoricalPoints ?? null;
    const historicalPointsBySeason = [...teamHistoricalSnapshots]
      .sort((left, right) => left.snapshot.seasonId.localeCompare(right.snapshot.seasonId, "de", { numeric: true }))
      .map((entry) => ({
        seasonId: entry.snapshot.seasonId,
        seasonName: entry.snapshot.seasonName,
        points:
          entry.standing.disciplinePoints != null
            ? roundValue(entry.standing.disciplinePoints, 1)
            : entry.standing.points != null
              ? roundValue(entry.standing.points, 1)
              : null,
        rank: entry.standing.rank ?? null,
      }));
    const historicalAvgPoints =
      historicalPointsBySeason.length > 0
        ? roundValue(
            historicalPointsBySeason.reduce((sum, entry) => sum + (entry.points ?? 0), 0) /
              historicalPointsBySeason.length,
            1,
          )
        : null;
    const latestHistoricalEntry =
      [...teamHistoricalSnapshots].sort((left, right) => {
        const leftTs = Date.parse(left.snapshot.archivedAt ?? "");
        const rightTs = Date.parse(right.snapshot.archivedAt ?? "");
        if (Number.isFinite(leftTs) && Number.isFinite(rightTs) && leftTs !== rightTs) {
          return rightTs - leftTs;
        }
        return right.snapshot.seasonId.localeCompare(left.snapshot.seasonId, "de");
      })[0] ?? null;
    const startBudgetRank = startBudgetRankByTeamId.get(team.teamId) ?? null;
    const activeRank =
      currentVisiblePoints == null
        ? startBudgetRank
        : standing?.rank ?? startBudgetRank;

    return {
      team,
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      generalManagerName: generalManager?.profile.name ?? null,
      generalManagerTitle: generalManager?.profile.title ?? null,
      generalManagerInfluencePct: generalManager?.assignment.influencePct ?? null,
      rank: activeRank,
      points: currentVisiblePoints,
      rosterCount: roster.length > 0 ? roster.length : usesArchivedSnapshotValues ? standing?.rosterCount ?? roster.length : roster.length,
      salaryTotal: roster.length > 0 ? salaryTotal : usesArchivedSnapshotValues ? standing?.salaryTotal ?? salaryTotal : salaryTotal,
      avgContractLength,
      marketValueTotal: roster.length > 0 ? marketValueTotal : usesArchivedSnapshotValues ? standing?.marketValueTotal ?? marketValueTotal : marketValueTotal,
      cash,
      cashFc,
      budget,
      formAvg,
      financeForm: standing?.form ?? null,
      needScore: needScoreByTeamId[team.teamId] ?? null,
      avgMarketValue: averageMarketValue,
      avgPps,
      avgOvr,
      ppsTotal: displayPpsTotal,
      ppsPow: displayPpsPow,
      ppsSpe: displayPpsSpe,
      ppsMen: displayPpsMen,
      ppsSoc: displayPpsSoc,
      playerMin,
      playerOpt,
      rosterTarget:
        playerMin != null && playerOpt != null
          ? `${Math.round(playerMin)} / ${Math.round(playerOpt)}`
          : null,
      transferCount: transferSummary?.transferCount ?? 0,
      transferBuyTotal: transferSummary?.transferBuyTotal ?? 0,
      transferSellTotal: transferSummary?.transferSellTotal ?? 0,
      transferNet,
      transfersSeasonValue: transferNet,
      cashDelta,
      startplatz: currentVisiblePoints == null ? startBudgetRank : standing?.startplatz ?? startBudgetRank,
      rankDiff: standing?.rankDiff ?? null,
      sponsorBasis: standing?.sponsorBasis ?? null,
      sponsorRank: standing?.sponsorRank ?? null,
      sponsorTotal: standing?.sponsorTotal ?? null,
      sponsorSeason,
      guv: standing?.guv ?? null,
      cashTotal: standing?.cashTotal ?? null,
      historicalPow: allTimeRow?.historicalPow ?? null,
      historicalSpe: allTimeRow?.historicalSpe ?? null,
      historicalMen: allTimeRow?.historicalMen ?? null,
      historicalSoc: allTimeRow?.historicalSoc ?? null,
      historicalGoldCount: allTimeRow?.gold ?? 0,
      historicalSilverCount: allTimeRow?.silver ?? 0,
      historicalBronzeCount: allTimeRow?.bronze ?? 0,
      historicalTop5Count: allTimeRow?.top5 ?? 0,
      historicalTop10Count: allTimeRow?.top10 ?? 0,
      historicalAvgRank: allTimeRow?.avgRank ?? null,
      historicalAvgPoints,
      historicalPointsTotal,
      historicalPointsBySeason,
      historicalSeasonsPlayed: allTimeRow?.seasonsPlayed ?? teamHistoricalSnapshots.length,
      historicalBestRank: allTimeRow?.bestRank ?? null,
      historicalLastSeasonRank: latestHistoricalEntry?.standing.rank ?? allTimeRow?.lastSeasonRank ?? null,
      historicalLastSeasonPoints:
        latestHistoricalEntry?.standing.disciplinePoints != null
          ? roundValue(latestHistoricalEntry.standing.disciplinePoints, 1)
          : null,
      historicalHasData,
      disciplineValues,
      roster,
      rosterPlayers,
    };
  });

  const startRankRows = [...baseRows]
    .filter((row) => row.budget != null)
    .sort((left, right) => {
      if ((right.budget ?? Number.NEGATIVE_INFINITY) !== (left.budget ?? Number.NEGATIVE_INFINITY)) {
        return (right.budget ?? Number.NEGATIVE_INFINITY) - (left.budget ?? Number.NEGATIVE_INFINITY);
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });

  const derivedStartRankByTeamId = new Map<string, number>();
  let previousBudget: number | null = null;
  let previousRank = 0;

  startRankRows.forEach((row, index) => {
    if (previousBudget != null && row.budget === previousBudget) {
      derivedStartRankByTeamId.set(row.teamId, previousRank);
      return;
    }

    const nextRank = index + 1;
    previousBudget = row.budget;
    previousRank = nextRank;
    derivedStartRankByTeamId.set(row.teamId, nextRank);
  });

  const rowsWithDerivedRanks = baseRows
    .map((row) => {
      const derivedStartRank = derivedStartRankByTeamId.get(row.teamId) ?? null;
      return {
        ...row,
        rank: row.rank ?? derivedStartRank,
        startplatz: row.startplatz ?? derivedStartRank,
      };
    });

  const prizeSummaryByTeamId = new Map(
    buildTeamPrizeSummary(
      rowsWithDerivedRanks.map((row) => ({
        rank: row.rank ?? 0,
        startPlace: row.startplatz ?? row.rank ?? 0,
        team: {
          teamId: row.team.teamId,
          name: row.team.name,
          cash: row.cash ?? 0,
        },
        upkeep: row.salaryTotal,
        transfers: row.transfersSeasonValue ?? 0,
      })),
      currentSalaryFactor,
      gameState.seasonState.adminBalancingConfig,
    ).map((row) => [row.teamId, row] as const),
  );

  return rowsWithDerivedRanks
    .map((row) => {
      const prizeSummary = prizeSummaryByTeamId.get(row.teamId) ?? null;
      return {
        ...row,
        cashFc: prizeSummary?.cashForecast ?? row.cashFc ?? null,
        sponsorBasis: prizeSummary?.basis ?? row.sponsorBasis ?? null,
        sponsorRank: prizeSummary?.placementBonus ?? row.sponsorRank ?? null,
        sponsorSeason: prizeSummary?.sponsorSeason ?? row.sponsorSeason ?? null,
        sponsorTotal: prizeSummary?.sponsorTotal ?? row.sponsorTotal ?? null,
        guv: prizeSummary?.profitLoss ?? row.guv ?? null,
        cashTotal: prizeSummary?.cashTotal ?? row.cashTotal ?? null,
      };
    })
    .sort((left, right) => {
      const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
      const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return (right.cash ?? Number.NEGATIVE_INFINITY) - (left.cash ?? Number.NEGATIVE_INFINITY);
    });
}
