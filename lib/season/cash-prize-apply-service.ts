import type { CashPrizeApplyLogRecord, GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { requireLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import type { PersistenceService } from "@/lib/persistence/types";
import { buildPrizeMoneyPreview, type PrizeMoneyPreviewResult } from "@/lib/season/prize-money-preview";
import { CASH_PRIZE_BENCHMARK_ONLY } from "@/lib/season/cash-prize-benchmark-flag";
import { hasSeasonEndSponsorPayout } from "@/lib/season/season-end-sponsor-payout-status";
import type { StandingsPreviewSource } from "@/lib/standings/standings-preview-engine";
import { applySponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { applyApronSettlement } from "@/lib/season/apron-settlement-service";
import {
  applyFacilitySeasonEndFinance,
  hasFacilitySeasonEndFinanceApplied,
  previewFacilitySeasonEndFinance,
} from "@/lib/facilities/facility-season-end-service";

export const CASH_PRIZE_APPLY_CONFIRM_TOKEN = "APPLY_LOCAL_CASH_PRIZE";

// Kanonische Definition liegt in einem client-sicheren Modul (ohne node:fs, Import oben), damit
// UI-Hooks das Flag lesen können; hier re-exportiert, damit bestehende Server-Importe (die es aus
// diesem Service beziehen) unverändert bleiben.
export { CASH_PRIZE_BENCHMARK_ONLY };

export type CashPrizeApplyParams = {
  saveId: string;
  seasonId: string;
  matchdayId?: string;
  source?: StandingsPreviewSource;
  phase?: "season_end" | "matchday";
  dryRun?: boolean;
  execute?: boolean;
  confirm?: string;
};

export type CashPrizeApplyPlannedChange = {
  teamId: string;
  teamCode: string;
  teamName: string;
  rank: number | null;
  points: number | null;
  oldCash: number | null;
  prizeMoney: number | null;
  rankChangePrize: number | null;
  startRank: number | null;
  rankDelta: number | null;
  newCash: number | null;
  status: string;
  warnings: string[];
};

export type CashPrizeApplyResult = {
  ok: boolean;
  source: StandingsPreviewSource;
  dryRun: boolean;
  applied: boolean;
  canApply: boolean;
  blockingReasons: string[];
  warnings: string[];
  plannedChanges: CashPrizeApplyPlannedChange[];
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  idempotencyKey: string;
  duplicateDetected: boolean;
  auditLogId: string | null;
};

type PrepareCashPrizeApplyResult = {
  source: StandingsPreviewSource;
  dryRun: boolean;
  preview: PrizeMoneyPreviewResult;
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  idempotencyKey: string;
  duplicateDetected: boolean;
  existingAuditLog: CashPrizeApplyLogRecord | null;
  plannedChanges: CashPrizeApplyPlannedChange[];
  blockingReasons: string[];
  warnings: string[];
};

function normalizeSource(source?: string): StandingsPreviewSource {
  return source === "prisma" ? "prisma" : "sqlite";
}

function buildIdempotencyKey(scope: { saveId: string; seasonId: string; matchdayId: string }) {
  return `cash-prize-apply:${scope.saveId}:${scope.seasonId}:${scope.matchdayId}`;
}

function buildAuditLogId(scope: { saveId: string; seasonId: string; matchdayId: string }) {
  return `cash-prize-apply-audit__${scope.saveId}__${scope.seasonId}__${scope.matchdayId}`;
}

// Audit S4: cash payouts are a gameplay write — an unresolved saveId must never silently land on
// "the active save" (which, per-owner, isn't even a well-defined target). Throw instead.
function resolveLocalSave(persistence: PersistenceService, saveId: string) {
  return requireLocalPersistedSave(persistence, saveId).save;
}

function toPlannedChanges(items: PrizeMoneyPreviewResult["items"]): CashPrizeApplyPlannedChange[] {
  return items.map((item) => ({
    teamId: item.teamId,
    teamCode: item.teamCode,
    teamName: item.teamName,
    rank: item.rank,
    points: item.points,
    oldCash: item.currentCash,
    prizeMoney: item.prizeMoney,
    rankChangePrize: item.rankChangePrize?.bonusMalus ?? null,
    startRank: item.rankChangePrize?.startRank ?? null,
    rankDelta: item.rankChangePrize?.rankDelta ?? null,
    newCash: item.projectedCash,
    status: item.status,
    warnings: item.warnings,
  }));
}

function buildBlockingReasons(
  preview: PrizeMoneyPreviewResult,
  duplicateDetected: boolean,
  phase: "season_end" | "matchday",
) {
  const reasons = new Set<string>();

  if (duplicateDetected) {
    reasons.add("duplicate_apply_for_save_season_block");
  }

  if (phase === "matchday") {
    reasons.add("blockedRule:season_end_only");
  }

  for (const rule of preview.blockedRules) {
    reasons.add(`blockedRule:${rule}`);
  }

  for (const item of preview.items) {
    if (item.status !== "ready") {
      reasons.add(`${item.status}:${item.teamId}`);
    }
    if (item.projectedCash == null) {
      reasons.add(`missing_projected_cash:${item.teamId}`);
    }
  }

  return Array.from(reasons);
}

function buildWarnings(
  preview: PrizeMoneyPreviewResult,
  duplicateDetected: boolean,
  phase: "season_end" | "matchday",
) {
  const warnings = new Set<string>();

  if (duplicateDetected) {
    warnings.add("duplicate_apply_detected");
  }

  if (phase === "matchday") {
    warnings.add("season_end_only");
  }

  for (const globalWarning of preview.globalWarnings) {
    warnings.add(globalWarning);
  }

  for (const item of preview.items) {
    for (const warning of item.warnings) {
      warnings.add(`${item.teamId}:${warning}`);
    }
  }

  return Array.from(warnings);
}

async function prepareCashPrizeApply(
  params: CashPrizeApplyParams,
  persistence: PersistenceService,
): Promise<PrepareCashPrizeApplyResult> {
  const source = normalizeSource(params.source);
  const dryRun = params.execute ? false : params.dryRun ?? true;
  const phase = params.phase === "matchday" ? "matchday" : "season_end";
  const scope = {
    saveId: params.saveId,
    seasonId: params.seasonId,
    matchdayId: params.matchdayId ?? resolveLocalSave(persistence, params.saveId).gameState.matchdayState.matchdayId,
  };
  const idempotencyKey = buildIdempotencyKey(scope);

  const preview = await buildPrizeMoneyPreview(
    {
      saveId: scope.saveId,
      seasonId: scope.seasonId,
      source,
      phase: params.phase,
    },
    persistence,
  );
  const existingAuditLog =
    source === "sqlite"
      ? (resolveLocalSave(persistence, scope.saveId).gameState.seasonState.cashPrizeApplyLogs ?? []).find(
          (log) =>
            log.saveId === scope.saveId &&
            log.seasonId === scope.seasonId &&
            log.matchdayId === scope.matchdayId &&
            log.payload.idempotencyKey === idempotencyKey,
        ) ?? null
      : null;
  /**
   * Ein vorhandenes Audit-Log heisst NICHT, dass Geld geflossen ist.
   *
   * Solange dieser Schritt nur Tabellen-Spalten und das Log schrieb, konnte er als
   * "erledigt" dastehen, ohne einen Cent bewegt zu haben — genau so ist ein Spielstand
   * entstanden, in dem alle 32 Teams unveraendertes Cash hatten. Der Duplikat-Riegel
   * sperrte den Knopf danach dauerhaft: der Spieler konnte die Buchung nie nachholen.
   *
   * Der Riegel greift deshalb nur noch, wenn das Sponsorgeld dieser Saison tatsaechlich
   * ausgezahlt ist. Ist es das nicht, ist ein zweiter Druck kein Duplikat, sondern die
   * ERSTE Buchung. Gegen echte Doppelbuchung schuetzt weiterhin `applySponsorSettlement`
   * selbst (Idempotenz je Team ueber `sponsorPayoutLogs`) — der Riegel hier war immer nur
   * die zweite Linie, nie die eigentliche Wache.
   */
  const sponsorPayoutSettled =
    source === "prisma"
      ? false
      : hasSeasonEndSponsorPayout(resolveLocalSave(persistence, scope.saveId).gameState, scope.seasonId);
  const duplicateDetected = existingAuditLog != null && (phase === "matchday" || sponsorPayoutSettled);
  const staleApplyLogWithoutPayout = existingAuditLog != null && !duplicateDetected;
  const plannedChanges = toPlannedChanges(preview.items);
  const blockingReasons =
    source === "prisma"
      ? ["Prisma/Supabase mode is read-only. Cash Apply is only allowed in the local SQLite test save."]
      : buildBlockingReasons(preview, duplicateDetected, phase);
  const warnings = buildWarnings(preview, duplicateDetected, phase);
  if (staleApplyLogWithoutPayout) {
    // Sichtbar machen, dass hier ein alter Lauf nachgeholt wird, statt es still zu tun.
    warnings.push("apply_log_without_sponsor_payout_retry");
  }

  return {
    source,
    dryRun,
    preview,
    scope,
    idempotencyKey,
    duplicateDetected,
    existingAuditLog,
    plannedChanges,
    blockingReasons,
    warnings,
  };
}

function buildResult(
  prepared: PrepareCashPrizeApplyResult,
  input: { applied: boolean; auditLogId?: string | null },
): CashPrizeApplyResult {
  return {
    ok: prepared.blockingReasons.length === 0 || input.applied,
    source: prepared.source,
    dryRun: prepared.dryRun,
    applied: input.applied,
    canApply: prepared.blockingReasons.length === 0,
    blockingReasons: prepared.blockingReasons,
    warnings: prepared.warnings,
    plannedChanges: prepared.plannedChanges,
    scope: prepared.scope,
    idempotencyKey: prepared.idempotencyKey,
    duplicateDetected: prepared.duplicateDetected,
    auditLogId: input.auditLogId ?? null,
  };
}

function writeLocalCashPrizeApply(input: {
  persistence: PersistenceService;
  saveId: string;
      preview: PrizeMoneyPreviewResult;
      idempotencyKey: string;
      matchdayId: string;
      phase: "season_end" | "matchday";
}) {
  const save = resolveLocalSave(input.persistence, input.saveId);
  const now = new Date().toISOString();
  const previewByTeamId = new Map(input.preview.items.map((item) => [item.teamId, item] as const));
  const nextTeams = save.gameState.teams;
  const nextStandings = Object.fromEntries(
    Object.entries(save.gameState.seasonState.standings ?? {}).map(([teamId, standing]) => {
      const row = previewByTeamId.get(teamId) ?? null;
      if (!row) return [teamId, standing] as const;
      /**
       * SPONSOREN STATT PREISGELD.
       *
       * `sponsorTotal` und `guv` wurden aus `row.prizeMoney` gebildet — dem
       * Preisgeld-BENCHMARK, der nie ausgezahlt wird (`CASH_PRIZE_BENCHMARK_ONLY`).
       * Die Tabelle zeigte damit eine GuV, die niemand je aufs Konto bekommt: fuer
       * C-C standen dort 67,5 Sponsoren und +25,0 GuV, waehrend die Abrechnung
       * 48,1 Sponsorgeld gegen 42,5 Gehaelter buchte — real +5,6.
       *
       * Quelle ist jetzt `row.sponsorCash`: die Sponsor-Abrechnung beim AKTUELLEN
       * Rang (`previewSponsorSettlement`), also exakt das, was `applySponsorSettlement`
       * gutschreibt. Dazu die Gebaeude netto, die ebenfalls real gebucht werden.
       * Eine Groesse, eine Quelle — die Spalte beantwortet endlich dieselbe Frage
       * wie das Konto.
       */
      const sponsorBasis = row.basisCash;
      const sponsorRank = row.rankChangePrize.bonusMalus;
      const sponsorSeason =
        row.sponsorCash != null && sponsorBasis != null ? Number((row.sponsorCash - sponsorBasis).toFixed(2)) : null;
      const sponsorTotal = row.sponsorCash != null ? Number(row.sponsorCash.toFixed(2)) : null;
      const cashFc =
        row.currentCash != null && row.salaryTotal != null ? Number((row.currentCash - row.salaryTotal).toFixed(2)) : null;
      // GuV = was die Saison real einbringt: Sponsoren + Gebaeude (netto) − Gehaelter.
      const guv =
        sponsorTotal != null && row.salaryTotal != null
          ? Number((sponsorTotal + (row.facilityIncome ?? 0) - row.salaryTotal).toFixed(2))
          : null;
      return [
        teamId,
        {
          ...standing,
          cashFc,
          startplatz: row.rankChangePrize.startRank,
          rankDiff: row.rankChangePrize.rankDelta,
          sponsorBasis,
          sponsorRank,
          sponsorSeason,
          sponsorTotal,
          guv,
          cashTotal: row.projectedCash,
        },
      ] as const;
    }),
  );

  const totalPrizeMoney = input.preview.items.reduce((sum, item) => sum + (item.prizeMoney ?? 0), 0);
  const auditLog: CashPrizeApplyLogRecord = {
    id: buildAuditLogId({
      saveId: input.preview.scope?.saveId ?? input.saveId,
      seasonId: input.preview.scope?.seasonId ?? "season-1",
      matchdayId: input.matchdayId,
    }),
    saveId: input.preview.scope?.saveId ?? input.saveId,
    seasonId: input.preview.scope?.seasonId ?? "season-1",
    matchdayId: input.matchdayId,
    action: "apply",
    payload: {
      idempotencyKey: input.idempotencyKey,
      totalTeams: input.preview.items.length,
      appliedTeams: input.preview.items.filter((item) => item.projectedCash != null).length,
      totalPrizeMoney: Number(totalPrizeMoney.toFixed(2)),
      benchmarkOnly: CASH_PRIZE_BENCHMARK_ONLY,
      cashPayoutApplied: !CASH_PRIZE_BENCHMARK_ONLY,
    },
    createdAt: now,
  };

  const nextGameState: GameState = {
    ...save.gameState,
    teams: nextTeams,
    seasonState: {
      ...save.gameState.seasonState,
      standings: nextStandings,
      cashPrizeApplyLogs: [...(save.gameState.seasonState.cashPrizeApplyLogs ?? []), auditLog],
    },
  };

  /**
   * GEMELDET: „Preisgeld und Sponsoren buchen ist gelaufen, aber der GuV-Betrag wurde nicht auf das
   * aktuelle Cash drauf gerechnet — bei allen Teams." Bestaetigt.
   *
   * Dieser Schritt schrieb bisher AUSSCHLIESSLICH die Tabellen-Spalten (`sponsorTotal`, `guv`,
   * `cashTotal`, `cashFc`) und ein Audit-Log; `nextTeams` ging unveraendert durch. Die Oberflaeche
   * meldete danach „Ist gebucht — das Geld steht auf dem Konto", und in der Tabelle stand eine GuV
   * — bewegt wurde aber nichts.
   *
   * Das Geld floss nur in `applySponsorSettlement`, und die wird an genau EINER Stelle gerufen:
   * `season-completion-service`. Der Saisonabschluss haengt aber nur im Cockpit
   * (`runSeasonCompletion`); im Saisonende-Panel, das im normalen Spielverlauf benutzt wird, gibt
   * es ihn nicht. „Neue Saison starten" geht ueber den Preseason-Workflow, der die Abrechnung nur
   * VORSCHAUT (`previewSponsorSettlement`) und keinen Riegel gegen einen Wechsel ohne Buchung hat.
   *
   * Damit war es moeglich — und ist genau passiert —, mit unveraendertem Cash in die neue Saison zu
   * gehen: kein Sponsorgeld, keine Gehaelter, bei allen 32 Teams.
   *
   * Der Schritt tut jetzt, was auf ihm steht. NUR am Saisonende: bei `phase === "matchday"` gibt es
   * keine Sponsor-Abrechnung, die Spalten bleiben wie bisher reine Zwischenstands-Anzeige.
   *
   * Doppelbuchung ist beidseitig abgesichert: `applySponsorSettlement` prueft ueber
   * `previewSponsorSettlement` bereits gezahlte Zeilen, und `season-completion-service` ueberspringt
   * seinerseits, sobald ein `season_end`-Eintrag in `sponsorPayoutLogs` steht. Wer zuerst kommt,
   * bucht; der andere laesst es. `deductSalary: true` ist dieselbe Einstellung, die der
   * Saisonabschluss benutzt — sonst kaeme Sponsorgeld ohne die zugehoerigen Gehaelter an, und die
   * gebuchte Summe waere nicht die GuV, die daneben steht.
   *
   * Die Standings-Spalten oben werden bewusst VOR der Abrechnung aus der Vorschau gebildet: sie
   * beantworten „was hat die Saison gebracht", nicht „wie viel liegt jetzt auf dem Konto". Rechnete
   * man sie auf dem Nach-Buchungs-Stand, waere `cashFc` doppelt um die Gehaelter gekuerzt.
   */
  const settlement =
    input.phase === "season_end"
      ? applySponsorSettlement({
          gameState: nextGameState,
          saveId: save.saveId,
          phase: "season_end",
          execute: true,
          deductSalary: true,
        })
      : null;

  /**
   * APRON — NACH der Sponsor-Abrechnung und VOR der Kassenbuchung (dem `saveSingleplayerState`
   * gleich darunter). Reihenfolge ist hier nicht kosmetisch: der Deckel des Apron braucht den
   * rangabhaengigen Wertungsanteil, den `apronWertungsanteil` zwar unabhaengig vom Sponsorvertrag
   * berechnet (siehe apron-service.ts) — er liest aber denselben, an dieser Stelle bereits
   * finalen Endrang, den auch die Sponsor-Abrechnung gerade genutzt hat. Liefe der Apron vor der
   * Sponsor-Abrechnung, gaebe es noch keinen Cash-Stand, gegen den GuV-Kriterien (siehe
   * apron-service.ts Kopfkommentar) ueberhaupt Sinn ergeben.
   */
  const apronSettlement =
    input.phase === "season_end"
      ? applyApronSettlement({
          gameState: settlement?.applied ? settlement.gameState : nextGameState,
          saveId: save.saveId,
          execute: true,
        })
      : null;

  input.persistence.saveSingleplayerState(
    save.saveId,
    apronSettlement?.applied
      ? apronSettlement.gameState
      : settlement?.applied
        ? settlement.gameState
        : nextGameState,
  );

  /**
   * GEBAEUDE GEHOEREN ZUR SAISONABRECHNUNG.
   *
   * Die GuV-Spalte weist Sponsoren + Gebaeude − Gehaelter aus. Buchte dieser Schritt nur
   * die Sponsoren, versprach die Spalte wieder mehr, als ankommt — genau der Fehler, der
   * hier gerade behoben wird, nur an einer neuen Stelle.
   *
   * Die Fan-Shop-/Arena-Abrechnung lief bisher ausschliesslich in
   * `season-completion-service`, und der haengt nur im Cockpit. Im normalen Spielverlauf
   * war sie damit unerreichbar.
   *
   * Uebernommen ist das Muster von dort, nicht nachgebaut — inklusive des Grundes, warum
   * der Spielstand in JEDEM Durchlauf neu aufgeloest wird: `applyFacilitySeasonEndFinance`
   * persistiert einen vollstaendigen GameState aus dem ihm gegebenen Stand. Aus einem
   * veralteten Schnappschuss gebaut, ueberschriebe ein spaeteres Team die Buchung eines
   * frueheren.
   *
   * Doppelbuchung ist durch `hasFacilitySeasonEndFinanceApplied` je Team und Saison
   * ausgeschlossen — dieselbe Sperre, die auch den Saisonabschluss schuetzt. Wer zuerst
   * kommt, bucht.
   */
  if (input.phase === "season_end") {
    for (const team of resolveLocalSave(input.persistence, save.saveId).gameState.teams) {
      const latestSave = resolveLocalSave(input.persistence, save.saveId);
      if (hasFacilitySeasonEndFinanceApplied(latestSave.gameState, latestSave.gameState.season.id, team.teamId)) {
        continue;
      }
      const facilityPreview = previewFacilitySeasonEndFinance(latestSave, team.teamId);
      if (!facilityPreview.ok || !facilityPreview.confirmToken) {
        continue;
      }
      const hasFacilityAction =
        facilityPreview.facilityIncomeTotal > 0 ||
        facilityPreview.rows.some((row) => row.status === "paid" || row.status === "will_disable_unpaid");
      if (!hasFacilityAction) {
        continue;
      }
      applyFacilitySeasonEndFinance(latestSave, team.teamId, facilityPreview.confirmToken, input.persistence);
    }
  }

  return auditLog;
}

export async function previewCashPrizeApply(
  params: CashPrizeApplyParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<CashPrizeApplyResult> {
  const prepared = await prepareCashPrizeApply(params, persistence);
  return buildResult(prepared, { applied: false, auditLogId: prepared.existingAuditLog?.id ?? null });
}

export async function executeCashPrizeApply(
  params: CashPrizeApplyParams,
  persistence: PersistenceService = createPersistenceService(),
): Promise<CashPrizeApplyResult> {
  const prepared = await prepareCashPrizeApply(
    {
      ...params,
      execute: true,
      dryRun: false,
    },
    persistence,
  );

  if (prepared.source === "prisma") {
    return buildResult(prepared, { applied: false, auditLogId: null });
  }

  if (prepared.blockingReasons.length > 0) {
    return buildResult(prepared, { applied: false, auditLogId: prepared.existingAuditLog?.id ?? null });
  }

  if (params.confirm !== CASH_PRIZE_APPLY_CONFIRM_TOKEN) {
    return {
      ...buildResult(prepared, { applied: false, auditLogId: null }),
      ok: false,
      canApply: false,
      blockingReasons: ["Missing explicit confirm token for execute."],
    };
  }

  const auditLog = writeLocalCashPrizeApply({
    persistence,
    saveId: params.saveId,
    preview: prepared.preview,
    idempotencyKey: prepared.idempotencyKey,
    matchdayId: params.matchdayId ?? resolveLocalSave(persistence, params.saveId).gameState.matchdayState.matchdayId,
    phase: params.phase === "matchday" ? "matchday" : "season_end",
  });

  return {
    ...buildResult(prepared, { applied: true, auditLogId: auditLog.id }),
    ok: true,
    dryRun: false,
    canApply: true,
    blockingReasons: [],
  };
}
