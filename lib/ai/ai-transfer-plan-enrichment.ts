import {
  evaluateAiBuyDecision,
  getWeakestSameAxisOvrRank,
  type AiBuyDecisionResult,
} from "@/lib/ai/ai-buy-decision-engine";
import {
  adjustSellScoreForDoctrine,
  compareStrategicBuyCandidates,
  resolveTransferDoctrine,
  type TransferDoctrineProfile,
} from "@/lib/ai/ai-transfer-doctrine-layer";
import {
  buildReplacementSlotsFromHistory,
  buildReplacementSlotsFromPlannedSells,
  markReplacementSlotFulfilled,
  type ReplacementSlot,
} from "@/lib/ai/ai-transfer-replacement-memory";
import type { AiSellPreviewCandidate } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import type { AiTransferPreviewRecommendation } from "@/lib/ai/ai-transfermarkt-preview-service";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import type { GameState, Player } from "@/lib/data/olyDataTypes";

export type EnrichedBuyRecommendation = AiTransferPreviewRecommendation & {
  buyIntentScore?: number | null;
  passIntentScore?: number | null;
  replacementFitScore?: number | null;
  strategicBuyScore?: number | null;
  buyDecisionLabel?: string | null;
  replacementSlotId?: string | null;
  reasonToBuy?: string[];
  reasonToPass?: string[];
};

export type DoctrineAdjustedSellCandidate = AiSellPreviewCandidate & {
  strategicSellScore?: number | null;
};

function getPlayerAxis(player: Player | null): "pow" | "spe" | "men" | "soc" | null {
  if (!player) return null;
  const entries = Object.entries(player.coreStats) as Array<["pow" | "spe" | "men" | "soc", number]>;
  const top = [...entries].sort((left, right) => right[1] - left[1])[0];
  return top?.[0] ?? null;
}

export function resolveTeamReplacementSlots(input: {
  gameState: GameState;
  teamId: string;
  plannedSells?: AiSellPreviewCandidate[];
}) {
  const historySlots = buildReplacementSlotsFromHistory(input.gameState, input.teamId);
  return buildReplacementSlotsFromPlannedSells({
    teamId: input.teamId,
    gameState: input.gameState,
    plannedSells: input.plannedSells ?? [],
    existingSlots: historySlots,
  });
}

export function applyDoctrineToSellCandidates(input: {
  candidates: AiSellPreviewCandidate[];
  doctrine: TransferDoctrineProfile;
}): DoctrineAdjustedSellCandidate[] {
  return [...input.candidates]
    .map((candidate) => {
      const baseScore = candidate.sellPriority ?? candidate.sellPriorityScore ?? 0;
      const strategicSellScore = adjustSellScoreForDoctrine({
        baseScore,
        reasonToSell: candidate.reasonToSell,
        reasonToKeep: candidate.reasonToKeep,
        doctrine: input.doctrine,
      });
      return { ...candidate, strategicSellScore };
    })
    .sort((left, right) => (right.strategicSellScore ?? 0) - (left.strategicSellScore ?? 0));
}

export function annotateBuyRecommendations(input: {
  gameState: GameState;
  teamId: string;
  recommendations: AiTransferPreviewRecommendation[];
  doctrine: TransferDoctrineProfile;
  replacementSlots: ReplacementSlot[];
  rosterAfterSell: number | null;
  playerMin: number | null;
  playerOpt: number | null;
  teamCash: number | null;
  cashAfterSell: number | null;
  plannedSellCount: number;
  rosterPlayerIds: string[];
  coversNeedAxis?: (candidate: AiTransferPreviewRecommendation, player: Player | null) => boolean;
}): EnrichedBuyRecommendation[] {
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const ratingsById = buildPlayerRatingContractMap(input.gameState);

  return input.recommendations.map((candidate) => {
    const player = playersById.get(candidate.playerId) ?? null;
    const candidateRating = ratingsById.get(candidate.playerId) ?? null;
    const playerAxis = getPlayerAxis(player);
    const weakestSameAxisOvrRank = getWeakestSameAxisOvrRank({
      playerAxis,
      rosterPlayerIds: input.rosterPlayerIds,
      playersById,
      ratingsById,
    });
    const decision = evaluateAiBuyDecision({
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      price: candidate.price,
      marketValue: candidate.marketValue,
      salary: candidate.salary,
      ovr: candidate.ovr,
      score: candidate.overallRecommendationScore ?? candidate.score,
      rosterAfterSell: input.rosterAfterSell,
      playerMin: input.playerMin,
      playerOpt: input.playerOpt,
      teamCash: input.teamCash,
      cashAfterSell: input.cashAfterSell,
      plannedSellCount: input.plannedSellCount,
      weakestSameAxisOvrRank,
      candidateRating,
      player,
      replacementSlots: input.replacementSlots,
      doctrine: input.doctrine,
      coversNeedAxis: input.coversNeedAxis?.(candidate, player) ?? Boolean(candidate.needMatchLabel),
      isTrashCandidate: (candidate.overallRecommendationScore ?? candidate.score ?? 0) < 28,
    });

    return applyBuyDecisionToRecommendation(candidate, decision);
  });
}

export function enrichBuyRecommendations(input: {
  gameState: GameState;
  teamId: string;
  recommendations: AiTransferPreviewRecommendation[];
  doctrine: TransferDoctrineProfile;
  replacementSlots: ReplacementSlot[];
  rosterAfterSell: number | null;
  playerMin: number | null;
  playerOpt: number | null;
  teamCash: number | null;
  cashAfterSell: number | null;
  plannedSellCount: number;
  rosterPlayerIds: string[];
  coversNeedAxis?: (candidate: AiTransferPreviewRecommendation, player: Player | null) => boolean;
}): EnrichedBuyRecommendation[] {
  return annotateBuyRecommendations(input).sort((left, right) => compareStrategicBuyCandidates(left, right));
}

function applyBuyDecisionToRecommendation(
  candidate: AiTransferPreviewRecommendation,
  decision: AiBuyDecisionResult,
): EnrichedBuyRecommendation {
  const strategyNotes = [...(candidate.strategyNotes ?? [])];
  if (decision.buyDecisionLabel && !strategyNotes.includes(decision.buyDecisionLabel)) {
    strategyNotes.unshift(decision.buyDecisionLabel);
  }

  return {
    ...candidate,
    buyIntentScore: decision.buyIntentScore,
    passIntentScore: decision.passIntentScore,
    replacementFitScore: decision.replacementFitScore,
    strategicBuyScore: decision.strategicBuyScore,
    buyDecisionLabel: decision.buyDecisionLabel,
    replacementSlotId: decision.replacementSlotId,
    reasonToBuy: decision.reasonToBuy,
    reasonToPass: decision.reasonToPass,
    strategyNotes,
    reason:
      decision.reasonToBuy[0] ??
      candidate.reason ??
      (decision.strategicBuyScore >= 35 ? "strategischer Kauf" : candidate.reason),
  };
}

export function chooseSwapAwarePackages(input: {
  sellCandidates: DoctrineAdjustedSellCandidate[];
  buyCandidates: EnrichedBuyRecommendation[];
  chosenSells: DoctrineAdjustedSellCandidate[];
  chosenBuys: EnrichedBuyRecommendation[];
  replacementSlots: ReplacementSlot[];
  rosterNetQualityLoss?: (sell: DoctrineAdjustedSellCandidate, buy: EnrichedBuyRecommendation) => number;
}) {
  if (input.chosenSells.length === 0 || input.chosenBuys.length === 0) {
    return {
      sells: input.chosenSells,
      buys: input.chosenBuys,
      swapReason: null as string | null,
      replacementSlots: input.replacementSlots,
    };
  }

  const topSells = input.sellCandidates.slice(0, 3);
  const topBuys = input.buyCandidates.slice(0, 5);
  let bestPackage: {
    sell: DoctrineAdjustedSellCandidate;
    buy: EnrichedBuyRecommendation;
    score: number;
  } | null = null;

  for (const sell of topSells) {
    for (const buy of topBuys) {
      const sellScore = sell.strategicSellScore ?? sell.sellPriority ?? 0;
      const buyScore = buy.strategicBuyScore ?? buy.overallRecommendationScore ?? 0;
      const replacementBonus = buy.replacementFitScore ?? 0;
      const qualityLoss = input.rosterNetQualityLoss?.(sell, buy) ?? 0;
      const packageScore = sellScore + buyScore + replacementBonus - qualityLoss;
      if (!bestPackage || packageScore > bestPackage.score) {
        bestPackage = { sell, buy, score: packageScore };
      }
    }
  }

  const isolatedScore =
    (input.chosenSells[0]?.strategicSellScore ?? input.chosenSells[0]?.sellPriority ?? 0) +
    (input.chosenBuys[0]?.strategicBuyScore ?? input.chosenBuys[0]?.overallRecommendationScore ?? 0);

  if (!bestPackage || bestPackage.score <= isolatedScore + 4) {
    return {
      sells: input.chosenSells,
      buys: input.chosenBuys,
      swapReason: null as string | null,
      replacementSlots: input.replacementSlots,
    };
  }

  const sells = uniqueByPlayerId([bestPackage.sell, ...input.chosenSells]).slice(0, input.chosenSells.length);
  let slots = input.replacementSlots;
  const buys: EnrichedBuyRecommendation[] = [];
  const usedBuyIds = new Set<string>();

  for (const buy of [bestPackage.buy, ...input.chosenBuys]) {
    if (usedBuyIds.has(buy.playerId)) continue;
    buys.push(buy);
    usedBuyIds.add(buy.playerId);
    slots = markReplacementSlotFulfilled(slots, buy.replacementSlotId ?? null);
    if (buys.length >= input.chosenBuys.length) break;
  }

  const sellReason = bestPackage.sell.reasonToSell[0] ?? bestPackage.sell.strategyFitSummary;
  const buyReason = bestPackage.buy.reasonToBuy?.[0] ?? bestPackage.buy.reason ?? bestPackage.buy.buyDecisionLabel ?? "strategischer Kauf";
  const swapReason = `Tausch: ${sellReason} -> ${buyReason}`;

  return { sells, buys, swapReason, replacementSlots: slots };
}

function uniqueByPlayerId<T extends { playerId: string }>(items: T[]) {
  const seen = new Set<string>();
  const uniqueItems: T[] = [];
  for (const item of items) {
    if (seen.has(item.playerId)) continue;
    seen.add(item.playerId);
    uniqueItems.push(item);
  }
  return uniqueItems;
}

export function loadDoctrineContext(gameState: GameState, teamId: string) {
  return resolveTransferDoctrine(gameState, teamId);
}
