import { evaluateAiNeeds } from "@/lib/ai/aiNeedsEngine";
import { recordSellPreview } from "@/lib/ai/transfer-window-profiler";
import type {
  GameState,
  Player,
  PlayerDisciplinePerformanceRecord,
  RosterEntry,
  SeasonSnapshotRecord,
  Team,
  TeamControlMode,
  TeamStrategyProfile,
} from "@/lib/data/olyDataTypes";
import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import { projectFoundationStateFromPrisma } from "@/lib/db/read/foundation-read-projection";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import { buildPlayerRatingContractMap, type PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import { getTeamControlSettings, withNormalizedTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { getTeamStrategyProfile, withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";
import { normalizeTransfermarktToken } from "@/lib/market/transfermarkt-fit";
import type { LocalTransfermarktRunContext } from "@/lib/market/transfermarkt-local-service";
import { buildTransfermarktSaleFactorBreakdown } from "@/lib/market/transfermarkt-sale-factor";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assessTeamSellRunwayPressure, estimateBuyoutLikelihood, isAttractiveProfitSell } from "@/lib/ai/team-sell-runway-pressure";
import { assessPlayerBoardTrust, type PlayerBoardTrustRenewalPolicy } from "@/lib/ai/player-board-trust-service";
import { evaluateAiSellDecision } from "@/lib/ai/ai-sell-decision-engine";
import { resolveTransferDoctrine } from "@/lib/ai/ai-transfer-doctrine-layer";
import type { AiKeepReasonCode, AiSellReasonCode } from "@/lib/ai/ai-transfer-reason-codes";
import { applyGmArchetypeSellScoreModifier } from "@/lib/ai/gm-sell-archetype-modifier";
import { buildPlayerDemands } from "@/lib/morale/player-demands-service";
import { resolveGmPressureBehavior } from "@/lib/foundation/gm-pressure-behavior";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";

export type AiSellPreviewSource = "sqlite" | "prisma";
export type AiSellPreviewTeamScope = "ai" | "all";
export type AiSellPreviewTeamStatus =
  | "ready"
  | "no_sell_need"
  | "low_roster_depth"
  | "no_candidates"
  | "warning"
  | "blocked";
export type AiSellPreviewBudgetPressure = "healthy" | "tight" | "critical" | "unknown";

export type AiSellPreviewParams = {
  source?: AiSellPreviewSource;
  saveId?: string | null;
  seasonId?: string | null;
  teamId?: string | null;
  teamScope?: AiSellPreviewTeamScope;
  limit?: number | null;
  /** AI/market-plan paths may sell below roster min and refill later. Default keeps UI advisory warning. */
  allowSellBelowRosterMin?: boolean;
  localRunContext?: LocalTransfermarktRunContext | null;
};

export type AiSellPreviewCandidate = {
  activePlayerId: string;
  playerId: string;
  playerName: string;
  className: string;
  race: string;
  raceName: string;
  ovr: number | null;
  mvs: number | null;
  salary: number | null;
  marketValue: number | null;
  expectedSellValue: number | null;
  contractLength: number | null;
  rosterAfter: number | null;
  salaryAfter: number | null;
  cashAfter: number | null;
  sportValueSummary: string;
  performanceSummary: string;
  strategyFitSummary: string;
  reasonToSell: string[];
  reasonToKeep: string[];
  sellReasonCodes?: AiSellReasonCode[];
  keepReasonCodes?: AiKeepReasonCode[];
  reasonsToSell: string[];
  reasonsToKeep: string[];
  warnings: string[];
  boardTrustScore: number | null;
  boardTrustSmiley: string | null;
  boardTrustPolicy: PlayerBoardTrustRenewalPolicy;
  boardTrustReasons: string[];
  boardTrustWarnings: string[];
  salaryCapMultiplier: number | null;
  sellPriority: number;
  sellPriorityScore: number;
  sellIntentScore?: number | null;
  keepIntentScore?: number | null;
  strategicSellScore?: number | null;
  sellDecisionLabel?: string | null;
  productiveElite?: boolean;
};

export type AiSellPreviewTeamEntry = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  aiSellPreviewEnabled: boolean;
  status: AiSellPreviewTeamStatus;
  strategySummary: string;
  cash: number | null;
  rosterCount: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
  rosterSize: number | null;
  playerMin: number | null;
  playerOpt: number | null;
  targetRosterMin: number | null;
  targetRosterOpt: number | null;
  budgetPressure: AiSellPreviewBudgetPressure;
  sellCandidates: AiSellPreviewCandidate[];
  keepCore: AiSellPreviewCandidate[];
  warnings: string[];
  blockingReasons: string[];
  explanation: string;
};

export type AiSellPreviewResult = {
  readOnly: true;
  source: AiSellPreviewSource;
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    teamScope: AiSellPreviewTeamScope;
  };
  totalTeams: number;
  aiTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  readyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  teams: AiSellPreviewTeamEntry[];
  debugPerformance?: {
    durationMs: number;
    candidateCount: number;
    sellValuePreviewCount: number;
    needsEvaluationCount: number;
    snapshotLookupCount: number;
  };
};

type ResolvedPreviewContext = {
  source: AiSellPreviewSource;
  saveId: string;
  seasonId: string;
  gameState: GameState;
};

type PlayerPerformanceSummary = {
  appearances: number;
  averageContribution: number | null;
  averageFinalScore: number | null;
  top10Count: number;
  mvpCount: number;
};

type SellPreviewRunCache = {
  latestSnapshot: SeasonSnapshotRecord | null;
  performanceByTeamPlayer: Map<string, PlayerPerformanceSummary>;
  needsByTeamId: Map<string, ReturnType<typeof evaluateAiNeeds>>;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function normalizeGameState(gameState: GameState) {
  return withNormalizedTeamStrategyProfiles(withNormalizedTeamControlSettings(gameState));
}

function getBudgetPressure(team: Team, salaryTotal: number): AiSellPreviewBudgetPressure {
  if (!Number.isFinite(team.cash)) {
    return "unknown";
  }
  const cash = team.cash;
  const salary = Math.max(0, Number.isFinite(salaryTotal) ? salaryTotal : 0);

  // Cash-vs-Gehalt statt Cash/Startbudget: ein cash-reiches Team (z.B. 85M Cash > 66M
  // Gehalt) ist gesund, nicht "tight". Druck entsteht erst, wenn das Cash die Gehaltslast
  // einer Saison nicht mehr (gut) abdeckt. Deckt sich mit assessTeamSellRunwayPressure.
  if (salary <= 0) {
    return cash < 0 ? "critical" : "healthy";
  }
  if (cash <= 0) {
    return "critical";
  }
  const coverage = cash / salary;
  if (coverage < 0.5) return "critical";
  if (coverage < 1) return "tight";
  return "healthy";
}

function getTeamRoster(gameState: GameState, teamId: string) {
  return gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => ({
      roster: entry,
      player: gameState.players.find((candidate) => candidate.id === entry.playerId) ?? null,
    }))
    .filter((item): item is { roster: RosterEntry; player: Player } => Boolean(item.player));
}

function getLatestCompletedSeasonSnapshot(gameState: GameState): SeasonSnapshotRecord | null {
  return [...(gameState.seasonState.seasonSnapshots ?? [])]
    .filter((snapshot) => snapshot.status !== "dry_run" && snapshot.playerPerformances.length > 0)
    .sort((left, right) => {
      const leftTime = Date.parse(left.archivedAt ?? left.createdAt ?? "");
      const rightTime = Date.parse(right.archivedAt ?? right.createdAt ?? "");
      if (Number.isFinite(rightTime) && Number.isFinite(leftTime) && rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return right.seasonId.localeCompare(left.seasonId, "de", { numeric: true });
    })[0] ?? null;
}

function teamPlayerKey(teamId: string, playerId: string) {
  return `${teamId}::${playerId}`;
}

function buildSellPreviewRunCache(gameState: GameState): SellPreviewRunCache {
  const latestSnapshot = getLatestCompletedSeasonSnapshot(gameState);
  const grouped = new Map<string, PlayerDisciplinePerformanceRecord[]>();
  for (const performance of gameState.seasonState.playerDisciplinePerformances ?? []) {
    const key = teamPlayerKey(performance.teamId, performance.playerId);
    const rows = grouped.get(key) ?? [];
    rows.push(performance);
    grouped.set(key, rows);
  }
  const performanceByTeamPlayer = new Map<string, PlayerPerformanceSummary>();
  for (const [key, performances] of grouped) {
    performanceByTeamPlayer.set(key, {
      appearances: performances.length,
      averageContribution: roundValue(
        performances.reduce((sum, entry) => sum + entry.scoreContribution, 0) / performances.length,
        1,
      ),
      averageFinalScore: roundValue(
        performances.reduce((sum, entry) => sum + entry.finalPlayerScore, 0) / performances.length,
        1,
      ),
      top10Count: performances.filter((entry) => entry.isTop10).length,
      mvpCount: performances.filter((entry) => entry.isMvpCandidate).length,
    });
  }
  return {
    latestSnapshot,
    performanceByTeamPlayer,
    needsByTeamId: new Map(),
  };
}

function getPlayerPerformanceSummary(cache: SellPreviewRunCache, teamId: string, playerId: string): PlayerPerformanceSummary {
  const cached = cache.performanceByTeamPlayer.get(teamPlayerKey(teamId, playerId));
  if (cached) return cached;

  const snapshotPerformance = cache.latestSnapshot?.playerPerformances.find(
    (entry) => entry.playerId === playerId && (entry.teamId == null || entry.teamId === teamId),
  ) ?? null;

  if (snapshotPerformance) {
    return {
      appearances: snapshotPerformance.appearances,
      averageContribution: snapshotPerformance.averageContribution,
      averageFinalScore: snapshotPerformance.averageFinalScore,
      top10Count: snapshotPerformance.top10Count,
      mvpCount: snapshotPerformance.mvpCount,
    };
  }

  return {
    appearances: 0,
    averageContribution: null,
    averageFinalScore: null,
    top10Count: 0,
    mvpCount: 0,
  };
}

function getProfileTokens(player: Player) {
  return [
    player.className,
    player.race,
    ...player.subclasses,
    ...player.traitsPositive,
    ...player.traitsNegative,
  ]
    .map(normalizeTransfermarktToken)
    .filter(Boolean);
}

function countMatches(values: string[] | undefined, candidateTokens: string[]) {
  const normalizedValues = (values ?? []).map(normalizeTransfermarktToken).filter(Boolean);
  return normalizedValues.filter((token) => candidateTokens.some((candidate) => candidate === token || candidate.includes(token) || token.includes(candidate))).length;
}

function getPlayerAxisLabel(player: Player) {
  const entries = Object.entries(player.coreStats) as Array<["pow" | "spe" | "men" | "soc", number]>;
  const top = [...entries].sort((left, right) => right[1] - left[1])[0];
  return top?.[0] ?? null;
}

function matchesHardNoGo(profile: TeamStrategyProfile | null, player: Player) {
  if (!profile || profile.hardNoGos.length === 0) {
    return false;
  }

  const tokens = getProfileTokens(player);
  const normalizedRace = normalizeTransfermarktToken(player.race);
  return profile.hardNoGos.some((entry) => {
    const normalized = normalizeTransfermarktToken(entry);
    if (!normalized) {
      return false;
    }
    if (normalized.includes("nonhuman") && normalizedRace !== "human") {
      return true;
    }
    if (normalized.includes("human") && normalized.includes("anti") && normalizedRace === "human") {
      return true;
    }
    return tokens.some((token) => token === normalized || token.includes(normalized) || normalized.includes(token));
  });
}

function buildStrategySummary(profile: TeamStrategyProfile | null, player: Player) {
  if (!profile) {
    return {
      summary: "Kein Teamprofil vorhanden.",
      preferredHits: 0,
      avoidedHits: 0,
      preferredTraitHits: 0,
      avoidedTraitHits: 0,
    };
  }

  const tokens = getProfileTokens(player);
  const preferredRaceHits = countMatches(profile.preferredRaces, [normalizeTransfermarktToken(player.race)]);
  const avoidedRaceHits = countMatches(profile.avoidedRaces, [normalizeTransfermarktToken(player.race)]);
  const preferredClassHits = countMatches(profile.preferredClasses, [normalizeTransfermarktToken(player.className)]);
  const avoidedClassHits = countMatches(profile.avoidedClasses, [normalizeTransfermarktToken(player.className)]);
  const preferredTraitHits = countMatches(profile.preferredTraits, tokens);
  const avoidedTraitHits = countMatches(profile.dislikedTraits, tokens);
  const preferredArchetypeHits = countMatches(profile.preferredArchetypes, tokens);
  const avoidedArchetypeHits = countMatches(profile.avoidedArchetypes, tokens);

  const preferredHits = preferredRaceHits + preferredClassHits + preferredTraitHits + preferredArchetypeHits;
  const avoidedHits = avoidedRaceHits + avoidedClassHits + avoidedTraitHits + avoidedArchetypeHits;

  let summary = "Profil neutral.";
  if (preferredHits > avoidedHits) {
    summary = "Passt eher zum Teamprofil.";
  } else if (avoidedHits > preferredHits) {
    summary = "Widerspricht eher dem Teamprofil.";
  }

  return {
    summary,
    preferredHits,
    avoidedHits,
    preferredTraitHits,
    avoidedTraitHits,
  };
}

function buildSportValueSummary(player: Player, performance: PlayerPerformanceSummary) {
  if (performance.appearances === 0) {
    return `Noch keine lokale Performance-Historie. Kern: POW ${Math.round(player.coreStats.pow)} · SPE ${Math.round(player.coreStats.spe)} · MEN ${Math.round(player.coreStats.men)} · SOC ${Math.round(player.coreStats.soc)}.`;
  }

  return `${performance.appearances} Einsaetze · Beitrag Ø ${performance.averageContribution ?? "—"} · Final Score Ø ${performance.averageFinalScore ?? "—"} · Top 10 ${performance.top10Count}.`;
}

function buildExpectedSellValue(context: ResolvedPreviewContext, player: Player, roster: RosterEntry) {
  const economy = resolvePlayerEconomyContract({ player, rosterEntry: roster });
  if (context.source !== "sqlite") {
    return economy.marketValue;
  }

  const saleFactorBreakdown = buildTransfermarktSaleFactorBreakdown(context.gameState, player, roster);
  return saleFactorBreakdown.salePrice ?? economy.marketValue ?? null;
}

function buildCandidate(
  context: ResolvedPreviewContext,
  playerRatingsById: Map<string, PlayerRatingContractRow>,
  team: Team,
  roster: RosterEntry,
  player: Player,
  rosterSize: number,
  salaryTotal: number,
  playerMin: number | null,
  playerOpt: number | null,
  cache: SellPreviewRunCache,
  allowSellBelowRosterMin = false,
) {
  const profile = getTeamStrategyProfile(context.gameState, team.teamId);
  const playerRating = playerRatingsById.get(player.id) ?? null;
  const performance = getPlayerPerformanceSummary(cache, team.teamId, player.id);
  const needs = cache.needsByTeamId.get(team.teamId) ?? evaluateAiNeeds(context.gameState, team.teamId);
  cache.needsByTeamId.set(team.teamId, needs);
  const identity = context.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
  const expectedSellValue = buildExpectedSellValue(context, player, roster);
  const economy = resolvePlayerEconomyContract({ player, rosterEntry: roster });
  const marketValue = economy.marketValue;
  const purchasePrice = economy.purchasePrice;
  const strategy = buildStrategySummary(profile, player);
  const salary = economy.salary;
  const reasonToSell: string[] = [];
  const reasonToKeep: string[] = [];
  const sellReasonCodes: AiSellReasonCode[] = [];
  const keepReasonCodes: AiKeepReasonCode[] = [];
  const pushSell = (code: AiSellReasonCode, reason: string) => {
    sellReasonCodes.push(code);
    reasonToSell.push(reason);
  };
  const pushKeep = (code: AiKeepReasonCode, reason: string) => {
    keepReasonCodes.push(code);
    reasonToKeep.push(reason);
  };
  const unshiftSell = (code: AiSellReasonCode, reason: string) => {
    sellReasonCodes.unshift(code);
    reasonToSell.unshift(reason);
  };
  const warnings: string[] = [];
  const hardNoGoHit = matchesHardNoGo(profile, player);
  const rosterAfter = Math.max(rosterSize - 1, 0);

  if (!allowSellBelowRosterMin && playerMin != null && rosterSize - 1 < playerMin) {
    warnings.push("Verkauf wuerde den Kader unter das Team-Minimum druecken.");
  }
  if (rosterSize <= 7) {
    warnings.push("Kader ist bereits sehr klein.");
  }
  if (expectedSellValue == null) {
    warnings.push("Kein belastbarer Verkaufswert aus der aktuellen Sell-Preview vorhanden.");
  }
  if (performance.appearances === 0) {
    warnings.push("Noch keine lokale Leistungs-Historie fuer diesen Spieler.");
  }

  const budgetPressure = getBudgetPressure(team, salaryTotal);
  const boardPressure = clamp((10 - (identity?.boardConfidence ?? 5)) / 10, 0, 1);
  const teamSalaryPressure = team.cash > 0 ? clamp(salaryTotal / Math.max(team.cash, 1), 0, 3) / 3 : salaryTotal > 0 ? 1 : 0;
  const salaryShare = salary != null && salaryTotal > 0 ? clamp(salary / salaryTotal, 0, 1) : 0;
  const cashShare = salary != null && team.cash > 0 ? clamp(salary / team.cash, 0, 1) : 0;
  const wagePressureScore = clamp(salaryShare * 0.7 + cashShare * 0.3, 0, 1);
  const profitDelta = expectedSellValue != null && purchasePrice != null ? expectedSellValue - purchasePrice : null;
  const profitScore = profitDelta != null && purchasePrice != null && purchasePrice > 0 ? clamp(profitDelta / purchasePrice, -1, 1) : null;
  const lowPerformanceScore =
    performance.averageContribution != null ? clamp(1 - performance.averageContribution / 75, 0, 1) : 0;
  const keepPerformanceScore =
    performance.averageContribution != null ? clamp(performance.averageContribution / 75, 0, 1) : 0;
  const hasMeaningfulPerformanceSample = performance.appearances >= 3;
  const underperformed =
    hasMeaningfulPerformanceSample &&
    ((performance.averageContribution != null && performance.averageContribution < 30) ||
      (performance.averageFinalScore != null &&
        playerRating?.ovrNormalized != null &&
        performance.averageFinalScore < playerRating.ovrNormalized * 0.48));
  const rosterPressureScore =
    playerOpt != null && rosterSize > playerOpt ? clamp((rosterSize - playerOpt) / Math.max(playerOpt, 1), 0, 1) : 0;
  const playerAxis = getPlayerAxisLabel(player);
  const coversNeedAxis = playerAxis ? needs.uncoveredNeedAxes.includes(playerAxis) : false;
  const nonStarterBonus = roster.roleTag !== "starter" ? 0.15 : 0;
  const shortContractScore = roster.contractLength <= 1 ? 0.16 : roster.contractLength === 2 ? 0.08 : 0;
  const sellAggression = (profile?.bias.sellForProfitAggression ?? 5) / 10;
  const wageSensitivity = (profile?.bias.wageSensitivity ?? 5) / 10;
  const loyaltyBias = (profile?.bias.loyaltyBias ?? 5) / 10;
  const starProtection =
    (playerRating?.ovrRank != null && playerRating.ovrRank <= 10) ||
    (playerRating?.ppsSeasonRank != null && playerRating.ppsSeasonRank <= 10) ||
    (playerRating?.mvsRank != null && playerRating.mvsRank <= 10);
  const gmPressure = resolveGmPressureBehavior(context.gameState, team.teamId);
  const gmProfile = getTeamGeneralManager(context.gameState, team.teamId)?.profile ?? null;
  const playerDemands = buildPlayerDemands(context.gameState, player.id, team.teamId);
  const openDemands = playerDemands.filter((demand) => demand.status === "open" || demand.status === "at_risk");
  const demandPressureScore = openDemands.reduce((sum, demand) => {
    const priority = demand.priority === "high" ? 0.18 : demand.priority === "medium" ? 0.1 : 0.04;
    const risk = demand.status === "at_risk" ? 0.08 : 0;
    const typePressure = demand.type === "appearances" ? 0.05 : demand.type === "captaincy" ? 0.03 : 0;
    return sum + priority + risk + typePressure;
  }, 0);
  const demandKeepScore = openDemands.reduce((sum, demand) => {
    const coreDemand = demand.type === "discipline_start" || demand.type === "captaincy" || demand.type === "facility";
    if (!coreDemand) return sum;
    const priority = demand.priority === "high" ? 0.12 : demand.priority === "medium" ? 0.07 : 0.03;
    return sum + priority;
  }, 0);
  const negativeCashPressure = Number.isFinite(team.cash) && team.cash < 0;
  const lowCashReservePressure =
    budgetPressure === "critical" ||
    (Number.isFinite(team.cash) && team.cash > 0 && salaryTotal > 0 && team.cash < Math.max(8, salaryTotal * 0.18));
  const weakTeamFit = strategy.avoidedHits > strategy.preferredHits || hardNoGoHit;
  const boardTrust = assessPlayerBoardTrust({
    boardConfidence: identity?.boardConfidence ?? null,
    appearances: performance.appearances,
    averageContribution: performance.averageContribution,
    averageFinalScore: performance.averageFinalScore,
    expectedPerformanceValue: playerRating?.ovrNormalized ?? player.rating ?? null,
    contractLength: roster.contractLength,
    roleTag: roster.roleTag ?? null,
    salary,
    marketValue,
    purchasePrice,
    currentValue: expectedSellValue,
    ovrRank: playerRating?.ovrRank ?? null,
    actualPpsRank: playerRating?.ppsSeasonRank ?? null,
    actualMvsRank: playerRating?.mvsRank ?? null,
    rankPoolSize: playerRatingsById.size,
    weakTeamFit,
    hardNoGoHit,
  });

  if (salary != null && wagePressureScore >= 0.28) {
    pushSell("high_wage_burden", "hohes Gehalt im Verhaeltnis zum aktuellen Teambudget");
  } else if (salary != null && wagePressureScore <= 0.12) {
    pushKeep("low_wage_burden", "geringe Gehaltslast");
  }

  const sellRunway = assessTeamSellRunwayPressure({
    gameState: context.gameState,
    team,
    salaryTotal,
  });
  if (sellRunway.cashPressureScore >= 0.45 && !starProtection) {
    if (sellRunway.salaryExceedsCash) {
      pushSell("cash_runway_pressure", "Gehaltslast uebersteigt verfuegbares Cash — Verkauf entlastet den Etat");
    }
    if (
      isAttractiveProfitSell({
        expectedSellValue,
        marketValue,
        purchasePrice,
        cashPressureScore: sellRunway.cashPressureScore,
      })
    ) {
      pushSell("profit_window", "Verkaufspreis liegt ueber Marktwert — lukrativer Exit moeglich");
    }
  }

  if (profitDelta != null && profitDelta > 0) {
    pushSell("profit_window", `realisierbarer Gewinn von ${roundValue(profitDelta, 1)}`);
  } else if (profitDelta != null && profitDelta < 0) {
    pushKeep("sell_below_purchase", "aktueller Verkauf wuerde unter Einkauf liegen");
  }

  if (underperformed) {
    pushSell("underperformance", "Performance blieb unter Erwartung");
  } else if (performance.averageContribution != null && performance.averageContribution < 25) {
    pushSell("weak_contribution", "schwache lokale Score-Beitraege");
  }
  if (performance.averageContribution != null && performance.averageContribution >= 40) {
    pushKeep("strong_contribution", "starke lokale Score-Beitraege");
  }
  if (performance.top10Count > 0) {
    pushKeep("top10_presence", `Top-10-Praesenz in ${performance.top10Count} Diszi-Einsaetzen`);
  }

  if (strategy.avoidedHits > strategy.preferredHits) {
    pushSell("poor_team_fit", "passt nur schwach zum Teamprofil");
  }
  if (strategy.preferredHits > strategy.avoidedHits) {
    pushKeep("good_team_fit", "passt gut zum Teamprofil");
  }
  if (starProtection) {
    pushKeep("star_core_protection", "Star-/Core-Spieler wird nur bei echtem Finanz- oder Boarddruck bewegt");
  }
  if (openDemands.length > 0) {
    const demandLabels = openDemands.slice(0, 2).map((demand) => demand.label).join(", ");
    const highPriorityDemand = openDemands.some((demand) => demand.priority === "high");
    if (gmPressure.acceptPlayerDemandsUnderPressure && highPriorityDemand) {
      pushKeep(
        "player_demand_keep",
        `GM unter Druck geht eher auf Forderungen ein: ${demandLabels}`,
      );
    } else if (demandPressureScore >= 0.18 && !starProtection && !coversNeedAxis) {
      pushSell("player_demand_pressure", `offene Spielerforderung erzeugt Kaderdruck: ${demandLabels}`);
    } else {
      pushKeep("player_demand_keep", `offene Forderung muss eingeplant werden: ${demandLabels}`);
    }
  }
  if (hardNoGoHit) {
    pushSell("hard_no_go", "faellt in ein Team-Hard-No-Go");
  }
  // Board-Renewal-Signale sind reine Anzeige (Drawer-UI) und treiben keine Verkäufe mehr.
  // Verkauf/Entlassung liegt allein beim Team/GM.
  if (coversNeedAxis) {
    pushKeep("covers_need_axis", `deckt die aktuelle Achsenluecke ${playerAxis?.toUpperCase() ?? ""}`);
  }
  if (rosterSize > (playerOpt ?? rosterSize)) {
    pushSell("roster_over_opt", "Kader liegt ueber dem Optimum");
  }
  if (roster.contractLength <= 1) {
    if (strategy.avoidedHits >= strategy.preferredHits || underperformed || hardNoGoHit) {
      pushSell("short_contract", "Vertrag laeuft aus und Fit/Leistung rechtfertigt keine automatische Verlaengerung");
    } else {
      pushSell("short_contract", "kurze Restvertragslaenge");
    }
  } else if (roster.contractLength >= 3) {
    pushKeep("long_contract", "laengerer Restvertrag");
  }
  const expiringStrategicPressure = roster.contractLength <= 1 && !coversNeedAxis && keepPerformanceScore < 0.7;
  const expiringCoreDecisionPressure =
    roster.contractLength <= 1 &&
    (boardPressure >= 0.45 || teamSalaryPressure >= 0.3 || lowCashReservePressure || negativeCashPressure);
  if (expiringCoreDecisionPressure) {
    pushSell("expiring_contract", "auslaufender Vertrag braucht vor Ablauf eine aktive Marktentscheidung");
  }

  // Proactive early buyout (2026-07-04): a team may choose to cash out a player entering his
  // last contract year even without acute board/cash pressure. Cost-dependent — see
  // estimateBuyoutLikelihood — so this rarely overrides an otherwise "keep" case for teams that
  // can't comfortably afford giving up the commitment, but roster/cash pressure always overrides.
  const buyoutLikelihood =
    roster.contractLength === 1 && !expiringCoreDecisionPressure
      ? estimateBuyoutLikelihood({
          buyoutCost: Math.max(0, salary ?? 0),
          teamCash: team.cash,
          baseLikelihood: 0.35 + sellAggression * 0.25,
          pressureOverride: rosterPressureScore > 0 || lowCashReservePressure || negativeCashPressure,
        })
      : 0;
  if (buyoutLikelihood >= 0.4) {
    pushSell(
      "proactive_early_buyout",
      `letztes Vertragsjahr — vorzeitiger Marktverkauf lohnt sich (Buyout-Wahrscheinlichkeit ${Math.round(buyoutLikelihood * 100)}%)`,
    );
  }

  const scoreRaw =
    18 +
    (negativeCashPressure ? 24 : 0) +
    (lowCashReservePressure ? 10 : 0) +
    teamSalaryPressure * 18 * wageSensitivity +
    boardPressure * 12 +
    wagePressureScore * 30 * wageSensitivity +
    Math.max(profitScore ?? 0, 0) * 24 * sellAggression +
    lowPerformanceScore * 18 +
    (underperformed ? 12 : 0) +
    rosterPressureScore * 16 +
    shortContractScore * 30 * (profile?.bias.shortContractPreference ?? 5) / 10 +
    (roster.contractLength <= 1 && (strategy.avoidedHits >= strategy.preferredHits || underperformed || hardNoGoHit) ? 10 : 0) +
    (expiringStrategicPressure ? 8 : 0) +
    (expiringCoreDecisionPressure ? 10 : 0) +
    buyoutLikelihood * 12 +
    (sellRunway.cashPressureScore >= 0.45 && !starProtection
      ? Math.round(sellRunway.cashPressureScore * 14)
      : 0) +
    (sellRunway.cashPressureScore >= 0.45 &&
    isAttractiveProfitSell({
      expectedSellValue,
      marketValue,
      purchasePrice,
      cashPressureScore: sellRunway.cashPressureScore,
    })
      ? 10
      : 0) +
    demandPressureScore * 18 +
    strategy.avoidedHits * 6 +
    (hardNoGoHit ? 14 : 0) +
    nonStarterBonus * 50 -
    keepPerformanceScore * 22 -
    strategy.preferredHits * 5 -
    (coversNeedAxis ? 12 : 0) -
    demandKeepScore * 14 -
    (starProtection && !negativeCashPressure && !lowCashReservePressure && boardPressure < 0.65 ? 14 : 0) -
    loyaltyBias * (roster.contractLength >= 3 ? 8 : 2);

  if (negativeCashPressure) {
    unshiftSell("negative_cash", "negatives Teamcash zum Seasonstart");
  } else if (lowCashReservePressure) {
    unshiftSell("low_cash_reserve", "Cash-Reserve ist zu knapp fuer sichere Kaderplanung");
  } else if (budgetPressure === "healthy") {
    pushKeep("healthy_cash", "Teamcash ist entspannt");
  }

  let adjustedScoreRaw = scoreRaw;
  if (gmPressure.chaseBoardObjectivesMultiplier > 1.15 && profitScore != null && profitScore > 0) {
    adjustedScoreRaw += 8 * (gmPressure.chaseBoardObjectivesMultiplier - 1);
  }
  if (gmPressure.isHotSeat && underperformed) {
    adjustedScoreRaw += 5;
  }

  const doctrine = resolveTransferDoctrine(context.gameState, team.teamId);
  const gmAdjustedScore = applyGmArchetypeSellScoreModifier({
    baseScore: adjustedScoreRaw,
    gmProfile,
    pressure: gmPressure,
    sellReasonCodes,
    keepReasonCodes,
  });
  const sellPriority = Math.round(clamp(gmAdjustedScore, 0, 100));
  const sellDecision = evaluateAiSellDecision({
    sellPriority,
    reasonToSell,
    reasonToKeep,
    sellReasonCodes,
    keepReasonCodes,
    expectedSellValue,
    marketValue,
    contractLength: roster.contractLength,
    teamCash: team.cash ?? null,
    ovrRank: playerRating?.ovrRank ?? null,
    ppsSeasonRank: playerRating?.ppsSeasonRank ?? null,
    underperformed,
    doctrine,
  });

  return {
    activePlayerId: roster.id,
    playerId: player.id,
    playerName: player.name,
    className: player.className,
    race: player.race,
    raceName: player.race,
    ovr: playerRating?.ovrNormalized ?? null,
    mvs: playerRating?.mvs ?? null,
    salary,
    marketValue,
    expectedSellValue,
    contractLength: roster.contractLength,
    rosterAfter,
    salaryAfter: salary != null ? Math.max(salaryTotal - salary, 0) : salaryTotal,
    cashAfter: expectedSellValue != null && team.cash != null ? roundValue(team.cash + expectedSellValue, 1) : null,
    sportValueSummary: buildSportValueSummary(player, performance),
    performanceSummary: buildSportValueSummary(player, performance),
    strategyFitSummary: `${strategy.summary} ${profile?.sellStyleNote ?? profile?.sellStyle ?? ""}`.trim(),
    reasonToSell,
    reasonToKeep,
    sellReasonCodes: sellDecision.sellReasonCodes,
    keepReasonCodes: sellDecision.keepReasonCodes,
    reasonsToSell: reasonToSell,
    reasonsToKeep: reasonToKeep,
    warnings,
    boardTrustScore: boardTrust.trustScore,
    boardTrustSmiley: boardTrust.smiley,
    boardTrustPolicy: boardTrust.renewalPolicy,
    boardTrustReasons: boardTrust.reasons,
    boardTrustWarnings: boardTrust.warnings,
    salaryCapMultiplier: boardTrust.salaryCapMultiplier,
    sellPriority,
    sellPriorityScore: sellPriority,
    sellIntentScore: sellDecision.sellIntentScore,
    keepIntentScore: sellDecision.keepIntentScore,
    strategicSellScore: sellDecision.strategicSellScore,
    sellDecisionLabel: sellDecision.sellDecisionLabel,
    productiveElite: sellDecision.productiveElite,
  } satisfies AiSellPreviewCandidate;
}

async function resolvePreviewContext(params: AiSellPreviewParams): Promise<ResolvedPreviewContext> {
  const source = params.source === "prisma" ? "prisma" : "sqlite";

  if (source === "prisma") {
    const snapshot = await loadFoundationSnapshotFromPrisma(params.saveId ?? undefined);
    if (!snapshot) {
      throw new Error("Prisma foundation snapshot could not be loaded.");
    }

    const projected = projectFoundationStateFromPrisma(snapshot);
    return {
      source,
      saveId: projected.save.saveId,
      seasonId: projected.save.gameState.season.id,
      gameState: normalizeGameState(projected.save.gameState),
    };
  }

  const runContext = params.localRunContext ?? null;
  if (runContext?.save) {
    return {
      source,
      saveId: runContext.save.saveId,
      seasonId: runContext.save.gameState.season.id,
      gameState: normalizeGameState(runContext.save.gameState),
    };
  }

  const persistence = createPersistenceService();
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const requestedSave = params.saveId ? persistence.getSaveById(params.saveId) : null;
  if (params.saveId && !requestedSave) {
    throw new Error(`Requested save ${params.saveId} could not be resolved for AI sell preview.`);
  }
  const save =
    requestedSave ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("SQLite save could not be loaded.");
  }

  return {
    source,
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
    gameState: normalizeGameState(save.gameState),
  };
}

function getTeamStatus(entry: {
  controlMode: TeamControlMode;
  aiSellPreviewEnabled: boolean;
  sellCandidates: AiSellPreviewCandidate[];
  keepCore: AiSellPreviewCandidate[];
  warnings: string[];
  blockingReasons: string[];
  teamScope: AiSellPreviewTeamScope;
  rosterSize: number;
  playerMin: number | null;
  allowSellBelowRosterMin?: boolean;
}) {
  if (!entry.aiSellPreviewEnabled && entry.controlMode === "ai") {
    return "blocked" as const;
  }
  if (entry.blockingReasons.length > 0) {
    return "blocked" as const;
  }
  if (entry.teamScope === "all" && entry.controlMode !== "ai") {
    return "warning" as const;
  }
  if (
    !entry.allowSellBelowRosterMin &&
    entry.playerMin != null &&
    entry.rosterSize <= entry.playerMin
  ) {
    return "low_roster_depth" as const;
  }
  if (entry.sellCandidates.length === 0) {
    return entry.keepCore.length > 0 ? ("no_sell_need" as const) : ("no_candidates" as const);
  }
  if (entry.sellCandidates.every((candidate) => candidate.warnings.length > 0)) {
    return "warning" as const;
  }
  return entry.warnings.length > 0 ? ("warning" as const) : ("ready" as const);
}

export async function buildAiTransfermarktSellPreview(params: AiSellPreviewParams = {}): Promise<AiSellPreviewResult> {
  const startedAt = Date.now();
  const context = await resolvePreviewContext(params);
  const playerRatingsById = getSeasonDerivations({ gameState: context.gameState, saveId: context.saveId }).ratingsById;
  const runCache = buildSellPreviewRunCache(context.gameState);
  const teamScope = params.teamScope === "all" ? "all" : "ai";
  const limit = typeof params.limit === "number" && Number.isFinite(params.limit) ? Math.max(1, Math.round(params.limit)) : 5;
  const allowSellBelowRosterMin = params.allowSellBelowRosterMin ?? false;
  let candidateCount = 0;

  const requestedTeam =
    params.teamId != null
      ? context.gameState.teams.find((team) => team.teamId === params.teamId) ?? null
      : null;

  if (params.teamId && !requestedTeam) {
    throw new Error(`Team ${params.teamId} could not be found.`);
  }

  const candidateTeams = (requestedTeam ? [requestedTeam] : context.gameState.teams).filter((team) => {
    if (requestedTeam) return true;
    if (teamScope === "all") return true;
    const control = getTeamControlSettings(context.gameState, team.teamId);
    return control?.controlMode === "ai";
  });

  const teams = candidateTeams.map((team) => {
    const control = getTeamControlSettings(context.gameState, team.teamId);
    const profile = getTeamStrategyProfile(context.gameState, team.teamId);
    const roster = getTeamRoster(context.gameState, team.teamId);
    const identity = context.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const rosterSize = roster.length;
    const salaryTotal = roster.reduce(
      (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.roster }).salary ?? 0),
      0,
    );
    const marketValueTotal = roster.reduce(
      (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.roster }).marketValue ?? 0),
      0,
    );
    const warnings: string[] = [];
    const blockingReasons: string[] = [];
    const playerMin = identity?.playerMin ?? profile?.rosterMinTarget ?? null;
    const playerOpt = identity?.playerOpt ?? profile?.rosterOptTarget ?? null;

    if (teamScope === "all" && control?.controlMode === "manual") {
      warnings.push("manuell gesteuertes Team – Vorschlag nur informativ");
    }
    if (teamScope === "all" && control?.controlMode === "passive") {
      warnings.push("passives Team – Vorschlag nur informativ");
    }
    if (control?.controlMode === "ai" && !control.aiSellPreviewEnabled) {
      blockingReasons.push("AI-Sell-Preview ist fuer dieses Team deaktiviert");
    }
    if (roster.length === 0) {
      blockingReasons.push("kein aktiver Kader vorhanden");
    }

    const allCandidates = roster
      .map((item) =>
        buildCandidate(
          context,
          playerRatingsById,
          team,
          item.roster,
          item.player,
          rosterSize,
          salaryTotal,
          playerMin,
          playerOpt,
          runCache,
          allowSellBelowRosterMin,
        ),
      )
      .sort((left, right) => right.sellPriority - left.sellPriority || left.playerName.localeCompare(right.playerName, "de"));
    candidateCount += allCandidates.length;

    const keepCore = [...allCandidates]
      .sort((left, right) => {
        const leftKeepScore = (100 - left.sellPriority) + left.reasonToKeep.length * 12 - left.reasonToSell.length * 6 - left.warnings.length * 8;
        const rightKeepScore =
          (100 - right.sellPriority) + right.reasonToKeep.length * 12 - right.reasonToSell.length * 6 - right.warnings.length * 8;
        if (rightKeepScore !== leftKeepScore) {
          return rightKeepScore - leftKeepScore;
        }
        return left.playerName.localeCompare(right.playerName, "de");
      })
      .filter((entry) => entry.reasonToKeep.length > 0)
      .slice(0, Math.min(3, limit));

    const sellCandidates = allCandidates
      .filter((entry) => entry.reasonToSell.length > 0 || entry.warnings.length > 0)
      .slice(0, limit);

    const explanation = [
      profile?.strategySummary ?? "Kein Teamprofil vorhanden.",
      sellCandidates[0]
        ? `Top-Kandidat: ${sellCandidates[0].playerName}. ${sellCandidates[0].reasonToSell[0] ?? "Verkauf wirkt aktuell vertretbar."}`
        : "Aktuell kein sauberer Verkaufsvorschlag.",
    ]
      .filter(Boolean)
      .join(" ");

    const status = getTeamStatus({
      controlMode: control?.controlMode ?? "manual",
      aiSellPreviewEnabled: control?.aiSellPreviewEnabled ?? false,
      sellCandidates,
      keepCore,
      warnings,
      blockingReasons,
      teamScope,
      rosterSize,
      playerMin,
      allowSellBelowRosterMin,
    });

    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      controlMode: control?.controlMode ?? "manual",
      aiSellPreviewEnabled: control?.aiSellPreviewEnabled ?? false,
      status,
      strategySummary: profile?.strategySummary ?? "Kein Teamprofil vorhanden.",
      cash: team.cash ?? null,
      rosterCount: rosterSize,
      salaryTotal,
      marketValueTotal: roundValue(marketValueTotal, 1),
      rosterSize,
      playerMin,
      playerOpt,
      targetRosterMin: playerMin,
      targetRosterOpt: playerOpt,
      budgetPressure: getBudgetPressure(team, salaryTotal),
      sellCandidates,
      keepCore,
      warnings,
      blockingReasons,
      explanation,
    } satisfies AiSellPreviewTeamEntry;
  });

  const sortedTeams = [...teams].sort((left, right) => {
    const leftScore = left.sellCandidates[0]?.sellPriority ?? -1;
    const rightScore = right.sellCandidates[0]?.sellPriority ?? -1;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    return left.teamName.localeCompare(right.teamName, "de");
  });

  const result: AiSellPreviewResult = {
    readOnly: true,
    source: context.source,
    scope: {
      saveId: context.saveId,
      seasonId: context.seasonId,
      teamId: requestedTeam?.teamId ?? null,
      teamScope,
    },
    totalTeams: sortedTeams.length,
    aiTeams: sortedTeams.filter((team) => team.controlMode === "ai").length,
    skippedManual: sortedTeams.filter((team) => team.controlMode === "manual").length,
    skippedPassive: sortedTeams.filter((team) => team.controlMode === "passive").length,
    skippedDisabled: sortedTeams.filter((team) => team.controlMode === "ai" && !team.aiSellPreviewEnabled).length,
    readyTeams: sortedTeams.filter((team) => team.status === "ready").length,
    warningTeams: sortedTeams.filter((team) => team.status === "warning" || team.status === "no_sell_need" || team.status === "low_roster_depth" || team.status === "no_candidates").length,
    blockedTeams: sortedTeams.filter((team) => team.status === "blocked").length,
    teams: sortedTeams,
    debugPerformance: {
      durationMs: Date.now() - startedAt,
      candidateCount,
      sellValuePreviewCount: candidateCount,
      needsEvaluationCount: runCache.needsByTeamId.size,
      snapshotLookupCount: runCache.latestSnapshot ? 1 : 0,
    },
  };
  recordSellPreview(result.debugPerformance?.durationMs ?? Date.now() - startedAt);
  return result;
}

export function buildSellCoachingCandidateForActivePlayer(input: {
  gameState: GameState;
  teamId: string;
  activePlayerId: string;
}): AiSellPreviewCandidate | null {
  const gameState = normalizeGameState(input.gameState);
  const team = gameState.teams.find((entry) => entry.teamId === input.teamId) ?? null;
  if (!team) {
    return null;
  }

  const rosterItems = getTeamRoster(gameState, input.teamId);
  const rosterItem = rosterItems.find((entry) => entry.roster.id === input.activePlayerId) ?? null;
  if (!rosterItem) {
    return null;
  }

  const context: ResolvedPreviewContext = {
    source: "sqlite",
    saveId: "",
    seasonId: gameState.season.id,
    gameState,
  };
  const cache = buildSellPreviewRunCache(gameState);
  const playerRatingsById = buildPlayerRatingContractMap(gameState);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === input.teamId) ?? null;
  const profile = getTeamStrategyProfile(gameState, input.teamId);
  const rosterSize = rosterItems.length;
  const salaryTotal = rosterItems.reduce(
    (sum, item) => sum + (resolvePlayerEconomyContract({ player: item.player, rosterEntry: item.roster }).salary ?? 0),
    0,
  );
  const playerMin = identity?.playerMin ?? profile?.rosterMinTarget ?? null;
  const playerOpt = identity?.playerOpt ?? profile?.rosterOptTarget ?? null;

  return buildCandidate(
    context,
    playerRatingsById,
    team,
    rosterItem.roster,
    rosterItem.player,
    rosterSize,
    salaryTotal,
    playerMin,
    playerOpt,
    cache,
  );
}
