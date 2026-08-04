/**
 * BETRIEBS-GUV — EINE Rechnung, zwei Ansichten.
 *
 * GEMELDET VON CHRIS (Ticket 24, Seite „Spieltag · Saisonstand"): „Die GuV im Saisonstand und die im
 * Finanzen-Reiter weichen voneinander ab! Bitte fixen und bitte berücksichtigen, dass auch Apron mit
 * einfließt — am besten ein Hover auf dem GuV-Posten, der noch mal aufzeigt, wie die Zahl sich
 * zusammensetzt!"
 *
 * ENTSCHEIDUNG VON CHRIS zur offenen Frage „was ist mit den Transfers?":
 *     „Lass transfers aus der GuV am besten raus die sind separat ausgewiesen"
 * Also: Transfers bleiben ein Sonderposten (eigene Spalte im Saisonstand, eigener Block im
 * Finanzen-Reiter) und zählen in KEINER der beiden Ansichten in die GuV. Der Apron dagegen zählt
 * hinein — er ist kein Einmal-Ereignis, sondern die jährliche Umverteilung der Liga.
 *
 * WAS VORHER WAR (gemessen am Save new-game-1785823388048-1hf25q, Saison 1, Spieltag 7):
 *   Saisonstand   = Sponsor + Gebäude netto (BRUTTO-Unterhalt) − Gehälter
 *   Finanzen      = Sponsor + Gebäude-Einnahmen + Vorstandsprämie
 *                   − Gehälter − BEZAHLTER Unterhalt − Kreditzinsen − Vorstandsstrafe
 * Die Differenz je Team lag zwischen −6,9 und +6,1 und bestand aus vier Posten:
 *   1. VORSTANDSZIELE — im Saisonstand gar nicht enthalten (der mit Abstand größte Anteil,
 *      ±3 bis ±7 je Team).
 *   2. GEBÄUDE-UNTERHALT — Saisonstand zog den Brutto-Unterhalt ab, der Finanzen-Reiter nur den
 *      tatsächlich bezahlten (cash-gedeckelt, schon bezahlte Saison übersprungen). Im Save traf das
 *      genau ein Team (S-C, 0,6).
 *   3. KREDITZINSEN — im Saisonstand nicht enthalten (im Save 0, weil niemand einen Kredit hatte —
 *      strukturell aber eine Abweichung).
 *   4. GEHALTS-RUNDUNG — Saisonstand summierte roh und rundete am Ende, der Finanzen-Reiter rundet
 *      je Spieler auf eine Nachkommastelle (die Zahl muss zu den Zeilen im Hover passen). Bis 0,3.
 * Der Apron fehlte in beiden.
 *
 * Diese Datei ist die eine Quelle für beide Ansichten. Sie ist bewusst CLIENT-SAFE (keine
 * node:-/better-sqlite3-Importe), damit sowohl der Finanzen-Reiter als auch das Saisonstand-
 * Panel-Modell sie im Browser rechnen können — zwei Kopien wären genau der Zustand, der die Meldung
 * ausgelöst hat.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonObjectiveSettlement } from "@/lib/board/team-season-objectives-service";
import { FACILITY_CATALOG, getFacilityLevelDefinition } from "@/lib/facilities/facility-catalog";
import {
  calculateFacilitySeasonUpkeep,
  getFacilityEfficiency,
  getFacilityLevel,
  getTeamFacilityState,
} from "@/lib/facilities/facility-effects";
import { computeTeamBeliebtheitFromGameState } from "@/lib/economy/team-beliebtheit";
import { estimateTeamAnnualRevenue, getTeamAnnualLoanInterest } from "@/lib/finance/loan-service";
import { roundValue as round1Value } from "@/lib/foundation/foundation-number-utils";
import { normalizeEconomyMoney, resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { FINANCE_SPONSOR_INCOME_COMPONENT_KINDS } from "@/lib/foundation/finances/finances-types";
import type {
  FinanceFacilityIncome,
  FinanceFacilityIncomeRow,
  FinanceFacilityUpkeepRow,
  FinanceLoanInstallmentRow,
  FinanceSalaryRow,
  FinanceSponsorIncome,
  FinanceTransferBalance,
} from "@/lib/foundation/finances/finances-types";
import { previewApronSettlement } from "@/lib/season/apron-settlement-service";
import { getSponsorComponentKindLabel } from "@/lib/sponsor/sponsor-offer-presenter";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { previewSponsorSettlement, type SponsorSettlementRow } from "@/lib/sponsor/sponsor-settlement-service";
import { getSponsorV3Terms } from "@/lib/sponsor/sponsor-v3-offer-service";

function round1(value: number): number {
  return Number(value.toFixed(1));
}

/** 2-Nachkommastellen-Rundung — spiegelt `roundValue(x, 2)` im `facility-season-end-service`, damit die
 *  „paid vs. unpaid"-Schwelle (Cash + Einnahmen ≥ Upkeep) bit-genau zur echten Season-End-Resolution passt. */
function round2(value: number): number {
  return Number(value.toFixed(2));
}

// ── Liga-weiter Kontext ───────────────────────────────────────────────────────────────────────

/**
 * Die drei Größen, die nur LIGA-WEIT bestimmbar sind (Sponsor-Abrechnung beim aktuellen Rang,
 * Vorstandsziel-Abrechnung, Apron-Umverteilung). Einmal je Aufruf bauen und für alle 32 Teams
 * wiederverwenden — pro Team gerechnet wäre jede davon 32-mal berechnet (das war schon einmal die
 * Ursache eines blockierten Event-Loops, siehe `prize-money-preview.ts`).
 */
export type OperatingGuvContext = {
  sponsorRowsByTeamId: Map<string, SponsorSettlementRow[]>;
  objectiveCashDeltaByTeamId: Map<string, number>;
  /** `ausgleich − abgabe` je Team aus der Apron-Vorschau. Fehlen die eingefrorenen Linien, ist die Map leer. */
  apronNetByTeamId: Map<string, number>;
};

export function buildOperatingGuvContext(gameState: GameState): OperatingGuvContext {
  const sponsorRowsByTeamId = new Map<string, SponsorSettlementRow[]>();
  try {
    for (const row of previewSponsorSettlement(gameState).rows) {
      const bucket = sponsorRowsByTeamId.get(row.teamId);
      if (bucket) bucket.push(row);
      else sponsorRowsByTeamId.set(row.teamId, [row]);
    }
  } catch {
    // Sponsor-Vorschau ist optional — fehlt sie, greift unten der Estimate-Fallback.
  }

  const objectiveCashDeltaByTeamId = new Map<string, number>();
  try {
    const settlement = buildTeamSeasonObjectiveSettlement(gameState);
    for (const [teamId, entry] of Object.entries(settlement.byTeamId)) {
      objectiveCashDeltaByTeamId.set(teamId, entry?.cashDelta ?? 0);
    }
  } catch {
    // Ohne Vorstandsziele bleibt der Posten schlicht leer.
  }

  const apronNetByTeamId = new Map<string, number>();
  try {
    // Ohne eingefrorene Linien liefert die Vorschau bewusst KEINE Zeilen (siehe
    // apron-settlement-service) — dann bleibt der Apron-Posten leer statt eine Grenze zu erfinden.
    for (const row of previewApronSettlement(gameState).rows) {
      apronNetByTeamId.set(row.teamId, row.nettoDelta);
    }
  } catch {
    // Apron-Vorschau ist optional.
  }

  return { sponsorRowsByTeamId, objectiveCashDeltaByTeamId, apronNetByTeamId };
}

// ── Gebäude (client-safer Nachbau der Season-End-Resolution) ──────────────────────────────────

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
    paidUpkeepRows.push({ label: row.label, upkeep: round1Value(row.upkeep) });
    paidUpkeepTotalRaw += row.upkeep;
  }

  const incomeRows: FinanceFacilityIncomeRow[] = rows
    .filter((row) => row.income > 0)
    .map((row) => ({ label: row.label, income: round1Value(row.income) }))
    .sort((left, right) => right.income - left.income);
  const incomeTotal = round1Value(incomeTotalRaw);

  return {
    income: incomeTotal > 0 ? { total: incomeTotal, facilities: incomeRows } : null,
    paidUpkeep: {
      total: round1Value(paidUpkeepTotalRaw),
      facilities: paidUpkeepRows.sort((left, right) => right.upkeep - left.upkeep),
    },
  };
}

/** Mehr Zeilen würden den Tooltip sprengen — der Rest wird als „+ N weitere" zusammengefasst. */
export const SALARY_TOOLTIP_MAX_ROWS = 12;

// ── Die GuV eines Teams ───────────────────────────────────────────────────────────────────────

export type TeamOperatingGuv = {
  teamId: string;
  sponsor: FinanceSponsorIncome | null;
  facilityIncome: FinanceFacilityIncome | null;
  objectiveReward: number | null;
  /** Apron-Ausgleich (Einnahme) — nur gesetzt, wenn das Team unter der 1. Linie liegt und etwas bekommt. */
  apronPayout: number | null;
  salaries: { total: number; players: FinanceSalaryRow[] };
  facilityUpkeep: { total: number; facilities: FinanceFacilityUpkeepRow[] };
  loanInstallments: { total: number; loans: FinanceLoanInstallmentRow[] };
  objectivePenalty: number | null;
  /** Apron-Abgabe (Ausgabe, als positiver Betrag) — nur gesetzt, wenn das Team über der 1. Linie zahlt. */
  apronLevy: number | null;
  /** SONDERPOSTEN — bewusst NICHT in `totalIncome`/`totalExpenses`/`guv` (Entscheidung Chris). */
  transfer: FinanceTransferBalance | null;
  transferSurplus: number | null;
  transferDeficit: number | null;
  totalIncome: number;
  totalExpenses: number;
  guv: number;
};

/**
 * Die Betriebs-GuV eines Teams. `context` einmal je Liga-Lauf bauen und durchreichen; wird er
 * weggelassen, baut die Funktion ihn für diesen einen Aufruf selbst (der Normalfall im
 * Finanzen-Reiter, der ohnehin nur ein Team rechnet).
 */
export function buildTeamOperatingGuv(
  gameState: GameState,
  teamId: string,
  context?: OperatingGuvContext,
): TeamOperatingGuv | null {
  const team = gameState.teams.find((candidate) => candidate.teamId === teamId);
  if (!team) return null;
  const ctx = context ?? buildOperatingGuvContext(gameState);

  // --- Sponsor (Vertrag) ------------------------------------------------
  // T-030: `total` und die `components`-Aufschlüsselung müssen aus derselben Quelle stammen, sonst
  // laufen Summe und Aufschlüsselung sichtbar auseinander (wirkt wie ein UI-Rechenfehler). Deshalb
  // IMMER die Summe der aktuellen Vertragskomponenten. Nur wenn der aktuelle Vertrag keine
  // (positiven) Komponenten mehr liefert, fällt `total` auf den `estimateTeamAnnualRevenue`-Proxy
  // zurück — dann `totalIsEstimate: true`.
  //
  // WICHTIG: `component.rewardCash` aus dem Vertrag ist nur die OBERGRENZE des Bausteins, nicht der
  // zu erwartende Betrag. Die tatsächlich cash-wirksame Auszahlung hängt am aktuellen Rang und wird
  // von `previewSponsorSettlement` genauso berechnet wie im echten Season-End-Settlement.
  const sponsorContract = getTeamSponsorContract(gameState, teamId);
  const sponsorSettlementRows = ctx.sponsorRowsByTeamId.get(teamId) ?? [];
  // SPONSORSYSTEM V3: die Aufschlüsselung kommt ZEILENWEISE aus dem Settlement statt über `kind`
  // gruppiert. Die Settlement-Zeilen sind Teleskop-Differenzen der eingefrorenen Leiter; gruppiert
  // man sie nach `kind` und summiert die Belohnungsbeträge der Komponenten, entstehen Beträge, die
  // es so nicht gibt.
  const isV3Contract = getSponsorV3Terms(sponsorContract) != null;
  const sponsorComponents = !sponsorContract
    ? []
    : isV3Contract
      ? sponsorSettlementRows
          .filter((row) => FINANCE_SPONSOR_INCOME_COMPONENT_KINDS.includes(row.kind))
          // Auch NEGATIVE Zeilen gehören dazu: eine verfehlte Achse trägt −G/2 und die
          // Vorschuss-Verrechnung ist immer negativ. Wegzulassen hieße, dem Team eine Einnahme
          // auszuweisen, die es nie bekommt.
          .filter((row) => Number.isFinite(row.cashDelta) && row.cashDelta !== 0)
          .map((row) => ({ kind: row.kind, label: row.label, rewardCash: round1(row.cashDelta) }))
      : FINANCE_SPONSOR_INCOME_COMPONENT_KINDS.flatMap((kind) => {
          const rewardCash = sponsorSettlementRows
            .filter((row) => row.kind === kind)
            .reduce((sum, row) => sum + row.cashDelta, 0);
          if (!Number.isFinite(rewardCash) || rewardCash <= 0) return [];
          return [{ kind, label: getSponsorComponentKindLabel(kind), rewardCash: round1(rewardCash) }];
        });
  const sponsorComponentsTotal = round1(sponsorComponents.reduce((sum, component) => sum + component.rewardCash, 0));
  const estimatedSponsorRevenue = estimateTeamAnnualRevenue(gameState, teamId);
  const sponsorTotalIsEstimate = sponsorComponentsTotal <= 0 && estimatedSponsorRevenue > 0;
  const sponsorTotal = sponsorComponentsTotal > 0 ? sponsorComponentsTotal : estimatedSponsorRevenue;
  const sponsor: FinanceSponsorIncome | null =
    sponsorTotal > 0
      ? { total: round1(sponsorTotal), components: sponsorComponents, totalIsEstimate: sponsorTotalIsEstimate }
      : null;

  // --- Gehälter (Kader) ---------------------------------------------------
  // Quelle ist `contract.salary` — EXAKT das Feld, das die echte Season-End-Resolution abbucht
  // (`sponsor-settlement-service.ts`). NICHT `contract.expectedSalary` (ein abweichender
  // Erwartungswert), sonst laufen angezeigte Gehaltsausgabe und tatsächliche Cash-Belastung
  // auseinander. Je Spieler auf eine Nachkommastelle gerundet, damit die Summe zu den Zeilen im
  // Hover passt (der Saisonstand rundete früher erst am Schluss — bis 0,3 Unterschied).
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

  // --- Gebäude: Einnahmen + BEZAHLTER Unterhalt ---------------------------
  const facilityCash = computeFacilitySeasonEndCash(gameState, teamId, team.cash);

  // --- Kreditzinsen (GuV-Ausgabe) ------------------------------------------
  // NUR der Zinsanteil einer Kreditrate ist eine GuV-Ausgabe. Der Tilgungsanteil ist eine reine
  // Bilanzbewegung (Cash runter, Restschuld runter) und darf NICHT als Ausgabe zählen — symmetrisch
  // dazu, dass die Kreditauszahlung KEINE Einnahme ist.
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

  // --- Vorstandsziele ------------------------------------------------------
  // Netto-cashDelta, den die Engine über `buildTeamSeasonObjectiveSettlement` tatsächlich verbucht.
  const objectiveCashDelta = round1(ctx.objectiveCashDeltaByTeamId.get(teamId) ?? 0);
  const objectiveReward = objectiveCashDelta > 0 ? objectiveCashDelta : null;
  const objectivePenalty = objectiveCashDelta < 0 ? round1(-objectiveCashDelta) : null;

  // --- Apron (Chris: „bitte berücksichtigen dass auch Apron mit einfließt") ----
  // Zahler und Empfänger schließen sich aus (Abgabe verlangt Gehalt über der 1. Linie, Ausgleich
  // Gehalt strikt darunter) — deshalb ist immer höchstens eine der beiden Zeilen gesetzt.
  const apronNet = round1(ctx.apronNetByTeamId.get(teamId) ?? 0);
  const apronPayout = apronNet > 0 ? apronNet : null;
  const apronLevy = apronNet < 0 ? round1(-apronNet) : null;

  // --- Transfer-Saldo (SONDERPOSTEN, NICHT in der GuV) --------------------
  // Direkt aus `transferHistory` statt `collectSeasonTransferPipelineGuv` (liga-weit) oder
  // `TeamManagementSnapshotRow.transferNet` (all-time) — mirrors `buildTransferFinanceAudit`'s
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

  const totalIncome = round1(
    (sponsor?.total ?? 0) + (facilityCash.income?.total ?? 0) + (objectiveReward ?? 0) + (apronPayout ?? 0),
  );
  const totalExpenses = round1(
    salaryTotal + facilityCash.paidUpkeep.total + loanInterestTotal + (objectivePenalty ?? 0) + (apronLevy ?? 0),
  );

  return {
    teamId,
    sponsor,
    facilityIncome: facilityCash.income,
    objectiveReward,
    apronPayout,
    salaries: { total: salaryTotal, players: salaryRows },
    facilityUpkeep: facilityCash.paidUpkeep,
    loanInstallments: { total: loanInterestTotal, loans: loanRows },
    objectivePenalty,
    apronLevy,
    transfer,
    transferSurplus: transfer != null && transfer.net > 0 ? round1(transfer.net) : null,
    transferDeficit: transfer != null && transfer.net < 0 ? round1(-transfer.net) : null,
    totalIncome,
    totalExpenses,
    guv: round1(totalIncome - totalExpenses),
  };
}

/** Dieselbe Rechnung für die ganze Liga — Kontext einmal, dann 32-mal die reine Team-Arithmetik. */
export function buildLeagueOperatingGuv(gameState: GameState): Map<string, TeamOperatingGuv> {
  const context = buildOperatingGuvContext(gameState);
  const byTeamId = new Map<string, TeamOperatingGuv>();
  for (const team of gameState.teams) {
    const row = buildTeamOperatingGuv(gameState, team.teamId, context);
    if (row) byTeamId.set(team.teamId, row);
  }
  return byTeamId;
}
