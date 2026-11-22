import { getCurrentSeasonNumber } from "@/lib/foundation/season-history-clamp";
import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * Review 22.11. Befund 9: EINE Markierung fuer „im Saison-1-Draft gepickt“, gesetzt von beiden Draft-Wegen (Blocklauf in
 * `fuehreLigaSetupDraftAus`, Einzelschritt in `setzeDraftImKontext`) und gelesen von `istDraftPickFestkonditionen`.
 * Idempotent und rein: gibt denselben `gameState` zurueck, wenn nichts zu stempeln ist.
 */
export function stempleDraftPicksS1(gameState: GameState): GameState {
  const saisonId = gameState.season?.id;
  if (!saisonId) return gameState;
  if (!Array.isArray(gameState.rosters) || getCurrentSeasonNumber(gameState) !== 1) return gameState;
  let geaendert = false;
  const rosters = gameState.rosters.map((eintrag) => {
    if (eintrag.draftPickS1 || eintrag.joinedSeasonId !== saisonId) return eintrag;
    geaendert = true;
    return { ...eintrag, draftPickS1: true as const };
  });
  return geaendert ? { ...gameState, rosters } : gameState;
}
