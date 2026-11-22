import type { GameState } from "@/lib/data/olyDataTypes";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import { getCurrentSeasonNumber } from "@/lib/foundation/season-history-clamp";

/**
 * Review 22.11. Befund 10 / Runde 2: „Voll KI“ (Bereich `transfers` an die KI delegiert) nimmt ab Saison 2 am Kauffenster teil,
 * mit denselben Regeln und Funktionen wie KI-Teams. Der Modus im Spielstand wird dabei NIE veraendert (frueher: `controlMode` fuer die
 * Laufzeit auf "ai" -> parallele Schreibwege normalisierten Besitzer und `humanControlled`): die Transferdienste lesen stattdessen
 * diese Sicht, die den Modus nur im Speicher auf "ai" hebt. Teams mit `transfers: "selbst"` bleiben unberuehrt.
 */
export function istTransferAnKiDelegiert(gameState: GameState, teamId: string): boolean {
  const e = gameState.seasonState?.teamControlSettings?.[teamId];
  if (e == null || e.controlMode !== "manual" || !isBereichDelegiert(e, "transfers")) return false;
  // Saison 1: der Draft laeuft. Delegierte Transfers allein lassen die KI dort NICHT kaufen; nur zusammen mit dem delegierten Draft.
  const nummer = getCurrentSeasonNumber(gameState);
  if (nummer == null || nummer < 2) return isBereichDelegiert(e, "draft");
  return true;
}

/** Kontrolleinstellung fuer Transferdienste: delegierte Menschenteams erscheinen als KI (nur gelesen, nie gespeichert). */
export function getTransferControlSettings(gameState: GameState, teamId: string) {
  const settings = getTeamControlSettings(gameState, teamId);
  if (settings && istTransferAnKiDelegiert(gameState, teamId)) {
    return { ...settings, controlMode: "ai" as const, aiTransferPreviewEnabled: true, aiSellPreviewEnabled: true };
  }
  return settings;
}

/**
 * Delegierte Menschenteams, die im Kauf- und Verkaufsfenster mitlaufen — unabhaengig davon, wer den Lauf ausloest (Chris, Franky,
 * Ramona): der Bereich gehoert dem Team, nicht dem Ausloeser. Nicht in Saison 1 (dort laeuft der Draft), erst ab Saison 2.
 */
export function ermittleDelegierteTransferTeamIds(gameState: GameState): string[] {
  const nummer = getCurrentSeasonNumber(gameState);
  if (nummer == null || nummer < 2) return [];
  return gameState.teams.map((t) => t.teamId).filter((teamId) => istTransferAnKiDelegiert(gameState, teamId));
}
