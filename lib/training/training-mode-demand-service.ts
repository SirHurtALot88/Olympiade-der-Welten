import type { GameState, Player, PlayerDemandRecord, PlayerDemandStatus } from "@/lib/data/olyDataTypes";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { getTrainingModePresentation } from "@/lib/training/training-mode-presentation";

const LEICHT_BIAS_TRAITS = new Set(["lazy", "relaxed", "fainthearted", "timid", "caring", "paranoid"]);
const HART_BIAS_TRAITS = new Set(["ambitious", "motivated", "diligent", "disciplined", "firedup", "egomaniac", "obsessive", "feisty"]);
const LOW_MAINTENANCE_TRAITS = new Set(["loyal", "flexible", "fair"]);

function normalizeTrait(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getTraits(player: Pick<Player, "traitsPositive" | "traitsNegative">) {
  return [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])].map(normalizeTrait).filter(Boolean);
}

function hasTrait(player: Pick<Player, "traitsPositive" | "traitsNegative">, traits: Set<string>) {
  return getTraits(player).some((trait) => traits.has(trait));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export type TrainingModeDemandView = {
  demandId: string;
  preferredMode: PlayerTrainingMode;
  currentMode: PlayerTrainingMode;
  status: PlayerDemandStatus;
  label: string;
  detail: string;
  moraleReward: number;
  moralePenalty: number;
  priority: "low" | "medium" | "high";
  mismatchSeverity: 0 | 1 | 2;
};

export function getTrainingModeBiasScores(input: {
  player: Pick<Player, "traitsPositive" | "traitsNegative" | "fatigue" | "potential" | "age">;
  rosterRank?: number;
}) {
  let leicht = 0;
  let hart = 0;
  const traits = getTraits(input.player);

  for (const trait of traits) {
    if (LEICHT_BIAS_TRAITS.has(trait)) leicht += 2;
    if (HART_BIAS_TRAITS.has(trait)) hart += 2;
    if (LOW_MAINTENANCE_TRAITS.has(trait)) leicht += 1;
  }

  const fatigue = input.player.fatigue ?? 0;
  if (fatigue >= 75) leicht += 3;
  else if (fatigue >= 55) leicht += 2;
  else if (fatigue >= 40) leicht += 1;
  else if (fatigue <= 20 && traits.some((trait) => HART_BIAS_TRAITS.has(trait))) hart += 2;

  const potential = input.player.potential ?? 0;
  const age = input.player.age ?? 99;
  if (age <= 22 && potential >= 75) hart += 1;
  if (age >= 32) leicht += 1;

  const rosterRank = input.rosterRank ?? 99;
  if (rosterRank <= 3 && !traits.some((trait) => LEICHT_BIAS_TRAITS.has(trait))) {
    hart += 1;
  }

  return { leicht, hart };
}

export function resolvePreferredTrainingMode(input: {
  player: Pick<Player, "traitsPositive" | "traitsNegative" | "fatigue" | "potential" | "age">;
  rosterRank?: number;
}): PlayerTrainingMode | null {
  const { leicht, hart } = getTrainingModeBiasScores(input);
  const threshold = 2;
  if (leicht >= threshold && leicht > hart + 1) return "leicht";
  if (hart >= threshold && hart > leicht + 1) return "hart";
  return null;
}

export function getTrainingModeMismatchSeverity(
  currentMode: PlayerTrainingMode,
  preferredMode: PlayerTrainingMode,
): 0 | 1 | 2 {
  if (currentMode === preferredMode) return 0;
  const modes: PlayerTrainingMode[] = ["leicht", "mittel", "hart"];
  const gap = Math.abs(modes.indexOf(currentMode) - modes.indexOf(preferredMode));
  return gap >= 2 ? 2 : 1;
}

function resolveTrainingModeDemandStatus(input: {
  currentMode: PlayerTrainingMode;
  preferredMode: PlayerTrainingMode;
  mismatchSeverity: 0 | 1 | 2;
  matchdayIndex: number | null;
}): PlayerDemandStatus {
  if (input.mismatchSeverity === 0) return "fulfilled";
  if (input.mismatchSeverity === 1) {
    return input.matchdayIndex != null && input.matchdayIndex >= 3 ? "at_risk" : "open";
  }
  if (input.matchdayIndex != null && input.matchdayIndex >= 5) return "failed";
  if (input.matchdayIndex != null && input.matchdayIndex >= 2) return "at_risk";
  return "open";
}

export function buildTrainingModeDemand(input: {
  context: {
    seasonId: string;
    teamId: string;
    matchdayIndex?: number | null;
  };
  player: Pick<
    Player,
    "id" | "name" | "trainingMode" | "traitsPositive" | "traitsNegative" | "fatigue" | "potential" | "age"
  >;
  rosterRank?: number;
}): TrainingModeDemandView | null {
  const preferredMode = resolvePreferredTrainingMode({
    player: input.player,
    rosterRank: input.rosterRank,
  });
  if (!preferredMode) {
    return null;
  }

  const currentMode = input.player.trainingMode ?? "mittel";
  const mismatchSeverity = getTrainingModeMismatchSeverity(currentMode, preferredMode);
  const preferredLabel = getTrainingModePresentation(preferredMode).label;
  const currentLabel = getTrainingModePresentation(currentMode).label;
  const status = resolveTrainingModeDemandStatus({
    currentMode,
    preferredMode,
    mismatchSeverity,
    matchdayIndex: input.context.matchdayIndex ?? null,
  });

  const fatigue = input.player.fatigue ?? 0;
  const detail =
    preferredMode === "leicht"
      ? `${input.player.name} will wegen Erschoepfung (${Math.round(fatigue)}) oder Persoenlichkeit lieber ${preferredLabel} statt ${currentLabel}.`
      : `${input.player.name} will wegen Anspruch und Form lieber ${preferredLabel} statt ${currentLabel}.`;

  return {
    demandId: `${input.context.seasonId}:${input.context.teamId}:${input.player.id}:training_mode`,
    preferredMode,
    currentMode,
    status,
    label: preferredMode === "leicht" ? "Leichteres Training" : "Haerteres Training",
    detail,
    moraleReward: preferredMode === "leicht" ? 4 : 5,
    moralePenalty: mismatchSeverity === 2 ? -10 : -5,
    priority: mismatchSeverity === 2 ? "high" : "medium",
    mismatchSeverity,
  };
}

export function buildTrainingModeDemandRecord(input: Parameters<typeof buildTrainingModeDemand>[0]): PlayerDemandRecord | null {
  const demand = buildTrainingModeDemand(input);
  if (!demand) return null;
  return {
    demandId: demand.demandId,
    seasonId: input.context.seasonId,
    teamId: input.context.teamId,
    playerId: input.player.id,
    type: "training_mode",
    label: demand.label,
    detail: demand.detail,
    targetValue: demand.preferredMode,
    currentValue: demand.currentMode,
    status: demand.status,
    moraleReward: demand.moraleReward,
    moralePenalty: demand.moralePenalty,
    priority: demand.priority,
    source: "player_demands_v1_training_mode",
  };
}

export function buildTrainingModeDemandMap(gameState: GameState, teamId: string) {
  const rosterEntries = gameState.rosters.filter((entry) => entry.teamId === teamId);
  const rosterIds = new Set(rosterEntries.map((entry) => entry.playerId));
  const players = gameState.players.filter((player) => rosterIds.has(player.id));
  const currentSchedule =
    gameState.seasonState.disciplineSchedule?.find((entry) => entry.matchdayId === gameState.matchdayState.matchdayId) ?? null;
  const context = {
    seasonId: gameState.season.id,
    teamId,
    matchdayIndex: currentSchedule?.matchdayIndex ?? null,
  };

  return new Map(
    players.map((player) => [player.id, buildTrainingModeDemand({ context, player }) as TrainingModeDemandView | null] as const),
  );
}

export function evaluateTrainingModeDemandDelta(input: {
  demand: Pick<TrainingModeDemandView, "preferredMode" | "currentMode" | "status" | "moraleReward" | "moralePenalty" | "mismatchSeverity">;
  activeMode: PlayerTrainingMode;
}) {
  if (input.activeMode === input.demand.preferredMode) {
    return { delta: input.demand.moraleReward, outcome: "fulfilled" as const };
  }
  if (input.demand.status === "failed") {
    return { delta: input.demand.moralePenalty, outcome: "failed" as const };
  }
  if (input.demand.status === "at_risk") {
    return {
      delta: input.demand.moralePenalty * (input.demand.mismatchSeverity === 2 ? 0.45 : 0.25),
      outcome: "pressure" as const,
    };
  }
  return { delta: 0, outcome: "open" as const };
}
