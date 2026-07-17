/**
 * "Finanzen" view-model types.
 *
 * UI-facing shape of a human team's season income/expense breakdown, backed
 * entirely by existing services (`lib/finance/loan-service.ts`,
 * `lib/sponsor/sponsor-offer-read.ts`, `lib/facilities/facility-effects.ts`,
 * `lib/foundation/team-management-overview.ts`, `gameState.transferHistory`)
 * — this file only describes what the Finanzen UI needs to render. Mirrors
 * the Kredite split (`lib/foundation/credits/credits-types.ts`): game logic
 * lives in the services, this is a pure read-model.
 */

import type { SponsorOfferComponentKind } from "@/lib/data/olyDataTypes";

/** One sponsor-contract component contributing to the "Sponsor"-Einnahme, for the hover breakdown. */
export type FinanceSponsorComponentRow = {
  kind: SponsorOfferComponentKind;
  label: string;
  rewardCash: number;
};

/** One roster player's salary, for the "Gehälter"-Ausgabe hover breakdown (desc sortiert). */
export type FinanceSalaryRow = {
  playerName: string;
  salary: number;
};

/** One built facility's season upkeep, for the "Gebäude-Unterhalt"-Ausgabe hover breakdown (desc sortiert). */
export type FinanceFacilityUpkeepRow = {
  label: string;
  upkeep: number;
};

/** One active loan's installment, for the "Kreditraten"-Ausgabe hover breakdown (desc sortiert). */
export type FinanceLoanInstallmentRow = {
  lenderName: string;
  installment: number;
  outstanding: number;
};

/** Sponsor-Vertrag: Gesamtsumme (`estimateTeamAnnualRevenue`) + Komponenten-Aufschlüsselung. `null` ohne Vertrag/Auszahlung. */
export type FinanceSponsorIncome = {
  total: number;
  components: FinanceSponsorComponentRow[];
};

/** Preisgeld (Liga-Pool, Rang-Basis + Saison-Anteil + Platzierungsbonus), siehe `buildTeamPrizeSummary`. `null` wenn kein Standing vorliegt. */
export type FinancePrizeIncome = {
  total: number;
  basis: number;
  seasonShare: number;
  placementBonus: number;
};

/** Saison-Transfersaldo (Verkäufe minus Käufe) aus `gameState.transferHistory`. `null` ohne Transfers dieser Saison. */
export type FinanceTransferBalance = {
  /** `sellTotal - buyTotal`, positiv = Netto-Verkäufer, negativ = Netto-Käufer. */
  net: number;
  buyTotal: number;
  sellTotal: number;
  buyCount: number;
  sellCount: number;
};

export type TeamFinancesIncome = {
  sponsor: FinanceSponsorIncome | null;
  prize: FinancePrizeIncome | null;
  /** Nur gesetzt, wenn `transfer.net > 0` (Netto-Verkäufer) — sonst läuft der Saldo als Ausgabe. */
  transferSurplus: number | null;
};

export type TeamFinancesExpenses = {
  salaries: { total: number; players: FinanceSalaryRow[] };
  facilityUpkeep: { total: number; facilities: FinanceFacilityUpkeepRow[] };
  loanInstallments: { total: number; loans: FinanceLoanInstallmentRow[] };
  /** Nur gesetzt, wenn `transfer.net < 0` (Netto-Käufer) — als positiver Betrag. */
  transferDeficit: number | null;
};

/** Ein menschliches Team's Finanzen-Gesamtbild für die laufende Saison — nur das eigene Team (Fog of War). */
export type TeamFinancesState = {
  teamId: string;
  cash: number;
  income: TeamFinancesIncome;
  expenses: TeamFinancesExpenses;
  /** Rohe Transfer-Saldo-Zahlen, geteilt zwischen Income/Expenses-Hover (siehe `FinanceTransferBalance`). */
  transfer: FinanceTransferBalance | null;
  totalIncome: number;
  totalExpenses: number;
  /** `totalIncome - totalExpenses` — live berechnet, Quelle der Wahrheit (siehe auch `TeamManagementSnapshotRow.guv` als Cross-Check). */
  guv: number;
};

/** Discriminated view model consumed by the Finanzen UI. */
export type FinancesViewModel = { status: "not_ready" } | { status: "ready"; team: TeamFinancesState };

/**
 * Eine kompakte Liga-weite Finanzzeile — bewusste Balancing-Transparenz
 * (analog zur Liga-Kreditübersicht in `FoundationCreditsNewLook`, #182),
 * KEIN Fog-of-War-Verstoß: siehe `buildFinancesLeagueTable` in
 * `use-finances-league-table.ts`.
 */
export type FinanceLeagueTableRow = {
  teamId: string;
  teamName: string;
  teamCode: string;
  cash: number;
  /** Sponsor + Preisgeld p.a. (Näherungswert, ohne Transfer-Saldo). */
  incomeAnnual: number;
  /** Gehälter + Gebäude-Unterhalt + Kreditraten p.a. (Näherungswert, ohne Transfer-Saldo). */
  expensesAnnual: number;
  /** `incomeAnnual - expensesAnnual`. */
  guv: number;
  /** Kader-Marktwert-Summe (`TeamManagementSnapshotRow.marketValueTotal`) — `null` ohne Kader. */
  marketValue: number | null;
};
