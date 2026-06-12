import type { GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { saisonstandDisciplineColumns } from "@/lib/foundation/saisonstand-column-contract";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";
import { buildTeamPrizeSummary } from "@/lib/season/prize-money";
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
  standingsByTeamId?: Record<string, TeamManagementSnapshotStanding>;
  needScoreByTeamId?: Record<string, number | null | undefined>;
  transferSummaryByTeamId?: Record<string, TeamManagementTransferSummary | undefined>;
};

export type TeamManagementSnapshotRow = {
  team: Team;
  teamId: string;
  teamCode: string;
  teamName: string;
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
  historicalPointsTotal: number | null;
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

function getRosterDisplaySalary(entry: RosterEntry, player?: Player | null) {
  return resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0;
}

function getRosterPlayers(gameState: GameState, roster: RosterEntry[]) {
  return roster
    .map((entry) => ({
      entry,
      player: gameState.players.find((candidate) => candidate.id === entry.playerId),
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
  const { gameState, standingsByTeamId = {}, needScoreByTeamId = {}, transferSummaryByTeamId = {} } = input;
  const derivedTransferSummaryByTeamId = buildTransferSummaryByTeamIdFromHistory(gameState);
  const seasonSnapshots = gameState.seasonState.seasonSnapshots ?? [];
  const latestCompletedSnapshot =
    [...seasonSnapshots]
      .filter((snapshot) => snapshot.status == null || snapshot.status === "completed")
      .sort((left, right) => {
        const leftTs = Date.parse(left.archivedAt ?? "");
        const rightTs = Date.parse(right.archivedAt ?? "");
        if (Number.isFinite(leftTs) && Number.isFinite(rightTs) && leftTs !== rightTs) {
          return rightTs - leftTs;
        }
        return right.seasonId.localeCompare(left.seasonId, "de");
      })[0] ?? null;
  const latestCompletedStandingByTeamId = new Map(
    (latestCompletedSnapshot?.finalStandings ?? []).map((standing) => [standing.teamId, standing] as const),
  );
  const hasCashPrizeApply = (gameState.seasonState.cashPrizeApplyLogs ?? []).some(
    (entry) => entry.seasonId === gameState.season.id,
  );
  const seasonPointsLedger = buildSeasonPointsLedger(gameState);
  const playerRatingsById = buildPlayerRatingContractMap(gameState);
  const allTimeTableByTeamId = new Map(
    buildAllTimeTableFromSnapshots(seasonSnapshots, gameState.teams).map((row) => [row.teamId, row] as const),
  );

  const baseRows = gameState.teams.map((team) => {
    const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const rosterPlayers = getRosterPlayers(gameState, roster);
    const standing = standingsByTeamId[team.teamId] ?? null;
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
    const latestCompletedStanding = latestCompletedStandingByTeamId.get(team.teamId) ?? null;
    const hasCurrentSportPoints =
      (seasonPointsSummary?.totalPoints ?? 0) > 0 ||
      (standing?.points != null && Number.isFinite(standing.points) && standing.points > 0);
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
      hasCurrentSportPoints ? seasonPointsSummary?.pointsByArea.power ?? 0 : latestCompletedStanding?.disciplinePointsByArea.pow ?? 0,
      1,
    );
    const ppsSpe = roundValue(
      hasCurrentSportPoints ? seasonPointsSummary?.pointsByArea.speed ?? 0 : latestCompletedStanding?.disciplinePointsByArea.spe ?? 0,
      1,
    );
    const ppsMen = roundValue(
      hasCurrentSportPoints ? seasonPointsSummary?.pointsByArea.mental ?? 0 : latestCompletedStanding?.disciplinePointsByArea.men ?? 0,
      1,
    );
    const ppsSoc = roundValue(
      hasCurrentSportPoints ? seasonPointsSummary?.pointsByArea.social ?? 0 : latestCompletedStanding?.disciplinePointsByArea.soc ?? 0,
      1,
    );
    const ppsTotal = roundValue(
      hasCurrentSportPoints ? seasonPointsSummary?.totalPoints ?? 0 : latestCompletedStanding?.disciplinePoints ?? latestCompletedStanding?.points ?? 0,
      1,
    );
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
      teamCash: team.cash ?? standing?.cash ?? null,
      budget,
      transferNet,
      hasCashPrizeApply,
    });
    const cashFc = standing?.cashFc ?? null;
    const cashDelta = budget != null && cash != null ? roundValue(cash - budget, 2) : null;
    const disciplineValues = mergeSeasonDisciplineValues({
      standingValues: standing?.disciplineValues,
      ledgerValues: seasonPointsSummary?.pointsByDiscipline ?? null,
    });
    const visibleSeasonPoints = deriveVisibleSeasonPoints(disciplineValues);
    const storedStandingPoints =
      standing?.points != null && Number.isFinite(standing.points)
        ? roundValue(standing.points, 1)
        : null;
    const sponsorSeason =
      standing?.sponsorTotal != null &&
      standing?.sponsorBasis != null &&
      standing?.sponsorRank != null
        ? roundValue(standing.sponsorTotal - standing.sponsorBasis - standing.sponsorRank, 2)
        : null;
    const allTimeRow = allTimeTableByTeamId.get(team.teamId) ?? null;
    const teamHistoricalSnapshots = seasonSnapshots
      .map((snapshot) => ({
        snapshot,
        standing: snapshot.finalStandings.find((standingRow) => standingRow.teamId === team.teamId) ?? null,
      }))
      .filter(
        (
          entry,
        ): entry is {
          snapshot: (typeof seasonSnapshots)[number];
          standing: NonNullable<(typeof entry)["standing"]>;
        } => Boolean(entry.standing),
      );
    const historicalHasData = allTimeRow?.hasHistory ?? teamHistoricalSnapshots.length > 0;
    const historicalPointsTotal = allTimeRow?.totalHistoricalPoints ?? null;
    const latestHistoricalEntry =
      [...teamHistoricalSnapshots].sort((left, right) => {
        const leftTs = Date.parse(left.snapshot.archivedAt ?? "");
        const rightTs = Date.parse(right.snapshot.archivedAt ?? "");
        if (Number.isFinite(leftTs) && Number.isFinite(rightTs) && leftTs !== rightTs) {
          return rightTs - leftTs;
        }
        return right.snapshot.seasonId.localeCompare(left.snapshot.seasonId, "de");
      })[0] ?? null;

    return {
      team,
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      rank: hasCurrentSportPoints ? standing?.rank ?? null : latestCompletedStanding?.rank ?? standing?.rank ?? null,
      points: hasCurrentSportPoints
        ? storedStandingPoints ?? visibleSeasonPoints
        : latestCompletedStanding?.disciplinePoints ?? latestCompletedStanding?.points ?? storedStandingPoints ?? visibleSeasonPoints,
      rosterCount: roster.length,
      salaryTotal,
      avgContractLength,
      marketValueTotal,
      cash,
      cashFc,
      budget,
      formAvg,
      financeForm: standing?.form ?? null,
      needScore: needScoreByTeamId[team.teamId] ?? null,
      avgMarketValue: averageMarketValue,
      avgPps,
      avgOvr,
      ppsTotal,
      ppsPow,
      ppsSpe,
      ppsMen,
      ppsSoc,
      playerMin,
      playerOpt,
      rosterTarget:
        playerMin != null && playerOpt != null
          ? `${Math.round(playerMin)} / ${Math.round(playerOpt)}`
          : null,
      transferCount: transferSummary?.transferCount ?? 0,
      transferBuyTotal: transferSummary?.transferBuyTotal ?? 0,
      transferSellTotal: transferSummary?.transferSellTotal ?? 0,
      transferNet: transferSummary?.transferNet ?? 0,
      transfersSeasonValue: transferNet,
      cashDelta,
      startplatz: standing?.startplatz ?? null,
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
      historicalPointsTotal,
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

  const cashRankRows = [...baseRows]
    .filter((row) => row.cash != null)
    .sort((left, right) => {
      if ((right.cash ?? Number.NEGATIVE_INFINITY) !== (left.cash ?? Number.NEGATIVE_INFINITY)) {
        return (right.cash ?? Number.NEGATIVE_INFINITY) - (left.cash ?? Number.NEGATIVE_INFINITY);
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });

  const derivedCashRankByTeamId = new Map<string, number>();
  let previousCash: number | null = null;
  let previousRank = 0;

  cashRankRows.forEach((row, index) => {
    if (previousCash != null && row.cash === previousCash) {
      derivedCashRankByTeamId.set(row.teamId, previousRank);
      return;
    }

    const nextRank = index + 1;
    previousCash = row.cash;
    previousRank = nextRank;
    derivedCashRankByTeamId.set(row.teamId, nextRank);
  });

  const rowsWithDerivedRanks = baseRows
    .map((row) => {
      const derivedCashRank = derivedCashRankByTeamId.get(row.teamId) ?? null;
      return {
        ...row,
        rank: row.rank ?? derivedCashRank,
        startplatz: row.startplatz ?? derivedCashRank,
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
    ).map((row) => [row.teamId, row] as const),
  );

  return rowsWithDerivedRanks
    .map((row) => {
      const prizeSummary = prizeSummaryByTeamId.get(row.teamId) ?? null;
      return {
        ...row,
        cashFc: row.cashFc ?? prizeSummary?.cashForecast ?? null,
        sponsorBasis: row.sponsorBasis ?? prizeSummary?.basis ?? null,
        sponsorRank: row.sponsorRank ?? prizeSummary?.placementBonus ?? null,
        sponsorSeason: row.sponsorSeason ?? prizeSummary?.sponsorSeason ?? null,
        sponsorTotal: row.sponsorTotal ?? prizeSummary?.sponsorTotal ?? null,
        guv: row.guv ?? prizeSummary?.profitLoss ?? null,
        cashTotal: row.cashTotal ?? prizeSummary?.cashTotal ?? null,
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
