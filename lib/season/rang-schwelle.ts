import type { GameState } from "@/lib/data/olyDataTypes";
import { LEAGUE_SIZE, TEAM_COUNT_TOTAL, getLeagueOf, getLeagueTeamIds, isLeagueSplitActive } from "@/lib/season/league-split";

/**
 * Rang-Schwellen, die fuer 32 Teams geschrieben wurden, anteilig auf die echte Ligagroesse umrechnen.
 *
 * `standings[teamId].rank` zaehlt seit dem Liga-Split pro Liga (1..16). Feste Schwellen wie `>= 25`
 * oder `<= 20` stammen aus der 32er-Zeit: in einer 16er-Liga loesen die unteren nie aus, die oberen
 * sind immer wahr. Bei `teamZahl === 32` liefern alle Funktionen exakt den uebergebenen Wert zurueck
 * (bit-identisch zum alten Verhalten).
 */

/**
 * Rangraum des Teams: mit Liga-Split die ECHTE Teamzahl der eigenen Liga (aus `leagueByTeamId`),
 * ohne Liga-Split (Legacy-Saves) `TEAM_COUNT_TOTAL`. Gleiches Muster wie `sponsorRangraumFuer`.
 */
export function rangRaumDesTeams(gameState: Pick<GameState, "seasonState"> | null | undefined, teamId: string): number {
  if (!gameState?.seasonState || !isLeagueSplitActive(gameState as GameState)) return TEAM_COUNT_TOTAL;
  const tier = getLeagueOf(gameState as GameState, teamId);
  const size = tier ? getLeagueTeamIds(gameState as GameState, tier).length : 0;
  return size > 0 ? size : LEAGUE_SIZE;
}

function normiere(teamZahl: number): number {
  return Math.max(4, Math.round(Number.isFinite(teamZahl) ? teamZahl : TEAM_COUNT_TOTAL));
}

/**
 * Obere Schwelle (`rang <= x`) bzw. Zielrang: `wert32` ist der Platz im 32er-Feld, das Ergebnis der
 * anteilige Platz (aufgerundet, mindestens 1). Beispiel 16 Teams: 5 -> 3, 8 -> 4, 20 -> 10.
 */
export function rangSchwelleOben(wert32: number, teamZahl: number): number {
  const n = normiere(teamZahl);
  if (n === TEAM_COUNT_TOTAL) return wert32;
  return Math.max(1, Math.ceil((wert32 * n) / TEAM_COUNT_TOTAL));
}

/**
 * Untere Schwelle (`rang >= x`): gezaehlt wird vom Tabellenende. `x32 = 25` heisst „die unteren 8 von
 * 32"; bei 16 Teams sind das die unteren 4, also Rang >= 13. Mindestens Rang 2.
 */
export function rangSchwelleUnten(x32: number, teamZahl: number): number {
  const n = normiere(teamZahl);
  if (n === TEAM_COUNT_TOTAL) return x32;
  const vomEnde32 = TEAM_COUNT_TOTAL - x32 + 1;
  const vomEnde = Math.max(1, Math.ceil((vomEnde32 * n) / TEAM_COUNT_TOTAL));
  return Math.max(2, n - vomEnde + 1);
}

/** Anzahl Plaetze vom Tabellenende, anteilig (fuer Beschriftungen wie „nicht Bottom 5"). */
export function rangAnzahlAnteilig(anzahl32: number, teamZahl: number): number {
  const n = normiere(teamZahl);
  if (n === TEAM_COUNT_TOTAL) return anzahl32;
  return Math.max(1, Math.ceil((anzahl32 * n) / TEAM_COUNT_TOTAL));
}
