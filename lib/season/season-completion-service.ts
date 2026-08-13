import type { CashPrizeApplyResult } from "@/lib/season/cash-prize-apply-service";
import {
  previewCashPrizeApply,
} from "@/lib/season/cash-prize-apply-service";
import { persistGameStateWithMaterializedDerivations } from "@/lib/foundation/materialize-season-derivations";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { runWithSaveRecovery } from "@/lib/persistence/atomic-save-write";
import { requireLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import type { PersistenceService } from "@/lib/persistence/types";
import { upsertTeamRelationshipEvents, type TeamRelationshipEventApplyResult } from "@/lib/rivalries/team-relationship-dynamics";
import { buildSeasonAiLineupAudit, type SeasonAiLineupAudit } from "@/lib/season/season-ai-lineup-audit-service";
import {
  applyTeamSeasonObjectiveRewards,
} from "@/lib/board/team-season-objectives-service";
import { applyFormCardPenaltyWithRerank } from "@/lib/season/form-card-penalty-service";
import { applySponsorSettlement, previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { applyApronSettlement, previewApronSettlement } from "@/lib/season/apron-settlement-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import {
  applyFacilitySeasonEndFinance,
  hasFacilitySeasonEndFinanceApplied,
  previewFacilitySeasonEndFinance,
} from "@/lib/facilities/facility-season-end-service";
import { applyLoanSettlement, collectNegativeCashTeams, previewLoanSettlement, type LoanSettlementApplyResult } from "@/lib/finance/loan-service";
import { zieheSaisonstandGuvNach } from "@/lib/finance/season-guv-nachbuchung";
import { buildSeasonReview, type SeasonReview } from "@/lib/season/season-review-service";
import {
  createSeasonSnapshot,
  SEASON_SNAPSHOT_CONFIRM_TOKEN,
  type CreateSeasonSnapshotResult,
} from "@/lib/season/season-snapshot-service";
import {
  buildSeasonTransitionPreview,
  isSeasonComplete,
  startSeasonTransition,
  type SeasonTransitionPreview,
} from "@/lib/season/season-transition-service";

export const SEASON_COMPLETION_CONFIRM_TOKEN = "COMPLETE_LOCAL_SEASON_PIPELINE";

export type SeasonCompletionStepStatus = "planned" | "applied" | "already_done" | "blocked" | "skipped";

export type SeasonCompletionStep = {
  key:
    | "season_check"
    | "sponsor_choice_gate"
    | "form_card_penalty"
    | "season_review"
    | "objective_rewards"
    | "cash_apply"
    | "sponsor_settlement"
    | "apron_settlement"
    | "loan_settlement"
    | "facility_finance"
    | "insolvency_backstop"
    | "relationships"
    | "snapshot"
    | "transition"
    | "ai_audit";
  label: string;
  status: SeasonCompletionStepStatus;
  warnings: string[];
  blockingReasons: string[];
  auditId: string | null;
};

export type SeasonCompletionResult = {
  ok: boolean;
  dryRun: boolean;
  applied: boolean;
  status: "ready" | "applied" | "blocked";
  scope: {
    saveId: string;
    seasonId: string;
    matchdayId: string;
  };
  steps: SeasonCompletionStep[];
  seasonReview: SeasonReview;
  cashApply: CashPrizeApplyResult;
  snapshot: CreateSeasonSnapshotResult;
  relationships: TeamRelationshipEventApplyResult;
  transition: SeasonTransitionPreview;
  aiSeasonAudit: SeasonAiLineupAudit;
  warnings: string[];
  blockingReasons: string[];
};

// Audit R2/V6 (superseded by audit S4's central strict resolver): season completion previously
// fell back to getActiveSave()/bootstrap and only caught the mismatch after the fact. It now goes
// straight through `requireLocalPersistedSave`, which never resolves to a different save in the
// first place — the same protection, applied at the root instead of patched on afterward.
function resolveLocalSave(persistence: PersistenceService, saveId: string) {
  return requireLocalPersistedSave(persistence, saveId).save;
}

function addStep(
  steps: SeasonCompletionStep[],
  step: SeasonCompletionStep,
  warnings: Set<string>,
  blockingReasons: Set<string>,
) {
  steps.push(step);
  step.warnings.forEach((warning) => warnings.add(warning));
  step.blockingReasons.forEach((reason) => blockingReasons.add(reason));
}

function asReviewStateRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function countByReason(events: TeamRelationshipEventApplyResult["generatedEvents"]) {
  return events.reduce<Record<string, number>>((summary, event) => {
    summary[event.reason] = (summary[event.reason] ?? 0) + 1;
    return summary;
  }, {});
}

function buildSeasonConsequencesReviewState(input: {
  previousState: unknown;
  seasonId: string;
  seasonReview: SeasonReview;
  cashApply: CashPrizeApplyResult;
  relationships: TeamRelationshipEventApplyResult;
  aiSeasonAudit: SeasonAiLineupAudit;
  warnings: string[];
}) {
  const previous = asReviewStateRecord(input.previousState);
  const previousConsequences =
    previous.seasonConsequences && typeof previous.seasonConsequences === "object" && !Array.isArray(previous.seasonConsequences)
      ? { ...(previous.seasonConsequences as Record<string, unknown>) }
      : {};
  const totalPrizeMoney = input.cashApply.plannedChanges.reduce((sum, change) => sum + (change.prizeMoney ?? 0), 0);
  const rankChangePrize = input.cashApply.plannedChanges.reduce((sum, change) => sum + (change.rankChangePrize ?? 0), 0);

  return {
    ...previous,
    seasonConsequences: {
      ...previousConsequences,
      [input.seasonId]: {
        seasonId: input.seasonId,
        generatedAt: new Date().toISOString(),
        objectiveSettlement: input.seasonReview.objectiveSettlement,
        cashPrize: {
          applied: input.cashApply.applied || input.cashApply.duplicateDetected,
          auditLogId: input.cashApply.auditLogId,
          appliedTeams: input.cashApply.plannedChanges.filter((change) => change.newCash != null).length,
          totalPrizeMoney: Number(totalPrizeMoney.toFixed(2)),
          rankChangePrize: Number(rankChangePrize.toFixed(2)),
          warnings: input.cashApply.warnings,
        },
        relationships: {
          generatedEvents: input.relationships.generatedEvents.length,
          insertedEvents: input.relationships.insertedEvents,
          replacedPreviewEvents: input.relationships.replacedPreviewEvents,
          reasonCounts: countByReason(input.relationships.generatedEvents),
          warnings: input.relationships.warnings,
        },
        aiSeasonAudit: input.aiSeasonAudit,
        warnings: input.warnings,
      },
    },
  };
}

async function runLocalSeasonCompletionUnsafe(
  params: {
    saveId: string;
    seasonId?: string;
    source?: "sqlite" | "prisma";
    dryRun?: boolean;
    execute?: boolean;
    confirmToken?: string;
  },
  persistence: PersistenceService = createPersistenceService(),
): Promise<SeasonCompletionResult> {
  const source = params.source === "prisma" ? "prisma" : "sqlite";
  const dryRun = params.execute ? false : params.dryRun ?? true;
  const initialSave = resolveLocalSave(persistence, params.saveId);
  const seasonId = params.seasonId?.trim() || initialSave.gameState.season.id;
  const matchdayId = initialSave.gameState.matchdayState.matchdayId;
  const steps: SeasonCompletionStep[] = [];
  const warnings = new Set<string>();
  const blockingReasons = new Set<string>();
  const completed = isSeasonComplete(initialSave.gameState);
  const seasonReview = buildSeasonReview(initialSave.gameState);
  const aiSeasonAudit = buildSeasonAiLineupAudit(initialSave.gameState, seasonId);

  if (source === "prisma") {
    blockingReasons.add("Prisma/Supabase mode is read-only in this build.");
  }
  if (!completed) {
    blockingReasons.add("season_not_completed");
  }
  if (!dryRun && params.confirmToken !== SEASON_COMPLETION_CONFIRM_TOKEN) {
    blockingReasons.add("missing_season_completion_confirm_token");
  }

  addStep(
    steps,
    {
      key: "season_check",
      label: "Season Check",
      status: completed ? "applied" : "blocked",
      warnings: [],
      blockingReasons: completed ? [] : ["season_not_completed"],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  // Sponsor-Pflicht (P1-5): Menschliche (manuell gesteuerte) Teams MÜSSEN vor dem Saisonabschluss einen
  // Sponsorvertrag gewählt haben, sonst rechnet die Vorschau (projectedCash) Gehalt ab, das reale
  // Settlement aber nicht (`if (input.deductSalary && contract)`). KI/passiv signieren automatisch
  // (chooseSponsorOfferForAiTeams); Folge-Saisons blocken bereits im Preseason-Workflow — dieser Gate
  // erzwingt dieselbe Regel für die LAUFENDE Saison (schließt die Season-1-Lücke). Kein Soft-Lock: das
  // Team bleibt in der Saison und der Flow führt weiterhin auf die Sponsor-Auswahl (prize:sponsor-choice).
  const seasonEndControlSettings = buildTeamControlSettingsMap(
    initialSave.gameState.teams,
    initialSave.gameState.seasonState.teamControlSettings,
  );
  const manualTeamsWithoutSponsor = initialSave.gameState.teams.filter(
    (team) =>
      seasonEndControlSettings[team.teamId]?.controlMode === "manual" &&
      getTeamSponsorContract(initialSave.gameState, team.teamId) == null,
  );
  addStep(
    steps,
    {
      key: "sponsor_choice_gate",
      label: "Sponsor-Pflicht",
      status: manualTeamsWithoutSponsor.length === 0 ? "applied" : "blocked",
      warnings: [],
      blockingReasons: manualTeamsWithoutSponsor.length > 0 ? ["manual_sponsor_choice_pending"] : [],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );
  addStep(
    steps,
    {
      key: "season_review",
      label: "Season Review",
      status: completed ? "applied" : "skipped",
      warnings: seasonReview.warnings,
      blockingReasons: [],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  // Audit R2/V4: Formkarten-Übernutzungs-Strafe VOR der Liga-Abrechnung anwenden — Punktabzug + Re-Rank auf
  // der Endtabelle. Nur so sehen die rang-basierten Sponsor-Payouts UND der eingefrorene Season-Snapshot die
  // bestrafte Tabelle (vorher lief die Strafe erst bei next_season_setup, nach Snapshot/Payouts, und war
  // wirkungslos). Idempotent pro Saison; persistieren, damit die nachfolgenden Steps (die den Save neu lesen)
  // die bestrafte Tabelle sehen.
  const formCardPenalty = applyFormCardPenaltyWithRerank(initialSave.gameState, seasonId);
  const formCardPenaltyExecuted = !dryRun && blockingReasons.size === 0 && formCardPenalty.applied;
  if (formCardPenaltyExecuted) {
    persistGameStateWithMaterializedDerivations(persistence, initialSave.saveId, formCardPenalty.gameState);
  }
  addStep(
    steps,
    {
      key: "form_card_penalty",
      label: "Formkarten-Strafe",
      status: formCardPenalty.applied ? (formCardPenaltyExecuted ? "applied" : "planned") : "skipped",
      warnings: formCardPenalty.warnings,
      blockingReasons: [],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  const existingCashLog =
    (initialSave.gameState.seasonState.cashPrizeApplyLogs ?? []).find((log) => log.seasonId === seasonId) ?? null;
  const cashApply = await previewCashPrizeApply(
    {
      saveId: initialSave.saveId,
      seasonId,
      matchdayId,
      source,
      phase: "season_end",
      dryRun: true,
      execute: false,
    },
    persistence,
  );
  if (existingCashLog) {
    warnings.add("legacy_cash_prize_apply_log_present_benchmark_only_mode");
  }
  addStep(
    steps,
    {
      key: "cash_apply",
      label: "Preisgeld-Benchmark",
      status: existingCashLog ? "already_done" : cashApply.canApply ? "planned" : "skipped",
      warnings: [...cashApply.warnings, ...(existingCashLog ? ["legacy_cash_prize_apply_log_present"] : [])],
      blockingReasons: [],
      auditId: existingCashLog?.id ?? null,
    },
    warnings,
    blockingReasons,
  );

  const afterCashSave = resolveLocalSave(persistence, initialSave.saveId);
  const sponsorSettlementPreview = previewSponsorSettlement(afterCashSave.gameState, "season_end");
  const existingSponsorEndPayout =
    (afterCashSave.gameState.seasonState.sponsorPayoutLogs ?? []).some(
      (log) => log.seasonId === seasonId && log.phase === "season_end",
    ) ?? false;
  const shouldApplySponsorSettlement =
    !dryRun && blockingReasons.size === 0 && !existingSponsorEndPayout;
  const sponsorSettlementApply = shouldApplySponsorSettlement
    ? applySponsorSettlement({
        gameState: afterCashSave.gameState,
        saveId: afterCashSave.saveId,
        phase: "season_end",
        execute: true,
        deductSalary: true,
      })
    : { gameState: afterCashSave.gameState, preview: sponsorSettlementPreview, applied: false };
  if (shouldApplySponsorSettlement && !sponsorSettlementApply.applied && sponsorSettlementPreview.canApply) {
    sponsorSettlementPreview.blockingReasons.forEach((reason) => blockingReasons.add(`sponsor_settlement:${reason}`));
  }
  if (shouldApplySponsorSettlement && sponsorSettlementApply.applied) {
    persistence.saveSingleplayerState(afterCashSave.saveId, sponsorSettlementApply.gameState);
  }
  addStep(
    steps,
    {
      key: "sponsor_settlement",
      label: "Sponsor-Abrechnung",
      status: existingSponsorEndPayout
        ? "already_done"
        : sponsorSettlementApply.applied
          ? "applied"
          : sponsorSettlementPreview.canApply
            ? "planned"
            : "skipped",
      warnings: sponsorSettlementPreview.warnings,
      blockingReasons: sponsorSettlementPreview.blockingReasons,
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  const afterSponsorSave = sponsorSettlementApply.applied
    ? resolveLocalSave(persistence, initialSave.saveId)
    : afterCashSave;

  // APRON — NACH der Sponsor-Abrechnung (braucht den bereits bekannten rangabhaengigen
  // Wertungsanteil des Teams, siehe apron-service.ts) und VOR der Kassenbuchung der uebrigen
  // Saisonend-Schritte (Kredit-Tilgung, Facility-Einnahmen, Board-Objectives, Zahlungsunfaehigkeit)
  // — sonst rechnete der Deckel gegen einen Cash-Stand, den die Sponsor-Abrechnung selbst gerade
  // erst hergestellt hat, waehrend die nachfolgenden Schritte schon auf dem alten Stand aufsetzen.
  const apronSettlementPreview = previewApronSettlement(afterSponsorSave.gameState);
  const existingApronEndPayout = (afterSponsorSave.gameState.seasonState.apronSettlementLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.phase === "season_end",
  );
  const shouldApplyApronSettlement = !dryRun && blockingReasons.size === 0 && !existingApronEndPayout;
  const apronSettlementApply = shouldApplyApronSettlement
    ? applyApronSettlement({ gameState: afterSponsorSave.gameState, saveId: afterSponsorSave.saveId, execute: true })
    : { gameState: afterSponsorSave.gameState, preview: apronSettlementPreview, applied: false };
  if (shouldApplyApronSettlement && apronSettlementApply.applied) {
    persistence.saveSingleplayerState(afterSponsorSave.saveId, apronSettlementApply.gameState);
  }
  addStep(
    steps,
    {
      key: "apron_settlement",
      label: "Apron-Abrechnung",
      status: existingApronEndPayout
        ? "already_done"
        : apronSettlementApply.applied
          ? "applied"
          : apronSettlementPreview.canApply
            ? "planned"
            : "skipped",
      warnings: apronSettlementPreview.warnings,
      // Ein fehlender Snapshot (Save vor dieser Funktion angelegt, nie eingefroren) blockiert die
      // Saison NICHT — er zeigt nur, dass diese Saison keinen Apron kennt (kein Nachtrags-Zwang für
      // Bestandsspielstände).
      blockingReasons: [],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  const afterApronSave = apronSettlementApply.applied
    ? resolveLocalSave(persistence, initialSave.saveId)
    : afterSponsorSave;

  const loanSettlementPreview = previewLoanSettlement(afterApronSave.gameState, seasonId);
  const existingLoanSettlementLog =
    (afterApronSave.gameState.seasonState.loanApplyLogs ?? []).some(
      (log) => log.seasonId === seasonId && log.kind !== "early_payoff",
    ) ?? false;
  const shouldApplyLoanSettlement = !dryRun && blockingReasons.size === 0 && !existingLoanSettlementLog;
  const loanSettlementApply: LoanSettlementApplyResult = shouldApplyLoanSettlement
    ? applyLoanSettlement(afterApronSave.gameState, { execute: true, seasonId })
    : { ok: true, applied: false, duplicateDetected: existingLoanSettlementLog, preview: loanSettlementPreview, gameState: afterApronSave.gameState };
  if (shouldApplyLoanSettlement && loanSettlementApply.applied) {
    persistence.saveSingleplayerState(afterApronSave.saveId, loanSettlementApply.gameState);
  }
  addStep(
    steps,
    {
      key: "loan_settlement",
      label: "Kredit-Tilgung",
      status: existingLoanSettlementLog
        ? "already_done"
        : loanSettlementApply.applied
          ? "applied"
          : loanSettlementPreview.canApply
            ? "planned"
            : "skipped",
      warnings: [],
      blockingReasons: [],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  const afterLoanSave = loanSettlementApply.applied ? resolveLocalSave(persistence, initialSave.saveId) : afterApronSave;

  // Facility finance: fan-shop/arena income minus paid upkeep, applied once per team per
  // season. `applyFacilitySeasonEndFinance` computes the NET result (income - upkeep) — the
  // upkeep here (calculateFacilitySeasonUpkeep, gated by teamFacilities[..].lastPaidSeasonId)
  // is a distinct concept from the on-demand condition-repair cost charged by
  // applyFacilityMaintenance (calculateFacilityMaintenanceCost, gated by conditionPct >= 100
  // and only ever invoked via the manual /api/facilities/maintenance route or the AI manager's
  // budget-driven repair action — never automatically at season end). So applying the net here
  // does not double-charge upkeep. hasFacilitySeasonEndFinanceApplied guards against
  // double-applying (and double-crediting income) on retried/dry runs within the same season.
  let facilityFinanceAppliedCount = 0;
  let facilityFinancePlannedCount = 0;
  let facilityFinanceAlreadyDoneCount = 0;
  const facilityFinanceWarnings = new Set<string>();
  const facilityFinanceBlockingReasons = new Set<string>();
  for (const team of afterLoanSave.gameState.teams) {
    // Re-resolve on every iteration (not just after an apply): applyFacilitySeasonEndFinance
    // persists a full nextGameState derived from whatever save it was given, so an earlier
    // team's persisted facility cash/event change would otherwise get clobbered by a later
    // team's write built from a stale snapshot.
    const latestSave = resolveLocalSave(persistence, initialSave.saveId);
    if (hasFacilitySeasonEndFinanceApplied(latestSave.gameState, seasonId, team.teamId)) {
      facilityFinanceAlreadyDoneCount += 1;
      continue;
    }
    const facilityPreview = previewFacilitySeasonEndFinance(latestSave, team.teamId);
    facilityPreview.warnings.forEach((warning) => facilityFinanceWarnings.add(warning));
    if (!facilityPreview.ok) {
      facilityPreview.blockingReasons.forEach((reason) => facilityFinanceBlockingReasons.add(`facility_finance:${team.teamId}:${reason}`));
      continue;
    }
    const hasFacilityAction =
      facilityPreview.facilityIncomeTotal > 0 ||
      facilityPreview.rows.some((row) => row.status === "paid" || row.status === "will_disable_unpaid");
    if (!hasFacilityAction) {
      continue;
    }
    facilityFinancePlannedCount += 1;
    if (!dryRun && blockingReasons.size === 0 && facilityPreview.confirmToken) {
      const facilityApply = applyFacilitySeasonEndFinance(latestSave, team.teamId, facilityPreview.confirmToken, persistence);
      if (facilityApply.applied) {
        facilityFinanceAppliedCount += 1;
      } else {
        facilityApply.blockingReasons.forEach((reason) => facilityFinanceBlockingReasons.add(`facility_finance:${team.teamId}:${reason}`));
      }
    }
  }
  addStep(
    steps,
    {
      key: "facility_finance",
      label: "Facility-Einnahmen (Fan-Shop/Arena)",
      status:
        facilityFinanceAppliedCount > 0
          ? "applied"
          : facilityFinanceAlreadyDoneCount > 0
            ? "already_done"
            : facilityFinancePlannedCount > 0
              ? "planned"
              : "skipped",
      warnings: Array.from(facilityFinanceWarnings),
      blockingReasons: [],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  const afterFacilityFinanceSave = facilityFinanceAppliedCount > 0 ? resolveLocalSave(persistence, initialSave.saveId) : afterLoanSave;
  const objectiveRewardPreview = applyTeamSeasonObjectiveRewards(afterFacilityFinanceSave.gameState, {
    saveId: afterCashSave.saveId,
    seasonId,
    execute: false,
  });
  const existingObjectiveRewardLog =
    (afterFacilityFinanceSave.gameState.seasonState.objectiveRewardApplyLogs ?? []).find((log) => log.seasonId === seasonId) ?? null;
  const shouldApplyObjectiveRewards = !dryRun && blockingReasons.size === 0 && !existingObjectiveRewardLog;
  const objectiveRewardApply = shouldApplyObjectiveRewards
    ? applyTeamSeasonObjectiveRewards(afterFacilityFinanceSave.gameState, {
        saveId: afterFacilityFinanceSave.saveId,
        seasonId,
        execute: true,
      })
    : objectiveRewardPreview;
  if (shouldApplyObjectiveRewards && objectiveRewardApply.applied) {
    persistence.saveSingleplayerState(afterFacilityFinanceSave.saveId, objectiveRewardApply.gameState);
  }
  addStep(
    steps,
    {
      key: "objective_rewards",
      label: "Board Objectives",
      status: existingObjectiveRewardLog
        ? "already_done"
        : objectiveRewardApply.applied
          ? "applied"
          : completed
            ? "planned"
            : "skipped",
      warnings: objectiveRewardPreview.warnings,
      blockingReasons: [],
      auditId: existingObjectiveRewardLog?.id ?? objectiveRewardApply.auditLogId,
    },
    warnings,
    blockingReasons,
  );

  const afterObjectiveSave = objectiveRewardApply.applied ? resolveLocalSave(persistence, initialSave.saveId) : afterFacilityFinanceSave;

  /**
   * DIE GuV IM SAISONSTAND AUF DEN GEBUCHTEN STAND ZIEHEN — nach Sponsor, Apron, Gebäuden und
   * Zielen, weil erst hier alles gebucht ist, was in ihr steht.
   *
   * `standings[team].guvPosten` entsteht viel früher, in `writeLocalCashPrizeApply`, und trägt dort
   * nur Hochrechnungen — den Apron sogar als „noch nicht gebucht" und damit außerhalb der Summe.
   * Am Abbild `1hf25q` hiess das bei L-K −33,4 statt der gebuchten −18,8. Die Herleitung steht in
   * `season-guv-nachbuchung.ts`.
   *
   * Derselbe Aufruf steht am Ende von `applySeasonEndTail` — der andere Weg in dieselbe Abrechnung.
   * Er leitet nur ab und ist idempotent, doppelt laufen schadet also nicht.
   */
  const guvNachbuchung = dryRun
    ? { gameState: afterObjectiveSave.gameState, geaenderteTeams: [] as string[] }
    : zieheSaisonstandGuvNach(afterObjectiveSave.gameState);
  if (guvNachbuchung.geaenderteTeams.length > 0) {
    persistence.saveSingleplayerState(afterObjectiveSave.saveId, guvNachbuchung.gameState);
  }
  // Ab hier auf dem nachgezogenen Stand weiterarbeiten — sonst schreibt der nächste Schritt, der
  // den ganzen Spielstand speichert (die Beziehungs-Ereignisse), die Zeile wieder auf alt zurück.
  const afterGuvNachbuchungSave =
    guvNachbuchung.geaenderteTeams.length > 0 ? resolveLocalSave(persistence, initialSave.saveId) : afterObjectiveSave;

  // ZAHLUNGSUNFÄHIGKEIT WIRD FESTGESTELLT, NICHT AUSGEGLICHEN.
  //
  // Früher nahm hier jedes Team mit negativem Cash ungefragt einen Notkredit über den Fehlbetrag auf
  // (Cash danach = 0). Auf dem gespielten Stand standen dadurch nach der Abrechnung von Saison 2
  // NEUN von 32 Teams auf exakt 0,0 und kein einziges im Minus — zusammen 164,2 Mio Kreditsumme, die
  // niemand beantragt hatte. Chris: „teams können auch ins negative gehen und müssen das dann mit
  // verkäufen und krediten wieder auffüllen! es darf nicht einfach geld erschummelt und auf 0
  // gesetzt werden."
  //
  // Der Weg zurück ist längst gebaut: negatives Cash blockiert Käufe, erzwingt Notverkäufe und setzt
  // den Verkaufsdruck auf den Höchstwert. Er wurde nur nie betreten, weil der Backstop vorher
  // zumachte. Dieser Schritt schreibt deshalb NICHTS mehr — er weist nur aus, wer im Minus steht.
  const negativeCash = collectNegativeCashTeams(afterGuvNachbuchungSave.gameState);
  const afterInsolvencySave = afterGuvNachbuchungSave;
  addStep(
    steps,
    {
      key: "insolvency_backstop",
      label: "Zahlungsunfähigkeit",
      status: negativeCash.teams.length > 0 ? "already_done" : "skipped",
      warnings: negativeCash.warnings,
      blockingReasons: [],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  const relationshipApply = upsertTeamRelationshipEvents(afterInsolvencySave.gameState);
  const existingRelationshipEvents = afterCashSave.gameState.seasonState.teamRelationshipEvents ?? [];
  const existingRelationshipIds = new Set(existingRelationshipEvents.map((event) => event.eventId));
  const newRelationshipEventCount = relationshipApply.generatedEvents.filter((event) => !existingRelationshipIds.has(event.eventId)).length;
  const shouldApplyRelationships =
    !dryRun && blockingReasons.size === 0 && (newRelationshipEventCount > 0 || relationshipApply.replacedPreviewEvents > 0);
  if (shouldApplyRelationships) {
    persistence.saveSingleplayerState(afterCashSave.saveId, relationshipApply.gameState);
  }
  addStep(
    steps,
    {
      key: "relationships",
      label: "Ally/Rival Updates",
      status:
        relationshipApply.generatedEvents.length === 0
          ? "skipped"
          : shouldApplyRelationships
            ? "applied"
            : newRelationshipEventCount === 0 && relationshipApply.replacedPreviewEvents === 0
              ? "already_done"
              : "planned",
      warnings: relationshipApply.warnings,
      blockingReasons: [],
      auditId: relationshipApply.generatedEvents.length > 0 ? `relationships:${seasonId}:${relationshipApply.generatedEvents.length}` : null,
    },
    warnings,
    blockingReasons,
  );

  const afterRelationshipsSave = shouldApplyRelationships ? resolveLocalSave(persistence, initialSave.saveId) : afterInsolvencySave;
  const existingSnapshot =
    (afterRelationshipsSave.gameState.seasonState.seasonSnapshots ?? []).find((snapshot) => snapshot.seasonId === seasonId) ?? null;
  const snapshot =
    !dryRun && blockingReasons.size === 0 && !existingSnapshot
      ? createSeasonSnapshot(
          {
            saveId: afterRelationshipsSave.saveId,
            seasonId,
            source,
            execute: true,
            dryRun: false,
            confirm: SEASON_SNAPSHOT_CONFIRM_TOKEN,
          },
          persistence,
        )
      : createSeasonSnapshot(
          {
            saveId: afterRelationshipsSave.saveId,
            seasonId,
            source,
            dryRun: true,
            execute: false,
          },
          persistence,
        );
  if (!existingSnapshot && (!snapshot.ok || (!dryRun && !snapshot.applied))) {
    snapshot.blockingReasons.forEach((reason) => blockingReasons.add(reason));
  }
  addStep(
    steps,
    {
      key: "snapshot",
      label: "Season Snapshot",
      status: existingSnapshot ? "already_done" : snapshot.applied ? "applied" : snapshot.canCreate ? "planned" : "blocked",
      warnings: snapshot.warnings,
      blockingReasons: existingSnapshot ? [] : snapshot.blockingReasons,
      auditId: snapshot.snapshot.snapshotId ?? null,
    },
    warnings,
    blockingReasons,
  );

  const afterSnapshotSave = resolveLocalSave(persistence, initialSave.saveId);
  const transition =
    !dryRun && blockingReasons.size === 0 && afterSnapshotSave.gameState.gamePhase !== "season_review"
      ? startSeasonTransition(afterSnapshotSave, persistence)
      : buildSeasonTransitionPreview(afterSnapshotSave);
  if (!transition.ok) {
    transition.blockingReasons.forEach((reason) => blockingReasons.add(reason));
  }
  addStep(
    steps,
    {
      key: "transition",
      label: "Season Review öffnen",
      status: "applied" in transition && transition.applied ? "applied" : transition.ok ? "planned" : "blocked",
      warnings: transition.warnings,
      blockingReasons: transition.blockingReasons,
      auditId: transition.transition.transitionId,
    },
    warnings,
    blockingReasons,
  );
  addStep(
    steps,
    {
      key: "ai_audit",
      label: "AI Saison-Audit",
      status: aiSeasonAudit.warnings.length > 0 ? "planned" : "applied",
      warnings: aiSeasonAudit.warnings,
      blockingReasons: [],
      auditId: null,
    },
    warnings,
    blockingReasons,
  );

  const blockingList = Array.from(blockingReasons);
  const warningList = Array.from(warnings);
  const applied = !dryRun && blockingList.length === 0;
  if (applied) {
    const latestSave = resolveLocalSave(persistence, initialSave.saveId);
    persistGameStateWithMaterializedDerivations(persistence, latestSave.saveId, {
      ...latestSave.gameState,
      seasonReviewState: buildSeasonConsequencesReviewState({
        previousState: latestSave.gameState.seasonReviewState,
        seasonId,
        seasonReview,
        cashApply,
        relationships: relationshipApply,
        aiSeasonAudit,
        warnings: warningList,
      }),
    });
  }

  return {
    ok: blockingList.length === 0,
    dryRun,
    applied,
    status: blockingList.length > 0 ? "blocked" : applied ? "applied" : "ready",
    scope: {
      saveId: initialSave.saveId,
      seasonId,
      matchdayId,
    },
    steps,
    seasonReview,
    cashApply,
    snapshot,
    relationships: relationshipApply,
    transition,
    aiSeasonAudit,
    warnings: warningList,
    blockingReasons: blockingList,
  };
}

export async function runLocalSeasonCompletion(
  params: {
    saveId: string;
    seasonId?: string;
    source?: "sqlite" | "prisma";
    dryRun?: boolean;
    execute?: boolean;
    confirmToken?: string;
  },
  persistence: PersistenceService = createPersistenceService(),
): Promise<SeasonCompletionResult> {
  const dryRun = params.execute ? false : params.dryRun ?? true;
  if (dryRun) {
    return runLocalSeasonCompletionUnsafe(params, persistence);
  }

  const beforeSave = resolveLocalSave(persistence, params.saveId);
  return runWithSaveRecovery({
    label: "season_completion",
    saveId: beforeSave.saveId,
    status: beforeSave.status,
    beforeGameState: beforeSave.gameState,
    persistence,
    run: () => runLocalSeasonCompletionUnsafe(params, persistence),
  });
}
