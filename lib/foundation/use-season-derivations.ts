"use client";

import { useMemo, useRef } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";

import { buildGameStateContentSignature, getSeasonDerivations } from "./get-season-derivations";
import type { SeasonDerivations } from "./season-derivations-cache";

const EMPTY_DERIVATIONS: SeasonDerivations = {
  ledger: {
    hasResultSource: false,
    pointEntries: [],
    pointEntriesByPerformanceId: new Map(),
    playerSummariesByPlayerId: new Map(),
    teamSummariesByTeamId: new Map(),
    warnings: [],
  },
  ratingsById: new Map(),
  performanceByPlayerId: new Map(),
  fieldRaceLedger: { seasonId: "", matchdays: [], rowsByTeamId: new Map() },
};

export function useSeasonDerivations(input: {
  enabled: boolean;
  gameState: GameState;
  saveId: string;
  contentSignature?: string | null;
}): SeasonDerivations {
  const gameStateRef = useRef(input.gameState);
  gameStateRef.current = input.gameState;

  const contentSignature = input.contentSignature ?? buildGameStateContentSignature(input.gameState);
  const seasonId = input.gameState.season.id;

  return useMemo(() => {
    if (!input.enabled) {
      return EMPTY_DERIVATIONS;
    }

    return getSeasonDerivations({
      gameState: gameStateRef.current,
      saveId: input.saveId,
      seasonId,
      contentSignature,
    });
  }, [contentSignature, input.enabled, input.saveId, seasonId]);
}
