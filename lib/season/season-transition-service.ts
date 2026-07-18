import { randomUUID } from "node:crypto";

import type { GamePhase, GameState, SeasonTransitionState } from "@/lib/data/olyDataTypes";
import { buildFormCardSeasonUsageAudit } from "@/lib/lineups/legacy-lineup-modifiers";
import { persistGameStateWithMaterializedDerivations } from "@/lib/foundation/materialize-season-derivations";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { applySeasonEndPotentialUpdates } from "@/lib/progression/player-potential-service";
import { buildSeasonReview, type SeasonReview } from "@/lib/season/season-review-service";

export const SEASON_TRANSITION_STEPS = [
  "season_check",
  "season_review",
  "season_rewards",
  "player_development",
  "preseason_management",
  "transfer_sell_phase",
  "transfer_buy_phase",
  "lineup_setup",
  "next_season_ready",
] as const;

export type SeasonTransitionStepId = (typeof SEASON_TRANSITION_STEPS)[number];

export type SeasonTransitionStepPreview = {
  stepId: SeasonTransitionStepId;
  label: string;
  status: "open" | "ready" | "applied" | "blocked";
  preview: string;
  warnings: string[];
  blockingReasons: string[];
  canApply: boolean;
};

export type SeasonTransitionPreview = {
  ok: boolean;
  dryRun: boolean;
  applied?: boolean;
  productiveWrites: false;
  gamePhase: GamePhase;
  canCompleteSeason: boolean;
  disabledReason: string | null;
  transition: SeasonTransitionState;
  steps: SeasonTransitionStepPreview[];
  seasonReview: SeasonReview;
  warnings: string[];
  blockingReasons: string[];
  saveContext: {
    saveId: string;
    fromSeasonId: string;
    toSeasonId: string;
  };
};

const STEP_LABELS: Record<SeasonTransitionStepId, string> = {
  season_check: "Saison prüfen",
  season_review: "Saisonrückblick",
  season_rewards: "Finanzen",
  player_development: "Spielerentwicklung",
  preseason_management: "Pre-Season Management",
  transfer_sell_phase: "Verkäufe",
  transfer_buy_phase: "Käufe",
  lineup_setup: "Setup neue Saison",
  next_season_ready: "Neue Saison starten",
};

const PHASE_TO_STEP: Partial<Record<GamePhase, SeasonTransitionStepId>> = {
  season_completed: "season_check",
  season_review: "season_review",
  season_rewards: "season_rewards",
  player_development: "player_development",
  preseason_management: "preseason_management",
  transfer_sell_phase: "transfer_sell_phase",
  transfer_buy_phase: "transfer_buy_phase",
  lineup_setup: "lineup_setup",
  next_season_ready: "next_season_ready",
};

export function resolveGamePhase(gameState: Pick<GameState, "gamePhase">): GamePhase {
  return gameState.gamePhase ?? "season_active";
}

function parseSeasonNumber(gameState: GameState) {
  const idNumber = gameState.season.id.match(/(\d+)$/)?.[1];
  const nameNumber = gameState.season.name.match(/(\d+)$/)?.[1];
  return Math.max(1, Number(idNumber ?? nameNumber ?? gameState.season.year ?? 1) || 1);
}

function getNextSeasonId(gameState: GameState) {
  return `season-${parseSeasonNumber(gameState) + 1}`;
}

export function isSeasonComplete(gameState: GameState) {
  if (gameState.gamePhase && gameState.gamePhase !== "season_active") {
    return true;
  }

  const matchdayIds = gameState.season.matchdayIds ?? [];
  const lastMatchdayId = matchdayIds[matchdayIds.length - 1] ?? gameState.matchdayState.matchdayId;
  const lastFixtures = gameState.seasonState.schedule.filter((fixture) => fixture.matchdayId === lastMatchdayId);
  const lastFixturesResolved = lastFixtures.length === 0 || lastFixtures.every((fixture) => fixture.status === "resolved");
  const hasLastMatchdayResult = (gameState.seasonState.matchdayResults ?? []).some(
    (result) => result.seasonId === gameState.season.id && result.matchdayId === lastMatchdayId,
  );
  const hasLastStandingsApply = (gameState.seasonState.standingsApplyLogs ?? []).some(
    (log) => log.seasonId === gameState.season.id && log.matchdayId === lastMatchdayId,
  );
  const activeMatchdayIsLast = gameState.matchdayState.matchdayId === lastMatchdayId || gameState.season.currentMatchday >= matchdayIds.length;
  const matchdayResolved = gameState.matchdayState.status === "resolved";

  return activeMatchdayIsLast && matchdayResolved && (lastFixturesResolved || (hasLastMatchdayResult && hasLastStandingsApply));
}

function buildTransitionState(save: PersistedSaveGame, input?: { status?: SeasonTransitionState["status"]; currentStep?: SeasonTransitionStepId }) {
  const existing = save.gameState.seasonTransition;
  return {
    transitionId: existing?.transitionId ?? `season-transition-${randomUUID()}`,
    fromSeasonId: save.gameState.season.id,
    toSeasonId: existing?.toSeasonId ?? getNextSeasonId(save.gameState),
    currentStep: input?.currentStep ?? existing?.currentStep ?? "season_check",
    status: input?.status ?? existing?.status ?? "preview",
    completedSteps: existing?.completedSteps ?? [],
    warnings: existing?.warnings ?? [],
    errors: existing?.errors ?? [],
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    appliedAt: existing?.appliedAt,
  } satisfies SeasonTransitionState;
}

function buildStepPreviews(save: PersistedSaveGame, transition: SeasonTransitionState, seasonComplete: boolean) {
  const currentStep = transition.currentStep as SeasonTransitionStepId;
  const currentIndex = Math.max(0, SEASON_TRANSITION_STEPS.indexOf(currentStep));
  const completed = new Set(transition.completedSteps);
  const rosterCount = save.gameState.rosters.length;
  const transferCount = save.gameState.transferHistory.length;
  const lineupCount = save.gameState.seasonState.lineupDrafts?.length ?? 0;
  const formCardCount = save.gameState.seasonState.formCards?.length ?? 0;
  const formCardUsageAudit = buildFormCardSeasonUsageAudit(save.gameState, save.gameState.season.id);

  return SEASON_TRANSITION_STEPS.map((stepId, index) => {
    const blockingReasons = stepId === "season_check" && !seasonComplete ? ["last_matchday_not_completed"] : [];
    const warnings = [
      stepId === "season_rewards" ? "uses_existing_prize_facility_cash_sources_only" : null,
      stepId === "season_rewards" && formCardUsageAudit.unusedNegativeCards > 0
        ? `unused_negative_formcards_penalty:${formCardUsageAudit.negativePenaltyPoints}`
        : null,
      stepId === "season_rewards" && formCardUsageAudit.unusedPositiveCards > 0
        ? `unused_positive_formcards_expire:${formCardUsageAudit.unusedPositiveCards}`
        : null,
      stepId === "player_development" ? "preview_only_no_attribute_writes" : null,
      stepId === "transfer_sell_phase" ? "human_teams_manual_only" : null,
      stepId === "transfer_buy_phase" ? "buy_after_sell_only" : null,
      stepId === "next_season_ready" ? "next_season_apply_requires_preseason_confirm" : null,
    ].filter((entry): entry is string => Boolean(entry));
    const previewByStep: Record<SeasonTransitionStepId, string> = {
      season_check: seasonComplete ? "Letzter Spieltag ist abgeschlossen." : "Letzter Spieltag ist noch nicht abgeschlossen.",
      season_review: `Rückblick liest Saisonstand, ${transferCount} Transfers und Kaderdaten.`,
      season_rewards:
        formCardUsageAudit.unusedCards > 0
          ? `Preview liest Preisgeld, Sponsor, Facilities; Formkarten offen: ${formCardUsageAudit.unusedCards} (${formCardUsageAudit.unusedNegativeCards} negative = ${formCardUsageAudit.negativePenaltyPoints} Strafpunkte, positive verfallen).`
          : "Preview liest Preisgeld, Sponsor, Facility-Unterhalt und Facility-Income. Alle Formkarten wurden verbraucht.",
      player_development: `Preview berechnet XP für ${rosterCount} aktive Spieler ohne Attribut-Writes.`,
      preseason_management: `Training, Gebäude, Scouting und Board-Hinweise als Vorschau; ${formCardCount} Formkarten im Save.`,
      transfer_sell_phase: "AI-Verkäufe werden später über Sell-Service vorbereitet; Human-Teams bleiben manuell.",
      transfer_buy_phase: "AI-Käufe laufen nach Verkäufen über Buy-Service; keine Duplikate/kein negatives Cash als spätere Gate-Regeln.",
      lineup_setup: `${lineupCount} gespeicherte Lineups würden für neue Season geprüft/resetet.`,
      next_season_ready: "Neue Saison startet ueber den bestaetigten Pre-Season Workflow.",
    };
    return {
      stepId,
      label: STEP_LABELS[stepId],
      status: blockingReasons.length > 0 ? "blocked" : completed.has(stepId) ? "applied" : index === currentIndex ? "ready" : "open",
      preview: previewByStep[stepId],
      warnings,
      blockingReasons,
      canApply: false,
    } satisfies SeasonTransitionStepPreview;
  });
}

export function buildSeasonTransitionPreview(save: PersistedSaveGame): SeasonTransitionPreview {
  const gamePhase = resolveGamePhase(save.gameState);
  const seasonComplete = isSeasonComplete(save.gameState);
  const currentStep = PHASE_TO_STEP[gamePhase] ?? "season_check";
  const transition = buildTransitionState(save, { status: "preview", currentStep });
  const disabledReason = seasonComplete ? null : "last_matchday_not_completed";
  const steps = buildStepPreviews(save, transition, seasonComplete);
  const seasonReview = buildSeasonReview(save.gameState);
  const warnings = [...new Set([...steps.flatMap((step) => step.warnings), ...seasonReview.warnings])];
  const blockingReasons = disabledReason ? [disabledReason] : [];

  return {
    ok: blockingReasons.length === 0,
    dryRun: true,
    productiveWrites: false,
    gamePhase,
    canCompleteSeason: seasonComplete,
    disabledReason,
    transition,
    steps,
    seasonReview,
    warnings,
    blockingReasons,
    saveContext: {
      saveId: save.saveId,
      fromSeasonId: save.gameState.season.id,
      toSeasonId: transition.toSeasonId,
    },
  };
}

export function startSeasonTransition(
  save: PersistedSaveGame,
  persistence: PersistenceService = createPersistenceService(),
): SeasonTransitionPreview {
  const preview = buildSeasonTransitionPreview(save);
  if (!preview.canCompleteSeason) {
    return {
      ...preview,
      dryRun: false,
      applied: false,
      transition: {
        ...preview.transition,
        status: "failed",
        errors: [...preview.transition.errors, "last_matchday_not_completed"],
      },
    };
  }
  const transition = buildTransitionState(save, { status: "preview", currentStep: "season_review" });
  // Idempotenz-Guard (mirror von season-completion-service): die Season-End-Potenzial-Updates driften die
  // hiddenPotentialScore deterministisch um einen seed-basierten Delta. `isSeasonComplete` bleibt nach dem
  // ersten Übergang WEITERHIN true (gamePhase = "season_review"), sodass ein erneuter Aufruf (Doppelklick,
  // Reload, zweiter Tab, API-Retry, oder das Nebeneinander von „Saison abschließen" und „Abschluss-Run")
  // die Drift SONST ligaweit ein zweites Mal anwenden würde. Ist der Übergang bereits gelaufen
  // (gamePhase === "season_review"), das Potenzial NICHT erneut driften — der bestehende Wert bleibt stehen.
  const alreadyTransitioned = save.gameState.gamePhase === "season_review";
  const updatedPlayerPotential = alreadyTransitioned
    ? save.gameState.playerPotential
    : applySeasonEndPotentialUpdates({
        saveId: save.saveId,
        seasonId: save.gameState.season.id,
        gameState: save.gameState,
      });
  const nextGameState: GameState = {
    ...save.gameState,
    gamePhase: "season_review",
    seasonTransition: transition,
    playerPotential: updatedPlayerPotential,
  };
  persistGameStateWithMaterializedDerivations(persistence, save.saveId, nextGameState);

  return {
    ...buildSeasonTransitionPreview({ ...save, gameState: nextGameState }),
    dryRun: false,
    applied: true,
    transition,
  };
}
