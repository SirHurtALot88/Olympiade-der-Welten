/**
 * Die Phasenkette der Arena — die eine Reihenfolge, in der die Buehne aufdeckt.
 *
 * Sie stand bis zum Audit vom 11.08.2026 in `lib/season/matchday-arena-presenter.ts`. Diese
 * Datei war ein 714-Zeilen-Presenter, von dessen 16 Exporten genau EINER noch einen Aufrufer
 * hatte: diese Konstante. Der Rest — die komplette Phasen-Zerlegung des Team-Scores samt
 * Rangkarte — war nachweislich tot (nachgezaehlt ueber alle .ts/.tsx/.js/.mjs/.json des Repos:
 * 0 Produktionsaufrufer, nur die eigene Testdatei). Zwei Kommentare im Produktivcode sagten es
 * selbst („die Funktion dort ruft niemand mehr auf").
 *
 * Geloescht wurde er, weil er zwei nachgewiesene Rechenfehler enthielt und damit eine Falle
 * fuer den naechsten war, der ihn wiederbelebt:
 *   - Die Phasenkette (Slots -> Push -> Form -> Mutator -> Captain -> Power) enthielt weder
 *     einen Fatigue- noch einen Moral-Term; am Live-Abbild blieben im Mittel 14,5 Punkte
 *     unerklaerter Rest bei 32 von 32 Teams.
 *   - `buildArenaTeamRankMap` sortierte bei Gleichstand nach Teamname; die Engine benutzt
 *     `rankDescendingSharedTies` (Gleichstand teilt den besseren Rang) — gemessen 1 von 32
 *     Raengen verschieden.
 * Wer die Zerlegung zurueckholen will, holt sie aus der Resolve-Vorschau
 * (`lib/foundation/discipline-stage/discipline-stage-from-preview.ts`), die auf `teamResult.score`
 * abschliesst — nicht aus einer zweiten Rechenstelle.
 */
export const MATCHDAY_ARENA_PHASES = [
  { id: "slots", label: "Slots" },
  { id: "push", label: "Intensität" },
  { id: "form", label: "Form" },
  { id: "mutator", label: "Mutator" },
  { id: "captain", label: "Kapitän" },
  { id: "power", label: "Team-Power" },
  { id: "final", label: "Finale" },
  { id: "result", label: "Ergebnis" },
] as const;

export type MatchdayArenaPhaseId = (typeof MATCHDAY_ARENA_PHASES)[number]["id"];

export type FoundationArenaDisciplinePhase = "d1" | "d2" | "total";
export type FoundationArenaDisciplineSide = "d1" | "d2";

export type FoundationArenaRevealState = {
  activeDisciplinePhase: FoundationArenaDisciplinePhase;
  phaseIndex: number;
  revealedSlotCountByDiscipline: Record<FoundationArenaDisciplineSide, number>;
  completedDisciplinePhases: Record<FoundationArenaDisciplineSide, boolean>;
};

export type FoundationArenaRevealLimits = {
  maxD1SlotRevealCount: number;
  maxD2SlotRevealCount: number;
};

export const FOUNDATION_ARENA_REVEAL_LIMITS = {
  slotsPhaseIndex: MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "slots"),
  finalPhaseIndex: MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "final"),
  resultPhaseIndex: MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === "result"),
} as const;

export function createFoundationArenaRevealState(): FoundationArenaRevealState {
  return {
    activeDisciplinePhase: "d1",
    phaseIndex: 0,
    revealedSlotCountByDiscipline: { d1: 0, d2: 0 },
    completedDisciplinePhases: { d1: false, d2: false },
  };
}

export function getFoundationArenaDisplayPhase(phaseIndex: number): MatchdayArenaPhaseId {
  if (phaseIndex < 0) {
    return MATCHDAY_ARENA_PHASES[0]?.id ?? "slots";
  }
  return MATCHDAY_ARENA_PHASES[Math.min(phaseIndex, MATCHDAY_ARENA_PHASES.length - 1)]?.id ?? "slots";
}

export function getFoundationArenaActiveSide(state: FoundationArenaRevealState): FoundationArenaDisciplineSide {
  return state.activeDisciplinePhase === "d2" ? "d2" : "d1";
}

export function getFoundationArenaMaxSlotRevealCount(
  state: FoundationArenaRevealState,
  limits: FoundationArenaRevealLimits,
): number {
  return getFoundationArenaActiveSide(state) === "d2"
    ? limits.maxD2SlotRevealCount
    : limits.maxD1SlotRevealCount;
}

export function getFoundationArenaRevealedSlotCount(
  state: FoundationArenaRevealState,
  limits: FoundationArenaRevealLimits,
): number {
  const side = getFoundationArenaActiveSide(state);
  const maxCount = side === "d2" ? limits.maxD2SlotRevealCount : limits.maxD1SlotRevealCount;
  return Math.min(state.revealedSlotCountByDiscipline[side], maxCount);
}

export function canAdvanceFoundationArenaReveal(
  state: FoundationArenaRevealState,
  limits: FoundationArenaRevealLimits,
): boolean {
  const { slotsPhaseIndex, finalPhaseIndex, resultPhaseIndex } = FOUNDATION_ARENA_REVEAL_LIMITS;
  const maxSlotRevealCount = getFoundationArenaMaxSlotRevealCount(state, limits);
  const revealedSlotCount = getFoundationArenaRevealedSlotCount(state, limits);
  const activeDisciplineSlotsComplete = revealedSlotCount >= maxSlotRevealCount;
  const activeDisciplineRevealComplete = activeDisciplineSlotsComplete && state.phaseIndex >= finalPhaseIndex;

  return (
    (state.phaseIndex === slotsPhaseIndex && revealedSlotCount < maxSlotRevealCount) ||
    state.phaseIndex < finalPhaseIndex ||
    (state.activeDisciplinePhase === "d1" && activeDisciplineRevealComplete) ||
    (state.activeDisciplinePhase === "d2" && activeDisciplineRevealComplete) ||
    (state.activeDisciplinePhase === "total" && state.phaseIndex < resultPhaseIndex)
  );
}

export function advanceFoundationArenaReveal(
  state: FoundationArenaRevealState,
  limits: FoundationArenaRevealLimits,
): FoundationArenaRevealState | null {
  const { slotsPhaseIndex } = FOUNDATION_ARENA_REVEAL_LIMITS;

  if (state.phaseIndex < 0) {
    return {
      ...state,
      phaseIndex: 0,
      revealedSlotCountByDiscipline: {
        ...state.revealedSlotCountByDiscipline,
        [getFoundationArenaActiveSide(state)]: 0,
      },
    };
  }

  if (!canAdvanceFoundationArenaReveal(state, limits)) {
    return null;
  }

  const activeSide = getFoundationArenaActiveSide(state);
  const maxSlotRevealCount = getFoundationArenaMaxSlotRevealCount(state, limits);
  const revealedSlotCount = getFoundationArenaRevealedSlotCount(state, limits);

  if (state.phaseIndex === slotsPhaseIndex && revealedSlotCount < maxSlotRevealCount) {
    return {
      ...state,
      revealedSlotCountByDiscipline: {
        ...state.revealedSlotCountByDiscipline,
        [activeSide]: revealedSlotCount + 1,
      },
    };
  }

  const nextPhaseIndex = Math.min(state.phaseIndex + 1, MATCHDAY_ARENA_PHASES.length - 1);
  if (MATCHDAY_ARENA_PHASES[nextPhaseIndex]?.id === "result") {
    if (state.activeDisciplinePhase === "d1") {
      return {
        ...state,
        activeDisciplinePhase: "d2",
        phaseIndex: 0,
        completedDisciplinePhases: { ...state.completedDisciplinePhases, d1: true },
        revealedSlotCountByDiscipline: {
          ...state.revealedSlotCountByDiscipline,
          d2: 0,
        },
      };
    }
    if (state.activeDisciplinePhase === "d2") {
      return {
        ...state,
        activeDisciplinePhase: "total",
        phaseIndex: nextPhaseIndex,
        completedDisciplinePhases: { d1: true, d2: true },
      };
    }
  }

  return {
    ...state,
    phaseIndex: nextPhaseIndex,
  };
}

export function mapRoomDisciplineSideToFoundationPhase(
  disciplineSide: "d1" | "d2" | "overall" | null | undefined,
): FoundationArenaDisciplinePhase {
  if (disciplineSide === "d2") {
    return "d2";
  }
  if (disciplineSide === "overall") {
    return "total";
  }
  return "d1";
}

export function mapFoundationPhaseToRoomDisciplineSide(
  phase: FoundationArenaDisciplinePhase,
): "d1" | "d2" | "overall" {
  if (phase === "d2") {
    return "d2";
  }
  if (phase === "total") {
    return "overall";
  }
  return "d1";
}
