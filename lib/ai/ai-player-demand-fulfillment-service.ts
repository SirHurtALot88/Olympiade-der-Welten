import type { GameState, Player, PlayerDemandRecord, TeamCaptainRecord } from "@/lib/data/olyDataTypes";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildTeamPlayerDemandMap } from "@/lib/morale/player-demands-service";
import type { PlayerTrainingMode as TrainingMode } from "@/lib/training/training-plan-types";

const CAPTAIN_POSITIVE_TRAITS = new Set(["eloquent", "motivated", "ambitious", "disciplined", "resourceful", "loyal"]);

function stableDemandFulfillmentHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeTrait(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getTraits(player: Pick<Player, "traitsPositive" | "traitsNegative">) {
  return [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])].map(normalizeTrait).filter(Boolean);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function shouldAiAttemptDemandFulfillment(gameState: GameState, demand: PlayerDemandRecord, probabilityPct = 38) {
  const key = [gameState.season.id, demand.teamId, demand.demandId, "ai-demand-fulfill"].join(":");
  return stableDemandFulfillmentHash(key) % 100 < probabilityPct;
}

function buildCaptainRecordForPlayer(gameState: GameState, teamId: string, player: Player): TeamCaptainRecord {
  const ratings = buildPlayerRatingContractMap(gameState);
  const traits = getTraits(player);
  const stats = player.attributeSheetStats;
  const traitBonus = traits.reduce(
    (sum, trait) => sum + (CAPTAIN_POSITIVE_TRAITS.has(trait) ? 4 : trait === "renegade" || trait === "scandalous" ? 1.5 : 0),
    0,
  );
  const leadershipScore = round(
    (stats?.charisma ?? player.coreStats.soc ?? 0) * 0.32 +
      (stats?.will ?? player.coreStats.men ?? 0) * 0.2 +
      (stats?.determination ?? player.coreStats.pow ?? 0) * 0.18 +
      (stats?.awareness ?? player.coreStats.men ?? 0) * 0.16 +
      (ratings.get(player.id)?.mvs ?? player.ovr ?? 0) * 0.08 +
      traitBonus,
    1,
  );
  const style =
    traits.includes("eloquent") || (stats?.charisma ?? 0) >= 70
      ? "inspirer"
      : traits.includes("renegade") || traits.includes("scandalous") || (stats?.torment ?? 0) >= 65
        ? "enforcer"
        : (stats?.awareness ?? 0) >= 70 || (stats?.intelligence ?? 0) >= 70
          ? "operator"
          : traits.includes("gambler")
            ? "wildcard"
            : "leader";

  return {
    seasonId: gameState.season.id,
    teamId,
    playerId: player.id,
    playerName: player.name,
    leadershipScore,
    style,
    effects: {
      moraleBuffer: round(clamp(leadershipScore / 18, 1, 6), 1),
      rivalryPressureReductionPct: round(clamp(leadershipScore / 3.5, 4, 24), 1),
      teamPowerModifierPct: round(clamp(leadershipScore / 9, 1, 8), 1),
      conflictSoftenChancePct: round(clamp(leadershipScore / 2.5, 6, 32), 1),
    },
    traitSignals: traits.filter((trait) => CAPTAIN_POSITIVE_TRAITS.has(trait) || ["renegade", "scandalous", "gambler"].includes(trait)).slice(0, 4),
    source: "ai_demand_fulfillment_captain",
  };
}

function setPlayerTrainingMode(gameState: GameState, playerId: string, mode: TrainingMode): GameState {
  return {
    ...gameState,
    players: gameState.players.map((player) => (player.id === playerId ? { ...player, trainingMode: mode } : player)),
  };
}

function assignTeamCaptain(gameState: GameState, teamId: string, captain: TeamCaptainRecord): GameState {
  const existing = (gameState.teamCaptains ?? []).filter(
    (entry) => !(entry.seasonId === gameState.season.id && entry.teamId === teamId),
  );
  return {
    ...gameState,
    teamCaptains: [...existing, captain],
  };
}

export type AiPlayerDemandFulfillmentResult = {
  gameState: GameState;
  fulfilledDemandIds: string[];
  reasons: string[];
};

export function applyAiTeamPlayerDemandFulfillment(input: {
  gameState: GameState;
  teamId: string;
  probabilityPct?: number;
}): AiPlayerDemandFulfillmentResult {
  const controlMode = input.gameState.seasonState.teamControlSettings?.[input.teamId]?.controlMode ?? "ai";
  if (controlMode === "manual") {
    return { gameState: input.gameState, fulfilledDemandIds: [], reasons: [] };
  }

  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const demandMap = buildTeamPlayerDemandMap(input.gameState, input.teamId);
  let nextGameState = input.gameState;
  const fulfilledDemandIds: string[] = [];
  const reasons: string[] = [];

  for (const [playerId, demands] of demandMap.entries()) {
    const player = playersById.get(playerId);
    if (!player) continue;

    for (const demand of demands) {
      if (demand.status === "fulfilled" || demand.status === "failed") continue;
      if (!shouldAiAttemptDemandFulfillment(nextGameState, demand, input.probabilityPct)) continue;

      if (demand.type === "training_mode" && typeof demand.targetValue === "string") {
        const preferredMode = demand.targetValue as TrainingMode;
        if ((player.trainingMode ?? "mittel") !== preferredMode) {
          nextGameState = setPlayerTrainingMode(nextGameState, playerId, preferredMode);
          fulfilledDemandIds.push(demand.demandId);
          reasons.push(`${player.name}: Trainingsmodus → ${preferredMode}`);
        }
        continue;
      }

      if (demand.type === "captaincy") {
        const currentCaptain = (nextGameState.teamCaptains ?? []).find(
          (entry) => entry.seasonId === nextGameState.season.id && entry.teamId === input.teamId,
        );
        if (currentCaptain?.playerId !== playerId) {
          nextGameState = assignTeamCaptain(nextGameState, input.teamId, buildCaptainRecordForPlayer(nextGameState, input.teamId, player));
          fulfilledDemandIds.push(demand.demandId);
          reasons.push(`${player.name}: Captain-Rolle übernommen`);
        }
      }
    }
  }

  return { gameState: nextGameState, fulfilledDemandIds, reasons };
}

export function applyAiLeaguePlayerDemandFulfillment(gameState: GameState, probabilityPct = 38): GameState {
  let next = gameState;
  for (const team of gameState.teams) {
    const result = applyAiTeamPlayerDemandFulfillment({ gameState: next, teamId: team.teamId, probabilityPct });
    next = result.gameState;
  }
  return next;
}
