/* Temporäre Probe: welche Rohdaten überleben den kompakten Payload? */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import { buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import type { GameState } from "@/lib/types/game";

const SAVE_ID = "new-game-1785823388048-1hf25q";

function probe(label: string, gameState: GameState) {
  const perfs = gameState.seasonState.playerDisciplinePerformances ?? [];
  const ledger = buildSeasonPointsLedger(gameState);
  const map = buildPlayerSeasonPerformanceMap(gameState, ledger);
  const playersWithBreakdown = [...map.values()].filter((entry) => (entry.disciplineBreakdown ?? []).length > 0);
  console.log(
    `${label}: playerDisciplinePerformances=${perfs.length} distinctPlayers=${new Set(perfs.map((p) => p.playerId)).size} ` +
      `ledgerEntries=${ledger.pointEntries.length} perfMapSize=${map.size} mitBreakdown=${playersWithBreakdown.length}`,
  );
  const laufen = [...map.entries()]
    .map(([playerId, entry]) => ({
      playerId,
      pts: entry.disciplineBreakdown?.find((d) => d.disciplineName === "Wettessen")?.totalContribution ?? null,
    }))
    .filter((e) => e.pts != null)
    .sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0));
  console.log(`  Wettessen: ${laufen.length} Spieler mit PPs, Top5: ${laufen.slice(0, 5).map((e) => `${e.playerId}=${e.pts}`).join(", ")}`);
  const gronn = laufen.findIndex((e) => e.playerId === "player-0344-gronn");
  console.log(`  Gronn Wettessen Position: ${gronn >= 0 ? gronn + 1 : "nicht dabei"}`);
}

async function main() {
  const service = createPersistenceService();
  const save = await service.getSaveById(SAVE_ID);
  const gameState = (save as { gameState?: GameState } | null)?.gameState;
  if (!gameState) throw new Error("kein gameState");
  probe("VOLL   ", gameState);
  probe("KOMPAKT", compactFoundationInitialGameState(gameState));
}

void main();
