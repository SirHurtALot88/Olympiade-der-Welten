/**
 * DIE SAISONENDE-KETTE — welcher Schritt auf welche Phase schaltet.
 *
 * GEMELDET AUS DEM SPIEL: "es ist nach MD10 aber Verkaeufe sind immernoch geblockt! sobald alle
 * diszis durch sind und bepunktet sind waere eigentlich end of season dran mit awards usw."
 *
 * BEFUND: Verkaufen oeffnet nur in `preseason_management` und `transfer_sell_phase`
 * (`transfer-window-policy.ts`). Beide Phasen hat das normale Spiel NIE gesetzt — die einzigen
 * Schreibstellen standen im Admin-/Simulations-Runner. Real erreichbar waren nur drei Phasen:
 *
 *   season_active  (matchday-progress-service)
 *   season_completed  (dasselbe, nach dem letzten Spieltag)
 *   season_review  (season-transition-service)
 *
 * Danach war Schluss. Verkaufen war damit im ganzen Spiel genau EINMAL moeglich: vor dem ersten
 * Spieltag einer Saison, ueber das Saisonstart-Fenster (`isEarlySeasonTransferSetup`). Die Awards
 * liefen aus demselben Grund nie — `season_rewards` wurde nie erreicht.
 *
 * Der Assistent kannte die Kette bereits vollstaendig (`SEASON_TRANSITION_STEPS`) und hatte sogar
 * die Zuordnung Phase→Schritt. Was fehlte, war das Weiterschalten: `buildStepPreviews` setzte
 * `canApply: false` fuer JEDEN Schritt, fest verdrahtet. Kein Schritt war je anwendbar.
 *
 * Diese Datei haelt genau die fehlende Kante: Schritt → Phase, auf die er schaltet.
 */
import type { GamePhase } from "@/lib/data/olyDataTypes";
import { SEASON_TRANSITION_STEPS, type SeasonTransitionStepId } from "@/lib/season/season-transition-steps";

/**
 * Auf welche Phase ein angewendeter Schritt schaltet.
 *
 * Bewusst der Schritt und nicht die Phase als Schluessel: `season_check` (der Einstieg, waehrend
 * die Phase noch `season_completed` ist) hat keine eigene Phase — er schaltet auf `season_review`.
 * Ab da traegt jeder Schritt denselben Namen wie seine Phase.
 *
 * `next_season_ready` ist das Ende der Kette und steht bewusst auf `null`: die neue Saison legt
 * NICHT dieser Weg an, sondern der bestaetigte Pre-Season-Workflow
 * (`preseason-workflow-service`), der am Ende auf `season_active` zurueckschaltet. Zwei Wege in
 * dieselbe Saison waeren zwei Quellen fuer denselben Zustand.
 */
const STEP_TO_NEXT_PHASE: Record<SeasonTransitionStepId, GamePhase | null> = {
  season_check: "season_review",
  season_review: "season_rewards",
  season_rewards: "player_development",
  player_development: "preseason_management",
  preseason_management: "transfer_sell_phase",
  transfer_sell_phase: "transfer_buy_phase",
  transfer_buy_phase: "lineup_setup",
  lineup_setup: "next_season_ready",
  next_season_ready: null,
};

export function getPhaseAfterStep(stepId: SeasonTransitionStepId): GamePhase | null {
  return STEP_TO_NEXT_PHASE[stepId];
}

/** Der Schritt, der auf diese Phase folgt — oder `null`, wenn die Kette zu Ende ist. */
export function getNextStepAfter(stepId: SeasonTransitionStepId): SeasonTransitionStepId | null {
  const index = SEASON_TRANSITION_STEPS.indexOf(stepId);
  if (index < 0) return null;
  return SEASON_TRANSITION_STEPS[index + 1] ?? null;
}

/**
 * Ist dieser Schritt schon durchlaufen?
 *
 * Gemessen an der POSITION in der Kette, nicht an `completedSteps`: die Phase ist der belastbare
 * Zustand (sie liegt im Save und steuert alle Gates), waehrend `completedSteps` eine Beschriftung
 * ist. Wer per Save-Import oder Admin-Runner mitten in der Kette landet, hat eine gueltige Phase,
 * aber keine Historie — die Position stimmt trotzdem.
 */
export function isStepBehind(stepId: SeasonTransitionStepId, currentStep: SeasonTransitionStepId): boolean {
  return SEASON_TRANSITION_STEPS.indexOf(stepId) < SEASON_TRANSITION_STEPS.indexOf(currentStep);
}
