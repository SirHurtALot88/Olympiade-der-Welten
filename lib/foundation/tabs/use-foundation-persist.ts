import type { GameState } from "@/lib/data/olyDataTypes";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";

/** Stable signature for auto-persist skip (ignores saveVersion bumps). */
export function buildAutoPersistContentSignature(gameState: GameState) {
  return JSON.stringify({
    ...gameState,
    saveVersion: undefined,
    seasonState: {
      ...gameState.seasonState,
      persistedSeasonDerivations: undefined,
    },
  });
}

export type FoundationPersistPutBody = {
  saveId: string;
  gameState: GameState;
  expectedSaveVersion: number;
  compactPut?: boolean;
  skipMaterializeIfUnchanged?: boolean;
  materializeSeasonDerivations?: boolean;
};

export function buildFoundationPersistPutBody(input: {
  saveId: string;
  gameState: GameState;
  compactPut?: boolean;
  materializeSeasonDerivations?: boolean;
}): FoundationPersistPutBody {
  return {
    saveId: input.saveId,
    gameState: input.compactPut
      ? compactFoundationInitialGameState(input.gameState)
      : input.gameState,
    expectedSaveVersion: input.gameState.saveVersion ?? 0,
    compactPut: input.compactPut ?? false,
    skipMaterializeIfUnchanged: true,
    ...(input.materializeSeasonDerivations ? { materializeSeasonDerivations: true } : {}),
  };
}

export async function putFoundationGameState(
  body: FoundationPersistPutBody,
): Promise<Response> {
  return fetch("/api/singleplayer-state", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
