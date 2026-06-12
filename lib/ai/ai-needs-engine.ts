import type { AiDisciplineNeedSummary, AiNeedAxis, AiNeedsSummary } from "@/lib/ai/ai-needs-types";
import { deriveTeamIdentityAxisWeightMap } from "@/lib/foundation/team-identity-settings";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mapAttributeToAxis(attributeKey: string): AiNeedAxis | null {
  if (attributeKey === "power" || attributeKey === "health") return "pow";
  if (attributeKey === "speed" || attributeKey === "dexterity" || attributeKey === "stamina") return "spe";
  if (attributeKey === "awareness" || attributeKey === "intelligence" || attributeKey === "will" || attributeKey === "determination") {
    return "men";
  }
  if (attributeKey === "charisma" || attributeKey === "spirit" || attributeKey === "torment") return "soc";
  return null;
}

function getKeyAttributes(context: LegacyLineupLoadedContext, disciplineId: string | null) {
  if (!disciplineId) {
    return [];
  }

  return context.disciplineWeights
    .filter((weight) => weight.disciplineId === disciplineId && weight.weightPct > 0)
    .sort((left, right) => right.weightPct - left.weightPct)
    .map((weight) => weight.attributeKey);
}

function getFocusAxes(attributeKeys: string[]): AiNeedAxis[] {
  const axisWeights = new Map<AiNeedAxis, number>();
  for (const key of attributeKeys) {
    const axis = mapAttributeToAxis(key);
    if (!axis) continue;
    axisWeights.set(axis, (axisWeights.get(axis) ?? 0) + 1);
  }

  return [...axisWeights.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([axis]) => axis);
}

function buildDisciplineNeedSummary(
  context: LegacyLineupLoadedContext,
  disciplineId: string | null,
  disciplineSide: "d1" | "d2",
  axisDeficits: Record<AiNeedAxis, number>,
): AiDisciplineNeedSummary {
  if (!disciplineId) {
    return {
      disciplineId: null,
      disciplineSide,
      averageDisciplineScore: 0,
      needScore: 0,
      playerCount: 0,
      keyAttributes: [],
      focusAxes: [],
    };
  }

  const relevantScores = context.disciplineScores
    .filter((score) => score.disciplineId === disciplineId)
    .map((score) => score.score);
  const averageDisciplineScore = relevantScores.length
    ? relevantScores.reduce((sum, value) => sum + value, 0) / relevantScores.length
    : 0;
  const keyAttributes = getKeyAttributes(context, disciplineId);
  const focusAxes = getFocusAxes(keyAttributes);
  const preferredBonus = focusAxes.reduce((sum, axis) => sum + axisDeficits[axis] * 10, 0);

  return {
    disciplineId,
    disciplineSide,
    averageDisciplineScore,
    needScore: clamp(100 - averageDisciplineScore + preferredBonus, 0, 200),
    playerCount: context.disciplinePlayerCounts[disciplineId] ?? 0,
    keyAttributes,
    focusAxes,
  };
}

export function evaluateLegacyAiNeeds(context: LegacyLineupLoadedContext): AiNeedsSummary {
  const rosterCount = context.activePlayers.length;
  const rosterTarget = context.teamSeasonState.playerOpt ?? context.teamSeasonState.rosterLimit;
  const rosterGap = clamp((rosterTarget - rosterCount) / Math.max(rosterTarget, 1), 0, 1);
  const rosterFillPressure = clamp(rosterCount / Math.max(context.teamSeasonState.rosterLimit, 1), 0, 1.5);
  const totalUpkeep = context.activePlayers.reduce((sum, player) => sum + (player.upkeep ?? 0), 0);
  const budgetPressure = clamp(1 - context.teamSeasonState.cash / Math.max(context.teamSeasonState.budget, 1), 0, 1);
  const upkeepPressure = clamp(totalUpkeep / Math.max(context.teamSeasonState.cash, 1), 0, 1.5);

  const averageAxis = {
    pow: context.rosterPlayers.length ? context.rosterPlayers.reduce((sum, player) => sum + player.coreStats.pow, 0) / context.rosterPlayers.length : 0,
    spe: context.rosterPlayers.length ? context.rosterPlayers.reduce((sum, player) => sum + player.coreStats.spe, 0) / context.rosterPlayers.length : 0,
    men: context.rosterPlayers.length ? context.rosterPlayers.reduce((sum, player) => sum + player.coreStats.men, 0) / context.rosterPlayers.length : 0,
    soc: context.rosterPlayers.length ? context.rosterPlayers.reduce((sum, player) => sum + player.coreStats.soc, 0) / context.rosterPlayers.length : 0,
  };

  const identityAxisWeights = deriveTeamIdentityAxisWeightMap(context.teamIdentity);
  const axisDeficits = {
    pow: clamp(identityAxisWeights.pow - averageAxis.pow / 100, 0, 1),
    spe: clamp(identityAxisWeights.spe - averageAxis.spe / 100, 0, 1),
    men: clamp(identityAxisWeights.men - averageAxis.men / 100, 0, 1),
    soc: clamp(identityAxisWeights.soc - averageAxis.soc / 100, 0, 1),
  };

  const d1NeedSummary = buildDisciplineNeedSummary(context, context.contextMeta.d1DisciplineId, "d1", axisDeficits);
  const d2NeedSummary = buildDisciplineNeedSummary(context, context.contextMeta.d2DisciplineId, "d2", axisDeficits);

  const recommendedPriority =
    Math.abs(d1NeedSummary.needScore - d2NeedSummary.needScore) < 5
      ? "balanced"
      : d1NeedSummary.needScore > d2NeedSummary.needScore
        ? "d1"
        : "d2";

  const warnings: string[] = [];
  if (!context.contextMeta.d1DisciplineId || !context.contextMeta.d2DisciplineId) {
    warnings.push("One or both matchday discipline sides could not be derived from the current legacy context.");
  }

  return {
    teamId: context.teamId,
    matchdayId: context.matchdayId,
    rosterPressure: {
      rosterCount,
      rosterGap,
      rosterFillPressure,
      budgetPressure,
      upkeepPressure,
    },
    axisDeficits,
    d1NeedSummary,
    d2NeedSummary,
    recommendedPriority,
    warnings,
  };
}
