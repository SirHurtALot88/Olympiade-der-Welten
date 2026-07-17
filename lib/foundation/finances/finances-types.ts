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

/** One built facility's real cash season income, for the "Gebäude-Einnahmen"-Einnahme hover breakdown (desc sortiert). */
export type FinanceFacilityIncomeRow = {
  label: string;
  income: number;
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

/**
 * Preisgeld (Liga-Pool, Rang-Basis + Saison-Anteil + Platzierungsbonus), siehe `buildTeamPrizeSummary`.
 *
 * WICHTIG: Preisgeld ist ausschließlich ein BENCHMARK und wird NIE als Cash ausgezahlt
 * (`CASH_PRIZE_BENCHMARK_ONLY = true` in `lib/season/cash-prize-apply-service.ts`, Team-Cash bleibt
 * unverändert). Es fließt deshalb NICHT in `totalIncome`/`guv` ein — siehe `income.prizeBenchmark`.
 * `null` wenn kein Standing vorliegt.
 */
export type FinancePrizeIncome = {
  total: number;
  basis: number;
  seasonShare: number;
  placementBonus: number;
};

/** Reale Gebäude-Saison-Einnahmen (cash-wirksam) + Aufschlüsselung, clientseitig aus dem Season-End-Modell nachgebildet. `null` ohne Einnahmen. */
export type FinanceFacilityIncome = {
  total: number;
  facilities: FinanceFacilityIncomeRow[];
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
  /**
   * Real cash-wirksame Gebäude-Saison-Einnahmen (Fan-Shop flach + Arena × Beliebtheit), clientseitig
   * aus dem Season-End-Modell (`facility-season-end-service`) nachgebildet — OHNE dessen node-only
   * Persistenz-/crypto-Importe. `null` wenn kein Gebäude Einnahmen liefert.
   */
  facilityIncome: FinanceFacilityIncome | null;
  /** Nur gesetzt, wenn `transfer.net > 0` (Netto-Verkäufer) — sonst läuft der Saldo als Ausgabe. */
  transferSurplus: number | null;
  /**
   * Board-Objective-Netto-cashDelta, nur gesetzt wenn > 0 (Prämie). Spiegelt genau den Betrag, den
   * `buildTeamSeasonObjectiveSettlement` tatsächlich verbucht — keine Duplikation der Logik.
   */
  objectiveReward: number | null;
  /**
   * Preisgeld (Liga-Pool) — reiner BENCHMARK, NIE cash-wirksam (siehe `FinancePrizeIncome`). Fließt
   * bewusst NICHT in `totalIncome`/`guv`; rein informativ getrennt ausgewiesen. `null` ohne Standing.
   */
  prizeBenchmark: FinancePrizeIncome | null;
};

export type TeamFinancesExpenses = {
  salaries: { total: number; players: FinanceSalaryRow[] };
  /**
   * `total` = BEZAHLTER Saison-Upkeep (nur die im Season-End-Settlement tatsächlich bezahlten Gebäude,
   * gedeckelt durch verfügbares Cash + Gebäude-Einnahmen) — NICHT der Brutto-Upkeep aller Gebäude.
   * Symmetrisch zu `income.facilityIncome`.
   */
  facilityUpkeep: { total: number; facilities: FinanceFacilityUpkeepRow[] };
  loanInstallments: { total: number; loans: FinanceLoanInstallmentRow[] };
  /** Nur gesetzt, wenn `transfer.net < 0` (Netto-Käufer) — als positiver Betrag. */
  transferDeficit: number | null;
  /**
   * Board-Objective-Netto-cashDelta, nur gesetzt wenn < 0 (Strafe, als positiver Betrag). Spiegelt
   * `buildTeamSeasonObjectiveSettlement` — keine Duplikation der Logik.
   */
  objectivePenalty: number | null;
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
  /**
   * Live `guv` der laufenden Saison. Für ARCHIVIERTE Saisons bewusst `null`: der persistierte
   * `SeasonSnapshotTeamRecord.guv` wurde mit der alten prize-als-Einnahme-Formel (bzw. dem
   * Benchmark-Pfad `writeLocalCashPrizeApply`, `cash-prize-apply-service`) gebildet und ist NICHT
   * mit der hier korrigierten GuV vergleichbar. Statt Phantomwerte zu zeigen, degradiert die
   * Sparkline ehrlich auf den Empty-State (siehe Finding (d) / `FinanceHistoryTrend`).
   */
  guv: number | null;
  /**
   * Reales Saison-End-Cash. Für archivierte Saisons vorrangig `cashEnd` (echtes fortgeschriebenes
   * `team.cash`), NICHT das benchmark-`cashTotal` (= projiziertes `projectedCash`, kein reales Cash).
   * Live `cash` für die laufende Saison. `null` wenn im Snapshot nicht erfasst.
   */
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
  /** Σ real cash-wirksamer Einnahmen: Sponsor + Gebäude-Einnahmen + Transfer-Überschuss + Objective-Prämie. OHNE Preisgeld (Benchmark). */
  totalIncome: number;
  /** Σ real cash-wirksamer Ausgaben: Gehälter (`contract.salary`) + bezahlter Upkeep + Kreditraten + Transfer-Defizit + Objective-Strafe. */
  totalExpenses: number;
  /**
   * `totalIncome - totalExpenses` — spiegelt exakt die cash-wirksame Season-End-Kette
   * (Sponsor − Gehalt) − Kredit-Tilgung + (FacilityIncome − bezahlter Upkeep) + Objective-cashDelta
   * ± Transfer-Saldo. Preisgeld ist NIE enthalten (Benchmark). Damit gilt
   * `cashSeasonStart + guv + otherCashMovements == cash` (siehe `otherCashMovements`).
   */
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
