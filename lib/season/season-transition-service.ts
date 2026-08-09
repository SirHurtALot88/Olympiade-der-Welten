import { randomUUID } from "node:crypto";

import type { GamePhase, GameState, SeasonTransitionState } from "@/lib/data/olyDataTypes";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { buildFormCardSeasonUsageAudit } from "@/lib/lineups/legacy-lineup-modifiers";
import { isTransferMarketPhaseOpen } from "@/lib/market/transfer-window-policy";
import { persistGameStateWithMaterializedDerivations } from "@/lib/foundation/materialize-season-derivations";
import { isSeasonComplete } from "@/lib/season/season-completion-state";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { applySeasonEndPotentialUpdates } from "@/lib/progression/player-potential-service";
import { runSeasonEndProgressionBatch } from "@/lib/progression/season-end-progression-batch";
import { patchSeasonSnapshotMarketValueAfterProgression } from "@/lib/season/season-snapshot-service";
import { buildSeasonReview, type SeasonReview } from "@/lib/season/season-review-service";
import { getNextStepAfter, getPhaseAfterStep, isStepBehind } from "@/lib/season/season-transition-chain";
import { SEASON_TRANSITION_STEPS, type SeasonTransitionStepId } from "@/lib/season/season-transition-steps";

// Audit R2/V1: Phasen, die der Saisonübergang NICHT auf "season_review" zurücksetzen darf (der User ist im
// Saisonende-Wizard bereits über den Review hinaus). undefined/season_active/season_completed/season_review
// sind NICHT enthalten → dort wird korrekt auf "season_review" gesetzt.
const SEASON_TRANSITION_POST_REVIEW_PHASES = new Set<GamePhase>([
  "season_rewards",
  "player_development",
  "season_end_management",
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
  season_end_management: "Training / Ziele",
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
  season_end_management: "season_end_management",
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

// Die Definition steht in `lib/season/season-completion-state.ts` — hier nur der Re-Export, damit die
// bisherigen Importpfade (Season-Completion, Debug-Bootstrap, Tests) unveraendert bleiben.
export { isSeasonComplete };

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
    // Die Erledigt-Marker muessen den Neuaufbau ueberleben, sonst laufen ihre Schritte erneut. Der
    // Entwicklungs-Marker wurde bisher weiter unten von Hand nachgereicht; hier stehen beide an
    // derselben Stelle, damit der naechste Marker nicht wieder vergessen wird.
    progressionAppliedForSeasonId: existing?.progressionAppliedForSeasonId ?? null,
    aiSeasonEndSellsAppliedForSeasonId: existing?.aiSeasonEndSellsAppliedForSeasonId ?? null,
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
      season_end_management: `Training, Gebäude, Scouting und Board-Hinweise als Vorschau; ${formCardCount} Formkarten im Save.`,
      transfer_sell_phase: "AI-Verkäufe werden später über Sell-Service vorbereitet; Human-Teams bleiben manuell.",
      transfer_buy_phase:
        "Reine Durchgangsstation: am Saisonende kauft niemand mehr. Käufe (Mensch wie KI) laufen erst im Kauffenster der neuen Saison; die Verkaufserlöse sind dort das Budget.",
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

type SeasonTransitionStartCompute =
  | { blocked: SeasonTransitionPreview }
  | { nextGameState: GameState; transition: SeasonTransitionState };

/**
 * Rechnet den Einstieg der Kette (`season_check` → `season_review`) im Speicher — OHNE zu
 * schreiben. `startSeasonTransition` haengt nur noch den einen Persistenz-Aufruf dran;
 * `advanceSeasonTransitionToTransferWindow` ruft diese Funktion direkt und reicht das Ergebnis
 * im Speicher weiter, statt jeden Hop einzeln zu schreiben und neu zu laden (siehe dort).
 */
function computeStartSeasonTransition(save: PersistedSaveGame): SeasonTransitionStartCompute {
  const preview = buildSeasonTransitionPreview(save);
  if (!preview.canCompleteSeason) {
    return {
      blocked: {
        ...preview,
        dryRun: false,
        applied: false,
        transition: {
          ...preview.transition,
          status: "failed",
          errors: [...preview.transition.errors, "last_matchday_not_completed"],
        },
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
  return { nextGameState, transition };
}

export function startSeasonTransition(
  save: PersistedSaveGame,
  persistence: PersistenceService = createPersistenceService(),
): SeasonTransitionPreview {
  const computed = computeStartSeasonTransition(save);
  if ("blocked" in computed) {
    return computed.blocked;
  }
  persistGameStateWithMaterializedDerivations(persistence, save.saveId, computed.nextGameState);

  return {
    ...buildSeasonTransitionPreview({ ...save, gameState: computed.nextGameState }),
    dryRun: false,
    applied: true,
    transition: computed.transition,
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
type SeasonTransitionAdvanceCompute =
  | { status: "blocked" | "chain_complete"; preview: SeasonTransitionPreview }
  | { status: "advanced"; appliedStep: SeasonTransitionStepId; nextGameState: GameState; transition: SeasonTransitionState };

/**
 * Rechnet EINEN Schritt der Kette im Speicher — OHNE zu schreiben. `advanceSeasonTransitionStep`
 * haengt nur noch den einen Persistenz-Aufruf dran; die Mehrfach-Schleife
 * (`advanceSeasonTransitionToTransferWindow`) ruft diese Funktion direkt und reicht den
 * Zwischenstand im Speicher weiter, statt nach jedem Hop zu schreiben und den Save per
 * `getSaveById` neu einzulesen. Bei bis zu sechs Hops auf einem grossen Save (32 Teams, ~3000
 * Spieler, ~16 MB) waren das mehrere Sekunden reine Persistenz, bevor ueberhaupt Fachlogik lief —
 * siehe Perf-Befund im PR.
 *
 * Fachlich unveraendert gegenueber vorher: dieselbe Reihenfolge an Pruefungen und derselbe Inhalt
 * pro Zweig, nur ohne den Schreib-Aufruf am Ende.
 */
function computeSeasonTransitionAdvance(
  save: PersistedSaveGame,
  persistence: PersistenceService,
): SeasonTransitionAdvanceCompute {
  const preview = buildSeasonTransitionPreview(save);
  const currentStep = preview.transition.currentStep as SeasonTransitionStepId;

  // Solange der letzte Spieltag nicht durch ist, faengt die Kette gar nicht erst an.
  if (!preview.canCompleteSeason) {
    return {
      status: "blocked",
      preview: {
        ...preview,
        ok: false,
        dryRun: false,
        applied: false,
        blockingReasons: [...new Set([...preview.blockingReasons, "last_matchday_not_completed"])],
      },
    };
  }

  // Der Einstieg behaelt seinen eigenen Weg — wegen des Drift-Guards, siehe oben.
  if (currentStep === "season_check") {
    const started = computeStartSeasonTransition(save);
    if ("blocked" in started) {
      return { status: "blocked", preview: started.blocked };
    }
    return { status: "advanced", appliedStep: currentStep, nextGameState: started.nextGameState, transition: started.transition };
  }

  const nextPhase = getPhaseAfterStep(currentStep);
  if (!nextPhase) {
    // Ende der Kette: ab hier legt der Pre-Season-Workflow die neue Saison an, nicht dieser Weg.
    return {
      status: "chain_complete",
      preview: {
        ...preview,
        ok: false,
        dryRun: false,
        applied: false,
        blockingReasons: [...new Set([...preview.blockingReasons, "season_transition_chain_complete"])],
      },
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
        /**
         * SAISONEND-MARKTWERT EINFRIEREN — genau hier, und nirgends sonst.
         *
         * Chris: „MW Werte können gerne NACH Apply von Training und MW-Neuberechnung übernommen
         * werden, weil Training soll übernommen werden bevor Spieler verkauft werden." An dieser
         * Stelle ist beides passiert (`runSeasonEndProgressionBatch` rechnet Entwicklung UND
         * Marktwerte neu) und das Transferfenster ist noch zu. Der Snapshot selbst entstand
         * frueher in der Kette und traegt deshalb noch den Vor-Entwicklungs-Stand.
         */
        const eingefroren = patchSeasonSnapshotMarketValueAfterProgression(
          batch.save.gameState,
          abgeschlosseneSaisonId,
        );
        progressionSave = eingefroren.patched ? { ...batch.save, gameState: eingefroren.gameState } : batch.save;
        progressionWarnings = eingefroren.patched
          ? batch.warnings
          : [...batch.warnings, `season_end_market_value_freeze_skipped:${abgeschlosseneSaisonId}`];
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

  return { status: "advanced", appliedStep: currentStep, nextGameState, transition };
}

/**
 * Einen Schritt des Saisonende-Assistenten anwenden und die Phase auf die naechste Station
 * schalten — duenner Wrapper um `computeSeasonTransitionAdvance`, der bei Erfolg GENAU EINMAL
 * schreibt. Fuer den Einzelschritt (Route-Aktion `advance_step`, ein Klick im Cockpit) bleibt das
 * bei einem Schreibvorgang; die Mehrfach-Schleife (`advanceSeasonTransitionToTransferWindow`)
 * nutzt die Compute-Funktion direkt und schreibt selbst nur einmal am Ende der Kette.
 */
export async function advanceSeasonTransitionStep(
  save: PersistedSaveGame,
  persistence: PersistenceService = createPersistenceService(),
): Promise<SeasonTransitionPreview> {
  const computed = computeSeasonTransitionAdvance(save, persistence);
  if (computed.status !== "advanced") {
    return computed.preview;
  }
  /**
   * LETZTE GELEGENHEIT, DIE SAISON EINZUFRIEREN — direkt vor den Verkaeufen.
   *
   * Der Freeze laeuft eigentlich am Ende von `player_development`. Haengt er nur
   * dort, faellt er bei jeder gescheiterten oder uebersprungenen Entwicklung
   * ersatzlos aus — und genau das ist auf dem Live-Spielstand passiert: kein Team
   * trug `marketValueSeasonEnd`, die Historie fiel auf Werte der FOLGE-Saison
   * zurueck.
   *
   * Deshalb hier noch einmal, idempotent (write-once je Feld) und unabhaengig
   * davon, ob die Entwicklung durchlief. Ab der naechsten Zeile verkauft die KI;
   * was danach eingefroren wuerde, waere nicht mehr der Saisonstand.
   */
  const gameStateVorVerkaeufen =
    computed.appliedStep === "transfer_sell_phase"
      ? (patchSeasonSnapshotMarketValueAfterProgression(computed.nextGameState, save.gameState.season.id).gameState ??
        computed.nextGameState)
      : computed.nextGameState;
  persistGameStateWithMaterializedDerivations(persistence, save.saveId, gameStateVorVerkaeufen);

  const nachVerkaeufen = await runSeasonEndAiSellsIfDue({
    saveId: save.saveId,
    appliedStep: computed.appliedStep,
    seasonId: save.gameState.season.id,
    gameStateAfterHop: gameStateVorVerkaeufen,
    transitionAfterHop: computed.transition,
    persistence,
  });

  return {
    ...buildSeasonTransitionPreview({ ...save, gameState: nachVerkaeufen.gameState }),
    dryRun: false,
    applied: true,
    transition: nachVerkaeufen.transition,
  };
}

/**
 * DER SCHRITT „VERKAEUFE" VERKAUFT JETZT WIRKLICH.
 *
 * Die Station `transfer_sell_phase` trug bis hierher nur eine Ankuendigung: „AI-Verkaeufe werden
 * spaeter ueber Sell-Service vorbereitet". Der Sell-Service existierte laengst und war getestet
 * (`runTransferWindowSession` mit `phase: "season_end"`) — er wurde von der Kette nur nie
 * aufgerufen. Ergebnis: die KI-Teams gingen mit unveraendertem Kader und ohne frisches Geld in die
 * neue Saison, und auf dem Markt lag nichts, was der Spieler haette kaufen koennen.
 *
 * WARUM HIER UND NICHT IN `computeSeasonTransitionAdvance`: die Compute-Funktion ist bewusst rein —
 * sie rechnet im Speicher und schreibt nie, damit die Mehrfach-Schleife
 * (`advanceSeasonTransitionToTransferWindow`) mehrere Stationen ohne Zwischenspeichern durchlaufen
 * kann. `runTransferWindowSession` liest und schreibt ueber die Persistenz. In die Compute-Funktion
 * gehaengt wuerde es genau diese Zusage brechen und der Schleife den Stand unter den Fuessen
 * wegschreiben. Deshalb laeuft es hier, NACH dem einen Schreibvorgang des Hops.
 *
 * Die Schleife erreicht diese Station ohnehin nie: sie bricht ab, sobald das Transferfenster offen
 * ist (`season_end_management`), also eine Station davor.
 *
 * MANUELL GEFUEHRTE TEAMS: hier steht bewusst KEIN eigener Filter. Der Schutz sitzt in
 * `runTransferWindowSession` selbst (`scopeTeam`, eingezogen nach „Wieso wird für mich gepickt und
 * gedraftet???"). Ihn hier zu wiederholen hiesse, ihn an zwei Stellen pflegen zu muessen — und
 * genau daran ist er beim letzten Mal gescheitert.
 */
async function runSeasonEndAiSellsIfDue(input: {
  saveId: string;
  appliedStep: SeasonTransitionStepId;
  seasonId: string;
  gameStateAfterHop: GameState;
  transitionAfterHop: SeasonTransitionState;
  persistence: PersistenceService;
}): Promise<{ gameState: GameState; transition: SeasonTransitionState }> {
  const unveraendert = { gameState: input.gameStateAfterHop, transition: input.transitionAfterHop };

  if (input.appliedStep !== "transfer_sell_phase") return unveraendert;
  if (input.transitionAfterHop.aiSeasonEndSellsAppliedForSeasonId === input.seasonId) return unveraendert;

  /**
   * SCHEITERN DARF DIE KETTE NICHT SPERREN — dieselbe Entscheidung wie bei der Spielerentwicklung
   * oben, aus demselben Grund: ein blockierter Saisonuebergang sperrt Verkaeufe und
   * Vertragsverlaengerungen des Spielers gleich mit aus, und dieser Ablauf hatte schon einmal eine
   * Sackgasse. Der Marker wird nur gesetzt, wenn die Sitzung wirklich durchlief — ein Fehlschlag
   * bleibt also nachholbar, statt still als erledigt zu gelten.
   */
  try {
    const sitzung = await runTransferWindowSession({
      saveId: input.saveId,
      seasonId: input.seasonId,
      persistence: input.persistence,
      phase: "season_end",
      dryRun: false,
      confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
      transferPhase: "manual_transfer_window",
      teamScope: "all",
      // Am Saisonende wird nur verkauft. Gekauft wird in der neuen Saison — der Riegel dafuer sitzt
      // zusaetzlich in der Sitzung selbst (`isSeasonEndPhase`), hier ist er die Absicht des Aufrufs.
      allowBuys: false,
      skipIfExistingMarketTransfers: false,
      progressLog: false,
    });

    const frisch = input.persistence.getSaveById(input.saveId);
    if (!frisch) {
      return {
        gameState: input.gameStateAfterHop,
        transition: {
          ...input.transitionAfterHop,
          warnings: [...new Set([...input.transitionAfterHop.warnings, "ai_season_end_sells_save_missing_after_session"])],
        },
      };
    }

    const transition: SeasonTransitionState = {
      ...input.transitionAfterHop,
      warnings: [
        ...new Set([
          ...input.transitionAfterHop.warnings,
          `ai_season_end_sells_applied:${sitzung.appliedSells}`,
          ...sitzung.warnings.slice(0, 8),
        ]),
      ],
      aiSeasonEndSellsAppliedForSeasonId: input.seasonId,
    };
    const gameState: GameState = { ...frisch.gameState, seasonTransition: transition };
    persistGameStateWithMaterializedDerivations(input.persistence, input.saveId, gameState);
    return { gameState, transition };
  } catch (error) {
    return {
      gameState: input.gameStateAfterHop,
      transition: {
        ...input.transitionAfterHop,
        warnings: [
          ...new Set([
            ...input.transitionAfterHop.warnings,
            `ai_season_end_sells_failed:${error instanceof Error ? error.message : "unknown"}`,
          ]),
        ],
      },
    };
  }
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
 *
 * PERF: bis zu vier Hops liegen zwischen Saisonende und offenem Transferfenster
 * (season_review → season_rewards → player_development → preseason_management). Die Schleife lief
 * frueher ueber `advanceSeasonTransitionStep`, das nach JEDEM Hop den kompletten Spielstand
 * schrieb (`persistGameStateWithMaterializedDerivations`) und ihn per `getSaveById` wieder
 * einlas — auf einem echten Save (32 Teams, ~3000 Spieler, ~16 MB) mehrere Sekunden reine
 * Persistenz, bevor ueberhaupt Fachlogik lief (siehe Perf-Befund im PR). Die Kette braucht das
 * nicht: kein Schritt in ihr liest je aus der Persistenz statt aus dem uebergebenen `save`
 * (gilt NICHT fuer `player_development` selbst — dort laeuft `runSeasonEndProgressionBatch`
 * bereits `persistFinalState: false` und rechnet rein im Speicher). Also: `current` haelt den
 * Zwischenstand nur im Speicher (`computeSeasonTransitionAdvance`, dieselbe Fachlogik wie in
 * `advanceSeasonTransitionStep`, nur ohne den Schreib-Aufruf), und geschrieben wird GENAU EINMAL
 * — entweder am Ende der Kette oder gar nicht, wenn kein Hop lief.
 *
 * Kehrseite: auf der Platte liegt zwischen den Hops kein konsistenter Zwischenstand mehr. Bricht
 * die Funktion nach hop 2 von 4 mit einer echten Exception ab (nicht abgefangen wie der
 * `player_development`-Fehlerfall oben, der schon als Warnung weiterschaltet), bleibt der Save
 * exakt auf dem Stand VOR diesem Aufruf stehen statt — wie vorher — auf dem Stand nach Hop 2. Das
 * ist bewusst in Kauf genommen: kein halb angewandter Zwischenstand auf der Platte, dafuer geht
 * der Fortschritt vorheriger Hops bei einem Fehler auf halber Strecke verloren — ein zweiter
 * Aufruf faengt wieder bei Hop 1 an. Das ist unschaedlich, WEIL nichts von diesem gescheiterten
 * Aufruf je auf der Platte stand: der Save ist exakt der Stand von vor diesem Aufruf, und
 * `computeStartSeasonTransition` erkennt an der Phase, dass season_check dort noch nicht
 * gelaufen ist (der Idempotenz-Guard dort greift erst, wenn die Phase wirklich auf
 * "season_review" steht).
 */
export function advanceSeasonTransitionToTransferWindow(
  save: PersistedSaveGame,
  persistence: PersistenceService = createPersistenceService(),
): SeasonTransitionPreview {
  let current = save;
  let lastTransition = buildSeasonTransitionPreview(current).transition;
  let hopsApplied = false;

  // Obergrenze = Laenge der Kette. Kein Sicherheitsnetz gegen Fehler, sondern gegen eine
  // Endlosschleife, falls ein Schritt je aufhoert weiterzuschalten — dann bricht die Schleife
  // ohnehin unten ab; die Grenze ist der Guertel dazu.
  for (let hop = 0; hop < SEASON_TRANSITION_STEPS.length; hop += 1) {
    if (isTransferMarketPhaseOpen(current.gameState)) break;
    const computed = computeSeasonTransitionAdvance(current, persistence);
    if (computed.status !== "advanced") {
      // Kein weiterer Hop moeglich (blockiert oder Kette zu Ende). Was bis hierher im Speicher
      // gelaufen ist, wird trotzdem einmal geschrieben — genau der Zustand, den die alte
      // Schleife an dieser Stelle auf der Platte gehabt haette (jeder erfolgreiche Hop schrieb
      // dort einzeln, bevor der scheiternde Hop unbeschrieben zurueckkam).
      if (hopsApplied) {
        persistGameStateWithMaterializedDerivations(persistence, save.saveId, current.gameState);
      }
      return computed.preview;
    }
    current = { ...current, gameState: computed.nextGameState };
    lastTransition = computed.transition;
    hopsApplied = true;
  }

  if (hopsApplied) {
    persistGameStateWithMaterializedDerivations(persistence, save.saveId, current.gameState);
  }

  return {
    ...buildSeasonTransitionPreview(current),
    dryRun: false,
    applied: true,
    transition: lastTransition,
  };
}
