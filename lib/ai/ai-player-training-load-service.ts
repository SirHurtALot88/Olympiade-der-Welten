import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { getFacilityLevel, getRecoveryTrainingFatigueReductionPct, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
import { MATCHDAY_FATIGUE_LOAD, getInjuryRiskPercent } from "@/lib/fatigue/fatigue-injury-service";
import { buildTrainingModeDemand } from "@/lib/training/training-mode-demand-service";
import { FATIGUE_LOAD_BY_MODE } from "@/lib/training/training-mode-presentation";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

export type AiTeamTrainingIntensity = "light" | "normal" | "hard";

function trainingIntensityToMode(intensity: AiTeamTrainingIntensity): PlayerTrainingMode {
  if (intensity === "light") return "leicht";
  if (intensity === "hard") return "hart";
  return "mittel";
}

export type AiPlayerTrainingLoadPlan = {
  playerId: string;
  playerName: string;
  selectedMode: PlayerTrainingMode;
  teamBaselineMode: PlayerTrainingMode;
  appearances: number;
  completedMatchdays: number;
  rosterRank: number;
  currentFatigue: number;
  currentInjuryRiskPercent: number;
  projectedInjuryRiskPercent: number;
  needsLineupRest: boolean;
  trainingDemandPreferred: PlayerTrainingMode | null;
  reasons: string[];
};

function clampFatigue(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function countCompletedMatchdays(gameState: GameState) {
  const currentMatchdayId = gameState.matchdayState.matchdayId;
  const index = gameState.season.matchdayIds?.findIndex((entry) => entry === currentMatchdayId) ?? -1;
  if (index >= 0) {
    return index + 1;
  }
  const resolved = gameState.matchdayState.resolvedFixtureIds?.length ?? 0;
  return Math.max(1, resolved);
}

function buildRosterRankMap(gameState: GameState, teamId: string, rosterEntries: RosterEntry[]) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const ranked = rosterEntries
    .map((entry) => {
      const player = playersById.get(entry.playerId);
      if (!player) return null;
      const score =
        (player.ovr ?? player.rating ?? 0) +
        Object.values(player.disciplineRatings ?? {}).reduce((sum, value) => sum + value, 0) / 20;
      return { playerId: entry.playerId, score };
    })
    .filter((entry): entry is { playerId: string; score: number } => Boolean(entry))
    .sort((left, right) => right.score - left.score);

  return new Map(ranked.map((entry, index) => [entry.playerId, index + 1] as const));
}

function isHeavyStarter(input: { appearances: number; completedMatchdays: number; rosterRank: number }) {
  return (
    (input.appearances >= 7 && input.completedMatchdays >= 8) ||
    (input.rosterRank <= 3 && input.appearances >= Math.max(4, input.completedMatchdays - 2))
  );
}

function isLikelyStarter(input: { appearances: number; rosterRank: number; completedMatchdays: number }) {
  return input.rosterRank <= 3 || input.appearances >= Math.max(6, input.completedMatchdays - 2);
}

function projectedFatigueAfterMode(input: {
  fatigue: number;
  mode: PlayerTrainingMode;
  recoveryReductionPct: number;
  likelyStarter: boolean;
}) {
  const trainingLoad = FATIGUE_LOAD_BY_MODE[input.mode] * (1 - input.recoveryReductionPct / 100);
  let projected = input.fatigue + trainingLoad;
  if (input.likelyStarter) {
    projected += MATCHDAY_FATIGUE_LOAD;
  }
  return clampFatigue(projected);
}

function resolveModeForPlayer(input: {
  player: Player;
  teamBaselineMode: PlayerTrainingMode;
  appearances: number;
  completedMatchdays: number;
  rosterRank: number;
  recoveryCenterLevel: number;
  recoveryReductionPct: number;
  demandPreferred: PlayerTrainingMode | null;
}): Pick<AiPlayerTrainingLoadPlan, "selectedMode" | "projectedInjuryRiskPercent" | "needsLineupRest" | "reasons"> {
  const fatigue = input.player.fatigue ?? 0;
  const currentRisk = getInjuryRiskPercent(fatigue);
  const heavyStarter = isHeavyStarter({
    appearances: input.appearances,
    completedMatchdays: input.completedMatchdays,
    rosterRank: input.rosterRank,
  });
  const likelyStarter = isLikelyStarter({
    appearances: input.appearances,
    rosterRank: input.rosterRank,
    completedMatchdays: input.completedMatchdays,
  });
  const reasons: string[] = [];

  if (fatigue >= 85 || currentRisk >= 25) {
    reasons.push("kritische Fatigue/Verletzungsgefahr → leicht + Pause");
    return {
      selectedMode: "leicht",
      projectedInjuryRiskPercent: getInjuryRiskPercent(
        projectedFatigueAfterMode({
          fatigue,
          mode: "leicht",
          recoveryReductionPct: input.recoveryReductionPct,
          likelyStarter,
        }),
      ),
      needsLineupRest: true,
      reasons,
    };
  }

  const evaluateMode = (mode: PlayerTrainingMode) =>
    getInjuryRiskPercent(
      projectedFatigueAfterMode({
        fatigue,
        mode,
        recoveryReductionPct: input.recoveryReductionPct,
        likelyStarter,
      }),
    );

  if (input.demandPreferred === "hart") {
    const hardRisk = evaluateMode("hart");
    const canHardDirect = hardRisk < 18;
    const canHardWithRecovery =
      input.recoveryCenterLevel >= 2 && hardRisk < 25 && !likelyStarter;
    if (canHardDirect || canHardWithRecovery) {
      reasons.push(
        canHardWithRecovery
          ? "Hard-Demand mit Reha-Zentrum abgefedert"
          : "Hard-Demand bei vertretbarem Risiko",
      );
      return {
        selectedMode: "hart",
        projectedInjuryRiskPercent: hardRisk,
        needsLineupRest: hardRisk >= 18 || fatigue >= 80,
        reasons,
      };
    }
    reasons.push("Hard-Demand gedämpft wegen Einsatz-/Fatigue-Last");
    const mediumRisk = evaluateMode("mittel");
    return {
      selectedMode: "mittel",
      projectedInjuryRiskPercent: mediumRisk,
      needsLineupRest: mediumRisk >= 18 || fatigue >= 75,
      reasons,
    };
  }

  if (input.demandPreferred === "leicht") {
    reasons.push("Spieler wünscht leichteres Training");
    return {
      selectedMode: "leicht",
      projectedInjuryRiskPercent: evaluateMode("leicht"),
      needsLineupRest: fatigue >= 70,
      reasons,
    };
  }

  if (heavyStarter) {
    const mode: PlayerTrainingMode =
      input.teamBaselineMode === "hart" || fatigue >= 70 || currentRisk >= 12 ? "mittel" : "leicht";
    reasons.push("Stamm-/High-Usage → kein pauschales Hart-Training");
    const projected = evaluateMode(mode);
    return {
      selectedMode: mode,
      projectedInjuryRiskPercent: projected,
      needsLineupRest: projected >= 18 || fatigue >= 80,
      reasons,
    };
  }

  const benchOrProspect = input.rosterRank > 6 || input.appearances < 3;
  if (benchOrProspect && input.teamBaselineMode === "hart") {
    const hardRisk = evaluateMode("hart");
    if (hardRisk < 22) {
      reasons.push("Bank/Prospect darf härter trainieren");
      return {
        selectedMode: "hart",
        projectedInjuryRiskPercent: hardRisk,
        needsLineupRest: false,
        reasons,
      };
    }
  }

  const selectedMode =
    input.teamBaselineMode === "hart" && (fatigue >= 55 || currentRisk >= 10)
      ? "mittel"
      : input.teamBaselineMode;
  reasons.push(`Team-Baseline ${input.teamBaselineMode}`);
  const projected = evaluateMode(selectedMode);
  return {
    selectedMode,
    projectedInjuryRiskPercent: projected,
    needsLineupRest: projected >= 20 || fatigue >= 78,
    reasons,
  };
}

export function buildTeamPlayerTrainingLoadPlans(input: {
  gameState: GameState;
  teamId: string;
  teamBaselineIntensity: AiTeamTrainingIntensity;
}): AiPlayerTrainingLoadPlan[] {
  const teamBaselineMode = trainingIntensityToMode(input.teamBaselineIntensity);
  const rosterEntries = input.gameState.rosters.filter((entry) => entry.teamId === input.teamId);
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  const performanceMap = buildPlayerSeasonPerformanceMap(input.gameState);
  const completedMatchdays = countCompletedMatchdays(input.gameState);
  const rosterRankByPlayerId = buildRosterRankMap(input.gameState, input.teamId, rosterEntries);
  const facilities = getTeamFacilityState(input.gameState, input.teamId);
  const recoveryCenterLevel = getFacilityLevel(facilities, "recovery_center");
  const recoveryReductionPct = getRecoveryTrainingFatigueReductionPct(facilities);
  const currentSchedule =
    input.gameState.seasonState.disciplineSchedule?.find(
      (entry) => entry.matchdayId === input.gameState.matchdayState.matchdayId,
    ) ?? null;
  const demandContext = {
    seasonId: input.gameState.season.id,
    teamId: input.teamId,
    matchdayIndex: currentSchedule?.matchdayIndex ?? null,
  };

  return rosterEntries
    .map((entry) => {
      const player = playersById.get(entry.playerId);
      if (!player) return null;
      const appearances = performanceMap.get(player.id)?.appearances ?? 0;
      const rosterRank = rosterRankByPlayerId.get(player.id) ?? rosterEntries.length;
      const demand = buildTrainingModeDemand({
        context: demandContext,
        player,
        rosterRank,
      });
      const resolved = resolveModeForPlayer({
        player,
        teamBaselineMode,
        appearances,
        completedMatchdays,
        rosterRank,
        recoveryCenterLevel,
        recoveryReductionPct,
        demandPreferred: demand?.preferredMode ?? null,
      });
      const fatigue = player.fatigue ?? 0;
      return {
        playerId: player.id,
        playerName: player.name,
        selectedMode: resolved.selectedMode,
        teamBaselineMode,
        appearances,
        completedMatchdays,
        rosterRank,
        currentFatigue: fatigue,
        currentInjuryRiskPercent: getInjuryRiskPercent(fatigue),
        projectedInjuryRiskPercent: resolved.projectedInjuryRiskPercent,
        needsLineupRest: resolved.needsLineupRest,
        trainingDemandPreferred: demand?.preferredMode ?? null,
        reasons: resolved.reasons,
      } satisfies AiPlayerTrainingLoadPlan;
    })
    .filter((entry): entry is AiPlayerTrainingLoadPlan => Boolean(entry));
}

export function buildTeamPlayerTrainingLoadPlanMap(input: {
  gameState: GameState;
  teamId: string;
  teamBaselineIntensity: AiTeamTrainingIntensity;
}) {
  return new Map(
    buildTeamPlayerTrainingLoadPlans(input).map((plan) => [plan.playerId, plan] as const),
  );
}

export function playerNeedsLineupRestFromTrainingLoad(input: {
  gameState: GameState;
  teamId: string;
  playerId: string;
  teamBaselineIntensity?: AiTeamTrainingIntensity;
}): boolean {
  const settings = input.gameState.seasonState.aiManagerTrainingSettings?.[input.teamId];
  const intensity =
    input.teamBaselineIntensity ??
    (settings?.trainingIntensity === "light"
      ? "light"
      : settings?.trainingIntensity === "hard"
        ? "hard"
        : "normal");
  const plan = buildTeamPlayerTrainingLoadPlanMap({
    gameState: input.gameState,
    teamId: input.teamId,
    teamBaselineIntensity: intensity,
  }).get(input.playerId);
  return plan?.needsLineupRest ?? false;
}

export function countTeamHardTrainingDemandPressure(gameState: GameState, teamId: string) {
  const settings = gameState.seasonState.aiManagerTrainingSettings?.[teamId];
  const intensity =
    settings?.trainingIntensity === "light"
      ? "light"
      : settings?.trainingIntensity === "hard"
        ? "hard"
        : "normal";
  const plans = buildTeamPlayerTrainingLoadPlans({
    gameState,
    teamId,
    teamBaselineIntensity: intensity,
  });
  return plans.filter(
    (plan) =>
      plan.trainingDemandPreferred === "hart" &&
      (plan.appearances >= 6 || plan.rosterRank <= 3) &&
      plan.currentFatigue >= 55,
  ).length;
}
