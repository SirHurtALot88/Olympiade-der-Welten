"use client";

import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamAnnualLoanInstallment, getTeamAnnualLoanInterest } from "@/lib/finance/loan-service";
import { resolveSeasonGuvByTeam } from "@/lib/finance/season-guv-resolver";
import { roundValue as round1 } from "@/lib/foundation/foundation-number-utils";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import type { FinanceLeagueTableRow } from "@/lib/foundation/finances/finances-types";

/** Gleiche Rundung wie `use-finances-view-model.ts` (1 Nachkommastelle). */
/**
 * Liga-weite Finanzübersicht — für JEDES Team eine kompakte p.a.-Finanzzeile
 * (Cash, Einnahmen, Ausgaben, GuV, Marktwert). Bewusst getrennt von
 * `buildFinancesViewModel` (das darf laut seiner eigenen Doku NUR mit der
 * ID des aktiven Managers aufgerufen werden — Fog of War). Diese Funktion
 * schwächt jenen Detail-Builder nicht auf: sie ruft stattdessen dieselben
 * pro-Team-Helfer (`estimateTeamAnnualRevenue`, `getTeamAnnualLoanInstallment`,
 * `resolvePlayerEconomyContract`, `FACILITY_CATALOG`+`calculateFacilitySeasonUpkeep`
 * +`calculateFacilityIncome`, `buildTeamSeasonOverviewRows` für den Marktwert)
 * einmal pro Team in `gameState.teams` auf — genau wie die bestehende Liga-Kreditübersicht
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
  /**
   * DIE EINE GuV, auch hier (Finanz-Audit 11.08.2026).
   *
   * Diese Tabelle rechnete ihre eigene Näherung: Sponsor + Gebäude-BRUTTO-Einnahme gegen Gehalt +
   * BRUTTO-Unterhalt + Kreditzins — ohne Apron, ohne Vorstandsziele, und mit dem Unterhalt aller
   * Gebäude statt des am Saisonende wirklich bezahlten. Auf DEMSELBEN Bildschirm stand darüber die
   * Detail-GuV des eigenen Teams aus `buildSeasonGuv`. Am Live-Abbild trennte das bis zu 17,0 C je
   * Team (Hell Raisers −10,4 in der Tabelle gegen −27,4 im Detail; Messkörper
   * `new-game-1785823388048-1hf25q`). Genau die Doppelrechnung, die Chris abgeschafft haben wollte
   * („ich will auch endlich dass überall die GuV das gleiche ausweist").
   *
   * `resolveSeasonGuvByTeam` macht die teure Beschaffung EINMAL für die Liga (eine Sponsor-Vorschau,
   * eine Apron-Projektion, ein Ziel-Settlement) — also nicht teurer als die frühere Schleife.
   */
  const seasonGuvByTeamId = resolveSeasonGuvByTeam(gameState);
  // Preisgeld für ALLE Teams in einem Rutsch (statt pro Team neu zu bauen) —
  // `buildTeamSeasonOverviewRows` iteriert ohnehin über `gameState.teams`
  // und liefert `marketValueTotal` gleich mit (roster-MW-Summe via
  // `resolvePlayerEconomyContract`, client-safe).
  const overviewByTeamId = new Map(buildTeamSeasonOverviewRows({ gameState }).map((row) => [row.teamId, row] as const));

  return gameState.teams.map((team) => {
    const overview = overviewByTeamId.get(team.teamId) ?? null;

    // Einnahmen, Ausgaben und GuV kommen aus DERSELBEN Rechnung wie die eigene Detail-Übersicht
    // (`buildSeasonGuv` über den Resolver): Sponsor (gebucht + projiziert), Gebäude-Einnahme,
    // Apron (nur wenn gebucht), Vorstandsziele gegen Gehälter, den WIRKLICH bezahlten
    // Gebäude-Unterhalt und den Kreditzins. Preisgeld ist nicht dabei (reiner Benchmark), der
    // Transfersaldo ebenfalls nicht (Einmal-Ereignis, eigene Spalte) — beides wie bisher.
    const seasonGuv = seasonGuvByTeamId.get(team.teamId) ?? null;
    const incomeAnnual = seasonGuv?.einnahmen ?? 0;
    const expensesAnnual = seasonGuv?.ausgaben ?? 0;
    const guv = seasonGuv?.guv ?? 0;

    // Tilgungsanteil = volle Rate minus Zins. Cash-wirksam (verlässt das Konto), aber
    // kein GuV-Aufwand — deshalb getrennt ausgewiesen statt in `expensesAnnual` versteckt.
    const loanPrincipalAnnual = Math.max(
      0,
      round1(getTeamAnnualLoanInstallment(gameState, team.teamId) - getTeamAnnualLoanInterest(gameState, team.teamId)),
    );

    // Logo-Modell wie in den anderen Team-Tabellen (Standings/Ränge): Browser-URL + Initialen-Fallback,
    // damit die Vergleichstabelle Wappen statt nur Kürzel zeigt (fällt ohne hinterlegtes Logo auf Initialen).
    const logo = getTeamLogoModel(team, { variant: "thumb" });

    return {
      teamId: team.teamId,
      teamName: team.name,
      teamCode: team.shortCode,
      logoUrl: logo.src,
      logoInitials: logo.initials,
      cash: round1(team.cash),
      incomeAnnual,
      expensesAnnual,
      guv,
      loanPrincipalAnnual,
      // Was wirklich am Konto ankommt/abfließt: GuV abzüglich der Tilgung.
      cashFlowAnnual: round1(guv - loanPrincipalAnnual),
      marketValue: overview?.marketValueTotal ?? null,
    };
  });
}

/** React hook wrapper, memoized per render like `useFinancesViewModel`. */
export function useFinancesLeagueTable(gameState: GameState): FinanceLeagueTableRow[] {
  return useMemo(() => buildFinancesLeagueTable(gameState), [gameState]);
}
