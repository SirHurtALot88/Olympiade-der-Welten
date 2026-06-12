import type { GameState } from "@/lib/data/olyDataTypes";
import { deriveTeamIdentityAxisWeightMap } from "@/lib/foundation/team-identity-settings";
import type { AiNeedSummary } from "@/lib/ai/types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function evaluateAiNeeds(gameState: GameState, teamId: string): AiNeedSummary {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  if (!team || !identity) {
    return {
      teamId,
      rosterCount: 0,
      rosterGap: 1,
      budgetPressure: 1,
      upkeepPressure: 1,
      axisDeficits: { pow: 1, spe: 1, men: 1, soc: 1 },
      uncoveredNeedAxes: ["pow", "spe", "men", "soc"],
      topNeedDisciplineIds: [],
      overallNeedScore: 0,
    };
  }

  const roster = gameState.rosters.filter((entry) => entry.teamId === teamId);
  const rosterCount = roster.length;
  const rosterGap = clamp((identity.playerOpt - rosterCount) / Math.max(identity.playerOpt, 1), 0, 1);
  const totalUpkeep = roster.reduce((sum, entry) => sum + entry.upkeep, 0);
  const budgetPressure = clamp(1 - team.cash / Math.max(team.budget, 1), 0, 1);
  const upkeepPressure = clamp(totalUpkeep / Math.max(team.cash, 1), 0, 1.5);
  const rosterPlayers = roster
    .map((entry) => gameState.players.find((player) => player.id === entry.playerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player));

  const averageAxis = {
    pow: rosterPlayers.length ? rosterPlayers.reduce((sum, player) => sum + player.coreStats.pow, 0) / rosterPlayers.length : 0,
    spe: rosterPlayers.length ? rosterPlayers.reduce((sum, player) => sum + player.coreStats.spe, 0) / rosterPlayers.length : 0,
    men: rosterPlayers.length ? rosterPlayers.reduce((sum, player) => sum + player.coreStats.men, 0) / rosterPlayers.length : 0,
    soc: rosterPlayers.length ? rosterPlayers.reduce((sum, player) => sum + player.coreStats.soc, 0) / rosterPlayers.length : 0,
  };

  const identityAxisWeights = deriveTeamIdentityAxisWeightMap(identity);
  const axisDeficits = {
    pow: clamp(identityAxisWeights.pow - averageAxis.pow / 100, 0, 1),
    spe: clamp(identityAxisWeights.spe - averageAxis.spe / 100, 0, 1),
    men: clamp(identityAxisWeights.men - averageAxis.men / 100, 0, 1),
    soc: clamp(identityAxisWeights.soc - averageAxis.soc / 100, 0, 1),
  };
  const uncoveredNeedAxes = (Object.entries(axisDeficits) as Array<["pow" | "spe" | "men" | "soc", number]>)
    .filter(([, value]) => value > 0.08)
    .sort((left, right) => right[1] - left[1])
    .map(([axis]) => axis);

  const disciplineScores = gameState.disciplines
    .map((discipline) => {
      const playerRatings = rosterPlayers
        .map((player) => player.disciplineRatings[discipline.id] ?? 50);

      const average = playerRatings.length
        ? playerRatings.reduce((sum, value) => sum + value, 0) / playerRatings.length
        : 40;
      const preferredBonus =
        (discipline.category === "power" ? axisDeficits.pow : 0) * 10 +
        (discipline.category === "speed" ? axisDeficits.spe : 0) * 10 +
        (discipline.category === "mental" ? axisDeficits.men : 0) * 10 +
        (discipline.category === "social" ? axisDeficits.soc : 0) * 10;
      return {
        disciplineId: discipline.id,
        needScore: 100 - average + preferredBonus,
      };
    })
    .sort((left, right) => right.needScore - left.needScore);

  return {
    teamId,
    rosterCount,
    rosterGap,
    budgetPressure,
    upkeepPressure,
    axisDeficits,
    uncoveredNeedAxes,
    topNeedDisciplineIds: disciplineScores.slice(0, 2).map((entry) => entry.disciplineId),
    overallNeedScore: clamp(
      rosterGap * 0.35 +
        disciplineScores[0].needScore / 100 * 0.25 +
        budgetPressure * 0.15 +
        upkeepPressure * 0.1 +
        Math.max(axisDeficits.pow, axisDeficits.spe, axisDeficits.men, axisDeficits.soc) * 0.15,
      0,
      1,
    ),
  };
}
