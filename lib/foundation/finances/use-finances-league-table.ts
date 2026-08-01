"use client";

import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  estimateTeamAnnualRevenue,
  getTeamAnnualLoanInstallment,
  getTeamAnnualLoanInterest,
} from "@/lib/finance/loan-service";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { calculateFacilityIncome, calculateFacilitySeasonUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { computeTeamBeliebtheitFromGameState } from "@/lib/economy/team-beliebtheit";
import { normalizeEconomyMoney, resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { getTeamLogoModel } from "@/lib/data/mediaAssets";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { FINANCE_SPONSOR_INCOME_COMPONENT_KINDS } from "@/lib/foundation/finances/finances-types";
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
  // Preisgeld für ALLE Teams in einem Rutsch (statt pro Team neu zu bauen) —
  // `buildTeamSeasonOverviewRows` iteriert ohnehin über `gameState.teams`
  // und liefert `marketValueTotal` gleich mit (roster-MW-Summe via
  // `resolvePlayerEconomyContract`, client-safe).
  const overviewByTeamId = new Map(buildTeamSeasonOverviewRows({ gameState }).map((row) => [row.teamId, row] as const));
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));

  // Sponsor-Einnahme aus der ECHTEN Settlement-Vorschau — dieselbe Quelle, die auch die eigene
  // Detail-Übersicht nutzt (`use-finances-view-model.ts`). `component.rewardCash` ist laut
  // sponsor-offer-service nur die OBERGRENZE des Bausteins, nicht der erwartete Betrag: ein
  // Verbesserungs-/Sonderziel zahlt 0, solange es nicht erfüllt ist, und die Rang-Komponente zahlt
  // rangabhängig. Die Tabelle summierte bisher die Caps und zeigte dadurch auf DEMSELBEN Screen eine
  // andere Sponsorsumme als die Detailansicht (Beispiel-Fixture: Tabelle 75 vs. Detail 69,3).
  // Einmal für die ganze Liga vorberechnet statt pro Team — previewSponsorSettlement liefert ohnehin
  // alle Zeilen auf einmal.
  const sponsorSettlementByTeamId = new Map<string, number>();
  try {
    for (const row of previewSponsorSettlement(gameState).rows) {
      if (!FINANCE_SPONSOR_INCOME_COMPONENT_KINDS.includes(row.kind)) continue;
      // Negative Zeilen saldieren mit, sonst weicht die Tabelle wieder von der Detailansicht ab —
      // diesmal um die Vorschuss-Verrechnung und um verfehlte Achsen.
      if (!Number.isFinite(row.cashDelta)) continue;
      sponsorSettlementByTeamId.set(row.teamId, (sponsorSettlementByTeamId.get(row.teamId) ?? 0) + row.cashDelta);
    }
  } catch {
    // Sponsor-Vorschau ist optional — fehlt sie, greift unten der Estimate-Fallback (wie im Detail-Model).
  }

  return gameState.teams.map((team) => {
    const overview = overviewByTeamId.get(team.teamId) ?? null;

    // Einnahmen p.a. = Sponsor + Gebäude-Einnahmen — EXAKT die laufenden
    // (cash-wirksamen) Einnahmequellen der eigenen Finanzübersicht
    // (`buildFinancesViewModel`: totalIncome = sponsor + facilityIncome + …).
    // Preisgeld wird bewusst NICHT eingerechnet: es ist ein reiner
    // platzierungs-abhängiger Benchmark (nie cash-wirksam) und war auch bei
    // Teams OHNE Sponsor > 0 — das erzeugte die falschen "Einnahmen ohne
    // Sponsor". Transfersaldo bleibt ebenfalls außen vor (Einmal-Ereignis).
    //
    // Sponsor-Herleitung IDENTISCH zur eigenen Detail-Übersicht
    // (`buildFinancesViewModel`): Summe ALLER positiven Vertragskomponenten
    // (Basis + Leistung + Bonus), nicht nur die Basis. Vorher lief hier direkt
    // `estimateTeamAnnualRevenue`, das in S1 (noch kein Payout-Log) auf die
    // Basis-Komponente zurückfällt → das eigene Team zeigte z. B. 21,3 statt 74,7.
    // Nur wenn KEIN aktueller Vertrag existiert (keine positiven Komponenten),
    // greift der `estimateTeamAnnualRevenue`-Proxy (Payout-Log/Basis) — exakt
    // die Fallback-Logik der Detail-Übersicht.
    // Dieselbe Komponenten-AUSWAHL wie die Detail-Übersicht (gemeinsame Konstante) — insbesondere OHNE
    // `overperformance`, deren rewardCash nur ein Cap ist (Auszahlung = min(cap, Rate × Plätze über
    // Erwartungsrang), also 0 solange der Erwartungsrang nicht übertroffen wird). Würde die Tabelle den Cap
    // mitsummieren, zeigte derselbe Finanzen-Screen zwei verschiedene Sponsorsummen für dasselbe Team.
    const sponsorContract = getTeamSponsorContract(gameState, team.teamId);
    const sponsorComponentsTotal = sponsorContract ? (sponsorSettlementByTeamId.get(team.teamId) ?? 0) : 0;
    const sponsor =
      sponsorComponentsTotal > 0
        ? round1(sponsorComponentsTotal)
        : Math.max(0, estimateTeamAnnualRevenue(gameState, team.teamId));

    const salaryTotal = gameState.rosters
      .filter((entry) => entry.teamId === team.teamId)
      .reduce((sum, entry) => {
        const player = playerById.get(entry.playerId) ?? null;
        const contract = resolvePlayerEconomyContract({ player, rosterEntry: entry });
        /**
         * `contract.salary` — der ECHTE Vertragswert dieser Saison, nicht der geglaettete.
         *
         * Gemeldet: „in der finanzansicht hat Z-H weniger gehaelter als in dieser ansicht???
         * was stimmt denn nun bitte den aktuellen wert aus den vertraegen ziehen inkl. FL oder
         * BL nicht den durchschnitts gehalt wert."
         *
         * FL/BL sind `front_loaded` / `back_loaded`: bei diesen Vertragsformen weicht die
         * aktuelle Rate bewusst vom Mittelwert ab. `expectedSalary` ist der Formelwert
         * (Mittelwert), `salary` die Rate, die tatsaechlich faellig wird. Bei Z-H trennt das
         * 97,7 von 83,3 — Sunken Crown zahlt aktuell 13,34 statt der berechneten 9,74.
         *
         * Der Saisonstand zeigte laengst `salary`, diese Tabelle `expectedSalary`: derselbe
         * Spielstand, zwei Gehaltssummen. Massgeblich ist `salary`, denn genau dieses Feld
         * bucht die Saisonende-Abrechnung ab (`sponsor-settlement-service`:
         * `resolvePlayerEconomyContract(...).salary ?? 0`) — dieselbe Quelle nutzt auch
         * `buildFinancesViewModel` fuer die eigene Detail-Uebersicht.
         *
         * NICHT angefasst: `getTeamDisplaySalaryTotal`. Daran haengt ueber
         * `getTeamSponsorBaseReferenceTotal` der Sponsor-Anker; eine Aenderung dort
         * verschoebe die Sponsoren-Kalibrierung und gehoert in die laufende Balance-
         * Entscheidung, nicht in einen Anzeige-Fix.
         */
        return sum + (normalizeEconomyMoney(contract.salary) ?? contract.salary ?? 0);
      }, 0);

    const teamFacilities = getTeamFacilityState(gameState, team.teamId);
    const facilityUpkeepTotal = FACILITY_CATALOG.reduce(
      (sum, entry) => sum + calculateFacilitySeasonUpkeep(entry.facilityId, teamFacilities),
      0,
    );
    // Gebäude-Einnahmen brutto (Arena skaliert mit Team-Beliebtheit) — gleiche
    // Herleitung wie die eigene Übersicht; der Unterhalt steht symmetrisch als
    // Ausgabe (facilityUpkeepTotal), daher hier die Brutto-Einnahme.
    const arenaPopularityFactor = computeTeamBeliebtheitFromGameState(gameState, team.teamId).value;
    const facilityIncome = Math.max(0, calculateFacilityIncome(teamFacilities, { arenaPopularityFactor }));

    // Kredit-Ausgabe = ZINS, nicht die volle Rate: Die Tilgung ist eine
    // Bilanz-Umbuchung (Schulden runter), keine GuV-Ausgabe — genau wie in der
    // eigenen Übersicht (`use-finances-view-model.ts`, dort `getTeamAnnualLoanInterest`).
    // Mit der vollen Rate wurde die Tilgung doppelt bestraft und kreditfinanzierte
    // Teams sahen im Vergleich künstlich schlechter aus als schuldenfreie mit
    // gleichem Cashflow.
    const loanInterestTotal = getTeamAnnualLoanInterest(gameState, team.teamId);
    // Tilgungsanteil = volle Rate minus Zins. Cash-wirksam (verlässt das Konto), aber
    // kein GuV-Aufwand — deshalb getrennt ausgewiesen statt in `expensesAnnual` versteckt.
    const loanPrincipalAnnual = Math.max(
      0,
      round1(getTeamAnnualLoanInstallment(gameState, team.teamId) - loanInterestTotal),
    );

    const incomeAnnual = round1(sponsor + facilityIncome);
    const expensesAnnual = round1(salaryTotal + facilityUpkeepTotal + loanInterestTotal);
    const guv = round1(incomeAnnual - expensesAnnual);

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
