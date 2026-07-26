import type { GameState } from "@/lib/data/olyDataTypes";
import { buildFormCardSeasonUsageAudit } from "@/lib/lineups/legacy-lineup-modifiers";
import {
  DEFAULT_STANDINGS_TIEBREAKER_MODE,
  resolveProjectedRankWithTiePolicy,
} from "@/lib/standings/standings-tiebreaker-policy";

/**
 * Audit R2/V4: Formkarten-Übernutzungs-Strafe auf die ENDTABELLE anwenden — Punktabzug UND Re-Rank —,
 * BEVOR die Liga abgerechnet wird (season-completion ruft dies vor sponsor_settlement/snapshot). Vorher lief
 * die Strafe erst bei next_season_setup, nach dem eingefrorenen Snapshot + den rang-basierten Payouts, und
 * mutierte nur `points` (nicht `rank`), die gleich darauf von buildZeroStandings genullt wurden → sie war
 * faktisch wirkungslos (kein Effekt auf Endstand, Rang, Sponsor/Preisgeld, Startplatz).
 *
 * Der von Sponsor-Settlement + Snapshot gelesene Rang kommt aus dem gespeicherten `standing.rank`
 * (team-management-overview), NICHT live aus den Punkten — deshalb muss nach dem Punktabzug der Rang mit
 * derselben Tie-Policy wie der Standings-Apply (`resolveProjectedRankWithTiePolicy`) neu berechnet und
 * zurückgeschrieben werden. Idempotent pro Saison über `formCardPenaltyAppliedSeasonIds`.
 */
export function applyFormCardPenaltyWithRerank(
  gameState: GameState,
  seasonId: string,
): { gameState: GameState; warnings: string[]; applied: boolean } {
  const appliedSeasonIds = gameState.seasonState.formCardPenaltyAppliedSeasonIds ?? [];
  if (appliedSeasonIds.includes(seasonId)) {
    return { gameState, warnings: [], applied: false };
  }

  const audit = buildFormCardSeasonUsageAudit(gameState, seasonId);
  const penaltyByTeamId = new Map(
    audit.rows.filter((row) => row.negativePenaltyPoints > 0).map((row) => [row.teamId, row.negativePenaltyPoints]),
  );
  if (penaltyByTeamId.size === 0) {
    return { gameState, warnings: [], applied: false };
  }

  const currentStandings = gameState.seasonState.standings ?? {};
  const teamNameById = new Map(gameState.teams.map((team) => [team.teamId, team.name] as const));
  const cashById = new Map(gameState.teams.map((team) => [team.teamId, team.cash] as const));

  // 1) Punktabzug (geklammert auf >= 0).
  const nextStandings: Record<string, (typeof currentStandings)[string]> = {};
  for (const [teamId, standing] of Object.entries(currentStandings)) {
    const penalty = penaltyByTeamId.get(teamId) ?? 0;
    nextStandings[teamId] =
      penalty > 0 ? { ...standing, points: Math.max(0, (standing.points ?? 0) - penalty) } : { ...standing };
  }

  // 2) Re-Rank aus den bestraften Punkten — identische Tie-Policy wie der reguläre Standings-Apply, damit der
  // bestrafte Rang exakt der normalen Rangberechnung entspricht (Primär-Sort ist `projectedPoints`).
  //
  // Zum `null`-Rang von "block_on_tie" (standings-tiebreaker-policy:193): dieser Pfad ist hier NICHT
  // erreichbar. Er verlangt `sameValueGroupSize > 1`, und die Gleichstands-Erkennung für `projectedPoints`
  // (`isProjectedPointsTieAfterScoreTieBreak`, ebd. :64-71) fordert bei BEIDEN Teams `totalScore != null` —
  // wir übergeben hier bewusst `totalScore: null` (am Saisonende gibt es keinen Spieltags-Score, der Rang
  // folgt allein den Punkten). Bei exaktem Punkt-Gleichstand vergibt die Policy daher deterministisch
  // aufeinanderfolgende Ränge über `sortForProjectedPoints` (matchdayRank → currentRank → teamName), niemals
  // `null`. Der `!= null`-Guard unten bleibt als Absicherung, falls diese Annahme je bricht — er darf aber
  // NICHT dazu führen, dass ein Vor-Strafe-Rang stehenbleibt, weshalb der Test unten genau das festnagelt
  // (Sponsor-Settlement und Snapshot lesen `standing.rank` direkt).
  const projectedRankByTeamId = resolveProjectedRankWithTiePolicy(
    Object.entries(nextStandings).map(([teamId, standing]) => ({
      teamId,
      teamName: teamNameById.get(teamId) ?? teamId,
      totalScore: null,
      projectedPoints: standing.points ?? 0,
      currentRank: standing.rank ?? null,
      currentPoints: standing.points ?? 0,
      matchdayRank: standing.rank ?? null,
      cash: cashById.get(teamId) ?? null,
    })),
    DEFAULT_STANDINGS_TIEBREAKER_MODE,
  );
  for (const teamId of Object.keys(nextStandings)) {
    const newRank = projectedRankByTeamId.get(teamId);
    if (newRank != null) {
      nextStandings[teamId] = { ...nextStandings[teamId], rank: newRank };
    }
  }

  const warnings = Array.from(penaltyByTeamId.entries()).map(
    ([teamId, points]) => `formcard_penalty_applied:${teamId}:${points}pts`,
  );

  return {
    gameState: {
      ...gameState,
      seasonState: {
        ...gameState.seasonState,
        standings: nextStandings,
        formCardPenaltyAppliedSeasonIds: [...appliedSeasonIds, seasonId],
      },
    },
    warnings,
    applied: true,
  };
}
