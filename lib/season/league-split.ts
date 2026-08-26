/**
 * FUNDAMENT DES LIGA-SPLITS — PR 1 aus docs/design/liga-split-plan.md, Abschnitt 9.
 *
 * Diese Datei fuehrt die Konstanten und Typen ein, an denen der spaetere 2×16-Split (Plan-Abschnitt 1
 * und 2.1) haengen wird — OHNE dass heute irgendwo Verhalten davon abhaengt. `isLeagueSplitActive`
 * gibt deshalb bewusst IMMER `false` zurueck: `seasonState.leagueByTeamId` wird von keinem
 * Produktionscode gesetzt, der Schalter existiert nur strukturell fuer PR 3 (liga-lokales Scoring
 * hinter genau diesem Schalter). Bis dahin bleibt jeder Spielstand im Legacy-32er-Modus.
 *
 * `buildInitialLeagueAssignment` ist die einzige Funktion hier, die schon "richtig" sein muss: sie
 * bildet Plan-Abschnitt 0, Fund 1 nach (Budget-Startraenge 1..16 → Liga 1, 17..32 → Liga 2, sortiert
 * wie `buildStartRankByTeamId` in lib/game/new-game-setup-service.ts) — wird aber von keinem
 * bestehenden Code aufgerufen.
 */
import type { GameState, Team } from "@/lib/data/olyDataTypes";

/** Groesse EINER Liga nach dem Split. Der Rangraum, in dem Sponsor/Scoring/Standings kuenftig laufen. */
export const LEAGUE_SIZE = 16;

/** Teams IM SAVE insgesamt — bleibt 32, Split oder nicht (Plan-Abschnitt 0, Fund 7). */
export const TEAM_COUNT_TOTAL = 32;

/** Anzahl Auf-/Absteiger je Saisonuebergang (Plan-Abschnitt 1). */
export const RELEGATION_COUNT = 3;

export type LeagueTier = "liga1" | "liga2";

/**
 * DER EINE SCHALTER Legacy-32 vs. 2×16 (Plan-Abschnitt 2.1, 8).
 *
 * Gibt heute IMMER `false` zurueck. Der Split wird erst in einer spaeteren PR scharf geschaltet, wenn
 * `seasonState.leagueByTeamId` tatsaechlich von der Spiel-/Saisonlogik gesetzt wird (Migration bzw.
 * Saisonuebergang, Plan-Abschnitt 7/8). Bis dahin ist das Feld hoechstens von Hand gesetzt und muss
 * ignoriert werden — sonst haette bereits das blosse Vorhandensein des optionalen Feldes im
 * Datenmodell (Schritt dieser PR) Verhalten geaendert, was PR 1 explizit ausschliesst.
 */
export function isLeagueSplitActive(_gameState: GameState): boolean {
  return false;
}

/**
 * Liga-Zugehoerigkeit eines Teams in DIESEM Spielstand — `null`, wenn keine Zuordnung existiert
 * (heute immer, siehe `isLeagueSplitActive`).
 */
export function getLeagueOf(gameState: GameState, teamId: string): LeagueTier | null {
  return gameState.seasonState.leagueByTeamId?.[teamId] ?? null;
}

/**
 * Alle Team-IDs einer Liga in DIESEM Spielstand. Leer, solange `leagueByTeamId` fehlt (heute immer).
 */
export function getLeagueTeamIds(gameState: GameState, tier: LeagueTier): string[] {
  const byTeamId = gameState.seasonState.leagueByTeamId;
  if (!byTeamId) return [];
  return Object.keys(byTeamId).filter((teamId) => byTeamId[teamId] === tier);
}

/**
 * DIE START-ZUORDNUNG (Plan-Abschnitt 0, Fund 1): Budget-Startrang 1..LEAGUE_SIZE → Liga 1, Rest →
 * Liga 2. Dieselbe Sortierung wie `buildStartRankByTeamId` in new-game-setup-service.ts (Budget
 * absteigend, Team-ID als deterministischer Tie-Breaker) — sonst koennte dieselbe Teamliste hier und
 * dort unterschiedliche Raenge ergeben.
 *
 * Rein funktional, kein GameState-Zugriff: wird von keinem bestehenden Code aufgerufen (siehe
 * Datei-Kommentar), nur getestet.
 */
export function buildInitialLeagueAssignment(teams: readonly Team[]): Record<string, LeagueTier> {
  const sorted = [...teams].sort(
    (a, b) => (b.budget ?? 0) - (a.budget ?? 0) || a.teamId.localeCompare(b.teamId),
  );
  const assignment: Record<string, LeagueTier> = {};
  sorted.forEach((team, index) => {
    assignment[team.teamId] = index < LEAGUE_SIZE ? "liga1" : "liga2";
  });
  return assignment;
}
