"use client";

import { useMemo } from "react";

import type { GameState, SponsorOfferComponentKind } from "@/lib/data/olyDataTypes";
import { estimateTeamAnnualRevenue, getTeamAnnualLoanInstallment } from "@/lib/finance/loan-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { getSponsorComponentKindLabel } from "@/lib/sponsor/sponsor-offer-presenter";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { calculateFacilitySeasonUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { normalizeEconomyMoney, resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import type {
  FinancePrizeIncome,
  FinanceSponsorIncome,
  FinanceTransferBalance,
  FinancesViewModel,
  TeamFinancesState,
} from "@/lib/foundation/finances/finances-types";

/** Gleiche Rundung wie Cash-Werte im Kredit-/Sponsor-Service (1 Nachkommastelle). */
function round1(value: number): number {
  return Number(value.toFixed(1));
}

/** Anzeige-Reihenfolge der Sponsor-Vertragskomponenten (mirrors `SPONSOR_STACK_SEGMENTS` in FoundationSponsorsNewLook). */
const SPONSOR_COMPONENT_KIND_ORDER: SponsorOfferComponentKind[] = ["base", "rank", "improvement", "special"];

/**
 * Builds the Finanzen view model for one human team's current-season
 * income/expense breakdown. Client-safe (no fs/better-sqlite3 imports) —
 * reuses the same read-only services the Kredite/Sponsoren/Preisgeld views
 * already derive from (see `docs/design/kredit-system.md` for the
 * sponsor/salary/upkeep helpers).
 *
 * Fog of war: this must only ever be called with the ACTIVE MANAGER's own
 * team id (`activeManagerTeamId`), same as `buildCreditsViewModel`. Never
 * pass another team's id in here.
 */
export function buildFinancesViewModel(gameState: GameState, teamId: string | null): FinancesViewModel {
  if (!teamId) {
    return { status: "not_ready" };
  }

  const team = gameState.teams.find((candidate) => candidate.teamId === teamId);
  if (!team) {
    return { status: "not_ready" };
  }

  // --- Sponsor (Vertrag) ------------------------------------------------
  // Gesamtsumme wie im Kredit-Belastungs-Chart (`estimateTeamAnnualRevenue`),
  // 0 ohne Vertrag/Auszahlung (siehe dort) — dann als "kein Sponsor" (`null`)
  // statt einer irreführenden 0-Zeile behandelt. Die Komponenten-Aufschlüsselung
  // kommt separat aus dem laufenden Vertrag (kann von der Gesamtsumme
  // abweichen, siehe `estimateTeamAnnualRevenue`-Doku: Proxy aus dem letzten
  // abgerechneten Payout-Log, Komponenten sind der AKTUELLE Vertrag).
  const estimatedSponsorRevenue = estimateTeamAnnualRevenue(gameState, teamId);
  const sponsorContract = getTeamSponsorContract(gameState, teamId);
  const sponsorComponents = sponsorContract
    ? SPONSOR_COMPONENT_KIND_ORDER.flatMap((kind) => {
        const component = sponsorContract.components.find((entry) => entry.kind === kind);
        if (!component || !Number.isFinite(component.rewardCash) || component.rewardCash <= 0) return [];
        return [{ kind, label: getSponsorComponentKindLabel(kind), rewardCash: round1(component.rewardCash) }];
      })
    : [];
  const sponsor: FinanceSponsorIncome | null =
    estimatedSponsorRevenue > 0 ? { total: round1(estimatedSponsorRevenue), components: sponsorComponents } : null;

  // --- Preisgeld (Liga-Pool) ---------------------------------------------
  // Gleiche Herleitung wie die Preisgeld-/Saisonstand-Views (`buildTeamPrizeSummary`
  // über `buildTeamSeasonOverviewRows`, season-scoped by default). Feldnamen im
  // Overview-Row sind historisch "sponsor*" benannt, meinen hier aber das
  // Preisgeld (Rang-Basis + Saison-Anteil + Platzierungsbonus), NICHT den
  // Sponsor-Vertrag oben.
  const overviewRow = buildTeamSeasonOverviewRows({ gameState }).find((row) => row.teamId === teamId) ?? null;
  const prizeTotal = overviewRow?.sponsorTotal;
  const prize: FinancePrizeIncome | null =
    prizeTotal != null && Number.isFinite(prizeTotal)
      ? {
          total: round1(prizeTotal),
          basis: round1(overviewRow?.sponsorBasis ?? 0),
          seasonShare: round1(overviewRow?.sponsorSeason ?? 0),
          placementBonus: round1(overviewRow?.sponsorRank ?? 0),
        }
      : null;

  // --- Transfer-Saldo (laufende Saison) -----------------------------------
  // Direkt aus `transferHistory` statt `collectSeasonTransferPipelineGuv`
  // (das ist eine LIGA-weite Season-Summe, kein Team-Split) oder
  // `TeamManagementSnapshotRow.transferNet` (das ist ALL-TIME, nicht
  // season-scoped) — mirrors `buildTransferFinanceAudit`'s
  // sell-netCashImpact-first-Regel.
  const seasonTransfers = gameState.transferHistory.filter((entry) => entry.seasonId === gameState.season.id);
  const buys = seasonTransfers.filter((entry) => entry.transferType === "buy" && entry.toTeamId === teamId);
  const sells = seasonTransfers.filter((entry) => entry.transferType === "sell" && entry.fromTeamId === teamId);
  const buyTotal = round1(buys.reduce((sum, entry) => sum + (entry.fee ?? 0), 0));
  const sellTotal = round1(sells.reduce((sum, entry) => sum + (entry.netCashImpact ?? entry.fee ?? 0), 0));
  const transfer: FinanceTransferBalance | null =
    buys.length > 0 || sells.length > 0
      ? { net: round1(sellTotal - buyTotal), buyTotal, sellTotal, buyCount: buys.length, sellCount: sells.length }
      : null;
  const transferSurplus = transfer != null && transfer.net > 0 ? round1(transfer.net) : null;
  const transferDeficit = transfer != null && transfer.net < 0 ? round1(-transfer.net) : null;

  // --- Gehälter (Kader) ---------------------------------------------------
  // Gleiche Auflösung wie `getTeamDisplaySalaryTotal` (siehe
  // `lib/sponsor/sponsor-team-salary-display.ts`, das auch die Kredite-Ansicht
  // nutzt), nur zusätzlich pro Spieler statt nur summiert.
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const salaryRows = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => {
      const player = playerById.get(entry.playerId) ?? null;
      const contract = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      const salary = contract.expectedSalary ?? normalizeEconomyMoney(contract.salary) ?? 0;
      return { playerName: player?.name ?? "Unbekannter Spieler", salary: round1(salary) };
    })
    .filter((row) => row.salary > 0)
    .sort((left, right) => right.salary - left.salary);
  const salaryTotal = round1(salaryRows.reduce((sum, row) => sum + row.salary, 0));

  // --- Gebäude-Unterhalt ---------------------------------------------------
  const teamFacilities = getTeamFacilityState(gameState, teamId);
  const facilityRows = FACILITY_CATALOG.map((entry) => ({
    label: entry.label,
    upkeep: round1(calculateFacilitySeasonUpkeep(entry.facilityId, teamFacilities)),
  }))
    .filter((row) => row.upkeep > 0)
    .sort((left, right) => right.upkeep - left.upkeep);
  const facilityUpkeepTotal = round1(facilityRows.reduce((sum, row) => sum + row.upkeep, 0));

  // --- Kreditraten ----------------------------------------------------------
  const activeLoans = (gameState.seasonState.loans ?? []).filter(
    (loan) => loan.borrowerTeamId === teamId && loan.status === "active",
  );
  const loanRows = activeLoans
    .map((loan) => ({
      lenderName:
        loan.lenderType === "team"
          ? (gameState.teams.find((candidate) => candidate.teamId === loan.lenderTeamId)?.name ?? "Team")
          : "Bank",
      installment: round1(loan.installmentPerSeason),
      outstanding: round1(loan.principalOutstanding),
    }))
    .sort((left, right) => right.installment - left.installment);
  const loanInstallmentTotal = getTeamAnnualLoanInstallment(gameState, teamId);

  const totalIncome = round1((sponsor?.total ?? 0) + (prize?.total ?? 0) + (transferSurplus ?? 0));
  const totalExpenses = round1(salaryTotal + facilityUpkeepTotal + loanInstallmentTotal + (transferDeficit ?? 0));
  const guv = round1(totalIncome - totalExpenses);

  const teamFinances: TeamFinancesState = {
    teamId,
    cash: team.cash,
    income: { sponsor, prize, transferSurplus },
    expenses: {
      salaries: { total: salaryTotal, players: salaryRows },
      facilityUpkeep: { total: facilityUpkeepTotal, facilities: facilityRows },
      loanInstallments: { total: loanInstallmentTotal, loans: loanRows },
      transferDeficit,
    },
    transfer,
    totalIncome,
    totalExpenses,
    guv,
  };

  return { status: "ready", team: teamFinances };
}

/**
 * React hook wrapper around `buildFinancesViewModel`. Hosts should prefer
 * this over calling the builder directly so the model is memoized per
 * render the same way `useCreditsViewModel` is.
 */
export function useFinancesViewModel(gameState: GameState, teamId: string | null): FinancesViewModel {
  return useMemo(() => buildFinancesViewModel(gameState, teamId), [gameState, teamId]);
}
