/**
 * Wer kann am letzten Spieltag noch Meister werden?
 *
 * GEMELDET VON CHRIS (Ansicht „Spieltag · Arena"): „beim letzten spieltag könnte es cool sein die
 * top teams die noch chance auf die meisterschaft haben etwas hervorzuheben damit man den
 * meisterschaftskampf im blick hat oder das irgendwie präsenter zu machen"
 *
 * ENTSCHIEDEN (Triage-Notiz `bug-2026-08-04T18-31-52-147Z-g5enkj.md`): „rechnerisch möglich", und
 * NUR am letzten Spieltag. Über die ganze Saison gedacht wäre „rechnerisch möglich" nutzlos weit —
 * am letzten Spieltag ist genau ein Ergebnis offen, damit ist die Menge von selbst eng, und man
 * braucht keine ausgedachte Schwelle.
 *
 * DIE OBERGRENZE kommt von Chris, weil sie im Code nirgends als Konstante stand: „punkte hängen an
 * der spieleranzahl die am letzten spieltag teilnehmen ca 3,3 punkte pro teilnehmendem spieler und
 * 4 spieler sind minimum und 12 das maximum an einem spieltag". Also höchstens 12 × 3,3 Punkte.
 *
 * Bewusst KONSERVATIV gerechnet: der Verfolger bekommt das Maximum, der Führende null. Wer dann
 * immer noch nicht vorbeikommt, ist sicher raus. Lieber ein Team zu viel hervorheben als einen
 * echten Titelkandidaten verschweigen — die Hervorhebung soll den Kampf zeigen, nicht ihn
 * vorwegnehmen.
 *
 * Die 3,3 sind Chris' Faustzahl, keine aus dem Code abgeleitete Konstante. Sie steht deshalb hier
 * als benannte Schraube und nicht verstreut im Code: stellt sich die echte Punkteverteilung als
 * anders heraus, wird genau diese eine Zahl angefasst.
 */

/** Punkte je teilnehmendem Spieler an einem Spieltag (Faustzahl von Chris). */
export const POINTS_PER_PARTICIPATING_PLAYER = 3.3;

/** Kleinste und größte Zahl an Spielern, die ein Team an einem Spieltag einsetzen kann. */
export const MIN_PLAYERS_PER_MATCHDAY = 4;
export const MAX_PLAYERS_PER_MATCHDAY = 12;

/** Höchstpunktzahl, die ein Team an EINEM Spieltag holen kann. */
export const MAX_POINTS_PER_MATCHDAY = MAX_PLAYERS_PER_MATCHDAY * POINTS_PER_PARTICIPATING_PLAYER;

export type TitleRaceTeam = {
  teamId: string;
  points: number | null;
};

export type TitleRaceResult = {
  /** Team-Ids, die den Titel rechnerisch noch holen können — inklusive des Führenden. */
  contenderIds: Set<string>;
  /** Der aktuell Führende (bei Gleichstand der erste in der Eingabereihenfolge). */
  leaderId: string | null;
  leaderPoints: number | null;
  /** Rückstand je Verfolger auf den Führenden — für die Kopfzeile über der Tabelle. */
  gapByTeamId: Map<string, number>;
};

/**
 * Rechnet aus, wer am letzten Spieltag noch am Titel dran ist.
 *
 * Erwartet den Punktestand VOR dem letzten Spieltag über ALLE Teams der Liga. Achtung: dieser Stand
 * ist im Browser unvollständig, wenn er aus dem Client-Ledger kommt — siehe
 * `docs/CLIENT_PAYLOAD_LEERE_ABLEITUNGEN.md`. Die Werte müssen serverseitig oder aus dem Slice
 * stammen, sonst zeigt die Hervorhebung die falschen Teams.
 *
 * Teams ohne Punktestand (`null`) fallen heraus, statt als 0 mitgerechnet zu werden — ein fehlender
 * Wert ist keine Null.
 */
export function buildTitleRace(teams: TitleRaceTeam[]): TitleRaceResult {
  const gapByTeamId = new Map<string, number>();
  const gewertet = teams.filter(
    (team): team is { teamId: string; points: number } =>
      typeof team.points === "number" && Number.isFinite(team.points),
  );

  if (gewertet.length === 0) {
    return { contenderIds: new Set(), leaderId: null, leaderPoints: null, gapByTeamId };
  }

  let leader = gewertet[0];
  for (const team of gewertet) {
    if (team.points > leader.points) leader = team;
  }

  const contenderIds = new Set<string>();
  for (const team of gewertet) {
    const gap = leader.points - team.points;
    gapByTeamId.set(team.teamId, gap);
    if (gap <= MAX_POINTS_PER_MATCHDAY) {
      contenderIds.add(team.teamId);
    }
  }

  return { contenderIds, leaderId: leader.teamId, leaderPoints: leader.points, gapByTeamId };
}
