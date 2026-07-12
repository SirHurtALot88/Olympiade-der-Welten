/**
 * Misst die Wall-Clock-Kosten EINES `saveSingleplayerState` (Voll-Write) und
 * rechnet hoch, was das Matchday-Save-Batching (~5 → 1 Write/Matchday) pro
 * Season spart. Der Voll-Write re-serialisiert den kompletten, mit jeder
 * Season wachsenden `season_states`/`game_metadata`-Singleton — deshalb ist
 * die pro-Save-Zeit der dominante Skalierungsfaktor.
 *
 *   OLY_APP_SQLITE_PATH=/tmp/bench.sqlite npx tsx scripts/bench-save-cost.ts
 */
import { performance } from "node:perf_hooks";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function timeOneSave(persistence: ReturnType<typeof createPersistenceService>, saveId: string, samples = 7): number {
  const times: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const save = persistence.getSaveById(saveId);
    if (!save) throw new Error("save disappeared");
    const t0 = performance.now();
    persistence.saveSingleplayerState(saveId, save.gameState);
    times.push(performance.now() - t0);
  }
  return median(times);
}

function main() {
  const persistence = createPersistenceService();
  const fresh = persistence.createFreshSeasonOneSave({ activate: true });
  const saveId = fresh.saveId;

  // Warmup (JIT, caches).
  timeOneSave(persistence, saveId, 3);

  const perSaveMs = timeOneSave(persistence, saveId, 9);

  const WRITES_REMOVED_PER_MATCHDAY = 4; // ~5 → 1
  const MATCHDAYS_PER_SEASON = fresh.gameState.season.matchdayIds.length;
  const savedPerSeasonMs = perSaveMs * WRITES_REMOVED_PER_MATCHDAY * MATCHDAYS_PER_SEASON;

  console.log(
    JSON.stringify(
      {
        note: "Baseline auf frischem S1-Save; die pro-Save-Zeit WÄCHST jede Season, weil die Event-Arrays im Singleton mitwachsen — die echte Ersparnis in späteren Seasons ist größer.",
        players: fresh.gameState.players.length,
        teams: fresh.gameState.teams.length,
        matchdaysPerSeason: MATCHDAYS_PER_SEASON,
        perFullSaveMs: Math.round(perSaveMs * 100) / 100,
        writesRemovedPerMatchday: WRITES_REMOVED_PER_MATCHDAY,
        estSavedPerSeasonMs: Math.round(savedPerSeasonMs),
        estSavedPerSeasonSec: Math.round(savedPerSeasonMs / 100) / 10,
      },
      null,
      2,
    ),
  );
}

main();
