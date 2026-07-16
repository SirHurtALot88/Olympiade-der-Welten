import { useMemo } from "react";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { MatchdayArenaBlockerSummary } from "@/lib/foundation/matchday-arena-blocker-summary";
import type { MatchdaySummary, MatchdaySummaryTeamRow } from "@/lib/foundation/matchday-summary";

export function buildMatchdayArenaClientKey(input: {
  activeSaveId: string;
  seasonId: string;
  matchdayId: string;
  activeManagerTeamId: string | null;
}): string {
  return `${input.activeSaveId}-${input.seasonId}-${input.matchdayId}-${input.activeManagerTeamId}`;
}

export function buildMatchdayArenaContextLabel(input: {
  activeSaveName: string;
  seasonId: string;
  matchdayId: string;
}): string {
  return `${input.activeSaveName} · ${input.seasonId} · ${input.matchdayId}`;
}

export function resolveMatchdayArenaPanelReady(input: {
  saveSummaryCount: number;
  selectedTeamId: string | null;
}): boolean {
  return input.saveSummaryCount > 0 && Boolean(input.selectedTeamId);
}

export function resolveShouldShowArenaBackToLineup(blockerSummary: MatchdayArenaBlockerSummary): boolean {
  return !blockerSummary.isArenaReady;
}

export function getActiveTeamMatchdaySummaryRow(
  matchdaySummary: MatchdaySummary,
  activeManagerTeamId: string | null,
): MatchdaySummaryTeamRow | null {
  return matchdaySummary.teamRows.find((row) => row.teamId === activeManagerTeamId) ?? null;
}

export interface UseMatchdayArenaDerivationsInput {
  activeSaveId: string;
  activeSaveName: string;
  gameState: GameState;
  activeManagerTeamId: string | null;
  selectedTeamId: string | null;
  saveSummaryCount: number;
  matchdaySummary: MatchdaySummary;
  selectedTeam: Team | null;
  blockerSummary: MatchdayArenaBlockerSummary;
}

/**
 * Matchday arena panel derivations (Strangler Phase 5.3). Runs only while
 * `FoundationMatchdayArenaShellHost` is mounted (`activeView === "matchdayArena"`).
 */
export function useMatchdayArenaDerivations(input: UseMatchdayArenaDerivationsInput) {
  const clientKey = useMemo(
    () =>
      buildMatchdayArenaClientKey({
        activeSaveId: input.activeSaveId,
        seasonId: input.gameState.season.id,
        matchdayId: input.gameState.matchdayState.matchdayId,
        activeManagerTeamId: input.activeManagerTeamId,
      }),
    [
      input.activeManagerTeamId,
      input.activeSaveId,
      input.gameState.matchdayState.matchdayId,
      input.gameState.season.id,
    ],
  );

  const contextLabel = useMemo(
    () =>
      buildMatchdayArenaContextLabel({
        activeSaveName: input.activeSaveName,
        seasonId: input.gameState.season.id,
        matchdayId: input.gameState.matchdayState.matchdayId,
      }),
    [input.activeSaveName, input.gameState.matchdayState.matchdayId, input.gameState.season.id],
  );

  const panelReady = useMemo(
    () =>
      resolveMatchdayArenaPanelReady({
        saveSummaryCount: input.saveSummaryCount,
        selectedTeamId: input.selectedTeamId,
      }),
    [input.saveSummaryCount, input.selectedTeamId],
  );

  const shouldShowBackToLineup = useMemo(
    () => resolveShouldShowArenaBackToLineup(input.blockerSummary),
    [input.blockerSummary],
  );

  const activeTeamMatchdaySummaryRow = useMemo(
    () => getActiveTeamMatchdaySummaryRow(input.matchdaySummary, input.activeManagerTeamId),
    [input.activeManagerTeamId, input.matchdaySummary],
  );

  return {
    clientKey,
    contextLabel,
    panelReady,
    shouldShowBackToLineup,
    activeTeamMatchdaySummaryRow,
  };
}
