import type { GameState } from "@/lib/data/olyDataTypes";
import { buildPlayerDrawerDataFromGameState, type PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { hydrateGameStatePlayerAttributeSheet } from "@/lib/foundation/hydrate-player-attribute-sheet";
import { fetchPlayerDisciplineRankOverride } from "@/lib/foundation/hydrate-player-discipline-ranks";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";

/**
 * `buildPlayerDrawerDataFromGameState` plus die zwei Server-Hydrationen, die
 * der kompakte Client-Payload nötig macht:
 *
 *  - `attributeSheetStats` für fremde Spieler (siehe hydrate-player-attribute-sheet.ts)
 *  - Disziplin-Saison-/All-Time-Ränge für den angezeigten Spieler
 *    (bug-2026-08-04T13-23-39-256Z-uzetn6, siehe player-discipline-rank-service.ts)
 *
 * Ein Wrapper statt zwei Imports + einen Merge an jeder der bisher fünf
 * Aufrufstellen von `buildPlayerDrawerDataFromGameState` im Foundation-Client
 * (use-foundation-shell-router-body-scope.tsx) — sonst driftet irgendeine
 * Stelle wieder auf die unhydrierte Variante.
 */
export async function buildHydratedPlayerDrawerData(input: {
  gameState: GameState;
  playerId: string;
  activePlayerId?: string | null;
  source: "sqlite" | "prisma";
  manageableTeamIds?: string[] | null;
  saveId?: string | null;
  liveRatingsById?: Map<string, PlayerRatingContractRow> | null;
}): Promise<PlayerDetailDrawerData | null> {
  const [hydratedGameState, disciplineRankOverride] = await Promise.all([
    hydrateGameStatePlayerAttributeSheet({
      gameState: input.gameState,
      saveId: input.saveId,
      playerId: input.playerId,
    }),
    fetchPlayerDisciplineRankOverride({
      saveId: input.saveId,
      playerId: input.playerId,
      teamId: input.manageableTeamIds?.[0] ?? null,
    }),
  ]);

  return buildPlayerDrawerDataFromGameState({
    gameState: hydratedGameState,
    playerId: input.playerId,
    activePlayerId: input.activePlayerId,
    source: input.source,
    manageableTeamIds: input.manageableTeamIds,
    saveId: input.saveId,
    liveRatingsById: input.liveRatingsById,
    disciplineRankOverride,
  });
}
