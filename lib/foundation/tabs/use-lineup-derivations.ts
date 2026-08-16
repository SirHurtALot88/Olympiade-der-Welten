import { useMemo } from "react";

import type { Team } from "@/lib/data/olyDataTypes";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

export type LineupDraftBoardView = "lineup" | "formBoard";

/**
 * DIE „CLASSIC"-VARIANTE IST WEG (Chris: „classic aufstellungsbaum brauchen wir nicht mehr").
 *
 * Hier standen ein Varianten-Typ mit den Stellungen „classic" und „focusV2" und der zugehoerige
 * Resolver (die Namen bewusst nicht woertlich — ein Quelltext-Test verbietet sie in dieser
 * Datei). Der Hook
 * laeuft ausschliesslich, waehrend `FoundationLineupShellHost` gemountet ist — und das ist nur
 * bei den beiden Aufstellungs-Ansichten der Fall, also genau dort, wo der Resolver ohnehin die
 * Focus-Stellung lieferte. Die klassische war damit unerreichbar, und ihr Markup im Client war
 * bereits vollstaendig entfernt.
 *
 * Uebrig bleibt die Focus-Ansicht — ohne Schalter, ohne zweiten Zweig.
 */
export function buildLineupClientKey(input: {
  activeSaveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string | null;
  ownerId: string;
}): string {
  return `lineup-v2-${input.activeSaveId}-${input.seasonId}-${input.matchdayId}-${input.teamId}-${input.ownerId}`;
}

export function buildLineupTeamTooltip(input: {
  selectedTeam: Team | null;
}): string {
  return input.selectedTeam
    ? `${input.selectedTeam.name}: Einsatzliste mit Focus Mode — Slots, Kandidaten und Preview.`
    : "Matchday Room für Teamwahl, Slots und Preview.";
}

export function resolveEffectiveLineupDraftBoardView(
  request: LineupDraftBoardView | null,
  current: LineupDraftBoardView,
): LineupDraftBoardView {
  return request ?? current;
}

export interface UseLineupDerivationsInput {
  activeView: FoundationViewId;
  selectedTeam: Team | null;
  selectedTeamControlMode?: string | null;
  activeSaveId: string;
  seasonId: string;
  matchdayId: string;
  activeManagerTeamId: string | null;
  effectiveActiveOwnerId: string;
  lineupFocusRequestKey: string | null;
  lineupDraftBoardViewRequest: LineupDraftBoardView | null;
  lineupDraftBoardView: LineupDraftBoardView;
}

/**
 * Lineup panel derivations (Strangler Phase 5.3). Runs only while
 * `FoundationLineupShellHost` is mounted (`activeView === "lineup"` or `"lineupV2"`).
 */
export function useLineupDerivations(input: UseLineupDerivationsInput) {
  const clientKey = useMemo(
    () =>
      buildLineupClientKey({
        activeSaveId: input.activeSaveId,
        seasonId: input.seasonId,
        matchdayId: input.matchdayId,
        teamId: input.activeManagerTeamId,
        ownerId: input.effectiveActiveOwnerId,
      }),
    [
      input.activeManagerTeamId,
      input.activeSaveId,
      input.effectiveActiveOwnerId,
      input.matchdayId,
      input.seasonId,
    ],
  );

  const teamTooltip = useMemo(
    () => buildLineupTeamTooltip({ selectedTeam: input.selectedTeam }),
    [input.selectedTeam],
  );

  const effectiveDraftBoardView = useMemo(
    () => resolveEffectiveLineupDraftBoardView(input.lineupDraftBoardViewRequest, input.lineupDraftBoardView),
    [input.lineupDraftBoardView, input.lineupDraftBoardViewRequest],
  );

  const highlightMissingSlots = useMemo(() => Boolean(input.lineupFocusRequestKey), [input.lineupFocusRequestKey]);

  return {
    clientKey,
    teamTooltip,
    effectiveDraftBoardView,
    highlightMissingSlots,
  };
}
