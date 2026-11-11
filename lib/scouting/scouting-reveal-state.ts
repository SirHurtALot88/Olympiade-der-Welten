import type { GameState } from "@/lib/data/olyDataTypes";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";

/**
 * Lesende Scouting-Zustandsfragen („wie viel weiß Team X über Spieler Y?").
 *
 * Bewusst ein Blatt-Modul ohne Abhängigkeit auf Pipeline oder Wunschliste: die Wunschliste
 * (`scouting-wishlist-slots.ts`) muss seit dem Scouting-Ausbau (11.11.) wissen, wer schon voll
 * gescoutet ist — nur die obersten X NICHT fertigen Einträge sind aktiv. Lägen diese Funktionen
 * weiter in `facility-scout-pipeline-service.ts`, entstünde ein Importkreis Wunschliste ↔ Pipeline.
 * Die Pipeline exportiert sie unverändert weiter, bestehende Importe bleiben gültig.
 */

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getTeamScoutIntelRecords(gameState: GameState, teamId: string) {
  const seasonId = gameState.season.id;
  return (gameState.seasonState.scoutIntelByTeamId?.[teamId] ?? []).filter((entry) => entry.seasonId === seasonId);
}

export function getPlayerScoutCertainty(gameState: GameState, teamId: string, playerId: string) {
  const rosterEntry = gameState.rosters.some((entry) => entry.teamId === teamId && entry.playerId === playerId);
  if (rosterEntry) {
    return 100;
  }
  const record = getTeamScoutIntelRecords(gameState, teamId).find((entry) => entry.playerId === playerId) ?? null;
  return record?.certainty ?? 0;
}

/**
 * Auto-Reveal-Fortschritt (0..100) aus dem playerPotential-Record — wächst über die
 * Zeit per advancePlayerPotentialRevealTick (eigene/Watchlist/Free-Agents). Wird mit
 * der aktiven Scout-Certainty zusammengeführt, damit sich das Potenzial auch OHNE
 * aktives Scouting mit den Spieltagen von selbst aufdeckt (und man den Fortschritt sieht).
 */
export function getPlayerRevealConfidence(gameState: GameState, playerId: string): number {
  const record = gameState.playerPotential?.find((entry) => entry.playerId === playerId);
  return clamp(record?.confidence ?? 0, 0, 100);
}

/**
 * Effektive Reveal-Sicherheit (0..100): das Maximum aus aktivem Scouting (certainty)
 * und dem zeitbasierten Auto-Reveal-Fortschritt. Einziger, glatt steigender Fortschritt,
 * an dem sowohl Anzeige (%) als auch das effektive Scouting-Level hängen.
 */
export function getEffectiveRevealConfidence(gameState: GameState, teamId: string, playerId: string): number {
  const certainty = getPlayerScoutCertainty(gameState, teamId, playerId);
  return Math.max(certainty, getPlayerRevealConfidence(gameState, playerId));
}

export function getScoutingOfficeLevel(gameState: GameState, teamId: string) {
  return getFacilityLevel(getTeamFacilityState(gameState, teamId), "scouting_office");
}

export function getEffectiveScoutingLevel(gameState: GameState, teamId: string, playerId: string) {
  const facilityLevel = getScoutingOfficeLevel(gameState, teamId);
  const certainty = getEffectiveRevealConfidence(gameState, teamId, playerId);
  return clamp(facilityLevel + Math.floor(certainty / 25), 0, 5);
}

/**
 * Minimum certainty needed for a player to reach effective scouting level 5
 * ("fully scouted": exact attributes/disciplines, POW/SPE/MEN/SOC and all
 * traits visible) given the team's current Scouting Office level.
 */
export function getFullRevealCertaintyThreshold(facilityLevel: number) {
  return clamp((5 - Math.max(0, facilityLevel)) * 25, 0, 100);
}

export function isPlayerFullyScouted(gameState: GameState, teamId: string, playerId: string) {
  return getEffectiveScoutingLevel(gameState, teamId, playerId) >= 5;
}

/**
 * Scouting-Fortschritt in Prozent (0..100) für den Bewertungskreis.
 *
 * 100 % heißt GENAU „voll gescoutet" (effektives Level 5) — dieselbe Aussage, die die
 * Warteschlange als „Vollständig gescoutet" zeigt. Darunter: effektive Reveal-Sicherheit
 * relativ zur Schwelle der aktuellen Bürostufe, gedeckelt auf 99, damit ein Ring nie „voll"
 * aussieht, solange der Spieler es nicht ist (bei Bürostufe 0 ist Level 5 unerreichbar, die
 * Sicherheit kann trotzdem 100 erreichen).
 */
export function getScoutingProgressPercent(gameState: GameState, teamId: string, playerId: string) {
  if (isPlayerFullyScouted(gameState, teamId, playerId)) {
    return 100;
  }
  const threshold = getFullRevealCertaintyThreshold(getScoutingOfficeLevel(gameState, teamId));
  if (threshold <= 0) {
    return 100;
  }
  const confidence = getEffectiveRevealConfidence(gameState, teamId, playerId);
  return clamp(Math.floor((confidence / threshold) * 100), 0, 99);
}
