/**
 * Miss den Kostensplit von `buildPersistedSeasonDerivationsRecord`, das bei
 * JEDEM Matchday-Result-Apply laeuft (10×/Season). Zeigt, welche Teilpaesse
 * ueber alle ~3000 Spieler die Zeit fressen und ob sie pro Matchday
 * ueberhaupt neu berechnet werden muessen.
 *
 *   OLY_APP_SQLITE_PATH=/tmp/bench.sqlite npx tsx scripts/bench-derivations.ts
 */
import { performance } from "node:perf_hooks";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  buildLeagueMarketValuePlayerSignature,
  computeLeagueMarketValueMapFromPlayers,
} from "@/lib/player-formulas/league-market-value-snapshot";
import { computeSeasonDerivationsFresh } from "@/lib/foundation/season-derivations-compute";
import { buildGameStateContentSignature } from "@/lib/foundation/season-derivations-signature";
import { buildPersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function timeIt(fn: () => void, samples = 5): number {
  fn(); // warmup
  return median(
    Array.from({ length: samples }, () => {
      const t0 = performance.now();
      fn();
      return performance.now() - t0;
    }),
  );
}

function main() {
  const persistence = createPersistenceService();
  const gameState = persistence.createFreshSeasonOneSave({ activate: true }).gameState;
  const seasonId = gameState.season.id;
  const players = gameState.players;

  const mvMapMs = timeIt(() => void computeLeagueMarketValueMapFromPlayers(players));
  const mvSigMs = timeIt(() => void buildLeagueMarketValuePlayerSignature(players));
  const derivFreshMs = timeIt(() => void computeSeasonDerivationsFresh(gameState, seasonId));
  const contentSigMs = timeIt(() => void buildGameStateContentSignature(gameState));

  // Recompute-Pfad: ohne persistierten Record (wie Matchday 1).
  const recomputeMs = timeIt(() => void buildPersistedSeasonDerivationsRecord(gameState));

  // Reuse-Pfad: den einmal berechneten Record in den State legen (wie Matchday 2..10,
  // wenn sich die MW-Signatur nicht geändert hat) und erneut bauen.
  const first = buildPersistedSeasonDerivationsRecord(gameState);
  const stateWithRecord = {
    ...gameState,
    seasonState: { ...gameState.seasonState, persistedSeasonDerivations: first },
  };
  const reuseMs = timeIt(() => void buildPersistedSeasonDerivationsRecord(stateWithRecord));

  // Äquivalenz: die MW-Map muss identisch sein (reuse == recompute).
  const reused = buildPersistedSeasonDerivationsRecord(stateWithRecord);
  const identical = JSON.stringify(reused.marketValueByPlayerId) === JSON.stringify(first.marketValueByPlayerId);
  if (!identical) throw new Error("MW-Map reuse weicht von recompute ab!");

  console.log(
    JSON.stringify(
      {
        players: players.length,
        note: "Frischer S1-Save; computeSeasonDerivationsFresh WÄCHST mit der Historie, die MW-Map hängt nur an disciplineRatings (ändert sich pro Matchday NICHT).",
        computeLeagueMarketValueMap_ms: Math.round(mvMapMs * 100) / 100,
        buildLeagueMarketValueSignature_ms: Math.round(mvSigMs * 100) / 100,
        computeSeasonDerivationsFresh_ms: Math.round(derivFreshMs * 100) / 100,
        buildGameStateContentSignature_ms: Math.round(contentSigMs * 100) / 100,
        record_recomputeMs: Math.round(recomputeMs * 100) / 100,
        record_reuseMs: Math.round(reuseMs * 100) / 100,
        savedPerReuseMs: Math.round((recomputeMs - reuseMs) * 100) / 100,
        mvMapIdenticalReuseVsRecompute: identical,
        estSavedPerSeasonMs_9of10Matchdays: Math.round((recomputeMs - reuseMs) * 9),
      },
      null,
      2,
    ),
  );
}

main();
