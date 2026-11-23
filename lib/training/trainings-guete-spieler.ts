/**
 * Trainingsguete eines Spielers im Spielstand (Stempel "neu2"): liest Modus, Wunsch und Belastung des Spielers und ruft die reine Rechnung
 * (`trainings-guete.ts`). Eine Stelle fuer Buchung (`berechneSpieltagsZuwachs`), Prognose (`buildOrganicSeasonProgression`), Heatmap und Seiten:
 * gezeigt = gebucht.
 */
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { entwicklungVerteilungFuer } from "@/lib/resolve/entwicklung-regel";
import { resolvePreferredTrainingMode } from "@/lib/training/training-mode-demand-service";
import { trainingsGuete, type TrainingsGuete, type TrainingsModus } from "@/lib/training/trainings-guete";

function normalisiere(modus: Player["trainingMode"]): TrainingsModus {
  return modus === "leicht" || modus === "mittel" || modus === "hart" ? modus : "mittel";
}

/** Die Guete dieses Spielers, oder `null`, wenn die Saison nicht "neu2" gestempelt ist (dann gilt der Stand vom 22.11. unveraendert). */
export function trainingsGueteFuerSpieler(gameState: GameState, player: Player, modus?: TrainingsModus): TrainingsGuete | null {
  if (!entwicklungVerteilungFuer(gameState)) return null;
  const gewaehlt = modus ?? normalisiere(player.trainingMode);
  // Der Wunsch haengt an Eigenschaften, Belastung und Rang; die Alterszweige der Wunschregel greifen im Spiel nicht (kein Alter).
  const wunsch = resolvePreferredTrainingMode({ player: { ...player, trainingMode: gewaehlt } });
  return trainingsGuete({
    playerId: player.id,
    seasonId: gameState.season?.id ?? "",
    modus: gewaehlt,
    wunsch,
    belastung: player.fatigue ?? 0,
  });
}
