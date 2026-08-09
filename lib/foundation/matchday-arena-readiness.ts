import type { FormCardPlanRecord, GameState } from "@/lib/data/olyDataTypes";
import { getFormCardFlowStatus, isFormCardFlowReadyForMatchday } from "@/lib/foundation/form-card-flow";
import {
  getMatchdayLineupSideRequirements,
  getTeamMatchdayLineupDraft,
  getTeamMatchdayLineupOpenSlots,
  getTeamRosterPlayerIds,
  isTeamMatchdayLineupComplete,
  isTeamMatchdayLineupOperationallyReady,
  isTeamMatchdayLineupSubmitted,
} from "@/lib/foundation/matchday-lineup-readiness";

export type MatchdayArenaBlockerReason =
  | "missing_lineup"
  | "incomplete_lineup"
  | "lineup_not_submitted"
  | "missing_formcard_pool"
  | null;

export function hasCurrentMatchdayResult(gameState: GameState) {
  return (gameState.seasonState?.matchdayResults ?? []).some(
    (result) => result.seasonId === gameState.season?.id && result.matchdayId === gameState.matchdayState?.matchdayId,
  );
}

export function mergeFormCardPlansIntoGameState(
  gameState: GameState,
  nextPlans: FormCardPlanRecord[],
  scope: { seasonId: string; teamId: string },
): GameState {
  const retained = (gameState.seasonState?.formCardPlans ?? []).filter(
    (plan) => !(plan.seasonId === scope.seasonId && plan.teamId === scope.teamId),
  );
  const scopedPlans = nextPlans.filter((plan) => plan.seasonId === scope.seasonId && plan.teamId === scope.teamId);
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      formCardPlans: [...retained, ...scopedPlans],
    },
  };
}

export function getMatchdayArenaReadiness(gameState: GameState, activeTeamId: string | null) {
  const lineup = activeTeamId ? getTeamMatchdayLineupDraft(gameState, activeTeamId) : null;
  const lineupSlotComplete = activeTeamId ? isTeamMatchdayLineupComplete(gameState, activeTeamId, lineup) : false;
  const lineupOperationallyReady = activeTeamId ? isTeamMatchdayLineupOperationallyReady(gameState, activeTeamId, lineup) : false;
  const lineupSubmitted = isTeamMatchdayLineupSubmitted(lineup);
  const openLineupSlots = activeTeamId ? getTeamMatchdayLineupOpenSlots(gameState, activeTeamId, lineup) : 0;
  const rosterPlayerIds = activeTeamId ? getTeamRosterPlayerIds(gameState, activeTeamId) : [];
  const deployedPlayerIds = new Set((lineup?.entries ?? []).map((entry) => entry.playerId));
  const undeployedRosterCount = rosterPlayerIds.filter((playerId) => !deployedPlayerIds.has(playerId)).length;
  const hasResults = hasCurrentMatchdayResult(gameState);
  const formCardsRequired = lineupOperationallyReady && !hasResults;
  const formCardFlow = getFormCardFlowStatus(gameState, activeTeamId);
  const formCardsReady =
    !formCardsRequired ||
    isFormCardFlowReadyForMatchday(gameState, activeTeamId, { lineupSubmitted: lineupSubmitted });
  const isReady = lineupOperationallyReady && lineupSubmitted && formCardsReady;

  let blocker: MatchdayArenaBlockerReason = null;
  if (!lineup?.entries?.length) {
    blocker = "missing_lineup";
  } else if (!lineupOperationallyReady) {
    blocker = "incomplete_lineup";
  } else if (!lineupSubmitted) {
    blocker = "lineup_not_submitted";
  } else if (formCardsRequired && !formCardsReady && formCardFlow.blocker) {
    blocker = formCardFlow.blocker as MatchdayArenaBlockerReason;
  }

  return {
    isReady,
    blocker,
    openLineupSlots,
    undeployedRosterCount,
    lineupSlotComplete,
    lineupOperationallyReady,
    sideRequirements: activeTeamId ? getMatchdayLineupSideRequirements(gameState) : null,
    formCardsRequired,
    formCardFlow,
    lineupReady: lineupOperationallyReady,
    lineupSubmitted,
    hasResults,
  };
}

export type MatchdayTeamLineupReadiness = {
  teamId: string;
  teamName: string;
  teamCode: string;
  isReady: boolean;
  blocker: MatchdayArenaBlockerReason;
};

export type MatchdayLeagueLineupReadiness = {
  /** Alle Teams der Liga mit ihrem Bereit-Status für den aktuellen Spieltag. */
  teams: MatchdayTeamLineupReadiness[];
  /** Teams, die noch NICHT bereit sind (Aufstellung fehlt/unvollständig/nicht abgeschickt/Formkarten offen). */
  pendingTeams: MatchdayTeamLineupReadiness[];
  readyCount: number;
  totalCount: number;
  /** True, sobald jedes Team der Liga bereit ist — das Gate für den Arena-START. */
  allReady: boolean;
};

/**
 * Bereit-Status ALLER Teams für den aktuellen Spieltag.
 *
 * "Bereit" heisst hier exakt dasselbe wie für das eigene Team: Aufstellung operativ
 * vollständig, abgeschickt (= gespeichert) und Formkarten geklärt. Damit sind KI-Teams
 * automatisch bereit, sobald ihre Aufstellung generiert und ihre Formkarten gesetzt sind —
 * es braucht keinen separaten KI-Sonderweg.
 *
 * Verwendet vom Arena-Start-Gate: der Host darf jederzeit IN die Arena wechseln, den Reveal
 * aber erst starten, wenn `allReady` true ist.
 */
export function getMatchdayLeagueLineupReadiness(gameState: GameState): MatchdayLeagueLineupReadiness {
  // Defensiv gegen Bootstrap-/Teilzustaende: im Ladefenster kann `teams` noch fehlen. Ohne das
  // `?? []` warf diese Zeile `Cannot read properties of undefined (reading 'map')` und riss die
  // ganze Disziplin-Buehne mit — genau der Fall, den `tests/discipline-stage-host.test.ts` mit
  // "bootstrap/partial state (empty object) does NOT throw" abdeckt und der dort seit laengerem
  // rot stand. Dieselbe Absicherung nutzen die Nachbarn in dieser Datei bereits.
  const teams = (gameState.teams ?? []).map((team) => {
    const readiness = getMatchdayArenaReadiness(gameState, team.teamId);
    return {
      teamId: team.teamId,
      teamName: team.name,
      teamCode: team.shortCode || team.teamId,
      isReady: readiness.isReady,
      blocker: readiness.blocker,
    } satisfies MatchdayTeamLineupReadiness;
  });
  const pendingTeams = teams.filter((team) => !team.isReady);
  return {
    teams,
    pendingTeams,
    readyCount: teams.length - pendingTeams.length,
    totalCount: teams.length,
    allReady: teams.length > 0 && pendingTeams.length === 0,
  };
}

export function formatLineupOperationalGapDetail(
  readiness: Pick<
    ReturnType<typeof getMatchdayArenaReadiness>,
    "openLineupSlots" | "undeployedRosterCount"
  >,
) {
  const parts: string[] = [];
  if (readiness.openLineupSlots > 0) {
    parts.push(`${readiness.openLineupSlots} offene Slot${readiness.openLineupSlots === 1 ? "" : "s"}`);
  }
  if (readiness.undeployedRosterCount > 0) {
    parts.push(
      `${readiness.undeployedRosterCount} Kader-Spieler noch nicht eingesetzt`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
