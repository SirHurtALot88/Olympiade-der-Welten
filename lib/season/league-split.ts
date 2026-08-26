/**
 * FUNDAMENT DES LIGA-SPLITS — PR 1 aus docs/design/liga-split-plan.md, Abschnitt 9, AKTIVIERT IN PR
 * 2+3+6 (Fixture-Generator, liga-lokales Scoring, Aktivierung fuer NEUE Spiele).
 *
 * `isLeagueSplitActive` gab in PR 1 bewusst IMMER `false` zurueck (kein Produktionscode setzte
 * `seasonState.leagueByTeamId`). Seit PR 6 setzt `buildNewGameStateFromBaseline`
 * (lib/game/new-game-setup-service.ts) dieses Feld fuer JEDES neu angelegte Spiel — der Schalter hier
 * liest ab jetzt genau das: Feld gesetzt und nicht leer → Split aktiv. Bestehende/laufende Saves ohne
 * das Feld bleiben unveraendert im Legacy-32er-Modus (Migration bestehender Saves ist explizit NICHT
 * Teil dieser PRs, siehe Plan-Abschnitt 8 / PR 8).
 *
 * `buildInitialLeagueAssignment` ist die einzige Funktion hier, die schon "richtig" sein muss: sie
 * bildet Plan-Abschnitt 0, Fund 1 nach (Budget-Startraenge 1..16 → Liga 1, 17..32 → Liga 2, sortiert
 * wie `buildStartRankByTeamId` in lib/game/new-game-setup-service.ts) — dieselbe Sortierung liefert
 * dort auch den liga-lokalen Rang 1..16 rein arithmetisch aus dem globalen Budget-Startrang 1..32
 * (Liga 1: unveraendert, Liga 2: Rang minus LEAGUE_SIZE), ohne ein zweites Mal zu sortieren.
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
 * Aktiv, sobald `seasonState.leagueByTeamId` gesetzt UND nicht leer ist — das ist seit PR 6 fuer
 * jedes NEU angelegte Spiel der Fall (`buildNewGameStateFromBaseline` in
 * lib/game/new-game-setup-service.ts). Ein fehlendes oder leeres Feld heisst weiterhin Legacy-32er-
 * Modus: jeder bestehende/laufende Save vor dieser PR hat das Feld nie gesetzt bekommen (Migration
 * bestehender Saves ist bewusst NICHT Teil dieser PRs, Plan-Abschnitt 8 / PR 8), bleibt also
 * unveraendert im 32er-Rangraum, bit-identisch zum Verhalten vor PR 1.
 */
export function isLeagueSplitActive(gameState: GameState): boolean {
  const byTeamId = gameState.seasonState.leagueByTeamId;
  return Object.keys(byTeamId ?? {}).length > 0;
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
