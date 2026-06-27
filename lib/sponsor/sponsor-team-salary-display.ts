import type { GameState } from "@/lib/data/olyDataTypes";
import { normalizeEconomyMoney, resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

/** Client-safe team salary total (no filesystem / prize-table reads). */
export function getTeamDisplaySalaryTotal(gameState: GameState, teamId: string): number {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const total = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .reduce((sum, entry) => {
      const player = playerById.get(entry.playerId) ?? null;
      const contract = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      const salary = contract.expectedSalary ?? normalizeEconomyMoney(contract.salary) ?? 0;
      return sum + salary;
    }, 0);
  return round1(total);
}
