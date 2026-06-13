import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import {
  readNormalizedPrizeMoneyRows,
  readPrizeMoneySourceBundle,
} from "@/lib/season/prize-money-sheet";
import type { StandingsPreviewSource } from "@/lib/standings/standings-preview-engine";

export type PrizeMoneyPreviewFutureSeason = {
  seasonLabel: string;
  factor: number | null;
  prizeMoney: number | null;
  projectedCash: number | null;
};

export type PrizeMoneyRankChangePrize = {
  source: "retool" | "sheet" | "missing";
  startRankSource:
    | "standing_startplatz"
    | "standing_rank_diff"
    | "season1_start_budget"
    | "missing";
  startRank: number | null;
  finalRank: number | null;
  rankDelta: number | null;
  bonusMalus: number | null;
  warning?: string;
};

export type PrizeMoneyPreviewItem = {
  teamId: string;
  teamCode: string;
  teamName: string;
  rank: number | null;
  points: number | null;
  currentCash: number | null;
  prizeMoney: number | null;
  rankChangePrize: PrizeMoneyRankChangePrize;
  projectedCash: number | null;
  status: "ready" | "missing_rank" | "missing_prize" | "missing_cash" | "blocked";
  warnings: string[];
  basisCash: number | null;
  seasonCash: number | null;
  salaryTotal: number | null;
  transferBalance: number | null;
  payoutIfTenBetter: number | null;
  payoutIfTenWorse: number | null;
  projectedCashIfTenBetter: number | null;
  projectedCashIfTenWorse: number | null;
  futureSeasons: PrizeMoneyPreviewFutureSeason[];
};

export type PrizeMoneyPreviewResult = {
  items: PrizeMoneyPreviewItem[];
  blockedRules: string[];
  globalWarnings: string[];
  flowPolicy: "season_end_only";
  summary: {
    totalTeams: number;
    calculableTeams: number;
    prizeRowsCount: number;
    blockedItemsCount: number;
    currentFactor: number | null;
    futureSeasonCount: number;
    totalPrizeMoney: number;
    totalRankChangePrize: number | null;
  };
  source: {
    mode: "sqlite" | "prisma";
    standings: "local_save" | "prisma_read_only_unsupported";
    prizeTable: "normalized_sheet" | "missing";
    placementTable: "sheet" | "missing";
    seasonFactors: "sheet" | "missing";
  };
  seasonFactors: Array<{
    seasonLabel: string;
    factor: number | null;
  }>;
  scenarioWindow: {
    betterBy: number;
    worseBy: number;
  };
  scope: {
    saveId: string;
    seasonId: string;
  } | null;
};

type BuildPrizeMoneyPreviewInput = {
  saveId?: string | null;
  seasonId?: string | null;
  source?: StandingsPreviewSource;
  phase?: "season_end" | "matchday";
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function toFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseSeasonCash(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function clampRank(rank: number) {
  return Math.min(32, Math.max(1, rank));
}

function isSeasonOne(seasonId: string | null | undefined) {
  return /^season-?1$/i.test(String(seasonId ?? "").trim());
}

function resolveLocalSave(persistence: PersistenceService, saveId?: string | null) {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  return (
    (saveId ? persistence.getSaveById(saveId) : null) ??
    persistence.getActiveSave() ??
    bootstrapped.save
  );
}

function buildTransferBalanceByTeamId(transferHistory: Array<{
  transferType?: string | null;
  toTeamId?: string | null;
  fromTeamId?: string | null;
  fee?: number | null;
}>) {
  const transferBalanceByTeamId = new Map<string, number>();

  for (const entry of transferHistory) {
    const amount = toFiniteNumber(entry.fee) ?? 0;
    if (entry.transferType === "buy" && entry.toTeamId) {
      transferBalanceByTeamId.set(
        entry.toTeamId,
        round1((transferBalanceByTeamId.get(entry.toTeamId) ?? 0) - amount),
      );
    }
    if (entry.transferType === "sell" && entry.fromTeamId) {
      transferBalanceByTeamId.set(
        entry.fromTeamId,
        round1((transferBalanceByTeamId.get(entry.fromTeamId) ?? 0) + amount),
      );
    }
  }

  return transferBalanceByTeamId;
}

function buildSeasonOneStartRankByTeamId(teams: Array<{
  teamId: string;
  shortCode?: string | null;
  name?: string | null;
  budget?: number | null;
}>) {
  return new Map(
    teams
      .map((team) => ({
        teamId: team.teamId,
        shortCode: team.shortCode ?? team.teamId,
        name: team.name ?? team.teamId,
        budget: toFiniteNumber(team.budget),
      }))
      .filter((team): team is { teamId: string; shortCode: string; name: string; budget: number } => team.budget != null)
      .sort(
        (left, right) =>
          right.budget - left.budget ||
          left.shortCode.localeCompare(right.shortCode) ||
          left.name.localeCompare(right.name) ||
          left.teamId.localeCompare(right.teamId),
      )
      .map((team, index) => [team.teamId, index + 1] as const),
  );
}

function isLikelyRank(value: number | null): value is number {
  return value != null && Number.isInteger(value) && value >= 1 && value <= 32;
}

function buildRankChangePrize(input: {
  finalRank: number | null;
  startRank: number | null;
  storedRankDelta: number | null;
  seasonOneStartBudgetRank: number | null;
  placementByRankDelta: Map<number, number>;
  placementSourceAvailable: boolean;
}): PrizeMoneyRankChangePrize {
  const { finalRank, startRank, storedRankDelta, seasonOneStartBudgetRank, placementByRankDelta, placementSourceAvailable } = input;
  const rankDiffStartRank = finalRank != null && storedRankDelta != null && Number.isFinite(storedRankDelta)
    ? finalRank + storedRankDelta
    : null;
  const startRankSource: PrizeMoneyRankChangePrize["startRankSource"] = isLikelyRank(startRank)
    ? "standing_startplatz"
    : isLikelyRank(rankDiffStartRank)
      ? "standing_rank_diff"
      : isLikelyRank(seasonOneStartBudgetRank)
        ? "season1_start_budget"
        : "missing";

  if (!placementSourceAvailable) {
    return {
      source: "missing",
      startRankSource,
      startRank,
      finalRank,
      rankDelta: null,
      bonusMalus: null,
      warning: "rank_change_source_missing",
    };
  }

  if (finalRank == null) {
    return {
      source: "sheet",
      startRankSource,
      startRank,
      finalRank,
      rankDelta: null,
      bonusMalus: null,
      warning: "missing_rank",
    };
  }

  const resolvedStartRank =
    isLikelyRank(startRank)
      ? startRank
      : isLikelyRank(rankDiffStartRank)
        ? rankDiffStartRank
        : isLikelyRank(seasonOneStartBudgetRank)
          ? seasonOneStartBudgetRank
          : null;

  if (!isLikelyRank(resolvedStartRank)) {
    return {
      source: "missing",
      startRankSource: "missing",
      startRank: null,
      finalRank,
      rankDelta: null,
      bonusMalus: null,
      warning: "start_rank_source_missing",
    };
  }

  const rankDelta = resolvedStartRank - finalRank;
  const bonusMalus = rankDelta === 0 ? 0 : placementByRankDelta.get(rankDelta) ?? null;

  if (bonusMalus == null) {
    return {
      source: "sheet",
      startRankSource,
      startRank: resolvedStartRank,
      finalRank,
      rankDelta,
      bonusMalus: null,
      warning: "rank_change_delta_missing",
    };
  }

  return {
    source: "sheet",
    startRankSource,
    startRank: resolvedStartRank,
    finalRank,
    rankDelta,
    bonusMalus,
    warning:
      startRank == null && isLikelyRank(rankDiffStartRank)
        ? "start_rank_derived_from_rank_diff"
        : startRank == null && !isLikelyRank(rankDiffStartRank) && startRankSource === "season1_start_budget"
          ? "start_rank_derived_from_season1_start_budget"
          : undefined,
  };
}

export async function buildPrizeMoneyPreview(
  input: BuildPrizeMoneyPreviewInput,
  persistence: PersistenceService = createPersistenceService(),
): Promise<PrizeMoneyPreviewResult> {
  const source = input.source === "prisma" ? "prisma" : "sqlite";
  const seasonId = input.seasonId?.trim() || "season-1";
  const phase = input.phase === "matchday" ? "matchday" : "season_end";

  if (source === "prisma") {
    return {
      items: [],
      blockedRules: ["prisma_read_only_preview_not_supported"],
      globalWarnings: [],
      flowPolicy: "season_end_only",
      summary: {
        totalTeams: 0,
        calculableTeams: 0,
        prizeRowsCount: 0,
        blockedItemsCount: 0,
        currentFactor: null,
        futureSeasonCount: 0,
        totalPrizeMoney: 0,
        totalRankChangePrize: null,
      },
      source: {
        mode: "prisma",
        standings: "prisma_read_only_unsupported",
        prizeTable: "missing",
        placementTable: "missing",
        seasonFactors: "missing",
      },
      seasonFactors: [],
      scenarioWindow: {
        betterBy: 10,
        worseBy: 10,
      },
      scope: null,
    };
  }

  const save = resolveLocalSave(persistence, input.saveId);
  const saveId = save.saveId;
  const prizeRows = await readNormalizedPrizeMoneyRows();
  const sourceBundle = await readPrizeMoneySourceBundle();
  const prizeRowByRank = new Map(
    prizeRows
      .filter((row) => row.rank != null)
      .map((row) => [row.rank as number, row] as const),
  );
  const placementByRankDelta = new Map(
    sourceBundle.placementRows
      .filter((row) => row.placementAmount != null)
      .map((row) => [row.rankDelta, row.placementAmount as number] as const),
  );
  const seasonFactors = sourceBundle.seasonFactors
    .filter((row) => row.factor != null)
    .map((row) => ({
      seasonLabel: row.seasonLabel,
      factor: row.factor,
    }));
  const currentFactor =
    seasonFactors.find((row) => row.seasonLabel === "Aktuell")?.factor ??
    seasonFactors[0]?.factor ??
    null;

  const blockedRules: string[] = [];
  const globalWarnings = new Set<string>();

  if (phase === "matchday") {
    blockedRules.push("season_end_only");
    globalWarnings.add("season_end_only");
  }

  if (prizeRows.length === 0) {
    blockedRules.push("prize_money_table_missing");
  } else if (prizeRows.length < 32) {
    blockedRules.push("prize_money_table_incomplete");
  }

  if (sourceBundle.placementRows.length === 0) {
    globalWarnings.add("placement_bonus_table_missing");
  }

  if (seasonFactors.length === 0) {
    globalWarnings.add("season_factor_table_missing");
  }

  const playerById = new Map(save.gameState.players.map((player) => [player.id, player] as const));
  const rosterByTeamId = new Map<string, typeof save.gameState.rosters>();
  for (const rosterEntry of save.gameState.rosters) {
    const existing = rosterByTeamId.get(rosterEntry.teamId) ?? [];
    existing.push(rosterEntry);
    rosterByTeamId.set(rosterEntry.teamId, existing);
  }

  const transferBalanceByTeamId = buildTransferBalanceByTeamId(save.gameState.transferHistory);
  const seasonOneStartRankByTeamId = isSeasonOne(seasonId)
    ? buildSeasonOneStartRankByTeamId(save.gameState.teams)
    : new Map<string, number>();

  const items: PrizeMoneyPreviewItem[] = save.gameState.teams.map((team) => {
    const standing = save.gameState.seasonState.standings[team.teamId] ?? null;
    const storedRank = toFiniteNumber(standing?.rank) ?? null;
    const rank = storedRank;
    const points = toFiniteNumber(standing?.points) ?? 0;
    const currentCash = toFiniteNumber(team.cash);
    const prizeRow = rank != null ? prizeRowByRank.get(rank) ?? null : null;
    const basisCash = prizeRow ? toFiniteNumber(prizeRow.basis) : null;
    const seasonCash = prizeRow ? parseSeasonCash(prizeRow.season) : null;
    const prizeMoney = prizeRow ? toFiniteNumber(prizeRow.prizeMoney) : null;
    const transferBalance = transferBalanceByTeamId.get(team.teamId) ?? 0;
    const salaryTotal = round1(
      (rosterByTeamId.get(team.teamId) ?? []).reduce((sum, rosterEntry) => {
        const player = playerById.get(rosterEntry.playerId) ?? null;
        return sum + (resolvePlayerEconomyContract({ player, rosterEntry }).salary ?? 0);
      }, 0),
    );

    const warnings = new Set<string>();
    let status: PrizeMoneyPreviewItem["status"] = "ready";

    if (storedRank == null) {
      warnings.add("missing_rank");
      status = "missing_rank";
    }
    if (storedRank != null && (!prizeRow || prizeMoney == null)) {
      warnings.add("missing_prize");
      status = "missing_prize";
    } else if (currentCash == null) {
      warnings.add("missing_cash");
      status = "missing_cash";
    }

    const rankChangePrize = buildRankChangePrize({
      finalRank: rank,
      startRank: toFiniteNumber(standing?.startplatz),
      storedRankDelta: toFiniteNumber(standing?.rankDiff),
      seasonOneStartBudgetRank: seasonOneStartRankByTeamId.get(team.teamId) ?? null,
      placementByRankDelta,
      placementSourceAvailable: sourceBundle.placementRows.length > 0,
    });
    if (rankChangePrize.warning) {
      warnings.add(rankChangePrize.warning);
    }

    const projectedCash =
      currentCash != null && prizeMoney != null
        ? round1(currentCash + prizeMoney + (rankChangePrize.bonusMalus ?? 0))
        : null;

    const buildPlacementScenario = (direction: "better" | "worse") => {
      if (rank == null || prizeMoney == null || currentCash == null) {
        return {
          payout: null,
          projectedCash: null,
        };
      }

      const targetRank =
        direction === "better"
          ? clampRank(rank - 10)
          : clampRank(rank + 10);
      const rankDelta = rank - targetRank;
      if (rankDelta === 0) {
        return {
          payout: prizeMoney,
          projectedCash: round1(currentCash + prizeMoney),
        };
      }
      const placementAmount = placementByRankDelta.get(rankDelta) ?? null;
      if (placementAmount == null) {
        warnings.add(`missing_${direction}_placement_delta`);
        return {
          payout: null,
          projectedCash: null,
        };
      }
      const payout = round1(prizeMoney + placementAmount);
      return {
        payout,
        projectedCash: round1(currentCash + payout),
      };
    };

    const betterScenario = buildPlacementScenario("better");
    const worseScenario = buildPlacementScenario("worse");

    const futureSeasons: PrizeMoneyPreviewFutureSeason[] = seasonFactors
      .filter((row) => row.seasonLabel !== "Aktuell")
      .map((row) => {
        if (basisCash == null || seasonCash == null || currentCash == null || currentFactor == null || row.factor == null) {
          return {
            seasonLabel: row.seasonLabel,
            factor: row.factor,
            prizeMoney: null,
            projectedCash: null,
          };
        }

        const seasonScaled = round1(seasonCash * (row.factor / currentFactor));
        const futurePrize = round1(basisCash + seasonScaled);
        return {
          seasonLabel: row.seasonLabel,
          factor: row.factor,
          prizeMoney: futurePrize,
          projectedCash: round1(currentCash + futurePrize),
        };
      });

    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      rank,
      points,
      currentCash,
      prizeMoney,
      rankChangePrize,
      projectedCash,
      status,
      warnings: Array.from(warnings),
      basisCash,
      seasonCash,
      salaryTotal,
      transferBalance,
      payoutIfTenBetter: betterScenario.payout,
      payoutIfTenWorse: worseScenario.payout,
      projectedCashIfTenBetter: betterScenario.projectedCash,
      projectedCashIfTenWorse: worseScenario.projectedCash,
      futureSeasons,
    };
  });

  const calculableTeams = items.filter((item) => item.projectedCash != null).length;
  const blockedItemsCount = items.filter((item) => item.status !== "ready").length;
  const totalPrizeMoney = round1(
    items.reduce((sum, item) => sum + (item.prizeMoney ?? 0), 0),
  );
  const rankChangePrizeValues = items
    .map((item) => item.rankChangePrize.bonusMalus)
    .filter((value): value is number => value != null);
  const totalRankChangePrize =
    rankChangePrizeValues.length > 0
      ? round1(rankChangePrizeValues.reduce((sum, value) => sum + value, 0))
      : null;

  return {
    items,
    blockedRules,
    globalWarnings: Array.from(globalWarnings),
    flowPolicy: "season_end_only",
    summary: {
      totalTeams: items.length,
      calculableTeams,
      prizeRowsCount: prizeRows.length,
      blockedItemsCount,
      currentFactor,
      futureSeasonCount: seasonFactors.filter((row) => row.seasonLabel !== "Aktuell").length,
      totalPrizeMoney,
      totalRankChangePrize,
    },
    source: {
      mode: "sqlite",
      standings: "local_save",
      prizeTable: prizeRows.length > 0 ? "normalized_sheet" : "missing",
      placementTable: sourceBundle.placementRows.length > 0 ? "sheet" : "missing",
      seasonFactors: seasonFactors.length > 0 ? "sheet" : "missing",
    },
    seasonFactors,
    scenarioWindow: {
      betterBy: 10,
      worseBy: 10,
    },
    scope: {
      saveId,
      seasonId,
    },
  };
}
