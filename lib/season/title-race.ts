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
 *
 * ABER (Review 22.11., `docs/design/gameplay-designreview-22-11.md` 3.5): diese Obergrenze gilt nur
 * für die alte Rang-Punkte-Wertung (Manager-Modus). Im Battle-Spielstand führt die Tabelle
 * DUELLPUNKTE (Sieg 2, Remis 1, Niederlage 0; `DUELL_TEAM_PUNKTE`, auch die Vierer-Pods vergeben
 * höchstens 2) und es spielen zwei Disziplinen je Spieltag: höchstens 2 x 2 = 4 Punkte je Spieltag.
 * Mit 39,6 wäre dort jedes Team bis zum Schluss "im Rennen" gewesen. Die Rechnung nimmt deshalb die
 * Obergrenze und die Zahl der noch offenen Spieltage als Parameter und rechnet JE LIGA (zwei Ligen
 * à 16, jede mit eigener Tabelle): Titel, Aufstieg (Liga 2) und Abstieg (Liga 1).
 */
import { DUELL_TEAM_PUNKTE } from "@/lib/resolve/battle-mode-pps-duell";

/** Punkte je teilnehmendem Spieler an einem Spieltag (Faustzahl von Chris). */
export const POINTS_PER_PARTICIPATING_PLAYER = 3.3;

/** Kleinste und größte Zahl an Spielern, die ein Team an einem Spieltag einsetzen kann. */
export const MIN_PLAYERS_PER_MATCHDAY = 4;
export const MAX_PLAYERS_PER_MATCHDAY = 12;

/** Höchstpunktzahl, die ein Team an EINEM Spieltag holen kann. */
export const MAX_POINTS_PER_MATCHDAY = MAX_PLAYERS_PER_MATCHDAY * POINTS_PER_PARTICIPATING_PLAYER;

/** Disziplinen je Spieltag im Battle-Spielstand (zwei laufen parallel, Konzept 16.10.). */
export const DUELL_DISCIPLINES_PER_MATCHDAY = 2;

/** Höchstpunktzahl eines Teams an EINEM Spieltag im Battle-Spielstand: Sieg x Disziplinen = 4. */
export const DUELL_MAX_POINTS_PER_MATCHDAY = DUELL_TEAM_PUNKTE.win * DUELL_DISCIPLINES_PER_MATCHDAY;

/** Obergrenze je Spieltag für den Spielstand: Duellpunkte im Battle-Modus, sonst die alte Faustzahl. */
export function maxPointsPerMatchdayFor(isBattleMode: boolean): number {
  return isBattleMode ? DUELL_MAX_POINTS_PER_MATCHDAY : MAX_POINTS_PER_MATCHDAY;
}

export type TitleRaceTeam = {
  teamId: string;
  points: number | null;
  /** `"liga1"` / `"liga2"`; fehlt ohne Liga-Split (dann bilden alle Teams eine Tabelle). */
  liga?: string | null;
};

export type TitleRaceOptions = {
  /** Höchstpunkte je Spieltag (Standard: alte Faustzahl 39,6). Battle: `DUELL_MAX_POINTS_PER_MATCHDAY`. */
  maxPointsPerMatchday?: number;
  /** Noch offene (nicht gewertete) Spieltage inklusive des laufenden. Standard 1 = letzter Spieltag. */
  remainingMatchdays?: number;
  /** Auf-/Absteiger je Liga (Standard 3 = `RELEGATION_COUNT`). */
  moveCount?: number;
};

export type TitleStatus = "meister" | "im-rennen" | "raus";
export type PromotionStatus = "sicher" | "im-rennen" | "raus";
export type RelegationStatus = "abgestiegen" | "gefaehrdet" | "gerettet";

/** Das Rennen EINER Liga (oder der einen gemeinsamen Tabelle ohne Liga-Split). */
export type LeagueRace = {
  liga: string | null;
  leaderId: string | null;
  leaderPoints: number | null;
  /** Wer den Titel dieser Liga rechnerisch noch holen kann (inklusive Führendem). */
  contenderIds: Set<string>;
  /** Höchstens erreichbare Endpunktzahl je Team (Ist + Rest x Obergrenze). */
  maxReachableByTeamId: Map<string, number>;
  titleStatusByTeamId: Map<string, TitleStatus>;
  /** Titel rechnerisch entschieden: nur noch der Führende ist im Rennen. */
  titleDecided: boolean;
  /** Nur Liga 2: Rennen um die Aufstiegsplätze. */
  promotion: Map<string, PromotionStatus> | null;
  /** Nur Liga 1: Rennen gegen den Abstieg. */
  relegation: Map<string, RelegationStatus> | null;
};

export type TitleRaceResult = {
  /**
   * Team-Ids, die den Titel rechnerisch noch holen können — inklusive des Führenden. Mit Liga-Split
   * der Titel von Liga 1, sonst der der einen Tabelle. Die übrigen Ligen stehen in `leagues`.
   */
  contenderIds: Set<string>;
  /** Der aktuell Führende (bei Gleichstand der erste in der Eingabereihenfolge). */
  leaderId: string | null;
  leaderPoints: number | null;
  /** Rückstand je Team auf den Führenden SEINER Liga — für die Kopfzeile über der Tabelle. */
  gapByTeamId: Map<string, number>;
  /** Höchstpunkte je Spieltag, mit denen gerechnet wurde (für den Erklärtext). */
  maxPointsPerMatchday: number;
  remainingMatchdays: number;
  /** Alle Ligen, Liga 1 zuerst. */
  leagues: LeagueRace[];
};

type Gewertet = { teamId: string; points: number; liga: string | null };

function raceFuerLiga(liga: string | null, teams: Gewertet[], maxRest: number, moveCount: number): LeagueRace {
  const maxReachableByTeamId = new Map<string, number>();
  for (const team of teams) maxReachableByTeamId.set(team.teamId, team.points + maxRest);

  let leader = teams[0];
  for (const team of teams) if (team.points > leader.points) leader = team;

  // Konservativ wie bisher: der Verfolger bekommt das Maximum, alle anderen nichts mehr.
  const contenderIds = new Set<string>();
  for (const team of teams) {
    if ((maxReachableByTeamId.get(team.teamId) ?? 0) >= leader.points) contenderIds.add(team.teamId);
  }
  const titleDecided = contenderIds.size === 1;
  const titleStatusByTeamId = new Map<string, TitleStatus>();
  for (const team of teams) {
    titleStatusByTeamId.set(
      team.teamId,
      !contenderIds.has(team.teamId) ? "raus" : titleDecided ? "meister" : "im-rennen",
    );
  }

  const n = teams.length;
  const k = Math.min(moveCount, Math.max(0, n - 1));
  // Gleichstand gilt als "noch offen" (Tie-Break unbekannt): nur strenge Vergleiche entscheiden.
  const sicherUeber = (team: Gewertet) =>
    teams.filter((x) => x.teamId !== team.teamId && x.points > (maxReachableByTeamId.get(team.teamId) ?? 0)).length;
  const sicherUnter = (team: Gewertet) =>
    teams.filter((x) => x.teamId !== team.teamId && (maxReachableByTeamId.get(x.teamId) ?? 0) < team.points).length;
  const koennenErreichen = (team: Gewertet) =>
    teams.filter((x) => x.teamId !== team.teamId && (maxReachableByTeamId.get(x.teamId) ?? 0) >= team.points).length;

  let promotion: Map<string, PromotionStatus> | null = null;
  let relegation: Map<string, RelegationStatus> | null = null;
  if (liga === "liga2" && k > 0) {
    promotion = new Map();
    for (const team of teams) {
      promotion.set(
        team.teamId,
        sicherUeber(team) >= k ? "raus" : koennenErreichen(team) < k ? "sicher" : "im-rennen",
      );
    }
  }
  if (liga === "liga1" && k > 0) {
    relegation = new Map();
    for (const team of teams) {
      relegation.set(
        team.teamId,
        sicherUeber(team) >= n - k ? "abgestiegen" : sicherUnter(team) >= k ? "gerettet" : "gefaehrdet",
      );
    }
  }

  return {
    liga,
    leaderId: leader.teamId,
    leaderPoints: leader.points,
    contenderIds,
    maxReachableByTeamId,
    titleStatusByTeamId,
    titleDecided,
    promotion,
    relegation,
  };
}

/**
 * Rechnet aus, wer noch am Titel dran ist (und in Liga 2 am Aufstieg, in Liga 1 am Abstieg).
 *
 * Erwartet den Punktestand VOR den noch offenen Spieltagen über ALLE Teams. Achtung: dieser Stand
 * ist im Browser unvollständig, wenn er aus dem Client-Ledger kommt — siehe
 * `docs/CLIENT_PAYLOAD_LEERE_ABLEITUNGEN.md`. Die Werte müssen serverseitig oder aus dem Slice
 * stammen, sonst zeigt die Hervorhebung die falschen Teams.
 *
 * Teams ohne Punktestand (`null`) fallen heraus, statt als 0 mitgerechnet zu werden — ein fehlender
 * Wert ist keine Null. Mit `liga` je Team wird je Liga gerechnet (Liga 1 zuerst); ohne bilden alle
 * Teams eine Tabelle.
 */
export function buildTitleRace(teams: TitleRaceTeam[], options: TitleRaceOptions = {}): TitleRaceResult {
  const maxPointsPerMatchday = options.maxPointsPerMatchday ?? MAX_POINTS_PER_MATCHDAY;
  const remainingMatchdays = Math.max(0, options.remainingMatchdays ?? 1);
  const moveCount = options.moveCount ?? 3;
  const gapByTeamId = new Map<string, number>();
  const gewertet: Gewertet[] = teams
    .filter(
      (team): team is TitleRaceTeam & { points: number } =>
        typeof team.points === "number" && Number.isFinite(team.points),
    )
    .map((team) => ({ teamId: team.teamId, points: team.points, liga: team.liga ?? null }));

  const empty: TitleRaceResult = {
    contenderIds: new Set(),
    leaderId: null,
    leaderPoints: null,
    gapByTeamId,
    maxPointsPerMatchday,
    remainingMatchdays,
    leagues: [],
  };
  if (gewertet.length === 0) return empty;

  const gruppen = new Map<string | null, Gewertet[]>();
  for (const team of gewertet) {
    const gruppe = gruppen.get(team.liga);
    if (gruppe) gruppe.push(team);
    else gruppen.set(team.liga, [team]);
  }
  const reihenfolge = [...gruppen.keys()].sort((a, b) => (a ?? "").localeCompare(b ?? ""));
  const maxRest = maxPointsPerMatchday * remainingMatchdays;
  const leagues = reihenfolge.map((liga) => raceFuerLiga(liga, gruppen.get(liga) ?? [], maxRest, moveCount));

  for (const race of leagues) {
    for (const team of gruppen.get(race.liga) ?? []) {
      gapByTeamId.set(team.teamId, (race.leaderPoints ?? team.points) - team.points);
    }
  }
  const top = leagues[0];
  return {
    ...empty,
    contenderIds: top.contenderIds,
    leaderId: top.leaderId,
    leaderPoints: top.leaderPoints,
    leagues,
  };
}

/**
 * Bester Tabellenplatz, den ein Team rechnerisch noch erreichen kann: es holt alle noch möglichen
 * Punkte, jedes andere Team der Liga keinen mehr. Plätze davor haben nur die, die schon jetzt
 * strikt mehr Punkte haben, als das Team am Ende höchstens erreicht (Gleichstand bleibt offen).
 * Grundlage für "verfehlt erst, wenn rechnerisch nicht mehr erreichbar" bei Rangzielen des Vorstands.
 * `null`, wenn das Team keinen Punktestand hat.
 */
export function bestReachableRank(
  teamId: string,
  teams: TitleRaceTeam[],
  options: Pick<TitleRaceOptions, "maxPointsPerMatchday" | "remainingMatchdays"> = {},
): number | null {
  const self = teams.find((team) => team.teamId === teamId);
  if (!self || typeof self.points !== "number" || !Number.isFinite(self.points)) return null;
  const maxRest = (options.maxPointsPerMatchday ?? MAX_POINTS_PER_MATCHDAY) * Math.max(0, options.remainingMatchdays ?? 1);
  const maxReach = self.points + maxRest;
  const sicherDavor = teams.filter(
    (other) =>
      other.teamId !== teamId &&
      (other.liga ?? null) === (self.liga ?? null) &&
      typeof other.points === "number" &&
      Number.isFinite(other.points) &&
      other.points > maxReach,
  ).length;
  return sicherDavor + 1;
}
