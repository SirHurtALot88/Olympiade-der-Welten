import type { NewGameFlowState, NewGameFlowStepId, NewGameFlowStepStatus } from "@/lib/data/olyDataTypes";

/**
 * Loest den Einstiegs-Flow auf, der fuer DIESEN Raum-Teilnehmer gilt.
 *
 * MIGRATIONSREGEL (siehe `NewGameFlowState.byParticipant` in olyDataTypes.ts): ohne
 * `participantId` (kein Raum, also Solo) ODER ohne eigenen Eintrag in `byParticipant`
 * (aeltere Saves, oder der Teilnehmer hat noch keinen eigenen Schritt geschrieben) liefert diese
 * Funktion das TOP-LEVEL-Objekt zurueck — das ist der Fallback, kein Sonderfall. Ein Solo-Save
 * befuellt `byParticipant` nie und liest dadurch bit-identisch zum Verhalten vor dieser Trennung.
 */
export function resolveScopedNewGameFlow(
  newGameFlow: NewGameFlowState | null | undefined,
  participantId: string | null | undefined,
): NewGameFlowState | undefined {
  if (!participantId) {
    return newGameFlow ?? undefined;
  }
  return newGameFlow?.byParticipant?.[participantId] ?? newGameFlow ?? undefined;
}

/**
 * Berechnet den naechsten `newGameFlow`-Zustand fuer EINEN Schritt-Wechsel (abschliessen/
 * ueberspringen) — geteilte Kernlogik zwischen dem optimistischen Client-Update
 * (`updateNewGameFlowStepStatus` in use-foundation-shell-router-body-scope.tsx) und dem
 * Raum-Teilnehmer-Zweig der Server-Route (`app/api/singleplayer-state/route.ts`, Aktion
 * `new-game-flow-step`), damit beide niemals auseinanderlaufen.
 *
 * `active`/`dismissed` werden hier IMMER korrekt aus `isHandled` (alle Schritte
 * completed/skipped) berechnet — das entspricht dem bestehenden Client-Verhalten (vor dieser
 * Aenderung schon `active: !isHandled` in `updateNewGameFlowStepStatus`) und ist fuer Raum-Saves
 * zwingend: anders als Solo gibt es fuer sie KEINE Selbstheilung ueber einen spaeteren
 * generischen Full-State-Write (der ist fuer jeden an einen Raum gebundenen Save hart mit 409
 * `room_save_generic_write_forbidden` gesperrt) — ohne die korrekte Berechnung HIER wuerde der
 * Einstieg fuer einen Raum-Teilnehmer NIE schliessen.
 *
 * ACHTUNG SERVER-SOLO-PFAD: die Server-Route ruft diese Funktion NUR im Raum-Teilnehmer-Zweig
 * auf. Ihr bestehender Solo-Zweig (kein `participantId`) bleibt bewusst SEPARAT und
 * unveraendert bei seinem alten, hart codierten `active:true`/`dismissed:false` (unabhaengig von
 * `isHandled`) — das ist die bestehende, leicht rennende aber selbstheilende Solo-Mechanik
 * (der naechste, fuer Solo nicht gesperrte Full-State-Write persistiert kurz danach den vom
 * Client hier korrekt berechneten Wert). "Solo bleibt unveraendert" heisst: genau DIESE
 * Eigenheit bleibt bestehen, nicht dass sie hier nachgebaut wird.
 *
 * KOOP-TRENNUNG: mit `participantId` wird NUR `newGameFlow.byParticipant[participantId]`
 * geschrieben — das TOP-LEVEL-Objekt bleibt unangetastet (kein Feld doppelt gefuehrt: sobald ein
 * Raum aktiv ist, ist ausschliesslich `byParticipant` die Wahrheit fuer diesen Save; das
 * Top-Level-Objekt friert auf seinem Anfangszustand ein und ist nur noch der Solo-/Alt-Save-
 * Fallback, den in Raum-Saves niemand mehr liest). Ohne `participantId` IST das TOP-LEVEL-Objekt
 * der Zustand — keine `byParticipant`-Klammer.
 */
export function applyNewGameFlowStepUpdate(input: {
  /** Das aktuell persistierte TOP-LEVEL-`newGameFlow`-Objekt (vor diesem Schreibzugriff). */
  previous: NewGameFlowState | null | undefined;
  /** `null`/`undefined` = Solo (oder Client-optimistisch ohne Raum). Sonst: der schreibende Teilnehmer. */
  participantId: string | null | undefined;
  stepId: NewGameFlowStepId;
  status: NewGameFlowStepStatus;
  selectedTeamId: string | null | undefined;
  /** Die vollstaendige Schrittliste des Aufrufers — bewusst kein hartcodiertes Set hier, siehe unten. */
  stepIds: NewGameFlowStepId[];
  now: string;
}): NewGameFlowState {
  const sharedPrevious: NewGameFlowState = input.previous ?? {
    active: true,
    selectedTeamId: input.participantId ? null : (input.selectedTeamId ?? null),
    steps: [],
  };
  const scopedPrevious: NewGameFlowState = resolveScopedNewGameFlow(sharedPrevious, input.participantId) ?? {
    active: true,
    selectedTeamId: input.selectedTeamId ?? null,
    steps: [],
  };

  const nextSteps = input.stepIds.map((stepId) => {
    const stored = scopedPrevious.steps?.find((step) => step.stepId === stepId);
    if (stepId !== input.stepId) {
      return stored ?? { stepId, status: "open" as const };
    }
    return {
      stepId,
      status: input.status,
      completedAt: input.status === "completed" ? input.now : (stored?.completedAt ?? null),
      skippedAt: input.status === "skipped" ? input.now : (stored?.skippedAt ?? null),
    };
  });
  const isHandled = nextSteps.every((step) => step.status === "completed" || step.status === "skipped");

  const nextScoped: NewGameFlowState = {
    ...scopedPrevious,
    active: !isHandled,
    dismissed: isHandled,
    selectedTeamId: input.selectedTeamId ?? scopedPrevious.selectedTeamId ?? null,
    steps: nextSteps,
    updatedAt: input.now,
    completedAt: isHandled ? (scopedPrevious.completedAt ?? input.now) : (scopedPrevious.completedAt ?? null),
  };

  if (!input.participantId) {
    // Solo bzw. Client-optimistisch ohne Raum: das TOP-LEVEL-Objekt IST der Zustand.
    return nextScoped;
  }

  return {
    ...sharedPrevious,
    byParticipant: {
      ...sharedPrevious.byParticipant,
      [input.participantId]: nextScoped,
    },
  };
}
