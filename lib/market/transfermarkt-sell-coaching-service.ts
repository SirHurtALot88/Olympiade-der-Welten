import type { AiSellPreviewCandidate } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import { buildSellCoachingCandidateForActivePlayer } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import type { ReplacementSlot } from "@/lib/ai/ai-transfer-replacement-memory";
import { buildReplacementSlotsFromPlannedSells } from "@/lib/ai/ai-transfer-replacement-memory";
import type { GameState } from "@/lib/data/olyDataTypes";
import { resolveGmPressureBehavior } from "@/lib/foundation/gm-pressure-behavior";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { resolveTransferDoctrine } from "@/lib/ai/ai-transfer-doctrine-layer";
import { computeSellBoardReaction, type SellBoardReaction } from "@/lib/market/transfermarkt-sell-board-reaction";
import type { SellPricingPolicyBreakdown } from "@/lib/market/transfermarkt-sell-pricing-policy";

export type TransfermarktSellCoachingView = {
  doctrinePersona: string;
  doctrineHint: string;
  strategyFitSummary: string;
  sellDecisionLabel: string | null;
  sellPriority: number | null;
  sellIntentScore: number | null;
  keepIntentScore: number | null;
  reasonsToSell: string[];
  reasonsToKeep: string[];
  coachingWarnings: string[];
  boardTrustPolicy: string | null;
  boardTrustSmiley: string | null;
  boardReaction: SellBoardReaction;
  gmName: string | null;
  gmArchetype: string | null;
  gmPressureLevel: string;
  gmWarning: string | null;
  gmDetail: string | null;
  gmSoftBlockStarSell: boolean;
  replacementSlot: ReplacementSlot | null;
  pricingPolicyNotes: string[];
  soldPlayerSeasonBanNote: string;
};

export function buildTransfermarktSellCoachingView(input: {
  gameState: GameState;
  teamId: string;
  activePlayerId: string;
  playerName: string;
  profit: number | null;
  pricingPolicy?: SellPricingPolicyBreakdown | null;
}): TransfermarktSellCoachingView | null {
  const candidate = buildSellCoachingCandidateForActivePlayer({
    gameState: input.gameState,
    teamId: input.teamId,
    activePlayerId: input.activePlayerId,
  });
  if (!candidate) {
    return null;
  }

  const doctrine = resolveTransferDoctrine(input.gameState, input.teamId);
  const gm = getTeamGeneralManager(input.gameState, input.teamId);
  const gmPressure = resolveGmPressureBehavior(input.gameState, input.teamId);
  const boardReaction = computeSellBoardReaction({
    coaching: candidate,
    playerName: input.playerName,
    profit: input.profit,
  });
  const replacementSlots = buildReplacementSlotsFromPlannedSells({
    teamId: input.teamId,
    gameState: input.gameState,
    plannedSells: [candidate],
    maxSlots: 1,
  });

  return {
    doctrinePersona: doctrine.persona,
    doctrineHint: doctrine.personaHint,
    strategyFitSummary: candidate.strategyFitSummary,
    sellDecisionLabel: candidate.sellDecisionLabel ?? null,
    sellPriority: candidate.sellPriority ?? null,
    sellIntentScore: candidate.sellIntentScore ?? null,
    keepIntentScore: candidate.keepIntentScore ?? null,
    reasonsToSell: candidate.reasonsToSell,
    reasonsToKeep: candidate.reasonsToKeep,
    coachingWarnings: candidate.warnings,
    boardTrustPolicy: candidate.boardTrustPolicy ?? null,
    boardTrustSmiley: candidate.boardTrustSmiley ?? null,
    boardReaction,
    gmName: gm?.profile.name ?? null,
    gmArchetype: gm?.profile.archetype ?? null,
    gmPressureLevel: gmPressure.pressureLevel,
    gmWarning: gmPressure.warning,
    gmDetail: gmPressure.detail,
    gmSoftBlockStarSell: gmPressure.softBlockStarSell,
    replacementSlot: replacementSlots[0] ?? null,
    pricingPolicyNotes: input.pricingPolicy?.notes ?? [],
    soldPlayerSeasonBanNote:
      "Nach dem Verkauf ist der Spieler fuer die restliche Saison fuer alle Teams nicht kaufbar.",
  };
}

export type { AiSellPreviewCandidate };
