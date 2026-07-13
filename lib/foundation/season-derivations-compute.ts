import type { GameState } from "@/lib/data/olyDataTypes";
import type { FieldRaceLedger } from "@/lib/foundation/build-field-race-ledger";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

import type { SeasonDerivations } from "./season-derivations-cache";

export function computeSeasonDerivationsFresh(gameState: GameState, seasonId: string): SeasonDerivations {
  const ledger = buildSeasonPointsLedger(gameState, seasonId);
  const ratingsById = buildPlayerRatingContractMap(gameState, ledger);
  const performanceByPlayerId = buildPlayerSeasonPerformanceMap(gameState, ledger);
  // Der Feld-Rennen-Ledger ist eine reine UI-Ableitung und wird NICHT eager hier
  // berechnet — sonst zahlen auch Backend-/Persistenz-Pfade dafür. Der einzige
  // Consumer (Shell-Scope-Hook) baut ihn on-demand aus dem `ledger`.
  const fieldRaceLedger: FieldRaceLedger = { seasonId, matchdays: [], rowsByTeamId: new Map() };

  return {
    ledger,
    ratingsById,
    performanceByPlayerId,
    fieldRaceLedger,
  };
}
