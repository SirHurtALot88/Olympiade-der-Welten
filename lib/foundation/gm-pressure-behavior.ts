import type { GameState, TeamGeneralManagerProfile, TeamIdentity } from "@/lib/data/olyDataTypes";
import { buildGmStoryView } from "@/lib/foundation/gm-story";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { isBoardObjectivesV2Enabled } from "@/lib/board/board-objectives-config";

export type GmPressureLevel = "stable" | "watch" | "hot";

export type GmPressureBehavior = {
  pressureLevel: GmPressureLevel;
  isHotSeat: boolean;
  concedeDemandsMultiplier: number;
  chaseBoardObjectivesMultiplier: number;
  sellCoreUnderPressure: boolean;
  acceptPlayerDemandsUnderPressure: boolean;
  warning: string | null;
  softBlockStarSell: boolean;
  detail: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getBoardPressure(identity: TeamIdentity | null) {
  return clamp((10 - (identity?.boardConfidence ?? 5)) / 10, 0, 1);
}

function archetypePressureStyle(profile: TeamGeneralManagerProfile | null): {
  concedeBoost: number;
  objectiveBoost: number;
  sellCore: boolean;
} {
  switch (profile?.archetype) {
    case "risk_gambler":
      return { concedeBoost: 0.15, objectiveBoost: 0.35, sellCore: true };
    case "star_chaser":
      return { concedeBoost: 0.2, objectiveBoost: 0.3, sellCore: false };
    case "culture_keeper":
      return { concedeBoost: 0.28, objectiveBoost: 0.12, sellCore: false };
    case "bargain_hunter":
      return { concedeBoost: 0.08, objectiveBoost: 0.18, sellCore: true };
    case "systems_tinkerer":
      return { concedeBoost: 0.1, objectiveBoost: 0.22, sellCore: false };
    default:
      return { concedeBoost: 0.12, objectiveBoost: 0.18, sellCore: false };
  }
}

export function resolveGmPressureBehavior(gameState: GameState, teamId: string): GmPressureBehavior {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId) ?? null;
  const gm = getTeamGeneralManager(gameState, teamId);
  // Bug #1 fix (V2 only): read the DYNAMIC per-season board state (how the team is actually doing)
  // instead of the static identity seed, which ignored in-season performance entirely. V1 keeps the
  // legacy static-seed behaviour so nothing shifts with the flag off.
  const dynamicBoard = isBoardObjectivesV2Enabled() ? gameState.seasonState.boardConfidence?.[teamId] ?? null : null;
  const boardPressure = dynamicBoard
    ? clamp((dynamicBoard.perceivedPressure ?? dynamicBoard.pressure) / 10, 0, 1)
    : getBoardPressure(identity);
  const boardConfidenceValue = dynamicBoard ? dynamicBoard.value : identity?.boardConfidence ?? 5;
  const story = buildGmStoryView({
    source: gm?.assignment.source ?? null,
    previousGmId: gm?.assignment.previousGmId ?? null,
    dismissalReason: gm?.assignment.dismissalReason ?? null,
    boardPressure: boardPressure * 10,
    boardConfidenceValue: boardConfidenceValue * 10,
  });
  const style = archetypePressureStyle(gm?.profile ?? null);

  const pressureLevel: GmPressureLevel =
    story.tone === "hot" ? "hot" : story.tone === "watch" || story.tone === "new" ? "watch" : "stable";

  const hotSeatBoost = story.isHotSeat ? 0.35 : pressureLevel === "watch" ? 0.15 : 0;
  const concedeDemandsMultiplier = clamp(1 + hotSeatBoost + style.concedeBoost, 1, 1.75);
  const chaseBoardObjectivesMultiplier = clamp(1 + hotSeatBoost + style.objectiveBoost, 1, 1.9);

  const acceptPlayerDemandsUnderPressure = pressureLevel !== "stable";
  const sellCoreUnderPressure = story.isHotSeat && style.sellCore;

  let warning: string | null = null;
  if (story.isHotSeat) {
    warning =
      gm?.profile?.archetype === "culture_keeper"
        ? "GM unter Druck: geht eher auf Spielerforderungen ein, um Ruhe zu halten."
        : gm?.profile?.archetype === "risk_gambler"
          ? "GM unter Druck: rotiert aggressiver, um Boardziele zu retten."
          : "GM unter Druck: Verkauf eines Core-Spielers kann das Mandat gefaehrden.";
  } else if (pressureLevel === "watch") {
    warning = "Board beobachtet: unpopulaere Verkäufe erhöhen den Druck.";
  }

  return {
    pressureLevel,
    isHotSeat: story.isHotSeat,
    concedeDemandsMultiplier,
    chaseBoardObjectivesMultiplier,
    sellCoreUnderPressure,
    acceptPlayerDemandsUnderPressure,
    warning,
    softBlockStarSell: story.isHotSeat && !sellCoreUnderPressure,
    detail: story.detail,
  };
}

// Hinweis (Bug #3, Konsolidierung): Die frühere `evaluateGmTransferBalanceRisk` war verwaist —
// ihre Logik ist als einzige Quelle der Wahrheit in team-general-managers.ts reimplementiert
// (getTeamSeasonTransferStats + applyTransferBalanceRiskToReplacementProbability), das direkt in
// die Rauswurf-Wahrscheinlichkeit fließt. Der Orphan hatte keinen Aufrufer und ist entfernt.

export function applyGmPressureDemandConcession(input: {
  baseScore: number;
  pressure: GmPressureBehavior;
  demandPriority: "high" | "medium" | "low";
}) {
  if (!input.pressure.acceptPlayerDemandsUnderPressure) {
    return input.baseScore;
  }
  const priorityBoost = input.demandPriority === "high" ? 0.22 : input.demandPriority === "medium" ? 0.12 : 0.05;
  return clamp(input.baseScore + priorityBoost * (input.pressure.concedeDemandsMultiplier - 1), 0, 1);
}
