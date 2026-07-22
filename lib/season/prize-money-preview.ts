import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistenceService } from "@/lib/persistence/types";
import {
  readNormalizedPrizeMoneyRows,
  readPrizeMoneySourceBundle,
} from "@/lib/season/prize-money-sheet";
import { buildPrizeMoneyTable } from "@/lib/season/prize-money";
import { getSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { calculateFacilityIncome, calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { computeTeamBeliebtheitFromGameState } from "@/lib/economy/team-beliebtheit";
import type { StandingsPreviewSource } from "@/lib/standings/standings-preview-engine";

export type PrizeMoneyPreviewFutureSeason = {
  seasonLabel: string;
  factor: number | null;
  salaryGrowthFactor: number | null;
  prizeMoney: number | null;
  salaryTotal: number | null;
  guv: number | null;
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
  /** Projizierte Sponsor-Einnahme beim aktuellen Rang, inkl. bereits erfüllter Ziele/Quests (Netto positiv). */
  sponsorCash: number | null;
  /** Gebäude-Einnahmen netto (Einnahmen − Unterhalt) der Saison. */
  facilityIncome: number | null;
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
    forecastSalaryFactorPassthrough: number;
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
  /**
   * Nur die UI-Sponsor-Tabelle braucht die (teure) Sponsor-Settlement- + Gebäude-Einnahme-Berechnung pro
   * Team. Auf dem AI-Planungs-Hotpfad (ai-needs-picks-compare-service) und in den Season-Workflows bleibt das
   * aus (Default false) — sonst würden 32× Sponsor-Settlements pro Aufruf den Event-Loop blockieren (502).
   */
  includeSponsorIncome?: boolean;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function projectSeasonEndCash(input: {
  currentCash: number | null;
  prizeMoney: number | null;
  salaryTotal: number | null;
  rankChangePrize?: number | null;
}) {
  if (input.currentCash == null || input.prizeMoney == null || input.salaryTotal == null) {
    return null;
  }

  return round1(input.currentCash - input.salaryTotal + input.prizeMoney + (input.rankChangePrize ?? 0));
}

const FORECAST_SALARY_FACTOR_PASSTHROUGH = 0.5;

function buildForecastSalaryGrowthFactor(input: {
  currentFactor: number | null;
  futureFactor: number | null;
}) {
  if (input.currentFactor == null || input.futureFactor == null || input.currentFactor <= 0) {
    return null;
  }

  const relativeFactor = input.futureFactor / input.currentFactor;
  return round3(1 + (relativeFactor - 1) * FORECAST_SALARY_FACTOR_PASSTHROUGH);
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
        forecastSalaryFactorPassthrough: FORECAST_SALARY_FACTOR_PASSTHROUGH,
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
  const normalizedPrizeRows = await readNormalizedPrizeMoneyRows();
  const sourceBundle = await readPrizeMoneySourceBundle();
  const placementByRankDelta = new Map(
    sourceBundle.placementRows
      .filter((row) => row.placementAmount != null)
      .map((row) => [row.rankDelta, row.placementAmount as number] as const),
  );
  // The salary factor is now a per-save random roll within its span (see season-economy-factors),
  // not a fixed sheet pattern — so the sheet's season-factor rows are no longer used to seed it here.
  const seasonFactors = getSeasonEconomyFactorWindow({
    saveId,
    seasonId,
    seasonState: save.gameState.seasonState,
  }).map((row) => ({
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

  if (normalizedPrizeRows.length === 0) {
    blockedRules.push("prize_money_table_missing");
  } else if (normalizedPrizeRows.length < 32) {
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
  const salaryTotalByTeamId = new Map(
    save.gameState.teams.map((team) => {
      const salaryTotal = round1(
        (rosterByTeamId.get(team.teamId) ?? []).reduce((sum, rosterEntry) => {
          const player = playerById.get(rosterEntry.playerId) ?? null;
          return sum + (resolvePlayerEconomyContract({ player, rosterEntry }).salary ?? 0);
        }, 0),
      );
      return [team.teamId, salaryTotal] as const;
    }),
  );
  const hasDynamicSalaryBasis = [...salaryTotalByTeamId.values()].filter((salary) => salary > 0).length >= 4;
  const currentLeagueSalaries = [...salaryTotalByTeamId.values()];
  const adminBalancingConfig = save.gameState.seasonState.adminBalancingConfig;
  const prizeRows =
    currentFactor != null && hasDynamicSalaryBasis
      ? buildPrizeMoneyTable(currentLeagueSalaries, currentFactor, adminBalancingConfig).map((row) => ({
          rank: row.rank,
          basis: row.basis,
          percent: row.percent,
          season: String(row.seasonShare),
          prizeMoney: row.totalPrizeMoney,
        }))
      : normalizedPrizeRows;
  const prizeRowByRank = new Map(
    prizeRows
      .filter((row) => row.rank != null)
      .map((row) => [row.rank as number, row] as const),
  );
  const futurePrizeRowsBySeasonLabel = new Map<string, Map<number, { prizeMoney: number | null }>>();
  if (currentFactor != null && hasDynamicSalaryBasis) {
    for (const seasonFactor of seasonFactors.filter((row) => row.seasonLabel !== "Aktuell")) {
      const salaryGrowthFactor = buildForecastSalaryGrowthFactor({
        currentFactor,
        futureFactor: seasonFactor.factor,
      });
      if (salaryGrowthFactor == null || seasonFactor.factor == null) continue;
      const projectedLeagueSalaries = currentLeagueSalaries.map((salary) => round1(salary * salaryGrowthFactor));
      const table = buildPrizeMoneyTable(projectedLeagueSalaries, seasonFactor.factor, adminBalancingConfig);
      futurePrizeRowsBySeasonLabel.set(
        seasonFactor.seasonLabel,
        new Map(table.map((row) => [row.rank, { prizeMoney: row.totalPrizeMoney }] as const)),
      );
    }
  }

  const transferBalanceByTeamId = buildTransferBalanceByTeamId(save.gameState.transferHistory);
  const seasonOneStartRankByTeamId = isSeasonOne(seasonId)
    ? buildSeasonOneStartRankByTeamId(save.gameState.teams)
    : new Map<string, number>();

  // Sponsor-Einnahmen pro Team = Summe der positiven Cash-Komponenten aus der Settlement-Vorschau (Basis +
  // Rang-Meilenstein beim aktuellen Rang + bereits erfüllte Sonderziele/Quests + Fan-Infrastruktur). NUR für
  // die UI-Sponsor-Tabelle (includeSponsorIncome) — sonst zu teuer für den AI-/Season-Hotpfad (siehe Input-Doc).
  const includeSponsorIncome = input.includeSponsorIncome === true;
  const sponsorCashByTeamId = new Map<string, number>();
  const facilityIncomeByTeamId = new Map<string, number>();
  if (includeSponsorIncome) {
    try {
      for (const row of previewSponsorSettlement(save.gameState).rows) {
        if (row.cashDelta > 0) {
          sponsorCashByTeamId.set(row.teamId, (sponsorCashByTeamId.get(row.teamId) ?? 0) + row.cashDelta);
        }
      }
    } catch {
      // Sponsor-Vorschau ist optional — fehlt sie (z. B. ohne Verträge), bleibt die Sponsor-Spalte leer.
    }
    for (const team of save.gameState.teams) {
      try {
        const facilities = getTeamFacilityState(save.gameState, team.teamId);
        const arenaPopularityFactor = computeTeamBeliebtheitFromGameState(save.gameState, team.teamId).value;
        const income = calculateFacilityIncome(facilities, { arenaPopularityFactor });
        const upkeep = calculateFacilityUpkeep(facilities);
        facilityIncomeByTeamId.set(team.teamId, round1(income - upkeep));
      } catch {
        // Gebäude-Einnahmen optional.
      }
    }
  }

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
    const salaryTotal = salaryTotalByTeamId.get(team.teamId) ?? 0;

    const warnings = new Set<string>();
    let status: PrizeMoneyPreviewItem["status"] = "ready";

    if (storedRank == null) {
      warnings.add("missing_rank");
      status = "missing_rank";
    }
    // Preisgeld wird nicht mehr genutzt → ein fehlender Preisgeld-Eintrag blockiert nicht mehr. Nur fehlender
    // Cash (Basis der Cash-danach-Projektion) markiert das Team als unvollständig.
    if (currentCash == null) {
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

    const sponsorCash = includeSponsorIncome ? sponsorCashByTeamId.get(team.teamId) ?? null : null;
    const facilityIncome = includeSponsorIncome ? facilityIncomeByTeamId.get(team.teamId) ?? null : null;

    // UI-Sponsor-Tabelle: Cash danach = Cash vorher + Sponsor + Gebäude − Gehälter (kein Preisgeld mehr).
    // AI-/Season-Pfad (includeSponsorIncome=false): unverändert die alte preisgeld-basierte Projektion, damit
    // sich die AI-Budgetplanung durch den UI-Umbau NICHT ändert.
    const projectedCash = includeSponsorIncome
      ? currentCash == null || salaryTotal == null
        ? null
        : round1(currentCash - salaryTotal + (sponsorCash ?? 0) + (facilityIncome ?? 0))
      : projectSeasonEndCash({
          currentCash,
          prizeMoney,
          salaryTotal,
          rankChangePrize: rankChangePrize.bonusMalus,
        });

    const buildPlacementScenario = (direction: "better" | "worse") => {
      if (rank == null || prizeMoney == null || currentCash == null || salaryTotal == null) {
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
          projectedCash: projectSeasonEndCash({ currentCash, prizeMoney, salaryTotal }),
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
        projectedCash: projectSeasonEndCash({ currentCash, prizeMoney: payout, salaryTotal }),
      };
    };

    const betterScenario = buildPlacementScenario("better");
    const worseScenario = buildPlacementScenario("worse");

    const futureSeasons: PrizeMoneyPreviewFutureSeason[] = seasonFactors
      .filter((row) => row.seasonLabel !== "Aktuell")
      .map((row) => {
        const salaryGrowthFactor = buildForecastSalaryGrowthFactor({
          currentFactor,
          futureFactor: row.factor,
        });
        if (currentCash == null || salaryTotal == null || currentFactor == null || row.factor == null || salaryGrowthFactor == null) {
          return {
            seasonLabel: row.seasonLabel,
            factor: row.factor,
            salaryGrowthFactor,
            prizeMoney: null,
            salaryTotal: null,
            guv: null,
            projectedCash: null,
          };
        }

        const futurePrizeFromLeagueTable =
          rank != null
            ? futurePrizeRowsBySeasonLabel.get(row.seasonLabel)?.get(rank)?.prizeMoney ?? null
            : null;
        const fallbackSeasonScaled = seasonCash != null ? round1(seasonCash * (row.factor / currentFactor)) : null;
        const fallbackPrize = basisCash != null && fallbackSeasonScaled != null ? round1(basisCash + fallbackSeasonScaled) : null;
        const futurePrize = futurePrizeFromLeagueTable ?? fallbackPrize;
        const futureSalaryTotal = round1(salaryTotal);
        const guv = futurePrize == null ? null : round1(futurePrize - futureSalaryTotal);
        return {
          seasonLabel: row.seasonLabel,
          factor: row.factor,
          salaryGrowthFactor,
          prizeMoney: futurePrize,
          salaryTotal: futureSalaryTotal,
          guv,
          projectedCash: projectSeasonEndCash({
            currentCash,
            prizeMoney: futurePrize,
            salaryTotal: futureSalaryTotal,
          }),
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
      sponsorCash,
      facilityIncome,
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
      forecastSalaryFactorPassthrough: FORECAST_SALARY_FACTOR_PASSTHROUGH,
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
