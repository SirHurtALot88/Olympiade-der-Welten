import type { GameState } from "@/lib/data/olyDataTypes";
import { calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
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

/** Season upkeep of all currently built/enabled facilities for a team (0 if nothing is built). */
export function getTeamFacilityUpkeepTotal(gameState: GameState, teamId: string): number {
  return round1(calculateFacilityUpkeep(getTeamFacilityState(gameState, teamId)));
}

/**
 * Sponsor-Basis-Referenz: Gehalt + Gebäude-Unterhalt (salary factor 1.0 anchor). Gebäude-Kosten
 * laufen sonst "unsichtbar" gegen die Kasse, ohne dass Sponsoren dafür mitzahlen — das schlägt
 * diese Referenz auf die reine Gehalts-Basis auf, bevor der Rang-32-Anker daraus gebildet wird.
 */
export function getTeamSponsorBaseReferenceTotal(gameState: GameState, teamId: string): number {
  return round1(getTeamDisplaySalaryTotal(gameState, teamId) + getTeamFacilityUpkeepTotal(gameState, teamId));
}
