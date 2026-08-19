/**
 * Wann darf der Flow nach dem Speichern einer Einsatzliste weiter in die Arena?
 *
 * Solo ist die Antwort einfach: sobald das eigene Team steht. Im Multiplayer
 * nicht — dort steuern zwei Spieler je mehrere Teams, und die Arena zeigt den
 * Spieltag ALLER. Wer als Erster fertig ist, wuerde sonst in eine Arena
 * geschickt, deren Aufstellungen noch gar nicht vollstaendig sind (und damit
 * Ergebnisse sehen, bevor der Mitspieler ueberhaupt gesetzt hat).
 *
 * Massgeblich sind ausschliesslich die von Menschen gesteuerten Teams
 * (`controlMode === "manual"`). KI- und passive Teams stellen sich selbst auf
 * und duerfen nie blockieren.
 */
export type MatchdayReadinessTeam = {
  id: string;
  controlMode: string;
  currentMatchdayReady: boolean;
};

export type MatchdayHumanReadiness = {
  /** Alle menschlich gesteuerten Teams haben ihre Aufstellung für diesen Spieltag. */
  allHumanTeamsReady: boolean;
  /** Anzahl menschlich gesteuerter Teams insgesamt. */
  humanTeamCount: number;
  /** Teams, auf die noch gewartet wird. */
  pendingTeamIds: string[];
};

export function evaluateMatchdayHumanReadiness(
  teams: readonly MatchdayReadinessTeam[] | null | undefined,
): MatchdayHumanReadiness {
  const humanTeams = (teams ?? []).filter((team) => team.controlMode === "manual");
  const pendingTeamIds = humanTeams.filter((team) => !team.currentMatchdayReady).map((team) => team.id);
  return {
    // Ohne menschliche Teams (reiner KI-Save) gibt es nichts zu blockieren.
    allHumanTeamsReady: pendingTeamIds.length === 0,
    humanTeamCount: humanTeams.length,
    pendingTeamIds,
  };
}

/**
 * Darf der "Weiter"-Sprung von der Einsatzliste in die Arena erfolgen?
 *
 * `isOnlineGame` unterscheidet die beiden Faelle: solo bleibt es beim bisherigen
 * Verhalten (eigenes Team reicht), online wird auf alle menschlichen Teams
 * gewartet — auch auf die des Mitspielers.
 */
/**
 * Leitet die Bereitschaftsliste direkt aus dem Spielstand ab.
 *
 * Bewusst NICHT über den Arena-Base-Service: der laedt asynchron und steht an
 * der Sprungstelle im Shell-Scope nicht zur Verfuegung — genau deshalb blieb
 * die Regel zunaechst unverdrahtet. Die Kriterien sind dieselben wie dort
 * (`countMatchdayLineupDisciplineSides(...) >= 2`, also beide Disziplin-Seiten
 * des Spieltags gesetzt), nur lokal aus `lineupDrafts` gerechnet.
 */
export function buildMatchdayReadinessTeamsFromState(input: {
  teams: ReadonlyArray<{ teamId: string }>;
  controlModeByTeamId: Readonly<Record<string, { controlMode: string } | undefined>>;
  lineupDrafts:
    | ReadonlyArray<{
        teamId: string;
        seasonId: string;
        matchdayId: string;
        entries?: ReadonlyArray<{ disciplineId: string; disciplineSide: "d1" | "d2" }> | null;
      }>
    | null
    | undefined;
  seasonId: string;
  matchdayId: string | null;
}): MatchdayReadinessTeam[] {
  const sidesByTeam = new Map<string, Set<string>>();
  for (const draft of input.lineupDrafts ?? []) {
    if (draft.seasonId !== input.seasonId || draft.matchdayId !== input.matchdayId) {
      continue;
    }
    const sides = sidesByTeam.get(draft.teamId) ?? new Set<string>();
    for (const entry of draft.entries ?? []) {
      sides.add(`${entry.disciplineId}::${entry.disciplineSide}`);
    }
    sidesByTeam.set(draft.teamId, sides);
  }
  return input.teams.map((team) => ({
    id: team.teamId,
    controlMode: input.controlModeByTeamId[team.teamId]?.controlMode ?? "manual",
    currentMatchdayReady: (sidesByTeam.get(team.teamId)?.size ?? 0) >= 2,
  }));
}

export function canJumpToArenaAfterLineupSave(input: {
  isOnlineGame: boolean;
  activeTeamReady: boolean;
  teams: readonly MatchdayReadinessTeam[] | null | undefined;
}): boolean {
  if (!input.activeTeamReady) {
    return false;
  }
  if (!input.isOnlineGame) {
    return true;
  }
  return evaluateMatchdayHumanReadiness(input.teams).allHumanTeamsReady;
}

/**
 * SAMMEL-ANSICHT „MEINE TEAMS" (Befund B5/4, Stufe 2.2): `evaluateMatchdayHumanReadiness` liefert
 * `pendingTeamIds` schon seit Langem — ausgewertet wurde das bisher NUR als Arena-Sperre in
 * `canJumpToArenaAfterLineupSave`, und die wiederum nur bei `isOnlineGame` (praktisch:
 * `online_4v4`). Wer solo mehrere eigene Teams fuehrt, sah nirgends "3 von 4 fertig".
 *
 * Diese Funktion RECHNET NICHTS NEU — sie ruft `evaluateMatchdayHumanReadiness` mit der auf den
 * angefragten Besitzer (`activeOwnerId`) eingeschraenkten Teamliste auf (Datenquelle bleibt
 * dieselbe) und haengt fuer die Anzeige nur Name + gefundenes Team-Objekt wieder an.
 * `activeOwnerId: null` (Login aus) laesst alle Teams stehen — im Solo-Betrieb gibt es ohnehin nur
 * den einen lokalen Besitzer, jede Einschraenkung waere dort wirkungslose Zusatzarbeit.
 */
export type MyTeamsReadinessTeam = MatchdayReadinessTeam & {
  name: string;
  ownerId: string | null;
};

export type MyTeamsMatchdayReadiness = {
  matchdayId: string;
  matchdayLabel: string;
  humanTeamCount: number;
  readyTeams: MyTeamsReadinessTeam[];
  pendingTeams: MyTeamsReadinessTeam[];
  allReady: boolean;
};

export function buildMyTeamsMatchdayReadiness(input: {
  teams: readonly MyTeamsReadinessTeam[] | null | undefined;
  activeOwnerId: string | null | undefined;
  matchdayId: string;
  matchdayLabel: string;
}): MyTeamsMatchdayReadiness {
  const myTeams = (input.teams ?? []).filter(
    (team) => input.activeOwnerId == null || team.ownerId === input.activeOwnerId,
  );
  const readiness = evaluateMatchdayHumanReadiness(myTeams);
  const pendingTeamIdSet = new Set(readiness.pendingTeamIds);
  const humanTeams = myTeams.filter((team) => team.controlMode === "manual");
  return {
    matchdayId: input.matchdayId,
    matchdayLabel: input.matchdayLabel,
    humanTeamCount: readiness.humanTeamCount,
    readyTeams: humanTeams.filter((team) => !pendingTeamIdSet.has(team.id)),
    pendingTeams: humanTeams.filter((team) => pendingTeamIdSet.has(team.id)),
    allReady: readiness.allHumanTeamsReady,
  };
}
