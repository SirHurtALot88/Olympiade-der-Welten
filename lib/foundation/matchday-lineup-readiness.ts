import type { GameState, LineupDraft, LineupDraftEntry } from "@/lib/data/olyDataTypes";
import { getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";

export type MatchdayLineupSideRequirements = {
  d1Required: number;
  d2Required: number;
  totalRequired: number;
};

export type MatchdayLineupSideCounts = {
  d1: number;
  d2: number;
  total: number;
};

export function getCurrentMatchdayDisciplineSchedule(gameState: GameState) {
  return (
    (gameState.seasonState.disciplineSchedule ?? []).find(
      (entry) => entry.seasonId === gameState.season.id && entry.matchdayId === gameState.matchdayState.matchdayId,
    ) ?? null
  );
}

export function getMatchdayLineupSideRequirements(gameState: GameState): MatchdayLineupSideRequirements {
  const schedule = getCurrentMatchdayDisciplineSchedule(gameState);
  const d1Required = schedule?.discipline1?.playerCount ?? 0;
  const d2Required = schedule?.discipline2?.playerCount ?? 0;
  return {
    d1Required,
    d2Required,
    totalRequired: d1Required + d2Required,
  };
}

export function getTeamMatchdayLineupDraft(gameState: GameState, teamId: string): LineupDraft | null {
  return (
    (gameState.seasonState.lineupDrafts ?? []).find(
      (draft) =>
        draft.seasonId === gameState.season.id &&
        draft.matchdayId === gameState.matchdayState.matchdayId &&
        draft.teamId === teamId,
    ) ?? null
  );
}

export function getLineupDraftSideCounts(entries: LineupDraftEntry[]): MatchdayLineupSideCounts {
  let d1 = 0;
  let d2 = 0;
  for (const entry of entries) {
    if (entry.disciplineSide === "d1") {
      d1 += 1;
    } else if (entry.disciplineSide === "d2") {
      d2 += 1;
    }
  }
  return { d1, d2, total: d1 + d2 };
}

export function isTeamMatchdayLineupComplete(
  gameState: GameState,
  teamId: string,
  draft: LineupDraft | null = getTeamMatchdayLineupDraft(gameState, teamId),
): boolean {
  if (!draft?.entries.length) {
    return false;
  }

  const { d1Required, d2Required, totalRequired } = getMatchdayLineupSideRequirements(gameState);
  const counts = getLineupDraftSideCounts(draft.entries);

  if (d1Required > 0 && counts.d1 < d1Required) {
    return false;
  }
  if (d2Required > 0 && counts.d2 < d2Required) {
    return false;
  }
  if (totalRequired > 0) {
    return true;
  }

  return draft.entries.length > 0;
}

export function getTeamMatchdayLineupOpenSlots(
  gameState: GameState,
  teamId: string,
  draft: LineupDraft | null = getTeamMatchdayLineupDraft(gameState, teamId),
): number {
  const { d1Required, d2Required, totalRequired } = getMatchdayLineupSideRequirements(gameState);
  if (totalRequired <= 0) {
    return draft?.entries.length ? 0 : 1;
  }

  const counts = getLineupDraftSideCounts(draft?.entries ?? []);
  return Math.max(d1Required - counts.d1, 0) + Math.max(d2Required - counts.d2, 0);
}

export function getTeamRosterPlayerIds(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId);
}

export function isTeamAllRosterPlayersDeployedInLineup(
  gameState: GameState,
  teamId: string,
  draft: LineupDraft | null = getTeamMatchdayLineupDraft(gameState, teamId),
) {
  const rosterPlayerIds = getTeamRosterPlayerIds(gameState, teamId);
  if (rosterPlayerIds.length === 0 || !draft?.entries.length) {
    return false;
  }
  const deployedPlayerIds = new Set(draft.entries.map((entry) => entry.playerId));
  return rosterPlayerIds.every((playerId) => deployedPlayerIds.has(playerId));
}

/**
 * Alle einsatzbereiten (nicht verletzten/gesperrten) Kaderspieler sind aufgestellt.
 * Offene Slots sind erlaubt: ein Team mit zu dünnem Kader entscheidet sich dann,
 * welche Disziplin es nicht (voll) besetzt — das ist kein Hard-Block.
 */
export function isTeamAllAvailablePlayersDeployedInLineup(
  gameState: GameState,
  teamId: string,
  draft: LineupDraft | null = getTeamMatchdayLineupDraft(gameState, teamId),
) {
  const rosterPlayerIds = getTeamRosterPlayerIds(gameState, teamId);
  if (rosterPlayerIds.length === 0 || !draft?.entries.length) {
    return false;
  }
  const matchdayId = draft.matchdayId ?? gameState.matchdayState.matchdayId;
  const availablePlayerIds = rosterPlayerIds.filter(
    (playerId) => !getPlayerAvailabilityView(gameState, playerId, teamId, matchdayId).isUnavailable,
  );
  if (availablePlayerIds.length === 0) {
    return false;
  }
  const deployedPlayerIds = new Set(draft.entries.map((entry) => entry.playerId));
  return availablePlayerIds.every((playerId) => deployedPlayerIds.has(playerId));
}

/**
 * Spielbar, wenn entweder alle Slots voll sind, der gesamte Kader eingesetzt ist,
 * oder alle einsatzbereiten (nicht verletzten) Spieler aufgestellt sind. Offene Slots
 * durch zu dünnen/verletzten Kader sind dann kein Hard-Block mehr.
 */
/**
 * Eine `locked`/`resolved` Aufstellung ist FESTGENAGELT — der Spieltag laeuft oder ist gelaufen.
 *
 * GEMELDET VON CHRIS: „hier sagt er P-C nicht ready obwohl ich ready bin und auch auf platz 3
 * gescored habe … ob die verletzungen schuld sind und das scoring blocken"
 *
 * Sie sind es, und zwar in der Richtung, die man nicht erwartet. Am Live-Spielstand nachgemessen
 * (Save `…-0kalpx`, Spieltag 6, Pirate Crew): Kader 8 Spieler, Aufstellung `locked` mit 7
 * Eintraegen, gefordert waeren 11 Slots (6 + 5) — mit 8 Spielern nie erreichbar. Getragen hat die
 * Bereitschaft deshalb der dritte Weg: „alle EINSATZBEREITEN Spieler sind aufgestellt". Beim
 * Abgeben stimmte das. Danach ist Lexa von `injured` auf `recovering` gewechselt und zaehlt seither
 * als einsatzbereit — aufgestellt ist sie aber nicht, und in einer gesperrten Liste kann sie es
 * auch nicht mehr werden. Ein Spieler, der GENESEN ist, hat das Team ruecklaufend „nicht bereit"
 * gemacht, fuer einen Spieltag, den es bereits gespielt hatte.
 *
 * Derselbe Fehler wie an anderen Stellen heute: zum falschen Zeitpunkt gemessen. Die Pruefung
 * fragt die Verfuegbarkeit von JETZT ab, die Aufstellung stammt von VORHER — und ist unaenderbar.
 *
 * Solange die Liste noch `submitted` (also aenderbar) ist, bleibt die Live-Pruefung richtig: wird
 * ein Spieler frei, kann man ihn noch nachtragen, und der Hinweis darauf ist nuetzlich. Ab
 * `locked` gibt es niemanden mehr, der auf die Antwort reagieren koennte — dann IST die
 * abgegebene Liste die Antwort.
 */
export function isTeamMatchdayLineupSealed(draft: LineupDraft | null | undefined) {
  return draft?.status === "locked" || draft?.status === "resolved";
}

export function isTeamMatchdayLineupOperationallyReady(
  gameState: GameState,
  teamId: string,
  draft: LineupDraft | null = getTeamMatchdayLineupDraft(gameState, teamId),
): boolean {
  if (!draft?.entries.length) {
    return false;
  }
  // Gesperrt heisst: die Entscheidung ist gefallen und nicht mehr revidierbar.
  if (isTeamMatchdayLineupSealed(draft)) {
    return true;
  }
  if (isTeamMatchdayLineupComplete(gameState, teamId, draft)) {
    return true;
  }
  if (isTeamAllRosterPlayersDeployedInLineup(gameState, teamId, draft)) {
    return true;
  }
  return isTeamAllAvailablePlayersDeployedInLineup(gameState, teamId, draft);
}

export function isTeamMatchdayLineupSubmitted(draft: LineupDraft | null | undefined) {
  return draft?.status === "submitted" || draft?.status === "locked" || draft?.status === "resolved";
}

export function mergeTeamLineupDraftIntoGameState(
  gameState: GameState,
  draft: LineupDraft,
): GameState {
  const lineupDrafts = [...(gameState.seasonState.lineupDrafts ?? [])];
  const draftIndex = lineupDrafts.findIndex(
    (entry) => entry.seasonId === draft.seasonId && entry.matchdayId === draft.matchdayId && entry.teamId === draft.teamId,
  );
  if (draftIndex >= 0) {
    lineupDrafts[draftIndex] = draft;
  } else {
    lineupDrafts.push(draft);
  }
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      lineupDrafts,
    },
  };
}
