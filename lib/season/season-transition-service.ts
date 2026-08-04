import { randomUUID } from "node:crypto";

import type { GamePhase, GameState, SeasonTransitionState } from "@/lib/data/olyDataTypes";
import { buildFormCardSeasonUsageAudit } from "@/lib/lineups/legacy-lineup-modifiers";
import { isTransferMarketPhaseOpen } from "@/lib/market/transfer-window-policy";
import { persistGameStateWithMaterializedDerivations } from "@/lib/foundation/materialize-season-derivations";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { applySeasonEndPotentialUpdates } from "@/lib/progression/player-potential-service";
import { runSeasonEndProgressionBatch } from "@/lib/progression/season-end-progression-batch";
import { buildSeasonReview, type SeasonReview } from "@/lib/season/season-review-service";
import { getNextStepAfter, getPhaseAfterStep, isStepBehind } from "@/lib/season/season-transition-chain";
import { SEASON_TRANSITION_STEPS, type SeasonTransitionStepId } from "@/lib/season/season-transition-steps";

// Audit R2/V1: Phasen, die der Saisonübergang NICHT auf "season_review" zurücksetzen darf (der User ist im
// Saisonende-Wizard bereits über den Review hinaus). undefined/season_active/season_completed/season_review
// sind NICHT enthalten → dort wird korrekt auf "season_review" gesetzt.
const SEASON_TRANSITION_POST_REVIEW_PHASES = new Set<GamePhase>([
  "season_rewards",
  "player_development",
  "preseason_management",
  "transfer_sell_phase",
  "transfer_buy_phase",
  "lineup_setup",
  "next_season_ready",
]);

// Die Liste ist nach `season-transition-steps.ts` gewandert, damit die Kette sie nutzen kann,
// ohne einen Zyklus ueber diesen Service zu bauen. Re-Export, damit die bestehenden Importeure
// dieses Moduls unveraendert weiterlaufen.
export { SEASON_TRANSITION_STEPS };
export type { SeasonTransitionStepId };

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
      player_development: `Preview berechnet die organische Saisonende-Entwicklung für ${rosterCount} aktive Spieler (identisch zum Apply, ohne Attribut-Writes bis zur Bestätigung).`,
      preseason_management: `Training, Gebäude, Scouting und Board-Hinweise als Vorschau; ${formCardCount} Formkarten im Save.`,
      transfer_sell_phase: "AI-Verkäufe werden später über Sell-Service vorbereitet; Human-Teams bleiben manuell.",
      transfer_buy_phase: "AI-Käufe laufen nach Verkäufen über Buy-Service; keine Duplikate/kein negatives Cash als spätere Gate-Regeln.",
      lineup_setup: `${lineupCount} gespeicherte Lineups würden für neue Season geprüft/resetet.`,
      next_season_ready: "Neue Saison startet ueber den bestaetigten Pre-Season Workflow.",
    };
    // Ein Schritt ist erledigt, sobald die PHASE ueber ihn hinaus ist — nicht erst, wenn er in
    // `completedSteps` steht. Die Phase liegt im Save und steuert alle Gates; `completedSteps` ist
    // nur die Beschriftung und fehlt z. B. bei Saves aus dem Admin-Runner oder aus einem Import.
    const behind = isStepBehind(stepId, currentStep);
    // HIER stand `canApply: false` — fest verdrahtet fuer JEDEN Schritt. Das war die Sackgasse:
    // der Assistent zeigte die komplette Kette an, aber kein Schritt war je anwendbar, also blieb
    // die Phase auf `season_review` stehen. Verkaufen (nur in `preseason_management` und
    // `transfer_sell_phase` offen) und die Awards (`season_rewards`) waren damit unerreichbar.
    const canApply = blockingReasons.length === 0 && index === currentIndex && getPhaseAfterStep(stepId) !== null;
    return {
      stepId,
      label: STEP_LABELS[stepId],
      status:
        blockingReasons.length > 0
          ? "blocked"
          : behind || completed.has(stepId)
            ? "applied"
            : index === currentIndex
              ? "ready"
              : "open",
      preview: previewByStep[stepId],
      warnings,
      blockingReasons,
      canApply,
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
    // Audit R2/V1: NICHT hart auf "season_review" zurücksetzen, wenn der User im Wizard schon WEITER ist.
    // Der Übergang setzt "season_review" nur, solange die Phase noch nicht über den Review hinaus ist
    // (undefined/season_active/season_completed/season_review). Ist sie bereits in einer Post-Review-Phase
    // (season_rewards, player_development, …), bleibt sie erhalten — ein erneuter Abschluss-Trigger wirft
    // den Fortschritt sonst zurück.
    gamePhase: SEASON_TRANSITION_POST_REVIEW_PHASES.has(save.gameState.gamePhase as GamePhase)
      ? save.gameState.gamePhase
      : "season_review",
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

/**
 * Einen Schritt des Saisonende-Assistenten anwenden und die Phase auf die naechste Station
 * schalten.
 *
 * DAS WAR DIE LUECKE. Die Kette existierte als Liste, die Zuordnung Phase→Schritt existierte,
 * nur schaltete nichts je weiter — `canApply` stand fest auf `false`, und die einzige schreibende
 * Funktion (`startSeasonTransition`) kam nie ueber `season_review` hinaus. Dadurch waren
 * `preseason_management` und `transfer_sell_phase` unerreichbar, und weil VERKAUFEN genau an
 * diesen beiden Phasen haengt, war es nach dem ersten Spieltag einer Saison dauerhaft zu.
 *
 * Der erste Schritt (`season_check`) laeuft bewusst weiter ueber `startSeasonTransition`: dort
 * haengt der Idempotenz-Guard fuer die Potenzial-Drift, den ein zweiter Weg sonst umgehen wuerde.
 *
 * KEIN Schritt fuehrt hier wirtschaftliche Effekte aus (Preisgeld, XP). Die haben eigene, jeweils
 * bestaetigte Wege (`cash-prize-apply-service`, `season-end-xp-apply-service`); sie hier
 * mitlaufen zu lassen hiesse, dieselbe Buchung an zwei Stellen ausloesen zu koennen. Das
 * Weiterschalten ist deshalb absichtlich NICHT an sie gekoppelt — es oeffnet die Phase, in der
 * sie stattfinden.
 */
export function advanceSeasonTransitionStep(
  save: PersistedSaveGame,
  persistence: PersistenceService = createPersistenceService(),
): SeasonTransitionPreview {
  const preview = buildSeasonTransitionPreview(save);
  const currentStep = preview.transition.currentStep as SeasonTransitionStepId;

  // Solange der letzte Spieltag nicht durch ist, faengt die Kette gar nicht erst an.
  if (!preview.canCompleteSeason) {
    return {
      ...preview,
      ok: false,
      dryRun: false,
      applied: false,
      blockingReasons: [...new Set([...preview.blockingReasons, "last_matchday_not_completed"])],
    };
  }

  // Der Einstieg behaelt seinen eigenen Weg — wegen des Drift-Guards, siehe oben.
  if (currentStep === "season_check") {
    return startSeasonTransition(save, persistence);
  }

  const nextPhase = getPhaseAfterStep(currentStep);
  if (!nextPhase) {
    // Ende der Kette: ab hier legt der Pre-Season-Workflow die neue Saison an, nicht dieser Weg.
    return {
      ...preview,
      ok: false,
      dryRun: false,
      applied: false,
      blockingReasons: [...new Set([...preview.blockingReasons, "season_transition_chain_complete"])],
    };
  }

  const nextStep = getNextStepAfter(currentStep) ?? currentStep;

  /**
   * DER SCHRITT „SPIELERENTWICKLUNG" RECHNET JETZT WIRKLICH.
   *
   * GEMELDET: „Kannst du dafuer sorgen, dass nach MD10 bevor man verkaufen kann die
   * Trainingsupgrades der spieler schon durch laufen und die neuen Marktwerte dann verfuegbar
   * sind? erst DANN darf wirklich verkauft werden."
   *
   * Vorher schaltete dieser Schritt nur die Phase weiter — die Entwicklung lief erst beim Start
   * der NEUEN Saison, also hinter dem Transferfenster. Man verkaufte damit zu Marktwerten, die
   * der Spieler zu diesem Zeitpunkt schon nicht mehr hatte: ein Spieler, der ueber den Sommer
   * zulegt, ging zum alten Preis weg.
   *
   * Die Reihenfolge in der Kette stimmte laengst (`player_development` liegt VOR
   * `transfer_sell_phase`) — es fehlte nur, dass der Schritt seine eigene Arbeit tut.
   *
   * Der Marker sorgt dafuer, dass es bei EINEM Mal bleibt: der Pre-Season-Workflow ueberspringt
   * die Materialisierung, wenn sie fuer diese Saison schon gelaufen ist. Ohne ihn liefe die
   * Entwicklung zweimal und jeder Spieler bekaeme seinen Saisonsprung doppelt.
   */
  let progressionSave = save;
  let progressionWarnings: string[] = [];
  const abgeschlosseneSaisonId = save.gameState.season.id;
  const entwicklungSchonGelaufen =
    save.gameState.seasonTransition?.progressionAppliedForSeasonId === abgeschlosseneSaisonId;

  let entwicklungGelaufen = entwicklungSchonGelaufen;

  if (currentStep === "player_development" && !entwicklungSchonGelaufen) {
    /**
     * SCHEITERT DIE ENTWICKLUNG, SPERRT SIE DEN WEG TROTZDEM NICHT.
     *
     * Die naheliegende Fassung waere, bei Blockern abzubrechen — dann bliebe die Phase stehen,
     * bis die Entwicklung sauber durchlaeuft. Genau das waere hier aber die schlechtere
     * Entscheidung: dieser Ablauf hatte schon einmal eine Sackgasse ("ich haenge in MD10, wie
     * komme ich sauber in den naechsten schritt"), und ein blockierter Saisonuebergang sperrt
     * Vertragsverlaengerungen und Verkaeufe gleich mit aus.
     *
     * Also: weiterschalten, aber ehrlich. Der Marker wird NUR gesetzt, wenn wirklich gerechnet
     * wurde — so holt der Saisonstart die Entwicklung nach, statt sie stillschweigend zu
     * verlieren, und die Warnung sagt, dass die Marktwerte in diesem Durchgang noch die alten
     * sind.
     */
    try {
      const batch = runSeasonEndProgressionBatch({ save, persistence, persistFinalState: false });
      if (batch.blockingReasons.length > 0) {
        progressionWarnings = [
          ...batch.warnings,
          `season_end_progression_deferred:${batch.blockingReasons.join("|")}`,
        ];
      } else {
        progressionSave = batch.save;
        progressionWarnings = batch.warnings;
        entwicklungGelaufen = true;
      }
    } catch (error) {
      progressionWarnings = [
        `season_end_progression_failed:${error instanceof Error ? error.message : "unknown"}`,
      ];
    }
  }

  const transition: SeasonTransitionState = {
    ...preview.transition,
    status: "preview",
    currentStep: nextStep,
    completedSteps: [...new Set([...preview.transition.completedSteps, currentStep])],
    warnings: [...new Set([...preview.transition.warnings, ...progressionWarnings])],
    // Nur setzen, wenn wirklich gerechnet wurde — sonst holt der Saisonstart es nach.
    progressionAppliedForSeasonId: entwicklungGelaufen
      ? abgeschlosseneSaisonId
      : save.gameState.seasonTransition?.progressionAppliedForSeasonId ?? null,
  };
  const nextGameState: GameState = {
    ...progressionSave.gameState,
    gamePhase: nextPhase,
    seasonTransition: transition,
  };
  persistGameStateWithMaterializedDerivations(persistence, save.saveId, nextGameState);

  return {
    ...buildSeasonTransitionPreview({ ...save, gameState: nextGameState }),
    dryRun: false,
    applied: true,
    transition,
  };
}

/**
 * Bis zum Transferfenster durchschalten — so weit, dass Verkaufen und Verlaengern offen sind.
 *
 * GEMELDET: "wenn hier gesagt wird sponsoren + preisgeld dann training und dann kader, wuerde
 * ich erwarten dass wenn ich da drauf gehe auch meine vertraege verlaengern und spieler
 * verkaufen kann! sonst ist das n fehler im system"
 *
 * Der Saisonabschluss-Bildschirm nannte vier Schritte und schickte zum Kader ("Im Kader kannst
 * du verhandeln"). Am echten Spielstand war in Phase `season_completed` aber JEDE dieser
 * Handlungen gesperrt — `renew_contract`, `sell_players`, `buy_players`, `set_training`
 * (`game-phase-action-policy`). Die Checkliste beschrieb einen Ablauf, den die Phase nicht
 * zuliess.
 *
 * Warum eine Schleife und kein einzelner Schritt: zwischen `season_completed` und der ersten
 * Phase mit offenem Transferfenster liegen VIER Stationen. Sie einzeln anklicken zu lassen ist
 * der Wizard-Weg (Cockpit); die Checkliste stellt eine andere Frage — "ich will jetzt meine
 * Vertraege machen" — und beantwortet sie in einem Zug.
 *
 * Die Schleife erfindet dabei nichts: sie ruft denselben `advanceSeasonTransitionStep` auf, der
 * auch am Einzelschritt haengt. Welche Station auf welche folgt, entscheidet weiterhin allein
 * die Kette — hier steht nur, WANN aufgehoert wird.
 *
 * `applied: true` heisst hier "das Fenster ist jetzt offen", nicht "es wurde etwas geschrieben".
 * War es schon offen, ist das Ergebnis dasselbe und der Aufrufer soll es nicht als Fehler
 * anzeigen — ein zweiter Klick auf denselben Knopf ist kein Fehlschlag. Geschrieben wird dann
 * nichts; die Phase rutscht insbesondere NICHT weiter Richtung neuer Saison.
 */
export function advanceSeasonTransitionToTransferWindow(
  save: PersistedSaveGame,
  persistence: PersistenceService = createPersistenceService(),
): SeasonTransitionPreview {
  let current = save;
  let result = buildSeasonTransitionPreview(current);

  // Obergrenze = Laenge der Kette. Kein Sicherheitsnetz gegen Fehler, sondern gegen eine
  // Endlosschleife, falls ein Schritt je aufhoert weiterzuschalten (`applied: false`) — dann
  // bricht die Schleife ohnehin unten ab; die Grenze ist der Guertel dazu.
  for (let hop = 0; hop < SEASON_TRANSITION_STEPS.length; hop += 1) {
    if (isTransferMarketPhaseOpen(current.gameState)) break;
    const step = advanceSeasonTransitionStep(current, persistence);
    if (!("applied" in step) || !step.applied) return step;
    const reloaded = persistence.getSaveById(current.saveId);
    if (!reloaded) return step;
    current = reloaded;
    result = step;
  }

  return {
    ...buildSeasonTransitionPreview(current),
    dryRun: false,
    applied: true,
    transition: result.transition,
  };
}
