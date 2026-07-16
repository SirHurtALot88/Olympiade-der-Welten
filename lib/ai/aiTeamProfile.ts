import type { GameState, Team, TeamIdentity } from "@/lib/data/olyDataTypes";

export function getAiTeamProfile(gameState: GameState, teamId: string): { team: Team; identity: TeamIdentity } | null {
  const team = gameState.teams.find((entry) => entry.teamId === teamId && !entry.humanControlled);
  if (!team) {
    return null;
  }

  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  if (!identity) {
    return null;
  }

  return { team, identity };
}
