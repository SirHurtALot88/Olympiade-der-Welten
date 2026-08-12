import type { GameState } from "@/lib/data/olyDataTypes";
import { calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { normalizeEconomyMoney, resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * Client-safe team salary total (no filesystem / prize-table reads).
 *
 * GEGLÄTTET: bevorzugt `contract.expectedSalary` — die Bemessungsgrundlage
 * für Apron, Sponsor-Kalkulation und KI. Als CASHFLOW-Anzeige ist diese Zahl
 * FALSCH: abgebucht wird am Saisonende `contract.salary` (Season-End-
 * Resolution) — dafür gibt es `getTeamActualSalaryTotal` direkt darunter.
 */
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

/**
 * F4 (eine Quelle pro Größe): die ECHTE Gehaltssumme — `contract.salary`,
 * exakt das Feld, das die Season-End-Resolution abbucht
 * (`sponsor-settlement-service.ts`: `resolvePlayerEconomyContract(...).salary`).
 * Das ist die Zahl, die die Finanzen-Seite summiert; jede Anzeige, die
 * „was kostet der Kader wirklich" meint (z. B. der Tilgung-vs-Cashflow-Chart
 * der Kredite-Seite), nimmt DIESE Summe. Die Glättung oben bleibt exklusiv
 * die Bemessungsgrundlage für Apron/Sponsor/KI.
 */
export function getTeamActualSalaryTotal(gameState: GameState, teamId: string): number {
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const total = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .reduce((sum, entry) => {
      const player = playerById.get(entry.playerId) ?? null;
      // KEIN zweites `normalizeEconomyMoney`. `contract.salary` ist bereits normalisiert
      // (`resolvePlayerEconomyContract` schickt jeden Zweig durch `normalizeStoredEconomyValue`).
      // Ein zweiter Durchlauf würde einen Betrag über 1000 ein zweites Mal durch 100 teilen und
      // diese Anzeige um Faktor 100 von dem trennen, was der Saisonende-Apply abbucht. Am Abbild
      // aller fünf Spielstände (1 689 Rosterverträge) liegt kein einziger über der Schwelle — der
      // Zweig war also toter, aber falscher Code.
      return sum + (resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0);
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
