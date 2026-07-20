import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { resolveTransferDoctrine } from "@/lib/ai/ai-transfer-doctrine-layer";
import { isMarketBuyTransferEntry } from "@/lib/season/transfer-season-policy";
import { buildTeamSeasonObjectiveSettlement } from "@/lib/board/team-season-objectives-service";

export type TransferFinanceTeamSeasonRow = {
  seasonId: string;
  teamId: string;
  teamName: string;
  cashStart: number | null;
  cashEnd: number | null;
  buyFeesPaid: number;
  sellProceeds: number;
  netTransferCash: number;
  sponsorCashIn: number;
  salaryPaidOut: number;
  netSponsorCash: number;
  /** Mid-Season-Sponsor-Event-Cash (auto-settle `sponsorEvents`, nicht in sponsorPayoutLogs). */
  netSponsorEventCash: number;
  /** T-029: Kredit-Cashflows der Saison (loanOriginationLogs + loanApplyLogs, beide Seiten bei Team-Krediten). */
  netLoanCash: number;
  /** T-029: Gebäude-Cashflows der Saison (facilityEvents-Ledger, `-cost` je Event). */
  netFacilityCash: number;
  /**
   * Board-Objective-Reward-Cash der Saison (settlement `byTeamId[teamId].cashDelta`, am Saisonende via
   * `applyTeamSeasonObjectiveRewards` direkt auf `team.cash` gebucht). Nur für die aktuelle Saison
   * rekonstruierbar (siehe `getSeasonObjectiveRewardCashByTeam`).
   */
  netObjectiveRewardCash: number;
  buyCount: number;
  draftBuyCount: number;
  marketBuyCount: number;
  sellCount: number;
  cashReconciliationDelta: number | null;
};

export type TransferFinanceAuditResult = {
  rows: TransferFinanceTeamSeasonRow[];
  violations: string[];
  doctrineStats: Array<{
    seasonId: string;
    teamId: string;
    persona: string;
    /** Markt-Käufe (exkl. bezahlter S1-Draft-Picks). */
    buys: number;
    draftBuys: number;
    marketBuys: number;
    sells: number;
    replacementSellCount: number;
    replacementBuyCount: number;
  }>;
};

/**
 * T-028: harte Schwelle, ab der ein `cash_reconciliation_delta` kein tolerierbares In-Season-Opex-
 * Rauschen mehr ist, sondern ein echtes Cash-Leck (wird als `cash_reconciliation_delta_hard:`
 * getaggt statt `cash_reconciliation_delta:`, siehe `buildTransferFinanceAudit`). Bewusst als
 * benannte, exportierte Konstanten gehalten, damit sie leicht justierbar sind, ohne die Formel
 * suchen zu müssen.
 */
export const RECONCILIATION_HARD_BLOCKER_MIN_ABS = 1;
export const RECONCILIATION_HARD_BLOCKER_CASH_START_RATIO = 0.05;

export function reconciliationHardBlockerThreshold(cashStart: number) {
  return Math.max(RECONCILIATION_HARD_BLOCKER_MIN_ABS, round(RECONCILIATION_HARD_BLOCKER_CASH_START_RATIO * Math.abs(cashStart)));
}

/**
 * T-029: Nachdem Kredit- und Gebäude-Cashflows jetzt in `cashReconciliationDelta` einfließen
 * (siehe `buildTransferFinanceAudit`), sollte im Normalfall nur noch Rundungsrauschen (roundCash/
 * roundValue auf 1-2 Nachkommastellen, mehrere Buchungen pro Team/Saison) übrig bleiben. Bewusst
 * < 1 gehalten, siehe tests/economy-cashflow-invariant.test.ts (SINGLE_BOOKING_TOLERANCE=0.05,
 * AGGREGATE_TOLERANCE=0.2 über mehrere Systeme) für die dort verifizierten Größenordnungen.
 */
export const RECONCILIATION_ROUNDING_TOLERANCE = 0.5;

/** Match transfer-finance violation strings to a specific season (avoids prior-season false positives). */
export function isTransferFinanceViolationForSeason(violation: string, seasonId: string) {
  if (violation.startsWith("cash_reconciliation_delta:")) return false;
  const tagged = violation.match(
    /^(?:negative_cash_end|zero_fee_buy|repair_buy_fee_not_mw|cash_reconciliation_delta_hard):(season-\d+):/,
  );
  if (tagged) return tagged[1] === seasonId;
  return violation.startsWith(`${seasonId}:`) || violation.includes(`:${seasonId}:`);
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function seasonsFromHistory(gameState: GameState) {
  const ids = new Set<string>();
  for (const entry of gameState.transferHistory) ids.add(entry.seasonId);
  for (const snapshot of gameState.seasonState.seasonSnapshots ?? []) ids.add(snapshot.seasonId);
  ids.add(gameState.season.id);
  return [...ids].sort((left, right) => left.localeCompare(right, "de", { numeric: true }));
}

function getSnapshotCashByTeam(gameState: GameState, seasonId: string) {
  const snapshot = gameState.seasonState.seasonSnapshots?.find((entry) => entry.seasonId === seasonId);
  const map = new Map<string, number>();
  for (const row of snapshot?.finalStandings ?? []) {
    map.set(row.teamId, row.cashEnd ?? row.cashTotal ?? 0);
  }
  return map;
}

function getTeamName(gameState: GameState, teamId: string) {
  return gameState.teams.find((team) => team.teamId === teamId)?.name ?? teamId;
}

/**
 * T-029: Kredit-Cashflows einer Saison, pro Team aggregiert — Auszahlung (`loanOriginationLogs`)
 * UND Saison-End-Tilgung (`loanApplyLogs`). `loanApplyLogs`-Einträge tragen selbst keine
 * Team-ID/Lender-Info (nur `loanId`), deshalb wird über `gameState.seasonState.loans` auf
 * `borrowerTeamId`/`lenderType`/`lenderTeamId` aufgelöst — exakt dasselbe Muster wie in
 * tests/economy-cashflow-invariant.test.ts (Phase 4a/4b) verifiziert.
 */
function getSeasonLoanCashByTeam(gameState: GameState, seasonId: string) {
  const map = new Map<string, number>();
  const add = (teamId: string | null | undefined, amount: number | null | undefined) => {
    if (!teamId || !amount) return;
    map.set(teamId, round((map.get(teamId) ?? 0) + amount));
  };
  const loansById = new Map((gameState.seasonState.loans ?? []).map((loan) => [loan.loanId, loan] as const));

  for (const log of gameState.seasonState.loanOriginationLogs ?? []) {
    if (log.seasonId !== seasonId) continue;
    add(log.borrowerTeamId, log.borrowerCashDelta);
    if (log.lenderType === "team" && log.lenderTeamId) {
      add(log.lenderTeamId, log.lenderCashDelta);
    }
  }

  for (const log of gameState.seasonState.loanApplyLogs ?? []) {
    if (log.seasonId !== seasonId) continue;
    const loan = loansById.get(log.loanId);
    if (!loan) continue;
    add(loan.borrowerTeamId, -log.installmentCharged);
    if (loan.lenderType === "team" && loan.lenderTeamId) {
      add(loan.lenderTeamId, log.installmentCharged);
    }
  }

  return map;
}

/**
 * T-029: Gebäude-Cashflows einer Saison, pro Team aggregiert, aus dem `facilityEvents`-Ledger.
 * `cost` ist dort so gepolt, dass der tatsächliche Cash-Effekt `-cost` ist (positive `cost` =
 * Ausgabe/Upkeep, negative `cost` = Einnahme/Refund — siehe facility-upgrade-service.ts und
 * facility-season-end-service.ts, wo `team.cash - cost` bzw. `-preview.facilityIncomeTotal`
 * geschrieben wird).
 */
function getSeasonFacilityCashByTeam(gameState: GameState, seasonId: string) {
  const map = new Map<string, number>();
  for (const event of gameState.seasonState.facilityEvents ?? []) {
    if (event.seasonId !== seasonId) continue;
    map.set(event.teamId, round((map.get(event.teamId) ?? 0) - event.cost));
  }
  return map;
}

/**
 * Sponsor-EVENT-Cashflows einer Saison, pro Team aggregiert. Mid-Season-Sponsor-Events
 * (`sponsorEvents`) werden beim Matchday-Advance sofort verrechnet (Auto-Settle): der `cashDelta`
 * landet direkt auf `team.cash` und der Datensatz wird mit Status `resolved` abgelegt (siehe
 * `sponsor-event-service.ts`). Dieses Cash ist BEWUSST NICHT in `sponsorPayoutLogs` (das
 * Season-End-Settlement arbeitet nur auf Vertragskomponenten), fehlte damit aber komplett in der
 * Cash-Reconciliation und tauchte als echtes (kleines) Rest-Delta auf. Nur `resolved`-Events sind
 * cash-wirksam — `open` (noch nicht eingelöst) und `dismissed` (abgelehnt) belasten `team.cash`
 * nicht.
 */
function getSeasonSponsorEventCashByTeam(gameState: GameState, seasonId: string) {
  const map = new Map<string, number>();
  for (const event of gameState.seasonState.sponsorEvents ?? []) {
    if (event.seasonId !== seasonId || event.status !== "resolved") continue;
    map.set(event.teamId, round((map.get(event.teamId) ?? 0) + event.cashDelta));
  }
  return map;
}

/**
 * Board-Objective-Reward-Cashflows einer Saison, pro Team aggregiert. Am Saisonende bucht
 * `applyTeamSeasonObjectiveRewards` (team-season-objectives-service.ts, execute:true) für jedes Team
 * `team.cash += settlement.byTeamId[teamId].cashDelta` — erfüllte Board-Ziele zahlen `rewardCash`,
 * verfehlte belasten `-penaltyCash` — und legt EINEN Idempotenz-Log (`objectiveRewardApplyLogs`) je
 * Saison ab. Dieses Cash landet VOR dem reconcilten Snapshot auf `team.cash`, fehlte bisher aber
 * komplett in der Cash-Reconciliation: exakt der blinde Fleck, den dieses Audit-Tool absichern soll.
 * Sponsor-Vertrags-Spiegel-Ziele tragen im Settlement bereits `cashDelta = 0` (siehe
 * `buildTeamSeasonObjectiveSettlement`), damit gibt es keine Doppelzählung mit `netSponsorCash`.
 *
 * WICHTIG (Rekonstruktion): Der Apply-Log trägt NUR die Saison-Summe (`payload.totalCashDelta`), keine
 * Per-Team-Aufschlüsselung, und `finalStandings` im Snapshot hält den Betrag ebenfalls nicht. Die
 * einzige deterministische Per-Team-Quelle ist daher, das Settlement neu zu rechnen — das aber immer
 * `gameState.season.id` abbildet. Deshalb wird der Kanal nur für die AKTUELLE Saison und nur dann
 * rekonstruiert, wenn für sie ein Apply-Log existiert (= Rewards wurden real gebucht; die Ziele sind
 * dann eingefroren, Recompute == gebuchter Wert). Für abgeschlossene Vor-Saisons bleibt der Kanal
 * bewusst 0 — mangels persistierter Per-Team-Daten nicht rekonstruierbar, ohne die Reward-Auszahlung
 * bzw. das Log-Schema zu ändern.
 */
function getSeasonObjectiveRewardCashByTeam(gameState: GameState, seasonId: string) {
  const map = new Map<string, number>();
  const hasApplyLog = (gameState.seasonState.objectiveRewardApplyLogs ?? []).some((log) => log.seasonId === seasonId);
  if (!hasApplyLog || seasonId !== gameState.season.id) {
    return map;
  }
  try {
    const settlement = buildTeamSeasonObjectiveSettlement(gameState);
    for (const [teamId, summary] of Object.entries(settlement.byTeamId)) {
      if (!summary || summary.cashDelta === 0) continue;
      map.set(teamId, round(summary.cashDelta));
    }
  } catch {
    // "nicht kaputt bauen": Ein Fehler in der Board-Settlement-Rekonstruktion darf das Finanz-Audit
    // nicht kippen — im Zweifel Kanal 0 (bisheriges Verhalten), statt den Report crashen zu lassen.
    return new Map<string, number>();
  }
  return map;
}

export function buildBuyEconomics(gameState: GameState) {
  const playerById = new Map(gameState.players.map((player) => [player.id, player]));
  return gameState.transferHistory
    .filter((entry): entry is TransferHistoryEntry => entry.transferType === "buy")
    .map((entry) => {
      const player = playerById.get(entry.playerId);
      const price = entry.fee ?? 0;
      const salary = entry.salary ?? player?.salaryDemand ?? 0;
      return {
        seasonId: entry.seasonId,
        playerId: entry.playerId,
        playerName: entry.playerName ?? player?.name ?? entry.playerId,
        toTeamId: entry.toTeamId,
        fee: round(price),
        annualSalary: round(salary),
        totalFirstYearCost: round(price + salary),
        source: entry.source ?? "",
      };
    });
}

export function buildTransferFinanceAudit(gameState: GameState): TransferFinanceAuditResult {
  const seasons = seasonsFromHistory(gameState);
  const rows: TransferFinanceTeamSeasonRow[] = [];
  const violations: string[] = [];
  const teamIds = new Set(gameState.teams.map((team) => team.teamId));

  for (let index = 0; index < seasons.length; index += 1) {
    const seasonId = seasons[index]!;
    const previousSeasonId = index > 0 ? seasons[index - 1]! : null;
    const cashStartByTeam = previousSeasonId ? getSnapshotCashByTeam(gameState, previousSeasonId) : new Map<string, number>();
    const cashEndByTeam = getSnapshotCashByTeam(gameState, seasonId);
    const transfers = gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
    const sponsorLogs = (gameState.seasonState.sponsorPayoutLogs ?? []).filter((log) => log.seasonId === seasonId);
    const loanCashByTeam = getSeasonLoanCashByTeam(gameState, seasonId);
    const facilityCashByTeam = getSeasonFacilityCashByTeam(gameState, seasonId);
    const sponsorEventCashByTeam = getSeasonSponsorEventCashByTeam(gameState, seasonId);
    const objectiveRewardCashByTeam = getSeasonObjectiveRewardCashByTeam(gameState, seasonId);

    for (const teamId of teamIds) {
      const buys = transfers.filter((entry) => entry.transferType === "buy" && entry.toTeamId === teamId);
      const marketBuys = buys.filter((entry) => isMarketBuyTransferEntry(entry));
      const draftBuys = buys.filter((entry) => !isMarketBuyTransferEntry(entry));
      const sells = transfers.filter((entry) => entry.transferType === "sell" && entry.fromTeamId === teamId);
      const contractExits = transfers.filter((entry) => entry.transferType === "contract_exit" && entry.fromTeamId === teamId);
      const buyFeesPaid = round(buys.reduce((sum, entry) => sum + (entry.fee ?? 0), 0));
      // Sells: use the real net cash impact (fee − buyout), not the gross fee, so this
      // reconciles against the actual team.cash delta caused by the sale.
      const sellProceeds = round(
        sells.reduce((sum, entry) => sum + (entry.netCashImpact ?? entry.fee ?? 0), 0) +
          contractExits.reduce((sum, entry) => sum + (entry.netCashImpact ?? entry.fee ?? 0), 0),
      );
      const netTransferCash = round(sellProceeds - buyFeesPaid);
      const teamSponsorLogs = sponsorLogs.filter((log) => log.teamId === teamId);
      const sponsorCashIn = round(teamSponsorLogs.filter((log) => log.cashDelta > 0).reduce((sum, log) => sum + log.cashDelta, 0));
      const salaryPaidOut = round(Math.abs(teamSponsorLogs.filter((log) => log.cashDelta < 0).reduce((sum, log) => sum + log.cashDelta, 0)));
      const netSponsorCash = round(teamSponsorLogs.reduce((sum, log) => sum + log.cashDelta, 0));
      const netLoanCash = loanCashByTeam.get(teamId) ?? 0;
      const netFacilityCash = facilityCashByTeam.get(teamId) ?? 0;
      const netSponsorEventCash = sponsorEventCashByTeam.get(teamId) ?? 0;
      const netObjectiveRewardCash = objectiveRewardCashByTeam.get(teamId) ?? 0;
      const cashStart = cashStartByTeam.get(teamId) ?? null;
      const cashEnd =
        cashEndByTeam.get(teamId) ??
        (seasonId === gameState.season.id ? gameState.teams.find((team) => team.teamId === teamId)?.cash ?? null : null);
      // T-029: vorher nur netTransferCash + netSponsorCash — Kredit- und Gebäude-Cashflows fehlten,
      // wodurch echte Lecks in dieser Größenordnung von der (künstlich großen) Toleranz verschluckt
      // wurden. Jetzt vollständig, Toleranz s.u. entsprechend auf Rundungsrauschen gesenkt.
      // Zusätzlich: mid-season Sponsor-Event-Cash (auto-settle `sponsorEvents`, NICHT in
      // sponsorPayoutLogs) — sonst blieb dieser reale Einnahmekanal als kleines Rest-Delta übrig.
      // Und: Board-Objective-Reward-Cash (Saison-End-Settlement, direkt auf team.cash gebucht) — bisher
      // gar nicht abgezogen, obwohl er im Snapshot-`cashEnd` steckt; genau die Formel-Lücke, die dieses
      // Tool eigentlich schließen soll. Vorzeichen wie die anderen Gutschriften: `cashEnd` enthält das
      // Reward-Cash bereits (team.cash += cashDelta), also subtrahieren, damit die Reconciliation aufgeht.
      const cashReconciliationDelta =
        cashStart != null && cashEnd != null
          ? round(
              cashEnd -
                cashStart -
                netTransferCash -
                netSponsorCash -
                netSponsorEventCash -
                netLoanCash -
                netFacilityCash -
                netObjectiveRewardCash,
            )
          : null;

      rows.push({
        seasonId,
        teamId,
        teamName: getTeamName(gameState, teamId),
        cashStart,
        cashEnd,
        buyFeesPaid,
        sellProceeds,
        netTransferCash,
        sponsorCashIn,
        salaryPaidOut,
        netSponsorCash,
        netSponsorEventCash,
        netLoanCash,
        netFacilityCash,
        netObjectiveRewardCash,
        buyCount: marketBuys.length,
        draftBuyCount: draftBuys.length,
        marketBuyCount: marketBuys.length,
        sellCount: sells.length,
        cashReconciliationDelta,
      });

      if (cashEnd != null && cashEnd < -0.01) {
        violations.push(`negative_cash_end:${seasonId}:${teamId}:${cashEnd}`);
      }
      // T-028: unterhalb RECONCILIATION_ROUNDING_TOLERANCE wird gar nichts geloggt (reines
      // Rundungsrauschen). Darüber wird geloggt, aber erst oberhalb der harten Schwelle
      // (reconciliationHardBlockerThreshold) als `..._hard:` getaggt — nur DIESE Tag-Variante wird
      // von den Konsumstellen (isTransferFinanceViolationForSeason, long-run-phase-audit.ts,
      // long-run-soft-blockers.ts) als echter Blocker gewertet statt toleriert.
      if (
        cashReconciliationDelta != null &&
        cashStart != null &&
        Math.abs(cashReconciliationDelta) > RECONCILIATION_ROUNDING_TOLERANCE
      ) {
        const hardThreshold = reconciliationHardBlockerThreshold(cashStart);
        const tag =
          Math.abs(cashReconciliationDelta) > hardThreshold ? "cash_reconciliation_delta_hard" : "cash_reconciliation_delta";
        violations.push(`${tag}:${seasonId}:${teamId}:${cashReconciliationDelta}`);
      }
      for (const buy of buys) {
        if ((buy.fee ?? 0) <= 0 && buy.source !== "preseason_roster_repair_buy") {
          violations.push(`zero_fee_buy:${seasonId}:${teamId}:${buy.playerId}:${buy.source ?? "unknown"}`);
        }
        if (
          buy.source === "preseason_roster_repair_buy" &&
          buy.marketValue != null &&
          buy.fee != null &&
          Math.abs(buy.fee - buy.marketValue) > 0.05
        ) {
          violations.push(`repair_buy_fee_not_mw:${seasonId}:${teamId}:${buy.playerId}:${buy.fee}<${buy.marketValue}`);
        }
      }
    }
  }

  return {
    rows,
    violations: [...new Set(violations)],
    doctrineStats: buildDoctrineTransferStats(gameState),
  };
}

function buildDoctrineTransferStats(gameState: GameState) {
  const seasons = seasonsFromHistory(gameState);
  const stats: TransferFinanceAuditResult["doctrineStats"] = [];
  for (const seasonId of seasons) {
    for (const team of gameState.teams) {
      const doctrine = resolveTransferDoctrine(gameState, team.teamId);
      const transfers = gameState.transferHistory.filter((entry) => entry.seasonId === seasonId);
      const buys = transfers.filter((entry) => entry.transferType === "buy" && entry.toTeamId === team.teamId);
      const marketBuys = buys.filter((entry) => isMarketBuyTransferEntry(entry));
      const draftBuys = buys.filter((entry) => !isMarketBuyTransferEntry(entry));
      const sells = transfers.filter((entry) => entry.transferType === "sell" && entry.fromTeamId === team.teamId);
      const replacementSells = sells.filter((entry) => (entry.fee ?? 0) >= 20 || (entry.marketValue ?? 0) >= 20);
      const replacementBuys = marketBuys.filter((entry) => {
        const priorSell = gameState.transferHistory.find(
          (prior) =>
            prior.seasonId === seasonId &&
            prior.transferType === "sell" &&
            prior.fromTeamId === team.teamId &&
            prior.playerId !== entry.playerId &&
            (prior.fee ?? 0) > 0,
        );
        return Boolean(priorSell) && (entry.fee ?? 0) <= (priorSell?.fee ?? 0) * 1.1;
      });
      stats.push({
        seasonId,
        teamId: team.teamId,
        persona: doctrine.persona,
        buys: marketBuys.length,
        draftBuys: draftBuys.length,
        marketBuys: marketBuys.length,
        sells: sells.length,
        replacementSellCount: replacementSells.length,
        replacementBuyCount: replacementBuys.length,
      });
    }
  }
  return stats;
}
