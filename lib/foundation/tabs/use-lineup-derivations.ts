import { useMemo } from "react";

import type { Team } from "@/lib/data/olyDataTypes";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

export type LineupDraftBoardView = "lineup" | "formBoard";
export type LineupUiVariant = "classic" | "focusV2";

export function resolveLineupUiVariant(activeView: FoundationViewId): LineupUiVariant {
  return activeView === "lineupV2" ? "focusV2" : "classic";
}

export function buildLineupClientKey(input: {
  variant: LineupUiVariant;
  activeSaveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string | null;
  ownerId: string;
}): string {
  const prefix = input.variant === "focusV2" ? "lineup-v2" : "lineup";
  return `${prefix}-${input.activeSaveId}-${input.seasonId}-${input.matchdayId}-${input.teamId}-${input.ownerId}`;
}

export function buildLineupTeamTooltip(input: {
  variant: LineupUiVariant;
  selectedTeam: Team | null;
  controlMode?: string | null;
}): string {
  if (input.variant === "focusV2") {
    return input.selectedTeam
      ? `${input.selectedTeam.name}: Focus-Mode Preview für die Einsatzliste.`
      : "Matchday Room fuer Teamwahl, Slots und Preview.";
  }

  if (!input.selectedTeam) {
    return "Matchday Room fuer Teamwahl, Slots und Preview.";
  }

  const modeLabel =
    input.controlMode === "ai" ? "AI-gesteuert" : input.controlMode === "passive" ? "passiv" : "manuell";

  return `${input.selectedTeam.name}: ${modeLabel}. Bestehende Settings bleiben read-only sichtbar, bis du im Adminbereich etwas änderst.`;
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
  const variant = resolveLineupUiVariant(input.activeView);

  const clientKey = useMemo(
    () =>
      buildLineupClientKey({
        variant,
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
      variant,
    ],
  );

  const teamTooltip = useMemo(
    () =>
      buildLineupTeamTooltip({
        variant,
        selectedTeam: input.selectedTeam,
        controlMode: input.selectedTeamControlMode,
      }),
    [input.selectedTeam, input.selectedTeamControlMode, variant],
  );

  const effectiveDraftBoardView = useMemo(
    () => resolveEffectiveLineupDraftBoardView(input.lineupDraftBoardViewRequest, input.lineupDraftBoardView),
    [input.lineupDraftBoardView, input.lineupDraftBoardViewRequest],
  );

  const highlightMissingSlots = useMemo(() => Boolean(input.lineupFocusRequestKey), [input.lineupFocusRequestKey]);

  return {
    variant,
    clientKey,
    teamTooltip,
    effectiveDraftBoardView,
    highlightMissingSlots,
  };
}
