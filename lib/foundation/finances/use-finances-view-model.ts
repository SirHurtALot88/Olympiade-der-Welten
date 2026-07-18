"use client";

import { useMemo } from "react";

import type { GameState, SponsorOfferComponentKind } from "@/lib/data/olyDataTypes";
import { estimateTeamAnnualRevenue, getTeamAnnualLoanInterest } from "@/lib/finance/loan-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { getSponsorComponentKindLabel } from "@/lib/sponsor/sponsor-offer-presenter";
import { FACILITY_CATALOG, getFacilityLevelDefinition } from "@/lib/facilities/facility-catalog";
import {
  calculateFacilitySeasonUpkeep,
  getFacilityEfficiency,
  getFacilityLevel,
  getTeamFacilityState,
} from "@/lib/facilities/facility-effects";
import { computeTeamBeliebtheitFromGameState } from "@/lib/economy/team-beliebtheit";
import { buildTeamSeasonObjectiveSettlement } from "@/lib/board/team-season-objectives-service";
import { normalizeEconomyMoney, resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import type {
  FinanceFacilityIncome,
  FinanceFacilityIncomeRow,
  FinanceFacilityUpkeepRow,
  FinancePrizeIncome,
  FinanceSeasonHistoryPoint,
  FinanceSponsorIncome,
  FinanceTransferBalance,
  FinancesViewModel,
  TeamFinancesState,
} from "@/lib/foundation/finances/finances-types";

/** Gleiche Rundung wie Cash-Werte im Kredit-/Sponsor-Service (1 Nachkommastelle). */
function round1(value: number): number {
  return Number(value.toFixed(1));
}

/** 2-Nachkommastellen-Rundung — spiegelt `roundValue(x, 2)` im `facility-season-end-service`, damit die
 *  „paid vs. unpaid"-Schwelle (Cash + Einnahmen ≥ Upkeep) bit-genau zur echten Season-End-Resolution passt. */
function round2(value: number): number {
  return Number(value.toFixed(2));
}

type FacilitySeasonEndCash = {
  income: FinanceFacilityIncome | null;
  /** Nur die tatsächlich BEZAHLTEN Upkeep-Zeilen (Season-End-Settlement-Semantik). */
  paidUpkeep: { total: number; facilities: FinanceFacilityUpkeepRow[] };
};

/**
 * Client-safe Nachbau von `previewFacilitySeasonEndFinance` (facility-season-end-service) — bewusst
 * OHNE dessen node:crypto/better-sqlite3-Importe (die sonst ins Client-Bundle gezogen würden). Nutzt
 * nur die client-safen Helfer `getFacilityLevel`/`getFacilityEfficiency`/`getFacilityLevelDefinition`/
 * `calculateFacilitySeasonUpkeep` und `computeTeamBeliebtheitFromGameState` (Arena-Skalierung),
 * exakt wie `buildRows`/`previewFacilitySeasonEndFinance` dort:
 *   - income = seasonIncome × efficiency × (Arena? Beliebtheit : 1) / 100
 *   - Upkeep gilt nur als BEZAHLT, wenn (Cash + Gesamteinnahmen − bisher bezahlt) ≥ Upkeep und nicht
 *     schon in dieser Saison bezahlt — sonst „will_disable_unpaid" (nicht cash-wirksam).
 * Der reale Cash-Effekt der Season-End-Resolution ist damit `income.total − paidUpkeep.total`.
 */
function computeFacilitySeasonEndCash(gameState: GameState, teamId: string, cashBefore: number | null): FacilitySeasonEndCash {
  const teamFacilities = getTeamFacilityState(gameState, teamId);
  const seasonId = gameState.season.id;
  const arenaPopularityFactor = computeTeamBeliebtheitFromGameState(gameState, teamId).value;

  // Reihenfolge = FACILITY_CATALOG (identisch zu buildRows), damit die Cash-gedeckelte
  // „paid"-Entscheidung dieselben Gebäude in derselben Reihenfolge abarbeitet.
  const rows = FACILITY_CATALOG.map((facility) => {
    const effectLevel = getFacilityLevel(teamFacilities, facility.facilityId);
    const efficiencyPct = getFacilityEfficiency(teamFacilities, facility.facilityId).efficiencyPct;
    const definition = getFacilityLevelDefinition(facility.facilityId, effectLevel);
    const popularityFactor = facility.facilityId === "arena_upgrade" ? arenaPopularityFactor : 1;
    return {
      label: facility.label,
      income: round2(((definition?.seasonIncome ?? 0) * efficiencyPct * popularityFactor) / 100),
      upkeep: round2(calculateFacilitySeasonUpkeep(facility.facilityId, teamFacilities)),
      alreadyPaid: teamFacilities.facilities[facility.facilityId]?.lastPaidSeasonId === seasonId,
    };
  });

  const incomeTotalRaw = round2(rows.reduce((sum, row) => sum + row.income, 0));
  let cashAvailableForUpkeep = cashBefore == null ? null : round2(cashBefore + incomeTotalRaw);

  const paidUpkeepRows: FinanceFacilityUpkeepRow[] = [];
  let paidUpkeepTotalRaw = 0;
  for (const row of rows) {
    if (row.upkeep <= 0 || row.alreadyPaid) continue;
    if (cashAvailableForUpkeep != null && cashAvailableForUpkeep < row.upkeep) continue; // will_disable_unpaid
    if (cashAvailableForUpkeep != null) cashAvailableForUpkeep = round2(cashAvailableForUpkeep - row.upkeep);
    paidUpkeepRows.push({ label: row.label, upkeep: round1(row.upkeep) });
    paidUpkeepTotalRaw += row.upkeep;
  }

  const incomeRows: FinanceFacilityIncomeRow[] = rows
    .filter((row) => row.income > 0)
    .map((row) => ({ label: row.label, income: round1(row.income) }))
    .sort((left, right) => right.income - left.income);
  const incomeTotal = round1(incomeTotalRaw);

  return {
    income: incomeTotal > 0 ? { total: incomeTotal, facilities: incomeRows } : null,
    paidUpkeep: {
      total: round1(paidUpkeepTotalRaw),
      facilities: paidUpkeepRows.sort((left, right) => right.upkeep - left.upkeep),
    },
  };
}

/** Anzeige-Reihenfolge der Sponsor-Vertragskomponenten (mirrors `SPONSOR_STACK_SEGMENTS` in FoundationSponsorsNewLook). */
const SPONSOR_COMPONENT_KIND_ORDER: SponsorOfferComponentKind[] = ["base", "rank", "improvement", "special"];

/** Wie viele vergangene (archivierte) Saisons der GuV-/Cash-Verlauf zusätzlich zur laufenden Saison zeigt (T-107). */
const HISTORY_PAST_SEASONS = 4;

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
  // T-030: `total` und die `components`-Aufschlüsselung müssen aus derselben
  // Quelle stammen, sonst laufen Summe und Aufschlüsselung sichtbar
  // auseinander (wirkt wie ein UI-Rechenfehler). Bevorzugt daher IMMER die
  // Summe der aktuellen Vertragskomponenten (identische Quelle wie die
  // Aufschlüsselung darunter). Nur wenn der aktuelle Vertrag keine
  // (positiven) Komponenten mehr liefert (z. B. Vertrag ausgelaufen, aber es
  // gibt noch ein abgerechnetes Payout-Log der Vorsaison) fällt `total` auf
  // den `estimateTeamAnnualRevenue`-Proxy zurück — dann `totalIsEstimate:
  // true`, siehe `FinanceSponsorIncome`-Doku.
  const sponsorContract = getTeamSponsorContract(gameState, teamId);
  const sponsorComponents = sponsorContract
    ? SPONSOR_COMPONENT_KIND_ORDER.flatMap((kind) => {
        const component = sponsorContract.components.find((entry) => entry.kind === kind);
        if (!component || !Number.isFinite(component.rewardCash) || component.rewardCash <= 0) return [];
        return [{ kind, label: getSponsorComponentKindLabel(kind), rewardCash: round1(component.rewardCash) }];
      })
    : [];
  const sponsorComponentsTotal = round1(sponsorComponents.reduce((sum, component) => sum + component.rewardCash, 0));
  const estimatedSponsorRevenue = estimateTeamAnnualRevenue(gameState, teamId);
  const sponsorTotalIsEstimate = sponsorComponentsTotal <= 0 && estimatedSponsorRevenue > 0;
  const sponsorTotal = sponsorComponentsTotal > 0 ? sponsorComponentsTotal : estimatedSponsorRevenue;
  const sponsor: FinanceSponsorIncome | null =
    sponsorTotal > 0
      ? { total: round1(sponsorTotal), components: sponsorComponents, totalIsEstimate: sponsorTotalIsEstimate }
      : null;

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
  // T-108 (c): Quelle ist `contract.salary` — EXAKT das Feld, das die echte Season-End-Resolution
  // abbucht (`sponsor-settlement-service.ts`: `resolvePlayerEconomyContract(...).salary ?? 0`).
  // NICHT `contract.expectedSalary` (ein abweichender Erwartungswert), sonst laufen angezeigte
  // Gehaltsausgabe und tatsächliche Cash-Belastung auseinander und die GuV stimmt nicht mit dem
  // realen Cash-Delta überein.
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const salaryRows = gameState.rosters
    .filter((entry) => entry.teamId === teamId)
    .map((entry) => {
      const player = playerById.get(entry.playerId) ?? null;
      const contract = resolvePlayerEconomyContract({ player, rosterEntry: entry });
      const salary = normalizeEconomyMoney(contract.salary) ?? 0;
      return { playerName: player?.name ?? "Unbekannter Spieler", salary: round1(salary) };
    })
    .filter((row) => row.salary > 0)
    .sort((left, right) => right.salary - left.salary);
  const salaryTotal = round1(salaryRows.reduce((sum, row) => sum + row.salary, 0));

  // --- Gebäude: Einnahmen + BEZAHLTER Unterhalt (T-108 b) ------------------
  // Symmetrisch cash-wirksam: der Season-End-Service schreibt sowohl den Facility-INCOME gut als
  // auch NUR den tatsächlich bezahlten Upkeep ab. Vorher fehlte die Einnahmenseite komplett und
  // der Brutto-Upkeep stand asymmetrisch als Ausgabe. `computeFacilitySeasonEndCash` bildet beides
  // client-safe nach (siehe Helfer oben). `cashBefore = team.cash` — identisch zu
  // `previewFacilitySeasonEndFinance`, das ebenfalls den aktuellen Team-Cash als Ausgangswert nimmt.
  const facilityCash = computeFacilitySeasonEndCash(gameState, teamId, team.cash);
  const facilityIncome = facilityCash.income;
  const facilityRows = facilityCash.paidUpkeep.facilities;
  const facilityUpkeepTotal = facilityCash.paidUpkeep.total;

  // --- Kreditzinsen (GuV-Ausgabe) ------------------------------------------
  // Buchhaltungsmodell (siehe unten bei totalExpenses): NUR der Zinsanteil einer Kreditrate ist eine
  // GuV-Ausgabe. Der Tilgungsanteil (principal) ist eine reine Bilanzbewegung (Cash runter, Restschuld
  // runter, Eigenkapital unverändert) und darf NICHT als Ausgabe zählen — genau symmetrisch dazu, dass
  // die Kreditauszahlung KEINE Einnahme ist (beide laufen über `otherCashMovements`, nicht die GuV).
  // Deshalb trägt die Kredit-Ausgabenzeile den pro-Kredit-ZINS (principalOutstanding * Zinssatz), nicht
  // die volle Rate. Pro-Kredit-Rundung = Zinsanteil im Season-End-Settlement, damit Summe (unten,
  // `getTeamAnnualLoanInterest`) und Zeilen bit-genau übereinstimmen (keine Anteil-/Flow-Chart-Diskrepanz).
  const activeLoans = (gameState.seasonState.loans ?? []).filter(
    (loan) => loan.borrowerTeamId === teamId && loan.status === "active",
  );
  const loanRows = activeLoans
    .map((loan) => ({
      lenderName:
        loan.lenderType === "team"
          ? (gameState.teams.find((candidate) => candidate.teamId === loan.lenderTeamId)?.name ?? "Team")
          : "Bank",
      installment: round1(loan.principalOutstanding * loan.interestRatePerSeason),
      outstanding: round1(loan.principalOutstanding),
    }))
    .sort((left, right) => right.installment - left.installment);
  const loanInterestTotal = getTeamAnnualLoanInterest(gameState, teamId);

  // --- Board-Objective-cashDelta (T-108 c) --------------------------------
  // Netto-cashDelta, den die Engine über `buildTeamSeasonObjectiveSettlement` tatsächlich verbucht
  // (Prämien completed − Strafen failed). Wir ZEIGEN nur diesen Netto-Wert und duplizieren die
  // Objective-Logik NICHT (der Board-Service ist die einzige Quelle; ein separater Doppelzahlungs-
  // Bug in den Sponsor-Komponenten wird andernorts im Service selbst behoben, nicht hier gespiegelt).
  const objectiveCashDelta = round1(
    buildTeamSeasonObjectiveSettlement(gameState).byTeamId[teamId]?.cashDelta ?? 0,
  );
  const objectiveReward = objectiveCashDelta > 0 ? objectiveCashDelta : null;
  const objectivePenalty = objectiveCashDelta < 0 ? round1(-objectiveCashDelta) : null;

  // Preisgeld ist NIE cash-wirksam (Benchmark) → NICHT in totalIncome. Facility-Income und
  // Objective-Prämie sind es → dazu. Symmetrisch: bezahlter Upkeep + Objective-Strafe als Ausgabe.
  //
  // Buchhaltungsmodell (Kredite): Die GuV ist intern konsistent, indem WEDER die Kreditauszahlung als
  // Einnahme NOCH die Tilgung als Ausgabe zählt — beide sind Bilanzbewegungen und landen in
  // `otherCashMovements`. Als Kredit-Ausgabe geht deshalb NUR der Zinsanteil (`loanInterestTotal`) ein,
  // nicht die volle Rate. (Vorher: volle Rate als Ausgabe, Auszahlung ausgeschlossen → inkonsistent, die
  // Tilgung wurde doppelt bestraft.) Die Cash-Reconciliation `cashSeasonStart + guv + otherCashMovements
  // == cash` bleibt gültig: `otherCashMovements` ist eine reine Differenz und absorbiert den nun nicht
  // mehr in der GuV enthaltenen Tilgungs-Cashabfluss.
  const totalIncome = round1(
    (sponsor?.total ?? 0) + (facilityIncome?.total ?? 0) + (transferSurplus ?? 0) + (objectiveReward ?? 0),
  );
  const totalExpenses = round1(
    salaryTotal + facilityUpkeepTotal + loanInterestTotal + (transferDeficit ?? 0) + (objectivePenalty ?? 0),
  );
  const guv = round1(totalIncome - totalExpenses);

  // --- Saison-Verlauf + Cash-Abgleich (T-107, T-031) -----------------------
  // Echte archivierte Season-End-Werte aus `gameState.seasonState.seasonSnapshots`
  // (`SeasonSnapshotTeamRecord.guv`/`.cashTotal`/`.cashEnd`) — KEIN Forecast wie
  // der 5-Saisons-Ausblick in prize-v2, reine Historie, keine neue Persistenz.
  // Cash trägt sich unverändert über den Saisonwechsel fort (siehe
  // `preseason-workflow-service.ts`, kein Cash-Reset), daher ist das Cash-Ende
  // der unmittelbar vorangegangenen Saison zugleich der Season-Start-Wert
  // dieser Saison.
  const pastSeasonPoints: FinanceSeasonHistoryPoint[] = (gameState.seasonState.seasonSnapshots ?? [])
    .map((snapshot): FinanceSeasonHistoryPoint | null => {
      const row = snapshot.finalStandings.find((entry) => entry.teamId === teamId) ?? null;
      if (!row) return null;
      // T-108 (d): reales fortgeschriebenes Cash-Ende BEVORZUGEN (`cashEnd`), NICHT das
      // benchmark-`cashTotal` (= projiziertes `projectedCash` aus `writeLocalCashPrizeApply`,
      // kein reales Cash). Der archivierte `guv` wurde mit der alten prize-als-Einnahme-Formel
      // gebildet und ist nicht mit der korrigierten GuV vergleichbar → bewusst `null`, damit die
      // Sparkline ehrlich in den Empty-State degradiert statt Phantomwerte zu zeigen.
      const cash = row.cashEnd ?? row.cashTotal ?? null;
      return {
        seasonId: snapshot.seasonId,
        seasonName: snapshot.seasonName,
        isCurrent: false,
        guv: null,
        cash: cash != null && Number.isFinite(cash) ? round1(cash) : null,
      };
    })
    .filter((point): point is FinanceSeasonHistoryPoint => point != null)
    .sort((left, right) => left.seasonId.localeCompare(right.seasonId, "de", { numeric: true }))
    .slice(-HISTORY_PAST_SEASONS);

  const cashSeasonStart = pastSeasonPoints.at(-1)?.cash ?? null;
  const otherCashMovements = cashSeasonStart != null ? round1(team.cash - cashSeasonStart - guv) : null;

  const history: FinanceSeasonHistoryPoint[] = [
    ...pastSeasonPoints,
    { seasonId: gameState.season.id, seasonName: gameState.season.name, isCurrent: true, guv, cash: team.cash },
  ];

  const teamFinances: TeamFinancesState = {
    teamId,
    cash: team.cash,
    income: { sponsor, facilityIncome, transferSurplus, objectiveReward, prizeBenchmark: prize },
    expenses: {
      salaries: { total: salaryTotal, players: salaryRows },
      facilityUpkeep: { total: facilityUpkeepTotal, facilities: facilityRows },
      // `total`/Zeilen = Kredit-ZINS der Saison (GuV-Ausgabe), NICHT die volle Rate — der Tilgungsanteil
      // ist eine Bilanzbewegung, keine Ausgabe (siehe Kommentar bei totalExpenses).
      loanInstallments: { total: loanInterestTotal, loans: loanRows },
      transferDeficit,
      objectivePenalty,
    },
    transfer,
    totalIncome,
    totalExpenses,
    guv,
    cashSeasonStart,
    otherCashMovements,
    history,
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
