/**
 * DER EINE SCHALTER Manager Mode vs. Battle Mode (docs/design/battle-mode-spielmodus-plan.md,
 * Abschnitt 2.1, analog zu `isLeagueSplitActive()` in lib/season/league-split.ts).
 *
 * `gameMode` lebt am Save (`GameState.scenarioMeta.gameMode`), nicht an der Saison — er wird bei
 * Anlage entschieden und aendert sich nie wieder. Jeder Save vor diesem Feature hat das Feld nie
 * gesetzt bekommen; `resolveGameMode()` ist die EINZIGE Stelle, die dieses Fehlen in einen
 * Fallback-Wert uebersetzt ("manager", bit-identisch zum Verhalten vor dem Liga-Split-Bug) — kein
 * anderer Code soll `scenarioMeta?.gameMode` direkt lesen.
 */
import type { GameMode, GameState } from "@/lib/data/olyDataTypes";

export type { GameMode };

export function resolveGameMode(gameState: Pick<GameState, "scenarioMeta">): GameMode {
  return gameState.scenarioMeta?.gameMode === "battle" ? "battle" : "manager";
}

export function isBattleModeSave(gameState: Pick<GameState, "scenarioMeta">): boolean {
  return resolveGameMode(gameState) === "battle";
}
