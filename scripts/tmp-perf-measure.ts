/* Temporäres Messskript — wird am Ende gelöscht. */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { compactFoundationInitialGameState } from "@/lib/persistence/foundation-initial-compact-state";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";
import { PROGRESSION_CLASS_ORDER } from "@/lib/training/class-progression-config";
import type { GameState } from "@/lib/data/olyDataTypes";

const SAVE_ID = "new-game-1785823388048-1hf25q";
const NAMES = ["Gronn", "Amystheta", "Crowthar"];

function fmt(n: number) {
  return n.toFixed(2).replace(".", ",");
}

function run() {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(SAVE_ID);
  if (!save) throw new Error("Save nicht gefunden");
  const full = save.gameState as GameState;
  const compact = compactFoundationInitialGameState(full);

  console.log("Saison:", full.season.id, "MD:", full.matchdayState.matchdayId);
  console.log("matchdayResults voll:", (full.seasonState.matchdayResults ?? []).length);
  console.log("matchdayResults kompakt:", (compact.seasonState.matchdayResults ?? []).length);
  console.log(
    "playerDisciplinePerformances voll/kompakt:",
    (full.seasonState.playerDisciplinePerformances ?? []).length,
    (compact.seasonState.playerDisciplinePerformances ?? []).length,
  );

  for (const name of NAMES) {
    const player = full.players.find((p) => (p.name ?? "").includes(name));
    if (!player) {
      console.log(name, "-> nicht gefunden");
      continue;
    }
    const compactPlayer = compact.players.find((p) => p.id === player.id)!;
    const fullRes = buildOrganicSeasonProgression({ gameState: full, player });
    const compactRes = buildOrganicSeasonProgression({ gameState: compact, player: compactPlayer });
    console.log(
      `${name} (${player.id}) voll=${fmt(fullRes.performanceSetpoints)} kompakt=${fmt(compactRes.performanceSetpoints)}`,
    );

    // Klassenunabhängigkeit nachmessen
    const perClass = PROGRESSION_CLASS_ORDER.map((className) => {
      const res = buildOrganicSeasonProgression({
        gameState: full,
        player: { ...player, trainingClass: className },
      });
      return fmt(res.performanceSetpoints);
    });
    const distinct = Array.from(new Set(perClass));
    console.log(
      `   über ${PROGRESSION_CLASS_ORDER.length} Klassen: ${distinct.length} verschiedene Werte -> ${distinct.join(" / ")}`,
    );
  }
}

run();
