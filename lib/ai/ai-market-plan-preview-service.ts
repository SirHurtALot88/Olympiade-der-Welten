import {
  buildAiTransfermarktPreview,
  type AiTransferPreviewParams,
  type AiTransferPreviewRecommendation,
  type AiTransferPreviewResult,
  type AiTransferPreviewSource,
  type AiTransferPreviewTeamEntry,
} from "@/lib/ai/ai-transfermarkt-preview-service";
import {
  buildAiTransfermarktSellPreview,
  type AiSellPreviewCandidate,
  type AiSellPreviewResult,
  type AiSellPreviewTeamEntry,
} from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import {
  applyDoctrineToSellCandidates,
  chooseSwapAwarePackages,
  enrichBuyRecommendations,
  loadDoctrineContext,
  resolveTeamReplacementSlots,
  type DoctrineAdjustedSellCandidate,
  type EnrichedBuyRecommendation,
} from "@/lib/ai/ai-transfer-plan-enrichment";
import {
  mapPlannedPicksToBuyCandidates,
  mapPlannedPicksToBuyRecommendations,
  planUnifiedTeamPicks,
  resolveUnifiedMarketPickSteps,
  isUnifiedPickEnabledForMarket,
} from "@/lib/ai/unified-pick-planner-service";
import { computeCompositeSellScore, selectCompositeSellCandidates } from "@/lib/ai/ai-composite-sell-score";
import { getTeamHardMinRequired } from "@/lib/ai/ai-market-plan-convergence-service";
import { teamHasCashBufferRebuildFocus } from "@/lib/ai/ai-team-cash-reserve-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import {
  buildLeagueMarketAnchors,
  resolvePlannerSpendableCash,
} from "@/lib/ai/ai-market-slot-plan-service";
import { resolveMarketQualityProfile } from "@/lib/ai/ai-market-quality-profile-service";
import { buildBudgetEnvelope } from "@/lib/ai/market-pick-engine/budget-envelope";
import { pickCandidateForSlot, reconcileEnvelopeAfterPick } from "@/lib/ai/market-pick-engine/pick-step";
import { resolveMarketPlannerCashBuffer } from "@/lib/ai/ai-team-cash-reserve-service";
import { assessTeamSellRunwayPressure } from "@/lib/ai/team-sell-runway-pressure";
import { loadFoundationSnapshotFromPrisma } from "@/lib/db/read/foundation-read-repository";
import { projectFoundationStateFromPrisma } from "@/lib/db/read/foundation-read-projection";
import { withNormalizedTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { withNormalizedTeamStrategyProfiles } from "@/lib/foundation/team-strategy-profiles";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { GameState, TeamControlMode } from "@/lib/data/olyDataTypes";
import type { LocalTransfermarktRunContext } from "@/lib/market/transfermarkt-local-service";

export type AiMarketPlanPreviewSource = AiTransferPreviewSource;
export type AiMarketPlanPreviewTeamScope = "ai" | "all";
export type AiMarketPlanPreviewStatus = "hold" | "buy_only" | "sell_only" | "sell_then_buy" | "warning" | "blocked";

export type AiMarketPlanPreviewParams = {
  source?: AiMarketPlanPreviewSource;
  saveId?: string | null;
  seasonId?: string | null;
  teamId?: string | null;
  teamScope?: AiMarketPlanPreviewTeamScope;
  buyLimit?: number | null;
  sellLimit?: number | null;
  fullScoringLimit?: number | null;
  buyNeedOnly?: boolean | null;
  forceBuyScanTeamIds?: string[] | null;
  /** Align buy pool with compare/unified pick (default budget_wide). */
  candidateScopeMode?: "strategic" | "budget_wide" | null;
  localRunContext?: LocalTransfermarktRunContext | null;
  gameState?: GameState | null;
};

export type AiMarketPlanCurrentState = {
  cash: number | null;
  rosterCount: number | null;
  projectedRosterAfterExits: number | null;
  playerMin: number | null;
  playerOpt: number | null;
  salaryTotal: number | null;
  marketValueTotal: number | null;
};

export type AiMarketPlanSellPlan = {
  candidates: AiSellPreviewCandidate[];
  totalExpectedSellValue: number | null;
  salaryFreed: number | null;
  expectedSellValue: number | null;
  rosterAfterSell: number | null;
  warnings: string[];
};

export type AiMarketPlanBuyPlan = {
  candidates: AiTransferPreviewRecommendation[];
  plannedSpend: number | null;
  plannedSalaryAdded: number | null;
  rosterAfterBuy: number | null;
  warnings: string[];
};

export type AiMarketPlanProjectedState = {
  cashAfterPlan: number | null;
  rosterAfterPlan: number | null;
  salaryAfterPlan: number | null;
  marketValueAfterPlan: number | null;
};

export type AiMarketPlanStep = {
  stepType: "sell" | "buy" | "hold" | "warning";
  playerId?: string | null;
  playerName?: string | null;
  amount?: number | null;
  salaryImpact?: number | null;
  rosterImpact?: number | null;
  reason: string;
  sourceStatus: "mapped" | "partial" | "missing_source";
};

export type AiMarketPlanTeamEntry = {
  teamId: string;
  teamCode: string;
  teamName: string;
  controlMode: TeamControlMode;
  aiTransferPreviewEnabled: boolean;
  aiSellPreviewEnabled: boolean;
  status: AiMarketPlanPreviewStatus;
  strategySummary: string;
  currentState: AiMarketPlanCurrentState;
  sellPlan: AiMarketPlanSellPlan;
  buyPlan: AiMarketPlanBuyPlan;
  projectedState: AiMarketPlanProjectedState;
  planSteps: AiMarketPlanStep[];
  reasons: string[];
  warnings: string[];
  blockingReasons: string[];
};

export type AiMarketPlanPreviewSummary = {
  aiTeams: number;
  ready: number;
  hold: number;
  buyOnly: number;
  sellOnly: number;
  sellThenBuy: number;
  warning: number;
  blocked: number;
};

export type AiMarketPlanPreviewResult = {
  readOnly: true;
  source: AiMarketPlanPreviewSource;
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
    teamScope: AiMarketPlanPreviewTeamScope;
  };
  totalTeams: number;
  aiTeams: number;
  skippedManual: number;
  skippedPassive: number;
  skippedDisabled: number;
  holdTeams: number;
  buyOnlyTeams: number;
  sellOnlyTeams: number;
  sellThenBuyTeams: number;
  warningTeams: number;
  blockedTeams: number;
  summary: AiMarketPlanPreviewSummary;
  teams: AiMarketPlanTeamEntry[];
};

function sumKnown(values: Array<number | null | undefined>) {
  if (values.some((value) => value == null || !Number.isFinite(value))) {
    return null;
  }

  return values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function uniqueById<T>(items: T[], keySelector: (item: T) => string) {
  const seen = new Set<string>();
  const uniqueItems: T[] = [];
  for (const item of items) {
    const key = keySelector(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueItems.push(item);
  }
  return uniqueItems;
}

function isKnownPositiveMoney(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getPreviewCashBuffer(input: {
  salaryTotal: number | null | undefined;
  rosterAfterSell: number | null;
  playerMin: number | null;
  wantedCount: number;
  plannedBuyCount: number;
  strategySummary: string;
}) {
  const salaryBase = Math.max(0, input.salaryTotal ?? 0);
  const longContractHint = /bindet|loyal|lang|contract|vertrag|mentor/i.test(input.strategySummary);
  const missingMin =
    input.rosterAfterSell != null && input.playerMin != null
      ? Math.max(0, input.playerMin - input.rosterAfterSell)
      : 0;
  const remainingBuys = Math.max(0, input.wantedCount - input.plannedBuyCount - 1);
  return Math.max(longContractHint ? 10 : 6, salaryBase * 0.08, missingMin * 2, remainingBuys * 2);
}

function chooseBuyCandidates(
  team: AiTransferPreviewTeamEntry,
  plannedSellCount = 0,
  cashAfterSell?: number | null,
  buyCandidatesOverride?: EnrichedBuyRecommendation[],
  runwayReserve?: number | null,
  gameState?: GameState | null,
) {
  const rosterCount = team.rosterCount ?? team.rosterSize ?? null;
  const playerMin = team.targetRosterMin ?? null;
  const identityPlayerOpt = team.targetRosterOpt ?? null;
  const rosterAfterSell = rosterCount != null ? rosterCount - plannedSellCount : null;
  const buyCandidates = [...(buyCandidatesOverride ?? team.recommendedBuys ?? [])].sort((left, right) => {
    const leftScore = left.strategicBuyScore ?? left.overallRecommendationScore ?? 0;
    const rightScore = right.strategicBuyScore ?? right.overallRecommendationScore ?? 0;
    return rightScore - leftScore;
  });
  const topScore = buyCandidates[0]?.overallRecommendationScore ?? 0;
  const aggressiveBuy =
    team.explanation.includes("Win-at-all-costs") ||
    team.explanation.includes("Stars") ||
    team.explanation.includes("Titel") ||
    team.explanation.includes("Opportun");

  const qualityProfile =
    gameState && rosterAfterSell != null
      ? resolveMarketQualityProfile({
          gameState,
          teamId: team.teamId,
          rosterCount: rosterAfterSell,
          spendable: cashAfterSell ?? resolvePlannerSpendableCash(gameState, team.teamId, team.cash),
        })
      : null;
  const playerOpt = identityPlayerOpt;

  let wantedCount = 0;
  if (rosterAfterSell != null && playerMin != null && rosterAfterSell < playerMin) {
    wantedCount = Math.min(Math.max(playerMin - rosterAfterSell, 1), 3);
  } else if (rosterAfterSell != null && playerOpt != null && rosterAfterSell < playerOpt) {
    wantedCount = Math.min(Math.max(playerOpt - rosterAfterSell, 1), plannedSellCount >= 2 ? 3 : 2);
  } else if (plannedSellCount >= 2 && topScore >= 58 && team.budgetStatus !== "critical") {
    wantedCount = qualityProfile?.starChaser ? 1 : 2;
  } else if (plannedSellCount >= 1 && topScore >= 52 && team.budgetStatus !== "critical") {
    wantedCount = 1;
  } else if (aggressiveBuy && topScore >= 65 && team.budgetStatus !== "critical") {
    wantedCount = 1;
  }

  const candidateWindow = wantedCount > 0 ? Math.min(buyCandidates.length, wantedCount + 16) : 0;
  const visibleCandidates = buyCandidates.slice(0, candidateWindow);
  if (cashAfterSell == null || !Number.isFinite(cashAfterSell)) {
    return visibleCandidates.slice(0, wantedCount);
  }

  const selected: AiTransferPreviewRecommendation[] = [];
  const usedPlayerIds = new Set<string>();
  let cashRemaining = cashAfterSell;

  const pickWithCash = (candidate: AiTransferPreviewRecommendation) => {
    const priceValue = candidate.price ?? candidate.marketValue ?? null;
    if (!isKnownPositiveMoney(priceValue) || usedPlayerIds.has(candidate.playerId)) {
      return false;
    }
    // Sum-cash rule: pick is allowed when team cash stays >= 0 after fee (per-pick buffer overrun OK).
    if (cashRemaining - priceValue < 0) {
      return false;
    }
    selected.push(candidate);
    usedPlayerIds.add(candidate.playerId);
    cashRemaining -= priceValue;
    return true;
  };

  if (qualityProfile && wantedCount > 0 && gameState) {
    const faPrices = gameState.players.map((player) => player.marketValue ?? player.displayMarketValue ?? null);
    const anchors = buildLeagueMarketAnchors(faPrices);
    const missingToMin =
      playerMin != null && rosterAfterSell != null ? Math.max(0, playerMin - rosterAfterSell) : 0;
    const rosterGap =
      playerOpt != null && rosterAfterSell != null ? Math.max(0, playerOpt - rosterAfterSell) : wantedCount;
    const envelope = buildBudgetEnvelope({
      spendable: cashRemaining,
      rosterGap,
      missingToMin,
      steps: wantedCount,
      profile: qualityProfile,
      faPrices,
    });
    const effectivePickPhase = qualityProfile.pickPhase;

    for (let slotIndex = 0; slotIndex < wantedCount; slotIndex += 1) {
      if (selected.length >= wantedCount) break;
      const pickResult = pickCandidateForSlot({
        slotIndex,
        envelope,
        candidates: visibleCandidates,
        usedPlayerIds,
        qualityProfile,
        pickPhase: effectivePickPhase,
        allowMinFillFallback: missingToMin > 0 && rosterAfterSell != null && playerMin != null && rosterAfterSell < playerMin,
      });
      if (!pickResult) continue;
      const candidate = pickResult.candidate as AiTransferPreviewRecommendation;
      if (pickWithCash(candidate)) {
        reconcileEnvelopeAfterPick({
          envelope,
          slotIndex,
          overspendDelta: pickResult.overspendDelta,
        });
      }
    }
  }

  for (const candidate of visibleCandidates) {
    if (selected.length >= wantedCount) break;
    pickWithCash(candidate);
  }

  return selected;
}

function chooseSellCandidates(
  team: AiSellPreviewTeamEntry,
  candidatesOverride?: DoctrineAdjustedSellCandidate[],
  gameState?: GameState | null,
  _options?: { buyTopScore?: number },
) {
  const sourceCandidates = candidatesOverride ?? team.sellCandidates;
  if (sourceCandidates.length === 0) {
    return [];
  }
  if (!gameState) {
    return sourceCandidates.slice(0, 3);
  }

  const teamState = gameState.teams.find((entry) => entry.teamId === team.teamId) ?? null;
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
  const profile = getTeamStrategyProfile(gameState, team.teamId);
  const salaryTotal = team.salaryTotal ?? 0;
  const sellRunway = teamState
    ? assessTeamSellRunwayPressure({ gameState, team: teamState, salaryTotal })
    : null;
  const cashPressureScore = sellRunway?.cashPressureScore ?? 0;
  const previewByPlayerId = new Map(sourceCandidates.map((candidate) => [candidate.playerId, candidate] as const));
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));

  const scored = gameState.rosters
    .filter((entry) => entry.teamId === team.teamId)
    .map((roster) => {
      const preview = previewByPlayerId.get(roster.playerId);
      const player = playersById.get(roster.playerId);
      if (!player || !teamState) {
        return preview ? { candidate: preview, score: preview.strategicSellScore ?? preview.sellPriority ?? 0, threshold: 30, teamProfile: "default" as const } : null;
      }
      const economy = resolvePlayerEconomyContract({ player, rosterEntry: roster });
      const composite = computeCompositeSellScore({
        teamId: team.teamId,
        team: teamState,
        identity,
        player,
        roster,
        gameState,
        saveId: gameState.season.id,
        expectedSellValue: preview?.expectedSellValue ?? null,
        marketValue: preview?.marketValue ?? economy.marketValue,
        salary: preview?.salary ?? economy.salary,
        purchasePrice: preview?.purchasePrice ?? economy.purchasePrice ?? roster.purchasePrice ?? null,
        teamCash: teamState.cash ?? 0,
        teamSalaryTotal: salaryTotal,
        cashPressureScore,
        explanation: team.explanation,
        sellForProfitAggression: profile?.bias.sellForProfitAggression ?? null,
      });
      const candidate = preview ?? ({
        activePlayerId: roster.id,
        playerId: player.id,
        playerName: player.name,
        className: player.className,
        race: player.race,
        raceName: player.race,
        ovr: null,
        mvs: null,
        salary: economy.salary ?? null,
        marketValue: economy.marketValue ?? null,
        expectedSellValue: economy.marketValue ?? null,
        contractLength: roster.contractLength,
        rosterAfter: null,
        salaryAfter: null,
        cashAfter: null,
        sportValueSummary: "",
        performanceSummary: "",
        strategyFitSummary: "",
        reasonToSell: [],
        reasonToKeep: [],
        reasonsToSell: [],
        reasonsToKeep: [],
        warnings: [],
        boardTrustScore: null,
        boardTrustSmiley: null,
        boardTrustPolicy: "normal",
        boardTrustReasons: [],
        boardTrustWarnings: [],
        salaryCapMultiplier: null,
        sellPriority: composite.total,
        sellPriorityScore: composite.total,
        strategicSellScore: composite.total,
      } satisfies AiSellPreviewCandidate);
      return {
        candidate: {
          ...candidate,
          purchasePrice: preview?.purchasePrice ?? economy.purchasePrice ?? roster.purchasePrice ?? null,
          strategicSellScore: composite.total,
          sellPriority: composite.total,
          sellPriorityScore: composite.total,
        },
        score: composite.total,
        threshold: composite.threshold,
        teamProfile: composite.teamProfile,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  if (scored.length === 0) {
    return [];
  }

  const effectiveThreshold = scored[0]?.threshold ?? 30;
  const teamProfile = scored[0]?.teamProfile ?? "default";
  const qualified = scored
    .filter((entry) => entry.score >= effectiveThreshold)
    .sort((left, right) => right.score - left.score || left.candidate.playerName.localeCompare(right.candidate.playerName, "de"));
  const rosterCount = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
  const hardMin = getTeamHardMinRequired(gameState, team.teamId);
  return uniqueById(
    selectCompositeSellCandidates({
      candidates: qualified.map((entry) => ({ candidate: entry.candidate, score: entry.score })),
      teamCash: teamState?.cash ?? 0,
      teamSalaryTotal: salaryTotal,
      cashPressureScore,
      teamProfile,
      hardMin,
      rosterCount,
      allowProfitSellsBelowMin:
        (identity?.boardConfidence ?? 0) < 7 ||
        teamHasCashBufferRebuildFocus(gameState, team.teamId),
    }),
    (candidate) => candidate.activePlayerId,
  );
}

function normalizeMarketPlanGameState(gameState: GameState) {
  return withNormalizedTeamStrategyProfiles(withNormalizedTeamControlSettings(gameState));
}

async function loadMarketPlanGameState(params: {
  source?: AiTransferPreviewSource;
  saveId?: string | null;
}): Promise<GameState | null> {
  try {
    const source = params.source === "prisma" ? "prisma" : "sqlite";
    if (source === "prisma") {
      const snapshot = await loadFoundationSnapshotFromPrisma(params.saveId ?? undefined);
      if (!snapshot) return null;
      const projected = projectFoundationStateFromPrisma(snapshot);
      return normalizeMarketPlanGameState(projected.save.gameState);
    }

    const persistence = createPersistenceService();
    const bootstrapped = persistence.bootstrapSingleplayerSave();
    const requestedSave = params.saveId ? persistence.getSaveById(params.saveId) : null;
    const save = requestedSave ?? persistence.getActiveSave() ?? bootstrapped.save;
    if (!save) return null;
    return normalizeMarketPlanGameState(save.gameState);
  } catch {
    return null;
  }
}

function buildProjectedState(input: {
  currentState: AiMarketPlanCurrentState;
  sellPlan: AiMarketPlanSellPlan;
  buyPlan: AiMarketPlanBuyPlan;
}) {
  const sellCount = input.sellPlan.candidates.length;
  const buyCount = input.buyPlan.candidates.length;

  return {
    cashAfterPlan:
      input.currentState.cash != null &&
      input.buyPlan.plannedSpend != null &&
      (sellCount === 0 || input.sellPlan.expectedSellValue != null)
        ? input.currentState.cash + (input.sellPlan.expectedSellValue ?? 0) - input.buyPlan.plannedSpend
        : null,
    rosterAfterPlan:
      input.currentState.rosterCount != null ? input.currentState.rosterCount - sellCount + buyCount : null,
    salaryAfterPlan:
      input.currentState.salaryTotal != null &&
      input.buyPlan.plannedSalaryAdded != null &&
      (sellCount === 0 || input.sellPlan.salaryFreed != null)
        ? input.currentState.salaryTotal - (input.sellPlan.salaryFreed ?? 0) + input.buyPlan.plannedSalaryAdded
        : null,
    marketValueAfterPlan:
      input.currentState.marketValueTotal != null &&
      input.buyPlan.plannedSpend != null &&
      (sellCount === 0 || input.sellPlan.expectedSellValue != null)
        ? input.currentState.marketValueTotal - (input.sellPlan.expectedSellValue ?? 0) + input.buyPlan.plannedSpend
        : null,
  } satisfies AiMarketPlanProjectedState;
}

function getTeamStatus(input: {
  controlMode: TeamControlMode;
  buyEnabled: boolean;
  sellEnabled: boolean;
  buyCandidates: AiTransferPreviewRecommendation[];
  sellCandidates: AiSellPreviewCandidate[];
  currentState: AiMarketPlanCurrentState;
  warnings: string[];
  blockingReasons: string[];
}) {
  if (input.controlMode !== "ai") {
    return "warning" as const;
  }
  if (!input.buyEnabled || !input.sellEnabled || input.blockingReasons.length > 0) {
    return "blocked" as const;
  }
  if (input.sellCandidates.length > 0 && input.buyCandidates.length > 0) {
    return "sell_then_buy" as const;
  }
  if (input.buyCandidates.length > 0) {
    return "buy_only" as const;
  }
  if (input.sellCandidates.length > 0) {
    return "sell_only" as const;
  }

  const rosterCount = input.currentState.rosterCount;
  const playerMin = input.currentState.playerMin;
  const playerOpt = input.currentState.playerOpt;
  const rosterNeedsBuy = rosterCount != null && playerMin != null && rosterCount < playerMin;
  const rosterNeedsSell = rosterCount != null && playerOpt != null && rosterCount > playerOpt;
  if (rosterNeedsBuy || rosterNeedsSell || input.warnings.length > 0) {
    return "warning" as const;
  }
  return "hold" as const;
}

function resolveProjectedRosterAfterExits(_gameState: GameState | null | undefined, _teamId: string, rosterCount: number | null) {
  return rosterCount;
}

function buildTeamEntry(input: {
  buyTeam: AiTransferPreviewTeamEntry | undefined;
  sellTeam: AiSellPreviewTeamEntry | undefined;
  teamScope: AiMarketPlanPreviewTeamScope;
  buyScanSkipped?: boolean;
  sellScanSkipped?: boolean;
  gameState?: GameState | null;
}) {
  const buyTeam = input.buyTeam;
  const sellTeam = input.sellTeam;
  if (!buyTeam && !sellTeam) {
    return null;
  }

  const teamId = buyTeam?.teamId ?? sellTeam?.teamId ?? "";
  const controlMode = buyTeam?.controlMode ?? sellTeam?.controlMode ?? "manual";
  const buyEnabled = input.buyScanSkipped ? true : buyTeam?.aiTransferPreviewEnabled ?? false;
  const sellEnabled = input.sellScanSkipped ? true : sellTeam?.aiSellPreviewEnabled ?? false;
  const rosterCount = buyTeam?.rosterCount ?? buyTeam?.rosterSize ?? sellTeam?.rosterSize ?? null;
  const currentState: AiMarketPlanCurrentState = {
    cash: buyTeam?.cash ?? sellTeam?.cash ?? null,
    rosterCount,
    projectedRosterAfterExits: resolveProjectedRosterAfterExits(input.gameState, teamId, rosterCount),
    playerMin: sellTeam?.targetRosterMin ?? sellTeam?.playerMin ?? buyTeam?.targetRosterMin ?? null,
    playerOpt: sellTeam?.targetRosterOpt ?? sellTeam?.playerOpt ?? buyTeam?.targetRosterOpt ?? null,
    salaryTotal: buyTeam?.salaryTotal ?? buyTeam?.salary ?? sellTeam?.salaryTotal ?? null,
    marketValueTotal: buyTeam?.marketValueTotal ?? sellTeam?.marketValueTotal ?? null,
  };

  const doctrine =
    input.gameState && teamId ? loadDoctrineContext(input.gameState, teamId) : null;
  const doctrineAdjustedSells =
    sellTeam && doctrine
      ? applyDoctrineToSellCandidates({ candidates: sellTeam.sellCandidates, doctrine })
      : sellTeam?.sellCandidates ?? [];

  const buyTopScore =
    buyTeam?.recommendedBuys?.[0]?.overallRecommendationScore ?? buyTeam?.recommendedBuys?.[0]?.score ?? 0;
  const chosenSells = sellTeam
    ? chooseSellCandidates(sellTeam, doctrineAdjustedSells, input.gameState, { buyTopScore })
    : [];
  const expectedSellValue = chosenSells.length > 0 ? sumKnown(chosenSells.map((candidate) => candidate.expectedSellValue)) : 0;
  const cashAfterSell =
    currentState.cash != null && expectedSellValue != null
      ? currentState.cash + expectedSellValue
      : null;

  const enrichedBuyPool =
    buyTeam && input.gameState
      ? enrichBuyRecommendations({
          gameState: input.gameState,
          teamId,
          recommendations: buyTeam.recommendedBuys ?? [],
          doctrine: doctrine!,
          replacementSlots: resolveTeamReplacementSlots({
            gameState: input.gameState,
            teamId,
            plannedSells: chosenSells,
          }),
          rosterAfterSell:
            currentState.rosterCount != null ? currentState.rosterCount - chosenSells.length : null,
          playerMin: currentState.playerMin,
          playerOpt: currentState.playerOpt,
          teamCash: currentState.cash,
          cashAfterSell,
          plannedSellCount: chosenSells.length,
          rosterPlayerIds: input.gameState.rosters
            .filter((entry) => entry.teamId === teamId)
            .map((entry) => entry.playerId),
        })
      : undefined;

  const initialBuys = buyTeam
    ? chooseBuyCandidates(
        buyTeam,
        chosenSells.length,
        cashAfterSell,
        enrichedBuyPool,
        input.gameState && teamId ? resolveMarketPlannerCashBuffer(input.gameState, teamId) : null,
        input.gameState,
      )
    : [];
  const swapResult =
    input.gameState && sellTeam && buyTeam
      ? chooseSwapAwarePackages({
          sellCandidates: doctrineAdjustedSells,
          buyCandidates: enrichedBuyPool ?? initialBuys,
          chosenSells,
          chosenBuys: initialBuys,
          replacementSlots: resolveTeamReplacementSlots({
            gameState: input.gameState,
            teamId,
            plannedSells: chosenSells,
          }),
          rosterNetQualityLoss: (sell, buy) => {
            const sellRank = sell.ovr ?? 0;
            const buyRank = buy.ovr ?? 0;
            return sellRank > buyRank + 6 ? 8 : 0;
          },
        })
      : { sells: chosenSells, buys: initialBuys, swapReason: null as string | null };

  const chosenBuys = swapResult.buys;
  const finalSells = swapResult.sells;
  const swapReason = swapResult.swapReason;
  const finalExpectedSellValue =
    finalSells.length > 0 ? sumKnown(finalSells.map((candidate) => candidate.expectedSellValue)) : 0;
  const buyPlan: AiMarketPlanBuyPlan = {
    candidates: chosenBuys,
    plannedSpend: chosenBuys.length > 0 ? sumKnown(chosenBuys.map((candidate) => candidate.price)) : 0,
    plannedSalaryAdded: chosenBuys.length > 0 ? sumKnown(chosenBuys.map((candidate) => candidate.salary)) : 0,
    rosterAfterBuy: currentState.rosterCount != null ? currentState.rosterCount + chosenBuys.length : null,
    warnings: unique([
      ...chosenBuys.flatMap((candidate) => candidate.warnings),
      chosenBuys.length === 0 && currentState.rosterCount != null && currentState.playerMin != null && currentState.rosterCount < currentState.playerMin
        ? "Kader liegt unter Minimum, aber es wurde noch kein sauberer Kaufkandidat gefunden."
        : null,
    ]),
  };
  const sellPlan: AiMarketPlanSellPlan = {
    candidates: finalSells,
    salaryFreed: finalSells.length > 0 ? sumKnown(finalSells.map((candidate) => candidate.salary)) : 0,
    expectedSellValue: finalExpectedSellValue,
    totalExpectedSellValue: finalExpectedSellValue,
    rosterAfterSell: currentState.rosterCount != null ? currentState.rosterCount - finalSells.length : null,
    warnings: unique([
      ...finalSells.flatMap((candidate) => candidate.warnings),
      finalSells.some((candidate) => candidate.expectedSellValue == null)
        ? "Mindestens ein geplanter Verkauf hat keinen belastbaren Verkaufserloes."
        : null,
    ]),
  };

  const reasons = unique([
    doctrine?.personaHint ?? null,
    swapReason,
    buyTeam?.explanation,
    sellTeam?.explanation,
    currentState.rosterCount != null &&
    currentState.playerMin != null &&
    currentState.rosterCount < currentState.playerMin
      ? "Kader liegt unter dem Team-Minimum und braucht Zugaenge."
      : null,
    currentState.rosterCount != null &&
    currentState.playerOpt != null &&
    currentState.rosterCount > currentState.playerOpt
      ? "Kader liegt ueber dem Team-Optimum und bietet Verkaufsdruck."
      : null,
    chosenBuys[0]?.reason,
    chosenBuys[0]?.buyDecisionLabel ?? chosenBuys[0]?.strategyNotes?.[0],
    finalSells[0]?.reasonToSell?.[0],
    finalSells[0]?.strategyFitSummary,
  ]);
  const warnings = unique([
    ...(buyTeam?.warnings ?? []),
    ...(sellTeam?.warnings ?? []),
    ...chosenBuys.flatMap((candidate) => candidate.warnings),
    ...finalSells.flatMap((candidate) => candidate.warnings),
    finalSells.some((candidate) => candidate.expectedSellValue == null)
      ? "Mindestens ein geplanter Verkauf hat keinen belastbaren Verkaufserloes."
      : null,
    input.teamScope === "all" && controlMode === "manual" ? "manuell gesteuertes Team – Marktplan nur informativ" : null,
    input.teamScope === "all" && controlMode === "passive" ? "passives Team – Marktplan nur informativ" : null,
  ]);
  const projectedState = buildProjectedState({
    currentState,
    sellPlan,
    buyPlan,
  });
  const blockingReasons = unique([
    !buyEnabled ? "ai_transfer_preview_disabled" : null,
    !sellEnabled ? "ai_sell_preview_disabled" : null,
    currentState.rosterCount != null &&
    currentState.playerMin != null &&
    currentState.rosterCount < currentState.playerMin &&
    chosenBuys.length === 0
      ? "roster_under_min_without_buy_candidate"
      : null,
    currentState.rosterCount != null &&
    currentState.playerOpt != null &&
    currentState.rosterCount > currentState.playerOpt &&
    finalSells.length === 0
      ? "roster_over_opt_without_sell_candidate"
      : null,
    currentState.cash != null && currentState.cash < 0 && projectedState.cashAfterPlan != null && projectedState.cashAfterPlan <= 0
      ? "negative_cash_unresolved_after_safe_sells"
      : null,
    projectedState.cashAfterPlan != null && projectedState.cashAfterPlan <= 0
      ? "cash_after_market_plan_not_positive"
      : null,
    projectedState.cashAfterPlan != null &&
    projectedState.salaryAfterPlan != null &&
    projectedState.cashAfterPlan < Math.max(1, projectedState.salaryAfterPlan * 0.05)
      ? "cash_after_market_plan_below_reserve"
      : null,
    projectedState.rosterAfterPlan != null &&
    chosenBuys.length > 0 &&
    currentState.playerMin != null &&
    projectedState.rosterAfterPlan < currentState.playerMin
      ? "roster_after_market_plan_below_player_min"
      : null,
  ]);
  const status = getTeamStatus({
    controlMode,
    buyEnabled,
    sellEnabled,
    buyCandidates: chosenBuys,
    sellCandidates: finalSells,
    currentState,
    warnings,
    blockingReasons,
  });

  const planSteps: AiMarketPlanStep[] = [
    ...finalSells.map((candidate) => ({
      stepType: "sell" as const,
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      amount: candidate.expectedSellValue,
      salaryImpact: candidate.salary != null ? -candidate.salary : null,
      rosterImpact: -1,
      reason: candidate.reasonsToSell[0] ?? candidate.strategyFitSummary,
      sourceStatus: candidate.expectedSellValue != null ? ("mapped" as const) : ("missing_source" as const),
    })),
    ...chosenBuys.map((candidate) => ({
      stepType: "buy" as const,
      playerId: candidate.playerId,
      playerName: candidate.name,
      amount: candidate.price,
      salaryImpact: candidate.salary,
      rosterImpact: 1,
      reason: candidate.reasonToBuy?.[0] ?? candidate.buyDecisionLabel ?? candidate.reason,
      sourceStatus:
        candidate.price != null && candidate.salary != null
          ? ("mapped" as const)
          : ("partial" as const),
    })),
  ];

  if (status === "hold") {
    planSteps.push({
      stepType: "hold",
      reason: "Halte den Kader im aktuellen Marktfenster stabil.",
      sourceStatus: "mapped",
    });
  }

  if (status === "warning" && chosenBuys.length === 0 && finalSells.length === 0) {
    planSteps.push({
      stepType: "warning",
      reason: "Vor einem Marktplan fehlen noch saubere Kauf- oder Verkaufskandidaten.",
      sourceStatus: "partial",
    });
  }

  return {
    teamId,
    teamCode: buyTeam?.teamCode ?? sellTeam?.teamCode ?? teamId,
    teamName: buyTeam?.teamName ?? sellTeam?.teamName ?? teamId,
    controlMode,
    aiTransferPreviewEnabled: buyEnabled,
    aiSellPreviewEnabled: sellEnabled,
    status,
    strategySummary: buyTeam?.explanation ?? sellTeam?.explanation ?? "Kein Teamprofil verfuegbar.",
    currentState,
    sellPlan,
    buyPlan,
    projectedState,
    planSteps,
    reasons,
    warnings,
    blockingReasons,
  } satisfies AiMarketPlanTeamEntry;
}

async function overlayUnifiedCompareBuyPlans(input: {
  teams: AiMarketPlanTeamEntry[];
  saveId: string;
  seasonId: string;
  buyPreview: AiTransferPreviewResult | null;
}) {
  // S1 is no longer excluded here (course correction 2026-07-04): the Unified engine must overlay
  // S1 convergence just like any other season, so a team that sells down below hardMin/Opt in S1
  // rebuilds through the same acquisition logic as the initial draft.
  if (!isUnifiedPickEnabledForMarket() || !input.saveId) {
    return input.teams;
  }

  const buyByTeam = new Map((input.buyPreview?.teams ?? []).map((team) => [team.teamId, team] as const));
  const overlayed: AiMarketPlanTeamEntry[] = [];

  for (const team of input.teams) {
    const steps = resolveUnifiedMarketPickSteps(team);
    const poolTeam = buyByTeam.get(team.teamId);
    const pool = poolTeam?.legalCandidatePool ?? poolTeam?.recommendedBuys ?? [];
    const rosterCount = team.currentState.rosterCount;
    const playerOpt = team.currentState.playerOpt;
    // 2026-07-06: a team the legacy (non-unified) buy plan could only *partially* fill gets
    // marked status="blocked" with the single reason "roster_after_market_plan_below_player_min"
    // (see getTeamStatus/blockingReasons above) — but that is exactly the situation the Unified
    // engine exists to fix (it plans as many steps as the roster gap needs, not just the 1-2
    // candidates the legacy preview pool happened to find). Excluding "blocked" teams from the
    // overlay meant the strongest rebuild candidates (e.g. a team sold down to 1 player) never
    // got a real Unified plan at all. Any OTHER blocking reason (disabled AI preview, unresolved
    // negative cash, etc.) still keeps the team out of the overlay — those represent situations
    // where buying more is genuinely not safe, not an incomplete-plan artifact.
    const blockedOnlyByIncompleteRosterFill =
      team.status === "blocked" &&
      team.blockingReasons.length > 0 &&
      team.blockingReasons.every((reason) => reason === "roster_after_market_plan_below_player_min");
    if (
      steps <= 0 ||
      (rosterCount != null && playerOpt != null && rosterCount >= playerOpt) ||
      !(
        team.status === "buy_only" ||
        team.status === "sell_then_buy" ||
        team.status === "warning" ||
        blockedOnlyByIncompleteRosterFill
      )
    ) {
      overlayed.push(team);
      continue;
    }

    const planned = await planUnifiedTeamPicks({
      saveId: input.saveId,
      seasonId: input.seasonId,
      teamId: team.teamId,
      steps,
      // 2026-07-06: reuse the exact S1 draft planner mode for market buys too — same lane
      // philosophy, star/superstar caps, spend corridor. The engine already accounts for the
      // team's existing roster composition (existingStars/existingCores etc.), so it degrades
      // gracefully from "empty roster draft" to "top up a partially filled roster" without a
      // separate code path. See ai-needs-picks-compare-service.ts buildCashStrategy for the
      // matching startingCash fix that keeps the spend corridor correct outside season 1.
      runMode: "season1_optimum_execute",
    });
    // Compare already scored against budget_wide FA pool — use pick metadata directly so mapping
    // does not depend on a narrower market-plan preview pool.
    const fromCompare = mapPlannedPicksToBuyRecommendations(planned.plannedPicks);
    const mappedFromPool = mapPlannedPicksToBuyCandidates(planned.plannedPicks, pool);
    const unifiedBuys = fromCompare.length > 0 ? fromCompare : mappedFromPool;
    if (unifiedBuys.length === 0) {
      overlayed.push({
        ...team,
        warnings: unique([
          ...team.warnings,
          ...planned.warnings,
          pool.length === 0 ? "unified_pick_empty_buy_pool" : null,
          "unified_pick_no_mapped_candidates",
        ]),
      });
      continue;
    }

    overlayed.push({
      ...team,
      buyPlan: {
        ...team.buyPlan,
        candidates: unifiedBuys,
        plannedSpend: unifiedBuys.length > 0 ? sumKnown(unifiedBuys.map((candidate) => candidate.price)) : 0,
        plannedSalaryAdded:
          unifiedBuys.length > 0 ? sumKnown(unifiedBuys.map((candidate) => candidate.salary)) : 0,
        rosterAfterBuy:
          team.currentState.rosterCount != null ? team.currentState.rosterCount + unifiedBuys.length : null,
        warnings: unique([
          ...team.buyPlan.warnings,
          ...planned.warnings,
          unifiedBuys.length < steps ? "unified_pick_partial_fill" : null,
        ]),
      },
      warnings: unique([...team.warnings, ...planned.warnings]),
      blockingReasons: unique([...team.blockingReasons, ...planned.blockingReasons]),
    });
  }

  return overlayed;
}

export async function buildAiMarketPlanPreview(params: AiMarketPlanPreviewParams = {}): Promise<AiMarketPlanPreviewResult> {
  const previewParams: AiTransferPreviewParams = {
    source: params.source === "prisma" ? "prisma" : "sqlite",
    saveId: params.saveId ?? null,
    seasonId: params.seasonId ?? null,
    teamId: params.teamId ?? null,
    teamScope: params.teamScope === "all" ? "all" : "ai",
  };
  const skipBuyScan = params.buyLimit === 0;
  const skipSellScan = params.sellLimit === 0;
  const gameState =
    params.gameState != null
      ? normalizeMarketPlanGameState(params.gameState)
      : params.localRunContext?.save.gameState != null
        ? normalizeMarketPlanGameState(params.localRunContext.save.gameState)
        : await loadMarketPlanGameState({
            source: previewParams.source,
            saveId: previewParams.saveId,
          });
  const previewContext = {
    localRunContext: params.localRunContext ?? undefined,
  };

  const candidateScopeMode = params.candidateScopeMode === "strategic" ? "strategic" : "budget_wide";

  const [buyPreview, sellPreview] = await Promise.all([
    skipBuyScan
      ? Promise.resolve(null)
      : buildAiTransfermarktPreview({
          ...previewParams,
          ...previewContext,
          limit: params.buyLimit ?? 90,
          fullScoringLimit: params.fullScoringLimit ?? null,
          buyNeedOnly: params.buyNeedOnly ?? false,
          forceBuyScanTeamIds: params.forceBuyScanTeamIds ?? null,
          candidateScopeMode,
        }),
    skipSellScan
      ? Promise.resolve(null)
      : buildAiTransfermarktSellPreview({
          ...previewParams,
          ...previewContext,
          limit: params.sellLimit ?? 6,
          fullRosterCandidates: true,
          allowSellBelowRosterMin: true,
        }),
  ]);

  const teamIds = Array.from(new Set([...(buyPreview?.teams ?? []).map((team) => team.teamId), ...(sellPreview?.teams ?? []).map((team) => team.teamId)]));
  const buyTeamById = new Map((buyPreview?.teams ?? []).map((team) => [team.teamId, team] as const));
  const sellTeamById = new Map((sellPreview?.teams ?? []).map((team) => [team.teamId, team] as const));
  const teams = teamIds
    .map((teamId) =>
      buildTeamEntry({
        buyTeam: buyTeamById.get(teamId),
        sellTeam: sellTeamById.get(teamId),
        teamScope: previewParams.teamScope ?? "ai",
        buyScanSkipped: skipBuyScan,
        sellScanSkipped: skipSellScan,
        gameState,
      }),
    )
    .filter((entry): entry is AiMarketPlanTeamEntry => Boolean(entry))
    .sort((left, right) => {
      const rank = ["sell_then_buy", "buy_only", "sell_only", "hold", "warning", "blocked"];
      const statusDelta = rank.indexOf(left.status) - rank.indexOf(right.status);
      if (statusDelta !== 0) {
        return statusDelta;
      }
      return left.teamName.localeCompare(right.teamName, "de");
    });

  const seasonId = previewParams.seasonId ?? buyPreview?.scope.seasonId ?? sellPreview?.scope.seasonId ?? "";
  const saveId = previewParams.saveId ?? buyPreview?.scope.saveId ?? sellPreview?.scope.saveId ?? "";
  const unifiedTeams = await overlayUnifiedCompareBuyPlans({
    teams,
    saveId,
    seasonId,
    buyPreview,
  });

  return {
    readOnly: true,
    source: buyPreview?.source ?? sellPreview?.source ?? previewParams.source ?? "sqlite",
    scope: buyPreview?.scope ?? sellPreview?.scope ?? {
      saveId: previewParams.saveId ?? "",
      seasonId: previewParams.seasonId ?? "",
      teamId: previewParams.teamId ?? null,
      teamScope: previewParams.teamScope ?? "ai",
    },
    totalTeams: teams.length,
    aiTeams: teams.filter((team) => team.controlMode === "ai").length,
    skippedManual: buyPreview?.skippedManual ?? sellPreview?.skippedManual ?? teams.filter((team) => team.controlMode === "manual").length,
    skippedPassive: buyPreview?.skippedPassive ?? sellPreview?.skippedPassive ?? teams.filter((team) => team.controlMode === "passive").length,
    skippedDisabled: Math.max(
      buyPreview?.skippedDisabled ?? 0,
      sellPreview?.skippedDisabled ?? 0,
      teams.filter((team) => team.controlMode === "ai" && (!team.aiTransferPreviewEnabled || !team.aiSellPreviewEnabled)).length,
    ),
    holdTeams: teams.filter((team) => team.status === "hold").length,
    buyOnlyTeams: teams.filter((team) => team.status === "buy_only").length,
    sellOnlyTeams: teams.filter((team) => team.status === "sell_only").length,
    sellThenBuyTeams: teams.filter((team) => team.status === "sell_then_buy").length,
    warningTeams: teams.filter((team) => team.status === "warning").length,
    blockedTeams: teams.filter((team) => team.status === "blocked").length,
    summary: {
      aiTeams: teams.filter((team) => team.controlMode === "ai").length,
      ready: teams.filter((team) => team.status === "buy_only" || team.status === "sell_only" || team.status === "sell_then_buy").length,
      hold: teams.filter((team) => team.status === "hold").length,
      buyOnly: teams.filter((team) => team.status === "buy_only").length,
      sellOnly: teams.filter((team) => team.status === "sell_only").length,
      sellThenBuy: teams.filter((team) => team.status === "sell_then_buy").length,
      warning: teams.filter((team) => team.status === "warning").length,
      blocked: teams.filter((team) => team.status === "blocked").length,
    },
    teams: unifiedTeams,
  };
}
