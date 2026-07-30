import type { GameFlowStep } from "@/lib/foundation/game-flow-controller";

const POST_MATCHDAY_ACK_STEP_IDS = ["review_matchday_results", "open_season_standings"] as const;

function isReadyLike(step: GameFlowStep) {
  return step.status === "ready" || step.status === "warning" || step.status === "blocked";
}

/**
 * DARF DER SPIELTAGSWECHSEL JETZT AUSGELOEST WERDEN?
 *
 * `advance_to_next_matchday` steht auf "ready", wenn ein Ergebnis vorliegt — und auf "warning",
 * wenn zusaetzlich das Board etwas meldet. Der einzige Board-"Blocker" ist
 * `board_objectives_failed` (getTeamBoardFlowSignals): die Saisonziele sind gerissen. Das ist eine
 * MITTEILUNG, kein Hindernis; gewertet ist der Spieltag in beiden Faellen gleich.
 *
 * Vorher fragten beide Aufrufer auf `status === "ready"` ab. Ein Team mit gerissenen Saisonzielen
 * bekam damit im Spieltagsergebnis KEINEN "Spieltag abschliessen"-Knopf mehr, und der globale
 * "Weiter"-Knopf schaltete nicht weiter, sondern schickte einen ins Cockpit — der Spieltag liess
 * sich aus dem normalen Spielverlauf nicht mehr abschliessen. `resolveGameFlowActionStep` selbst
 * behandelt "warning" ueber `isReadyLike` schon immer als handlungsfaehig; nur die beiden
 * Verbraucher taten es nicht.
 *
 * Beide benutzen jetzt diese Funktion, damit die Bedingung nicht wieder auseinanderlaeuft.
 */
export function canAdvanceMatchdayFromStep(step: Pick<GameFlowStep, "stepId" | "status"> | null | undefined) {
  if (!step) return false;
  return step.stepId === "advance_to_next_matchday" && (step.status === "ready" || step.status === "warning");
}

export function resolveGameFlowActionStep(
  actionableSteps: GameFlowStep[],
  fallbackStep: GameFlowStep,
  acknowledgedFlowStepIds: ReadonlySet<string>,
): GameFlowStep {
  const readyLike = actionableSteps.filter(isReadyLike);
  const optional = actionableSteps.filter((step) => step.status === "optional");

  const postMatchdayAckDone = POST_MATCHDAY_ACK_STEP_IDS.every((stepId) => acknowledgedFlowStepIds.has(stepId));
  const facilitiesOptional = optional.find((step) => step.stepId === "matchday_facilities");
  const facilitiesPending =
    facilitiesOptional != null && !acknowledgedFlowStepIds.has("matchday_facilities");

  if (postMatchdayAckDone && facilitiesPending) {
    return facilitiesOptional;
  }

  const advanceStep = readyLike.find((step) => step.stepId === "advance_to_next_matchday");
  const nonAdvance = readyLike.filter((step) => step.stepId !== "advance_to_next_matchday");

  /**
   * EIN BLOCKIERTER SCHRITT DARF DEN SPIELTAGSWECHSEL NICHT VERDRAENGEN.
   *
   * `isReadyLike` fasst ready, warning UND blocked zusammen — als "steht noch offen". Fuer die
   * Reihenfolge ist das zu grob: vorher gewann JEDER Nicht-Advance-Schritt aus dieser Menge, auch
   * ein blockierter. Nach einem Spieltag ist aber regelmaessig etwas blockiert, das erst der naechste
   * Spieltag freigibt (Aufstellung, Spieltagsvorschau). Damit wurde "Zum naechsten Spieltag" nie zum
   * Aktionsschritt — und der "Spieltag abschliessen"-Knopf, der daran haengt, erschien nie. Aus dem
   * normalen Spielverlauf gab es keinen Weg mehr weiter.
   *
   * Auf einen blockierten Schritt kann man ohnehin nicht handeln. Er darf einen handlungsfaehigen
   * Wechsel deshalb nicht schlagen. Die dokumentierte Absicht ("prefers non-advance READY steps
   * before advance") bleibt unveraendert — nur "blocked" zaehlt hier nicht mehr mit.
   */
  const nonAdvanceActionable = nonAdvance.filter((step) => step.status !== "blocked");

  if (nonAdvanceActionable.length > 0) {
    return nonAdvanceActionable[0]!;
  }

  if (advanceStep) {
    return advanceStep;
  }

  if (nonAdvance.length > 0) {
    return nonAdvance[0]!;
  }

  if (optional.length > 0) {
    return optional[0]!;
  }

  return fallbackStep;
}
