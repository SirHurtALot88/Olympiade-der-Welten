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

/**
 * Sponsor-Komponenten-Arten, die als laufende "Sponsor"-Einnahme gezeigt werden — GEMEINSAME Quelle für
 * die eigene Detail-Übersicht (`use-finances-view-model.ts`) UND die Liga-Vergleichstabelle
 * (`use-finances-league-table.ts`), damit beide auf demselben Finanzen-Screen niemals verschiedene
 * Sponsorsummen für dasselbe Team zeigen.
 *
 * `overperformance` ist bewusst NICHT enthalten: dessen `rewardCash` ist nur ein CAP, ausgezahlt wird
 * `min(cap, ratePerUnitC × Plätze über Erwartungsrang)` (siehe sponsor-settlement-service.ts) — also
 * 0 C, solange das Team seinen Erwartungsrang nicht übertrifft. Als sichere Einnahme ausgewiesen würde
 * der Cap die Einnahmen systematisch aufblähen. Die Reihenfolge bestimmt zugleich die Anzeige-Sortierung.
 */
export const FINANCE_SPONSOR_INCOME_COMPONENT_KINDS: SponsorOfferComponentKind[] = [
  "base",
  "rank",
  "improvement",
  "special",
];

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
 * @deprecated LEGACY — Preisgeld wird NICHT mehr ausgezahlt und NICHT mehr genutzt. Einnahmen laufen
 * ausschließlich über Sponsoren (+ Gebäude). Dieser Typ und `prizeBenchmark` bleiben nur aus
 * Back-Compat-Gründen bestehen (der Wert wird noch berechnet, aber NICHT mehr in der UI gezeigt).
 * Nicht für neue Features verwenden — überall Sponsoren nutzen.
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
   * @deprecated LEGACY — Preisgeld ist abgeschafft (nicht ausgezahlt, nicht genutzt). Wird noch
   * berechnet, aber in der UI NICHT mehr angezeigt. Immer Sponsoren verwenden. Wird bei einem
   * späteren Cleanup ganz entfernt.
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
  /** Team-Logo (Browser-URL) — `null` wenn kein Logo hinterlegt; dann greift `logoInitials`. */
  logoUrl: string | null;
  /** Initialen-Fallback (max. 2 Buchstaben) für die Crest-Anzeige ohne Logo. */
  logoInitials: string;
  cash: number;
  /** Sponsor + Preisgeld p.a. (Näherungswert, ohne Transfer-Saldo). */
  incomeAnnual: number;
  /**
   * Gehälter + Gebäude-Unterhalt + Kredit-ZINS p.a. (Näherungswert, ohne Transfer-Saldo).
   * Bewusst nur der Zins: Die Tilgung ist keine GuV-Ausgabe, sondern eine Bilanz-Umbuchung
   * (Schulden runter) — und die Kreditauszahlung wird spiegelbildlich auch nicht als
   * Einnahme gebucht. Der reine Liquiditätsabfluss steht in `cashFlowAnnual`.
   */
  expensesAnnual: number;
  /** `incomeAnnual - expensesAnnual`. */
  guv: number;
  /** Tilgungsanteil der Kreditraten p.a. (cash-wirksam, aber kein GuV-Aufwand). */
  loanPrincipalAnnual: number;
  /** Tatsächliche Cash-Veränderung p.a.: `guv - loanPrincipalAnnual`. */
  cashFlowAnnual: number;
  /** Kader-Marktwert-Summe (`TeamManagementSnapshotRow.marketValueTotal`) — `null` ohne Kader. */
  marketValue: number | null;
};
