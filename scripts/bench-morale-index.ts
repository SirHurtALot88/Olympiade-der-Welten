/**
 * Verifiziert + misst den Morale-Lookup-Index.
 *
 * (a) Aequivalenz: assessPlayerMorale liefert MIT und OHNE Index fuer jeden
 *     Kader-Eintrag byte-identische Ergebnisse (kein Balancing-Effekt).
 * (b) Speed: ein voller ligaweiter Pass (~320 Kader-Eintraege) linear vs. mit
 *     Index (inkl. Index-Aufbau).
 *
 *   OLY_APP_SQLITE_PATH=/tmp/bench.sqlite npx tsx scripts/bench-morale-index.ts
 */
import { performance } from "node:perf_hooks";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { assessPlayerMorale, buildMoraleLookupIndex } from "@/lib/morale/player-morale-service";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function main() {
  const persistence = createPersistenceService();
  const fresh = persistence.createFreshSeasonOneSave({ activate: true });
  const gameState = fresh.gameState;

  // Frischer S1-Save hat noch keine Kader (die entstehen erst im Draft) —
  // fuer den Index-vs-Non-Index-Vergleich zaehlt nur, dass ~320 gueltige
  // Eintraege den vollen Lookup-Pfad durchlaufen; die Werte sind egal.
  if (gameState.rosters.length === 0) {
    const synthetic = [];
    let playerCursor = 0;
    for (const team of gameState.teams) {
      for (let slot = 0; slot < 10 && playerCursor < gameState.players.length; slot += 1, playerCursor += 1) {
        synthetic.push({
          id: `bench-roster-${playerCursor}`,
          teamId: team.teamId,
          playerId: gameState.players[playerCursor].id,
          contractLength: 3,
          salary: 1000,
          upkeep: 0,
          roleTag: "starter" as const,
          joinedSeasonId: gameState.season.id,
        });
      }
    }
    gameState.rosters = synthetic;
  }

  // (a) Aequivalenz ueber ALLE Kader-Eintraege.
  const index = buildMoraleLookupIndex(gameState);
  let mismatches = 0;
  for (const roster of gameState.rosters) {
    const withoutIndex = assessPlayerMorale({ gameState, playerId: roster.playerId, teamId: roster.teamId });
    const withIndex = assessPlayerMorale({ gameState, playerId: roster.playerId, teamId: roster.teamId, index });
    if (JSON.stringify(withoutIndex) !== JSON.stringify(withIndex)) mismatches += 1;
  }

  // (b) Timing eines vollen Passes.
  function timeFullPass(useIndex: boolean): number {
    const idx = useIndex ? buildMoraleLookupIndex(gameState) : undefined;
    const t0 = performance.now();
    for (const roster of gameState.rosters) {
      assessPlayerMorale({ gameState, playerId: roster.playerId, teamId: roster.teamId, index: idx });
    }
    return performance.now() - t0;
  }

  timeFullPass(false); // warmup
  timeFullPass(true);
  const noIndexMs = median(Array.from({ length: 5 }, () => timeFullPass(false)));
  const withIndexMs = median(Array.from({ length: 5 }, () => timeFullPass(true)));

  if (mismatches > 0) {
    throw new Error(`Aequivalenz verletzt: ${mismatches} Abweichungen zwischen Index/Non-Index.`);
  }

  console.log(
    JSON.stringify(
      {
        players: gameState.players.length,
        rosterEntries: gameState.rosters.length,
        mismatches,
        noIndexMs: Math.round(noIndexMs * 100) / 100,
        withIndexMs: Math.round(withIndexMs * 100) / 100,
        speedup: Math.round((noIndexMs / withIndexMs) * 10) / 10,
      },
      null,
      2,
    ),
  );
}

main();
