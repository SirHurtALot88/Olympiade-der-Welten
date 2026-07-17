"use client";

import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import { estimateTeamAnnualRevenue, getTeamAnnualLoanInstallment } from "@/lib/finance/loan-service";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { calculateFacilitySeasonUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { normalizeEconomyMoney, resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import type { FinanceLeagueTableRow } from "@/lib/foundation/finances/finances-types";

/** Gleiche Rundung wie `use-finances-view-model.ts` (1 Nachkommastelle). */
function round1(value: number): number {
  return Number(value.toFixed(1));
}

/**
 * Liga-weite Finanzübersicht — für JEDES Team eine kompakte p.a.-Finanzzeile
 * (Cash, Einnahmen, Ausgaben, GuV, Marktwert). Bewusst getrennt von
 * `buildFinancesViewModel` (das darf laut seiner eigenen Doku NUR mit der
 * ID des aktiven Managers aufgerufen werden — Fog of War). Diese Funktion
 * schwächt jenen Detail-Builder nicht auf: sie ruft stattdessen dieselben
 * pro-Team-Helfer (`estimateTeamAnnualRevenue`, `getTeamAnnualLoanInstallment`,
 * `resolvePlayerEconomyContract`, `FACILITY_CATALOG`+`calculateFacilitySeasonUpkeep`,
 * `buildTeamSeasonOverviewRows` für das Preisgeld) einmal pro Team in
 * `gameState.teams` auf — genau wie die bestehende Liga-Kreditübersicht
 * (#182, `FoundationCreditsNewLook`) es für Kredite tut. Auf Datenebene gibt
 * es hier keine Sperre: jeder Helfer nimmt ohnehin eine `teamId` entgegen.
 * Diese Liga-Tabelle ist bewusste Balancing-Transparenz, kein Leak.
 *
 * Einnahmen/Ausgaben sind Näherungswerte p.a. — bewusst OHNE den
 * Saison-Transfer-Saldo (Einmal-Ereignis, keine laufende p.a.-Größe, siehe
 * auch die entsprechende Auslassung in `TeamFinancesIncome`/`-Expenses`
 * beim eigenen Team, wo der Transfer-Saldo separat ausgewiesen wird).
 *
 * Client-safe: keine `fs`/`better-sqlite3`-Importe in der Aufrufkette (alle
 * genutzten Helfer sind bereits Teil der bestehenden client-seitigen
 * Finanzen-/Kredite-Views).
 */
export function buildFinancesLeagueTable(gameState: GameState): FinanceLeagueTableRow[] {
  // Preisgeld für ALLE Teams in einem Rutsch (statt pro Team neu zu bauen) —
  // `buildTeamSeasonOverviewRows` iteriert ohnehin über `gameState.teams`
  // und liefert `marketValueTotal` gleich mit (roster-MW-Summe via
  // `resolvePlayerEconomyContract`, client-safe).
  const overviewByTeamId = new Map(buildTeamSeasonOverviewRows({ gameState }).map((row) => [row.teamId, row] as const));
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));

  return gameState.teams.map((team) => {
    const overview = overviewByTeamId.get(team.teamId) ?? null;

    const sponsor = Math.max(0, estimateTeamAnnualRevenue(gameState, team.teamId));
    const prize = Math.max(0, overview?.sponsorTotal ?? 0);

    const salaryTotal = gameState.rosters
      .filter((entry) => entry.teamId === team.teamId)
      .reduce((sum, entry) => {
        const player = playerById.get(entry.playerId) ?? null;
        const contract = resolvePlayerEconomyContract({ player, rosterEntry: entry });
        return sum + (contract.expectedSalary ?? normalizeEconomyMoney(contract.salary) ?? 0);
      }, 0);

    const teamFacilities = getTeamFacilityState(gameState, team.teamId);
    const facilityUpkeepTotal = FACILITY_CATALOG.reduce(
      (sum, entry) => sum + calculateFacilitySeasonUpkeep(entry.facilityId, teamFacilities),
      0,
    );

    const loanInstallmentTotal = getTeamAnnualLoanInstallment(gameState, team.teamId);

    const incomeAnnual = round1(sponsor + prize);
    const expensesAnnual = round1(salaryTotal + facilityUpkeepTotal + loanInstallmentTotal);

    return {
      teamId: team.teamId,
      teamName: team.name,
      teamCode: team.shortCode,
      cash: round1(team.cash),
      incomeAnnual,
      expensesAnnual,
      guv: round1(incomeAnnual - expensesAnnual),
      marketValue: overview?.marketValueTotal ?? null,
    };
  });
}

/** React hook wrapper, memoized per render like `useFinancesViewModel`. */
export function useFinancesLeagueTable(gameState: GameState): FinanceLeagueTableRow[] {
  return useMemo(() => buildFinancesLeagueTable(gameState), [gameState]);
}
