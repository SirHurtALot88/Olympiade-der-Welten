import type { GameInboxItem, GameState } from "@/lib/data/olyDataTypes";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

export type InboxQuickActionKind = "apply" | "navigate" | "dismiss";

export type InboxQuickAction = {
  id: string;
  label: string;
  detail: string;
  kind: InboxQuickActionKind;
};

export type InboxQuickActionResult = {
  gameState: GameState;
  message: string;
  applied: boolean;
};

const HEALTH_SOURCES_WITH_LIGHT_TRAINING = new Set([
  "player_health_fatigue_risk",
  "player_health_training_load",
  "player_health_lineup_rest",
]);

function setPlayerTrainingMode(gameState: GameState, playerId: string, mode: PlayerTrainingMode): GameState {
  return {
    ...gameState,
    players: gameState.players.map((player) => (player.id === playerId ? { ...player, trainingMode: mode } : player)),
  };
}

export function getInboxQuickActions(item: GameInboxItem): InboxQuickAction[] {
  const actions: InboxQuickAction[] = [];

  if (item.source.startsWith("player_health_")) {
    if (item.source === "player_health_injury") {
      actions.push({
        id: "open-lineup",
        label: "Lineup prüfen",
        detail: "Verletzten Spieler aus der Einsatzliste nehmen.",
        kind: "navigate",
      });
    } else if (HEALTH_SOURCES_WITH_LIGHT_TRAINING.has(item.source)) {
      actions.push({
        id: "apply-training-light",
        label: "Training leicht",
        detail: "Trainingsmodus auf Leicht setzen und speichern.",
        kind: "apply",
      });
      if (item.source === "player_health_lineup_rest") {
        actions.push({
          id: "open-lineup",
          label: "Spieler pausieren",
          detail: "Spieler aus dem Lineup nehmen.",
          kind: "navigate",
        });
      }
    }
    actions.push({
      id: "dismiss-later",
      label: "Später",
      detail: "Aufgabe vorerst ausblenden.",
      kind: "dismiss",
    });
    return actions;
  }

  if (item.source === "lineup_drafts" && item.itemId.includes("lineup_not_submitted")) {
    actions.push({
      id: "open-lineup",
      label: "Lineup bestätigen",
      detail: "Zur Einsatzliste springen und bestätigen.",
      kind: "navigate",
    });
  }

  if (item.ctaLabel && item.targetView) {
    actions.push({
      id: "open-target",
      label: item.ctaLabel,
      detail: `Springe zu ${item.targetView}.`,
      kind: "navigate",
    });
  }

  return actions;
}

export function applyInboxQuickAction(
  gameState: GameState,
  item: GameInboxItem,
  actionId: string,
): InboxQuickActionResult {
  if (actionId === "apply-training-light") {
    const playerId = item.playerId;
    if (!playerId) {
      return { gameState, message: "Kein Spieler für diese Aktion.", applied: false };
    }
    const nextGameState = setPlayerTrainingMode(gameState, playerId, "leicht");
    return {
      gameState: nextGameState,
      message: `${playerId}: Training auf Leicht gesetzt.`,
      applied: true,
    };
  }

  return {
    gameState,
    message: "Keine direkte Apply-Aktion.",
    applied: false,
  };
}

export function mapInboxQuickActionsToChoices(item: GameInboxItem) {
  return getInboxQuickActions(item).map((action) => ({
    id: action.id,
    label: action.label,
    detail: action.detail,
  }));
}
