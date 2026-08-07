import type { GameState, ScenarioType } from "@/lib/data/olyDataTypes";
import {
  buildTeamControlSettingsMap,
  DEFAULT_ACTIVE_OWNER_ID,
} from "@/lib/foundation/team-control-settings";
import { allowsSandboxTestWrites } from "@/lib/persistence/sandbox-write-permissions";
import { inferScenarioType } from "@/lib/persistence/scenario-meta";

const AI_PRESEASON_OVERRIDE_SCENARIO_TYPES = new Set<ScenarioType>([
  "ai_redraft_test",
  "season1_simulation",
  "season_transition_test",
  "live_feature_test",
  "sandbox_multiseason_test",
  "sandbox_snapshot",
  "manager_multiplayer_test",
]);

export function getProtectedHumanTeamIds(gameState: GameState): Set<string> {
  return new Set(
    [
      gameState.seasonState.newGameFlow?.selectedTeamId ?? null,
      // GEMELDET: „und wieso ist M-S auch als mein team getaggt? Das ist ein AI Team!!! da ist
      // irgendwas durcheinander geraten durch das season ende"
      //
      // Hier stand `team.humanControlled !== false` — das ist auch fuer `undefined` wahr. Ein Team,
      // dessen Flag unterwegs verlorengeht (kompakte Payloads, Projektionen, aeltere Saves), galt
      // damit als Spieler-Team. Schlimmer: `protectManualPlayerTeams` SCHREIBT diese Annahme
      // zurueck — `humanControlled: true` plus `controlMode: "manual"`. Ein einziger Durchlauf
      // macht aus einem KI-Team dauerhaft ein Spieler-Team, und weil das Zusammenfuehren die
      // Beschriftung behaelt, steht dann „AI" an einem Team im Manual-Modus. Genau so sah M-S aus.
      //
      // „Im Zweifel schuetzen" waere richtig, wenn der Schutz nur LESEND waere. Er ist es nicht.
      // Deshalb zaehlt jetzt nur noch ein ausdrueckliches `true`. Echte Spieler-Teams verlieren
      // dadurch nichts: sie tragen das Flag (`new-game-setup-service.ts:395`) oder stehen unten
      // ueber `controlMode === "manual"` in den Kontrolleinstellungen.
      ...gameState.teams.filter((team) => team.humanControlled === true).map((team) => team.teamId),
      ...Object.values(gameState.seasonState.teamControlSettings ?? {})
        .filter((settings) => settings.controlMode === "manual")
        .map((settings) => settings.teamId),
    ].filter((teamId): teamId is string => Boolean(teamId)),
  );
}

export function allowsAiPreseasonManualTeamOverride(input: {
  saveId: string;
  gameState: GameState;
}): boolean {
  if (allowsSandboxTestWrites(input.gameState)) {
    return true;
  }

  const scenarioType = input.gameState.scenarioMeta?.scenarioType ?? inferScenarioType(input.gameState);
  if (AI_PRESEASON_OVERRIDE_SCENARIO_TYPES.has(scenarioType)) {
    return true;
  }

  return /smoke|sandbox|test|block-/i.test(input.saveId);
}

function buildProtectedManualControlSettings(
  teamId: string,
  team: GameState["teams"][number] | undefined,
  current: ReturnType<typeof buildTeamControlSettingsMap>[string] | undefined,
) {
  return {
    ...current,
    teamId,
    controlMode: "manual" as const,
    ownerId: current?.ownerId && current.ownerId !== "ai" ? current.ownerId : DEFAULT_ACTIVE_OWNER_ID,
    ownerSlot: current?.ownerSlot && current.ownerSlot !== "ai" ? current.ownerSlot : "user",
    displayLabel: current?.displayLabel ?? team?.shortCode ?? teamId,
    aiLineupPreviewEnabled: false,
    aiLineupApplyEnabled: false,
    aiLineupAutoApplyEnabled: false,
    aiTransferPreviewEnabled: false,
    aiTransferAutoApplyEnabled: false,
    aiSellPreviewEnabled: false,
    aiSellAutoApplyEnabled: false,
    notes: current?.notes ?? null,
    strategyLock: current?.strategyLock ?? null,
  };
}

function hasProtectedManualControlSettings(
  settings: ReturnType<typeof buildTeamControlSettingsMap>[string] | undefined,
): boolean {
  if (!settings || settings.controlMode !== "manual") {
    return false;
  }

  return (
    settings.aiLineupPreviewEnabled === false &&
    settings.aiLineupApplyEnabled === false &&
    settings.aiLineupAutoApplyEnabled === false &&
    settings.aiTransferPreviewEnabled === false &&
    settings.aiTransferAutoApplyEnabled === false &&
    settings.aiSellPreviewEnabled === false &&
    settings.aiSellAutoApplyEnabled === false
  );
}

function isFullyProtectedManualControlSettings(
  settings: ReturnType<typeof buildTeamControlSettingsMap>[string] | undefined,
): boolean {
  if (!settings || !hasProtectedManualControlSettings(settings)) {
    return false;
  }

  return settings.ownerId !== "ai" && settings.ownerSlot !== "ai";
}

export function protectManualPlayerTeams(gameState: GameState): GameState {
  const protectedHumanTeamIds = getProtectedHumanTeamIds(gameState);
  if (protectedHumanTeamIds.size === 0) {
    return gameState;
  }

  const existingControl = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  let teamsChanged = false;
  const nextTeams = gameState.teams.map((team) => {
    if (!protectedHumanTeamIds.has(team.teamId) || team.humanControlled) {
      return team;
    }
    teamsChanged = true;
    return { ...team, humanControlled: true };
  });

  let controlChanged = false;
  const forcedControlSettings = Object.fromEntries(
    [...protectedHumanTeamIds].map((teamId) => {
      const team = gameState.teams.find((entry) => entry.teamId === teamId);
      const current = existingControl[teamId];
      const nextSettings = buildProtectedManualControlSettings(teamId, team, current);

      if (isFullyProtectedManualControlSettings(current)) {
        return [teamId, current] as const;
      }

      controlChanged = true;
      return [teamId, nextSettings] as const;
    }),
  );

  if (!teamsChanged && !controlChanged) {
    return gameState;
  }

  return {
    ...gameState,
    teams: nextTeams,
    seasonState: {
      ...gameState.seasonState,
      teamControlSettings: {
        ...existingControl,
        ...forcedControlSettings,
      },
    },
  };
}
