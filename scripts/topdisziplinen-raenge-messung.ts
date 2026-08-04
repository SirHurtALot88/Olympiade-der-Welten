/* Temporäre Messung: Top-Disziplinen-Ränge voll vs. kompakt. */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import { buildPlayerDrawerDataFromGameState } from "@/lib/foundation/player-detail-drawer";
import type { GameState } from "@/lib/types/game";

const SAVE_ID = "new-game-1785823388048-1hf25q";
const PLAYER_ID = "player-0344-gronn";

function report(label: string, gameState: GameState) {
  const data = buildPlayerDrawerDataFromGameState({
    gameState,
    playerId: PLAYER_ID,
    source: "sqlite",
    manageableTeamIds: ["S-C"],
    saveId: SAVE_ID,
  });
  if (!data) {
    console.log(`${label}: kein Drawer-Datensatz`);
    return;
  }
  const rows = [...data.disciplineValues]
    .sort((a, b) => (b.seasonPoints ?? -1) - (a.seasonPoints ?? -1))
    .slice(0, 6);
  console.log(`\n=== ${label} ===`);
  console.log(
    `matchdayResults=${gameState.seasonState.matchdayResults?.length ?? 0} ` +
      `disciplineResults=${gameState.seasonState.disciplineResults?.length ?? 0} ` +
      `seasonSnapshots=${gameState.seasonState.seasonSnapshots?.length ?? "undefined"} ` +
      `persistedSeasonDerivations=${gameState.seasonState.persistedSeasonDerivations ? "da" : "undefined"}`,
  );
  for (const row of rows) {
    console.log(
      `${row.label.padEnd(22)} value=${String(row.value).padStart(4)} rank=${String(row.rank)}` +
        ` | PPS=${row.seasonPoints} rank=${row.seasonPointsRank}` +
        ` | -1PPS=${row.lastSeasonPoints} ` +
        ` | AllTime=${row.allTimePoints}/${row.allTimeAppearances} rank=${row.allTimePointsRank}`,
    );
  }
  console.log(
    "Achsen-Karten:",
    data.axisCards.map((c) => `${c.id}: valueRank=${c.valueRank} ppsRank=${c.seasonPointsRank} prevRank=${c.previousSeasonPointsRank}`).join(" | "),
  );
}

async function main() {
  const service = createPersistenceService();
  const save = await service.getSaveById(SAVE_ID);
  const gameState = (save as { gameState?: GameState } | null)?.gameState ?? (save as unknown as { state?: GameState })?.state;
  if (!gameState) {
    console.log("Save-Objekt-Keys:", Object.keys(save ?? {}));
    throw new Error("kein gameState");
  }
  report("VOLLER SAVE", gameState);
  report("KOMPAKT (Client-Payload)", compactFoundationInitialGameState(gameState));
}

void main();
