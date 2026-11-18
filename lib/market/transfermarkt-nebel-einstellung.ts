import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * FOG OF WAR DES TRANSFERMARKTS ABSCHALTBAR (Chris, 18.11.): eine Spielstand-Einstellung schaltet den Scouting-Nebel
 * ganz aus (Testzwecke, Spielbeginn). Es gab keine bestehende Einstellung dafür; sie liegt neu in
 * `gameState.scenarioMeta.scoutingNebelAus`. Fehlt sie, ist der Nebel AN (Standard).
 *
 * Aus heißt: der Lesedienst rechnet jeden Spieler als voll gescoutet (Stufe 5), die Sicht zeigt exakte Werte und
 * sortiert nach ihnen (`baueSpielerSicht(item, { nebelAus: true })`).
 */
export function isScoutingNebelAus(gameState: Pick<GameState, "scenarioMeta"> | null | undefined): boolean {
  return gameState?.scenarioMeta?.scoutingNebelAus === true;
}
