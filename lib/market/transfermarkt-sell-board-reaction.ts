import { randomUUID } from "node:crypto";

import type { AiSellPreviewCandidate } from "@/lib/ai/ai-transfermarkt-sell-preview-service";
import type { GameInboxItem, GameState } from "@/lib/data/olyDataTypes";
import { hasKeepReason } from "@/lib/ai/ai-transfer-reason-codes";

export type SellBoardReaction = {
  confidenceDelta: number;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  gmNote: string | null;
  requiresStrongAcknowledgment: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function computeSellBoardReaction(input: {
  coaching: AiSellPreviewCandidate | null;
  playerName: string;
  profit: number | null;
}): SellBoardReaction {
  const coaching = input.coaching;
  if (!coaching) {
    return {
      confidenceDelta: 0,
      severity: "info",
      title: "Vorstand registriert Verkauf",
      description: `${input.playerName} verlaesst den Kader.`,
      gmNote: null,
      requiresStrongAcknowledgment: false,
    };
  }

  const starProtected = hasKeepReason(coaching.keepReasonCodes ?? [], "star_core_protection");
  const goodFit = hasKeepReason(coaching.keepReasonCodes ?? [], "good_team_fit");
  const profitWindow = (input.profit ?? 0) > 0;
  let confidenceDelta = 0;
  let severity: SellBoardReaction["severity"] = "info";
  let requiresStrongAcknowledgment = false;

  if (starProtected && !profitWindow) {
    confidenceDelta -= 0.55;
    severity = "critical";
    requiresStrongAcknowledgment = true;
  } else if (starProtected && profitWindow) {
    confidenceDelta -= 0.2;
    severity = "warning";
  } else if (goodFit && (input.profit ?? 0) < 0) {
    confidenceDelta -= 0.35;
    severity = "warning";
    requiresStrongAcknowledgment = true;
  } else if (profitWindow) {
    confidenceDelta += 0.15;
  } else if (coaching.sellPriority >= 65) {
    confidenceDelta += 0.05;
  }

  if (coaching.boardTrustPolicy === "do_not_renew") {
    confidenceDelta += 0.1;
  }

  const title =
    severity === "critical"
      ? "Vorstand kritisiert Core-Verkauf"
      : profitWindow
        ? "Vorstand akzeptiert Profite realisiert"
        : "Vorstand registriert Verkauf";

  const description =
    severity === "critical"
      ? `${input.playerName} war ein geschuetzter Core-Spieler. Der Verkauf belastet das Board-Vertrauen.`
      : profitWindow
        ? `${input.playerName} wurde mit Gewinn verkauft. Das Board sieht die Entscheidung eher positiv.`
        : `${input.playerName} verlaesst den Kader. Das Board beobachtet die sportliche Luecke.`;

  return {
    confidenceDelta: clamp(confidenceDelta, -1, 0.5),
    severity,
    title,
    description,
    gmNote: requiresStrongAcknowledgment ? "GM warnt: Dieser Verkauf kann das Mandat belasten." : null,
    requiresStrongAcknowledgment,
  };
}

export function applySellBoardReactionToGameState(input: {
  gameState: GameState;
  teamId: string;
  playerId: string;
  reaction: SellBoardReaction;
  saveId: string;
}): GameState {
  const nextIdentities = input.gameState.teamIdentities.map((identity) => {
    if (identity.teamId !== input.teamId) {
      return identity;
    }
    return {
      ...identity,
      boardConfidence: clamp(identity.boardConfidence + input.reaction.confidenceDelta, 0, 10),
    };
  });

  const inboxItem: GameInboxItem = {
    itemId: `inbox-sell-${randomUUID()}`,
    saveId: input.saveId,
    seasonId: input.gameState.season.id,
    matchday: input.gameState.season.currentMatchday ?? null,
    teamId: input.teamId,
    playerId: input.playerId,
    category: "transfer",
    severity: input.reaction.severity,
    title: input.reaction.title,
    description: input.reaction.description,
    ctaLabel: "Transfermarkt",
    targetView: "transfermarkt",
    targetParams: { teamId: input.teamId },
    status: "open",
    createdAt: new Date().toISOString(),
    source: "manual_transfermarkt_sell",
  };

  return {
    ...input.gameState,
    teamIdentities: nextIdentities,
    gameInboxItems: [inboxItem, ...(input.gameState.gameInboxItems ?? [])],
  };
}
