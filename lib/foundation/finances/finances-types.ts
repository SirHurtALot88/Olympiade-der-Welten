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

/**
 * Sponsor-Vertrag: Gesamtsumme + Komponenten-Aufschlüsselung. `null` ohne Vertrag/Auszahlung.
 *
 * `total` ist vorrangig die Summe der `components` (gleiche Quelle, kein Auseinanderlaufen,
 * siehe T-030). Nur wenn der aktuelle Vertrag keine (positiven) Komponenten mehr liefert — z. B.
 * Vertrag ausgelaufen, aber `estimateTeamAnnualRevenue` findet noch ein Payout-Log der Vorsaison —
 * fällt `total` auf diesen Log-Proxy zurück; `totalIsEstimate` markiert genau diesen Fall.
 */
export type FinanceSponsorIncome = {
  total: number;
  components: FinanceSponsorComponentRow[];
  /** `true`, wenn `total` NICHT aus `components` stammt, sondern aus dem `estimateTeamAnnualRevenue`-Payout-Log-Proxy (siehe T-030). */
  totalIsEstimate: boolean;
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

/**
 * Ein Saison-Datenpunkt für den GuV-/Cash-Verlauf (T-107) — vergangene Saisons kommen aus
 * `gameState.seasonState.seasonSnapshots` (echte archivierte Season-End-Werte,
 * `SeasonSnapshotTeamRecord.guv`/`.cashTotal`/`.cashEnd`), die laufende Saison ist der
 * live berechnete Wert dieser View (kein Forecast, reine Historie — anders als der
 * 5-Saisons-FORECAST in prize-v2, der auf projizierten Zukunftswerten basiert).
 */
export type FinanceSeasonHistoryPoint = {
  seasonId: string;
  seasonName: string;
  /** `true` für den laufenden (noch nicht archivierten) Saison-Datenpunkt. */
  isCurrent: boolean;
  /** `SeasonSnapshotTeamRecord.guv` bzw. der live `guv` der laufenden Saison. `null` wenn im Snapshot nicht erfasst. */
  guv: number | null;
  /** `cashTotal ?? cashEnd` bzw. live `cash`. `null` wenn im Snapshot nicht erfasst. */
  cash: number | null;
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
  /**
   * Cash zu Saisonbeginn — `cashTotal ?? cashEnd` aus dem archivierten Snapshot der UNMITTELBAR
   * vorangegangenen Saison (`gameState.seasonState.seasonSnapshots`, siehe T-031). `null` in
   * Season 1 bzw. wenn keine Vorsaison archiviert ist (kein Season-Start-Wert bekannt — dann bleibt
   * auch `otherCashMovements` `null`, statt einen falschen Wert vorzutäuschen).
   */
  cashSeasonStart: number | null;
  /**
   * Rest-Differenz, die GuV NICHT erklärt: `cash - cashSeasonStart - guv` (Kredit-Auszahlungen/
   * Vorfälligkeitsentschädigung, Baukosten, sonstige Cash-Events dieser Saison, siehe T-031).
   * Bewusst als reine Differenz statt einzeln aufgeschlüsselter Posten — reicht aus, damit die
   * GuV zum tatsächlichen Cash-Delta der Saison abgleichbar wird, ohne neue Buchungskategorien zu
   * erfinden. `null`, wenn `cashSeasonStart` `null` ist.
   */
  otherCashMovements: number | null;
  /** Saison-für-Saison-Verlauf (bis zu 4 vergangene Saisons + laufende Saison), siehe `FinanceSeasonHistoryPoint`. */
  history: FinanceSeasonHistoryPoint[];
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
