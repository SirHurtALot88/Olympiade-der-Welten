import type { GameState, Player, Team, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { listTransferHistory, type TransferHistoryReadResult } from "@/lib/market/transfer-history-read-service";
import { calculateTransfermarktFit, hasMercenaryTrait, normalizeTransfermarktToken } from "@/lib/market/transfermarkt-fit";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

export type TransferRecapSource = "sqlite" | "prisma";

export type TransferRecapParams = {
  source?: TransferRecapSource;
  saveId?: string | null;
  seasonId?: string | null;
  teamId?: string | null;
  limit?: number | null;
};

export type TransferRecapEntry = {
  transferId: string;
  playerId: string;
  playerName: string;
  fromTeam: string | null;
  toTeam: string | null;
  type: "buy" | "sell" | "contract_exit";
  amount: number;
  salary: number;
  marketValue: number;
  ovr: number | null;
  pps: number | null;
  teamFit: number | null;
  strategyFitReason: string | null;
  cashBefore: number | null;
  cashAfter: number | null;
  rosterBefore: number | null;
  rosterAfter: number | null;
  reason: string;
  warnings: string[];
  realizedProfit: number | null;
  happenedAt: string;
};

export type TransferRecapTeamSummary = {
  teamId: string;
  teamName: string;
  controlMode: "manual" | "ai" | "passive";
  buyCount: number;
  sellCount: number;
  spend: number;
  income: number;
  salaryFreed: number;
  netCashFlow: number;
  currentCash: number | null;
  currentRoster: number | null;
  currentSalary: number | null;
  currentMarketValue: number | null;
  strategySummary: string | null;
  warnings: string[];
};

export type TransferRecapSummary = {
  buys: number;
  sells: number;
  totalSpend: number;
  totalIncome: number;
  totalSalaryFreed: number;
};

export type TransferRecapResult = {
  readOnly: true;
  source: TransferRecapSource;
  scope: {
    saveId: string | null;
    seasonId: string | null;
    teamId: string | null;
  };
  saveContext?: {
    source: "sqlite" | "prisma";
    requestedSaveId: string | null;
    resolvedSaveId: string | null;
    requestedSeasonId: string | null;
    resolvedSeasonId: string | null;
    saveName: string | null;
    saveStatus: string | null;
    scopeWarning: string | null;
  } | null;
  summary: TransferRecapSummary;
  topTransfersIn: TransferRecapEntry[];
  topTransfersOut: TransferRecapEntry[];
  biggestSpend: TransferRecapEntry[];
  biggestProfit: TransferRecapEntry[];
  bestValueDeals: TransferRecapEntry[];
  riskyMoves: TransferRecapEntry[];
  teamSummaries: TransferRecapTeamSummary[];
  warnings: string[];
};

type MutableTeamState = {
  cash: number | null;
  rosterCount: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
};

type StrategyContext = {
  teamFit: number | null;
  strategyFitReason: string | null;
  warnings: string[];
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function limitRows<T>(rows: T[], limit: number) {
  return rows.slice(0, Math.max(1, limit));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveLocalSave(saveId?: string | null) {
  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const requestedSave = saveId ? persistence.getSaveById(saveId) : null;
  const activeSave = persistence.getActiveSave() ?? bootstrapped.save;
  const save = requestedSave ?? activeSave;

  if (!save) {
    throw new Error("SQLite save could not be loaded.");
  }

  return {
    save,
    requestedSave,
    activeSave,
    requestedSaveId: saveId ?? null,
    scopeWarning:
      saveId && !requestedSave
        ? `Requested save ${saveId} could not be resolved for local transfer recap.`
        : null,
  };
}

function buildCurrentTeamStateMap(gameState: GameState) {
  const overviewRows = buildTeamSeasonOverviewRows({ gameState });

  return new Map<string, MutableTeamState>(
    overviewRows.map((row) => [
      row.teamId,
      {
        cash: row.cash,
        rosterCount: row.rosterCount,
        salaryTotal: row.salaryTotal,
        marketValueTotal: row.marketValueTotal,
      } satisfies MutableTeamState,
    ]),
  );
}

function buildRealizedProfitMap(entries: TransferHistoryEntry[]) {
  const purchaseMap = new Map<string, number>();
  const profitByTransferId = new Map<string, number | null>();

  [...entries]
    .sort((left, right) => Date.parse(left.happenedAt) - Date.parse(right.happenedAt))
    .forEach((entry) => {
      if (entry.transferType === "buy" && entry.toTeamId) {
        purchaseMap.set(`${entry.toTeamId}:${entry.playerId}`, entry.fee);
        return;
      }

      if (entry.transferType === "sell" && entry.fromTeamId) {
        const key = `${entry.fromTeamId}:${entry.playerId}`;
        const previousBuyFee = purchaseMap.get(key);
        profitByTransferId.set(entry.id, previousBuyFee != null ? roundValue(entry.fee - previousBuyFee, 2) : null);
        purchaseMap.delete(key);
      }
    });

  return profitByTransferId;
}

function matchesStrategyToken(values: string[] | undefined, candidate: string | null | undefined) {
  const token = normalizeTransfermarktToken(candidate);
  if (!token || !values?.length) {
    return false;
  }

  return values.some((value) => normalizeTransfermarktToken(value) === token);
}

function matchesHardNoGo(player: Player, hardNoGos: string[] | undefined) {
  if (!hardNoGos?.length) {
    return false;
  }

  const playerTokens = new Set(
    [
      player.name,
      player.className,
      player.race,
      ...player.subclasses,
      ...player.traitsPositive,
      ...player.traitsNegative,
    ]
      .map((value) => normalizeTransfermarktToken(value))
      .filter(Boolean),
  );

  return hardNoGos.some((value) => playerTokens.has(normalizeTransfermarktToken(value)));
}

function buildStrategyContext(gameState: GameState, teamId: string | null, player: Player | null): StrategyContext {
  if (!teamId || !player) {
    return {
      teamFit: null,
      strategyFitReason: null,
      warnings: [],
    };
  }

  const rosterPlayers = gameState.rosters
    .filter((entry) => entry.teamId === teamId && entry.playerId !== player.id)
    .map((entry) => gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null)
    .filter((candidate): candidate is Player => Boolean(candidate));

  const fit = calculateTransfermarktFit(player, rosterPlayers, { teamId });
  const profile = getTeamStrategyProfile(gameState, teamId);
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (matchesStrategyToken(profile?.preferredRaces, player.race)) {
    reasons.push(`${player.race} passt ins Teamprofil.`);
  }
  if (matchesStrategyToken(profile?.preferredClasses, player.className)) {
    reasons.push(`${player.className} liegt im bevorzugten Klassenbild.`);
  }
  if (matchesStrategyToken(profile?.preferredTraits, player.traitsPositive[0] ?? null)) {
    reasons.push(`${player.traitsPositive[0]} staerkt das Teamprofil.`);
  }
  if (matchesStrategyToken(profile?.avoidedRaces, player.race)) {
    warnings.push(`${player.race} kollidiert mit dem Teamprofil.`);
  }
  if (matchesStrategyToken(profile?.avoidedClasses, player.className)) {
    warnings.push(`${player.className} ist im Profil eher unerwuenscht.`);
  }
  if (matchesHardNoGo(player, profile?.hardNoGos)) {
    warnings.push("Spieler trifft ein Hard-No-Go im Teamprofil.");
  }
  if (hasMercenaryTrait(player) && matchesHardNoGo(player, ["mercenary"])) {
    warnings.push("Mercenary-Tag kollidiert mit dem Teamprofil.");
  }
  if (fit.teamFit != null && fit.teamFit >= 8) {
    reasons.push("Sportlicher Fit wirkt stark.");
  } else if (fit.teamFit != null && fit.teamFit <= 0) {
    warnings.push("Sportlicher Fit wirkt schwach.");
  }

  return {
    teamFit: fit.teamFit,
    strategyFitReason: reasons[0] ?? profile?.strategySummary ?? null,
    warnings,
  };
}

function sortByAmountDesc(left: TransferRecapEntry, right: TransferRecapEntry) {
  if (right.amount !== left.amount) {
    return right.amount - left.amount;
  }

  const leftOvr = left.ovr ?? Number.NEGATIVE_INFINITY;
  const rightOvr = right.ovr ?? Number.NEGATIVE_INFINITY;
  if (rightOvr !== leftOvr) {
    return rightOvr - leftOvr;
  }

  return Date.parse(right.happenedAt) - Date.parse(left.happenedAt);
}

function sortByProfitDesc(left: TransferRecapEntry, right: TransferRecapEntry) {
  const leftProfit = left.realizedProfit ?? Number.NEGATIVE_INFINITY;
  const rightProfit = right.realizedProfit ?? Number.NEGATIVE_INFINITY;
  if (rightProfit !== leftProfit) {
    return rightProfit - leftProfit;
  }

  return sortByAmountDesc(left, right);
}

function getBestValueScore(entry: TransferRecapEntry) {
  if (entry.type !== "buy" || !isFiniteNumber(entry.ovr) || !isFiniteNumber(entry.amount) || entry.amount <= 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const pps = entry.pps ?? 0;
  return ((entry.ovr * 1.4) + pps) / Math.max(1, entry.amount / 1000);
}

function getRiskScore(entry: TransferRecapEntry) {
  const fitPenalty = entry.teamFit != null && entry.teamFit < 0 ? Math.abs(entry.teamFit) * 8 : 0;
  const moneyRisk = entry.type === "buy" ? entry.amount / 1000 : (entry.salary / 1000) * 4;
  return fitPenalty + moneyRisk + entry.warnings.length * 20;
}

function buildTeamSummariesFromLocal(gameState: GameState, entries: TransferRecapEntry[], teamFilter: string | null) {
  const overviewByTeamId = new Map(
    buildTeamSeasonOverviewRows({ gameState }).map((row) => [row.teamId, row] as const),
  );

  return gameState.teams
    .filter((team) => (teamFilter ? team.teamId === teamFilter : true))
    .map<TransferRecapTeamSummary>((team) => {
      const relevantEntries = entries.filter((entry) =>
        entry.type === "buy" ? entry.toTeam === team.name : entry.fromTeam === team.name,
      );
      const buyEntries = relevantEntries.filter((entry) => entry.type === "buy");
      const sellEntries = relevantEntries.filter((entry) => entry.type === "sell");
      const overview = overviewByTeamId.get(team.teamId);
      const control = getTeamControlSettings(gameState, team.teamId);
      const profile = getTeamStrategyProfile(gameState, team.teamId);

      return {
        teamId: team.teamId,
        teamName: team.name,
        controlMode: control?.controlMode ?? "manual",
        buyCount: buyEntries.length,
        sellCount: sellEntries.length,
        spend: roundValue(buyEntries.reduce((sum, entry) => sum + entry.amount, 0), 2),
        income: roundValue(sellEntries.reduce((sum, entry) => sum + entry.amount, 0), 2),
        salaryFreed: roundValue(sellEntries.reduce((sum, entry) => sum + entry.salary, 0), 2),
        netCashFlow: roundValue(
          sellEntries.reduce((sum, entry) => sum + entry.amount, 0) -
            buyEntries.reduce((sum, entry) => sum + entry.amount, 0),
          2,
        ),
        currentCash: overview?.cash ?? null,
        currentRoster: overview?.rosterCount ?? null,
        currentSalary: overview?.salaryTotal ?? null,
        currentMarketValue: overview?.marketValueTotal ?? null,
        strategySummary: profile?.strategySummary ?? null,
        warnings:
          buyEntries.length === 0 && sellEntries.length === 0 ? ["keine Transfers im aktuellen Scope"] : [],
      };
    })
    .sort((left, right) => {
      const leftVolume = left.spend + left.income;
      const rightVolume = right.spend + right.income;
      if (rightVolume !== leftVolume) {
        return rightVolume - leftVolume;
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });
}

function buildLocalTransferRecap(params: TransferRecapParams): TransferRecapResult {
  const resolved = resolveLocalSave(params.saveId);
  const save = resolved.save;
  const gameState = save.gameState;
  const seasonId = params.seasonId ?? gameState.season.id;
  const teamFilter = params.teamId ?? null;
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit) ? Math.max(3, Math.round(params.limit)) : 5;

  if (resolved.scopeWarning) {
    return {
      readOnly: true,
      source: "sqlite",
      scope: {
        saveId: null,
        seasonId: params.seasonId ?? null,
        teamId: teamFilter,
      },
      saveContext: {
        source: "sqlite",
        requestedSaveId: resolved.requestedSaveId,
        resolvedSaveId: null,
        requestedSeasonId: params.seasonId ?? null,
        resolvedSeasonId: null,
        saveName: null,
        saveStatus: null,
        scopeWarning: resolved.scopeWarning,
      },
      summary: {
        buys: 0,
        sells: 0,
        totalSpend: 0,
        totalIncome: 0,
        totalSalaryFreed: 0,
      },
      topTransfersIn: [],
      topTransfersOut: [],
      biggestSpend: [],
      biggestProfit: [],
      bestValueDeals: [],
      riskyMoves: [],
      teamSummaries: [],
      warnings: ["keine Transferhistorie im aktuellen Scope gefunden"],
    };
  }

  const playerRatings = buildPlayerRatingContractMap(gameState);
  const teamStateById = buildCurrentTeamStateMap(gameState);
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const historyEntries = gameState.transferHistory
    .filter((entry) => entry.seasonId === seasonId)
    .sort((left, right) => Date.parse(right.happenedAt) - Date.parse(left.happenedAt));
  const realizedProfitByTransferId = buildRealizedProfitMap(historyEntries);

  const recapEntries = historyEntries
    .map<TransferRecapEntry | null>((entry) => {
      const player = gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null;
      const teamId = entry.transferType === "buy" ? entry.toTeamId : entry.fromTeamId;
      const team = teamId ? (teamById.get(teamId) ?? null) : null;
      const strategyContext = buildStrategyContext(gameState, teamId, player);
      const rating = player ? playerRatings.get(player.id) ?? null : null;

      let cashBefore: number | null = null;
      let cashAfter: number | null = null;
      let rosterBefore: number | null = null;
      let rosterAfter: number | null = null;

      if (teamId) {
        const currentState = teamStateById.get(teamId) ?? null;
        if (currentState) {
          cashAfter = currentState.cash;
          rosterAfter = currentState.rosterCount;

          if (entry.transferType === "buy") {
            cashBefore = cashAfter != null ? roundValue(cashAfter + entry.fee, 2) : null;
            rosterBefore = rosterAfter != null ? rosterAfter - 1 : null;
            teamStateById.set(teamId, {
              cash: cashBefore,
              rosterCount: rosterBefore,
              salaryTotal:
                currentState.salaryTotal != null ? roundValue(currentState.salaryTotal - entry.salary, 2) : null,
              marketValueTotal:
                currentState.marketValueTotal != null ? roundValue(currentState.marketValueTotal - entry.marketValue, 2) : null,
            });
          } else {
            cashBefore = cashAfter != null ? roundValue(cashAfter - entry.fee, 2) : null;
            rosterBefore = rosterAfter != null ? rosterAfter + 1 : null;
            teamStateById.set(teamId, {
              cash: cashBefore,
              rosterCount: rosterBefore,
              salaryTotal:
                currentState.salaryTotal != null ? roundValue(currentState.salaryTotal + entry.salary, 2) : null,
              marketValueTotal:
                currentState.marketValueTotal != null ? roundValue(currentState.marketValueTotal + entry.marketValue, 2) : null,
            });
          }
        }
      }

      const recapEntry: TransferRecapEntry = {
        transferId: entry.id,
        playerId: entry.playerId,
        playerName: player?.name ?? entry.playerId,
        fromTeam: entry.fromTeamId ? (teamById.get(entry.fromTeamId)?.name ?? entry.fromTeamId) : null,
        toTeam: entry.toTeamId ? (teamById.get(entry.toTeamId)?.name ?? entry.toTeamId) : null,
        type: entry.transferType,
        amount: entry.fee,
        salary: entry.salary,
        marketValue: entry.marketValue,
        ovr: rating?.ovrNormalized != null ? Math.round(rating.ovrNormalized) : null,
        pps: rating?.ratingPps != null ? roundValue(rating.ratingPps, 1) : null,
        teamFit: strategyContext.teamFit != null ? roundValue(strategyContext.teamFit, 1) : null,
        strategyFitReason: strategyContext.strategyFitReason,
        cashBefore,
        cashAfter,
        rosterBefore,
        rosterAfter,
        reason:
          entry.transferType === "buy"
            ? strategyContext.strategyFitReason ?? `Zugang fuer ${team?.name ?? "das Team"}.`
            : realizedProfitByTransferId.get(entry.id) != null
              ? `Verkauf mit ${realizedProfitByTransferId.get(entry.id)! >= 0 ? "Plus" : "Minus"} von ${roundValue(realizedProfitByTransferId.get(entry.id) ?? 0, 2)}.`
              : `Abgang aus ${team?.name ?? "dem Team"}.`,
        warnings: strategyContext.warnings,
        realizedProfit: realizedProfitByTransferId.get(entry.id) ?? null,
        happenedAt: entry.happenedAt,
      };

      if (teamFilter && entry.fromTeamId !== teamFilter && entry.toTeamId !== teamFilter) {
        return null;
      }

      return recapEntry;
    })
    .filter((entry): entry is TransferRecapEntry => Boolean(entry));

  const buyEntries = recapEntries.filter((entry) => entry.type === "buy");
  const sellEntries = recapEntries.filter((entry) => entry.type === "sell");
  const warnings: string[] = [];

  if (recapEntries.length === 0) {
    warnings.push("keine Transferhistorie im aktuellen Scope gefunden");
  }

  return {
    readOnly: true,
    source: "sqlite",
    scope: {
      saveId: save.saveId,
      seasonId,
      teamId: teamFilter,
    },
    saveContext: {
      source: "sqlite",
      requestedSaveId: params.saveId ?? null,
      resolvedSaveId: save.saveId,
      requestedSeasonId: params.seasonId ?? null,
      resolvedSeasonId: seasonId,
      saveName: save.name ?? null,
      saveStatus: save.status ?? null,
      scopeWarning: null,
    },
    summary: {
      buys: buyEntries.length,
      sells: sellEntries.length,
      totalSpend: roundValue(buyEntries.reduce((sum, entry) => sum + entry.amount, 0), 2),
      totalIncome: roundValue(sellEntries.reduce((sum, entry) => sum + entry.amount, 0), 2),
      totalSalaryFreed: roundValue(sellEntries.reduce((sum, entry) => sum + entry.salary, 0), 2),
    },
    topTransfersIn: limitRows([...buyEntries].sort((left, right) => {
      const leftRank = (left.ovr ?? 0) + (left.pps ?? 0);
      const rightRank = (right.ovr ?? 0) + (right.pps ?? 0);
      if (rightRank !== leftRank) {
        return rightRank - leftRank;
      }
      return sortByAmountDesc(left, right);
    }), limit),
    topTransfersOut: limitRows([...sellEntries].sort((left, right) => {
      const leftRank = (left.ovr ?? 0) + (left.pps ?? 0);
      const rightRank = (right.ovr ?? 0) + (right.pps ?? 0);
      if (rightRank !== leftRank) {
        return rightRank - leftRank;
      }
      return sortByAmountDesc(left, right);
    }), limit),
    biggestSpend: limitRows([...buyEntries].sort(sortByAmountDesc), limit),
    biggestProfit: limitRows(
      [...sellEntries]
        .filter((entry) => entry.realizedProfit != null)
        .sort(sortByProfitDesc),
      limit,
    ),
    bestValueDeals: limitRows(
      [...buyEntries].sort((left, right) => getBestValueScore(right) - getBestValueScore(left) || sortByAmountDesc(left, right)),
      limit,
    ),
    riskyMoves: limitRows(
      [...recapEntries]
        .filter((entry) => entry.warnings.length > 0 || (entry.teamFit != null && entry.teamFit < 0))
        .sort((left, right) => getRiskScore(right) - getRiskScore(left) || sortByAmountDesc(left, right)),
      limit,
    ),
    teamSummaries: buildTeamSummariesFromLocal(gameState, recapEntries, teamFilter),
    warnings,
  };
}

async function buildPrismaTransferRecap(params: TransferRecapParams): Promise<TransferRecapResult> {
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit) ? Math.max(3, Math.round(params.limit)) : 5;
  const history = await listTransferHistory({
    saveId: params.saveId ?? undefined,
    seasonId: params.seasonId ?? undefined,
    teamId: params.teamId ?? undefined,
    limit: 250,
  });

  const entries: TransferRecapEntry[] = history.items.map((entry) => ({
    transferId: entry.transferId,
    playerId: entry.playerId,
    playerName: entry.playerName,
    fromTeam: entry.fromTeamName ?? entry.fromTeamId,
    toTeam: entry.toTeamName ?? entry.toTeamId,
    type: entry.type,
    amount: entry.fee,
    salary: entry.salary,
    marketValue: entry.marketValue,
    ovr: null,
    pps: null,
    teamFit: null,
    strategyFitReason: null,
    cashBefore: null,
    cashAfter: null,
    rosterBefore: null,
    rosterAfter: null,
    reason: entry.type === "buy" ? "Prisma-Transferzugang." : "Prisma-Transferabgang.",
    warnings: [],
    realizedProfit: null,
    happenedAt: entry.happenedAt,
  }));
  const buyEntries = entries.filter((entry) => entry.type === "buy");
  const sellEntries = entries.filter((entry) => entry.type === "sell");

  return {
    readOnly: true,
    source: "prisma",
    scope: {
      saveId: history.scope.saveId,
      seasonId: history.scope.seasonId,
      teamId: history.scope.teamId,
    },
    saveContext: history.saveContext,
    summary: {
      buys: buyEntries.length,
      sells: sellEntries.length,
      totalSpend: roundValue(buyEntries.reduce((sum, entry) => sum + entry.amount, 0), 2),
      totalIncome: roundValue(sellEntries.reduce((sum, entry) => sum + entry.amount, 0), 2),
      totalSalaryFreed: roundValue(sellEntries.reduce((sum, entry) => sum + entry.salary, 0), 2),
    },
    topTransfersIn: limitRows([...buyEntries].sort(sortByAmountDesc), limit),
    topTransfersOut: limitRows([...sellEntries].sort(sortByAmountDesc), limit),
    biggestSpend: limitRows([...buyEntries].sort(sortByAmountDesc), limit),
    biggestProfit: [],
    bestValueDeals: [],
    riskyMoves: [],
    teamSummaries: [],
    warnings: [
      "Prisma-Recap bleibt read-only und zeigt aktuell nur echte Transferhistorie.",
      "Cash-, Roster-, Salary- und Fit-Details stehen vollstaendig nur im lokalen SQLite-Recap bereit.",
    ],
  };
}

export async function buildTransferRecap(params: TransferRecapParams = {}): Promise<TransferRecapResult> {
  const source = params.source === "prisma" ? "prisma" : "sqlite";
  return source === "prisma" ? buildPrismaTransferRecap(params) : buildLocalTransferRecap(params);
}
