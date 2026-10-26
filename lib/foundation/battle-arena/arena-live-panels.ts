import type { StandingRecord, Team } from "@/lib/data/olyDataTypes";
import type { SpieltagsPaarung, SpieltagsUebersicht } from "@/lib/foundation/season-matchday-fixtures-overview";
import type { TeamRelationshipKind } from "@/lib/foundation/team-relationship";

/**
 * LIVE-PANELS FUER DIE BATTLE ARENA ("Spieltagsergebnisse" + "Tabelle") — Chris' Freigabe vom
 * 26.10. zum Mockup-Artefakt: „ja das mit der tabelle sieht gut aus und den ergebnissen fuege
 * das ein". Zwei reine, von React getrennte Aufbereitungs-Funktionen (analog zu
 * `lib/battle/arena-host-seed.ts`, PR4 "Determinismus-Feinschliff") — beide bauen NUR eine
 * kompakte Anzeige-Form aus bereits vorhandenen Daten, keine neue Rechnung:
 *
 *  - `buildArenaFixturesPanel()` liest `SpieltagsUebersicht` (`season-matchday-fixtures-overview.ts`,
 *    Task #180) — die bestehende Quelle fuer "wer spielt an diesem Spieltag gegen wen, mit
 *    welchem Ergebnis".
 *  - `buildArenaStandingsPanel()` liest `gameState.seasonState.standings` (immer vorhanden, der
 *    aktuelle, bereits gebuchte Stand) und reichert optional mit einer `StandingsPreviewItem[]`-
 *    Projektion an (`lib/standings/standings-preview-engine.ts` ueber `/api/standings/preview`,
 *    dieselbe Engine, die der Saisonstand-Tab fuer "wenn dieser Spieltag so bleibt" nutzt).
 *
 * MACHBARKEITS-BEFUND (Auftrag Punkt 1, s. PR-Beschreibung): das Spiel bucht einen Spieltag
 * IMMER als Batch — `commitArenaDiscipline()` (`use-foundation-shell-router-body-scope.tsx`)
 * loest beim Buchen EINER Seite (D1/D2) sofort ALLE Fixtures dieses Spieltags fuer die GANZE
 * Liga auf (`runCockpitMatchdayAutoRun`), nicht nur das gerade angesehene Paar. Es gibt also
 * keinen Zwischenzustand "Partie X laeuft, Partie Y pausiert" — nur "schon gebucht" oder "noch
 * nicht". Die beiden Panels bilden genau das ab, ohne einen Live-Zustand zu erfinden, den es
 * nicht gibt:
 *  - Vor dem Buchen von D1: jede Paarung zeigt "offen", die Tabelle zeigt den Stand VOR diesem
 *    Spieltag.
 *  - Nach D1, vor D2: D1 ist fuer die GANZE Liga gebucht (Paarungen zeigen ihr D1-Ergebnis), die
 *    Tabelle zeigt bereits die neuen D1-Punkte — das ist kein Projektions-Kunstgriff, sondern der
 *    echte, schon geschriebene Stand. "Vorlaeufig" heisst hier nur: D2 fehlt noch, der Endstand
 *    dieses Spieltags kann sich also noch aendern (`resultStatus: "incomplete_result"`).
 *  - Nach D2: beides final, kein Vorlaeufig-Hinweis mehr.
 */

export type ArenaStandingsPanelPreviewItem = {
  teamId: string;
  projectedRank: number | null;
  projectedPoints: number | null;
  resultStatus: "ready" | "missing_result" | "incomplete_result" | "tie_warning";
};

export type ArenaStandingsPanelInput = {
  teams: ReadonlyArray<Pick<Team, "teamId" | "name" | "shortCode">>;
  standings: Record<string, Pick<StandingRecord, "points" | "rank" | "verhaeltnis"> | undefined>;
  /** Fuer die "Sp"-Spalte -- der Spieltag, den die Liga gerade spielt/zuletzt gespielt hat (1-basiert). */
  currentMatchdayNumber: number | null;
  ownTeamId: string | null;
  /**
   * Die Standings-Preview-Projektion desselben Spieltags (`/api/standings/preview`), `null`/
   * `undefined` solange sie (noch) nicht geladen ist -- die Basistabelle bleibt dann der
   * zuletzt gebuchte Stand, ohne Vorlaeufig-Hinweis. Kein Pflichtfeld: ein fehlgeschlagener
   * Abruf darf die Tabelle nie leer lassen.
   */
  preview?: {
    matchdayResultFound: boolean;
    items: ReadonlyArray<ArenaStandingsPanelPreviewItem>;
  } | null;
};

export type ArenaStandingsPanelRow = {
  teamId: string;
  teamName: string;
  teamCode: string;
  rank: number | null;
  sp: number | null;
  diff: number | null;
  points: number | null;
  isOwnTeam: boolean;
  /** `true`, wenn DIESE Zeile die Preview-Projektion zeigt statt des zuletzt gebuchten Stands. */
  isProvisionalRow: boolean;
};

export type ArenaStandingsPanel = {
  rows: ArenaStandingsPanelRow[];
  /** `true`, sobald mindestens eine Zeile die Preview-Projektion zeigt (s. `isProvisionalRow`). */
  isProvisional: boolean;
  hinweisText: string;
};

/**
 * Baut die kompakte Tabelle (Rang/Team/Sp/Diff/Pkt). Ohne `preview` (oder solange sie keine
 * unvollstaendige Zeile meldet) ist das exakt der zuletzt gebuchte Saisonstand -- KEINE Erfindung
 * eines "laufenden" Spielstands, den die Engine nicht kennt (s. Dateikommentar).
 */
export function buildArenaStandingsPanel(input: ArenaStandingsPanelInput): ArenaStandingsPanel {
  const previewByTeamId = new Map((input.preview?.items ?? []).map((item) => [item.teamId, item] as const));
  const matchdayResultFound = input.preview?.matchdayResultFound ?? false;
  const hasIncompleteItem = (input.preview?.items ?? []).some(
    (item) => item.resultStatus === "incomplete_result" || item.resultStatus === "tie_warning",
  );
  const isProvisional = matchdayResultFound && hasIncompleteItem;

  const rows: ArenaStandingsPanelRow[] = input.teams.map((team) => {
    const standing = input.standings[team.teamId] ?? null;
    const previewItem = previewByTeamId.get(team.teamId) ?? null;
    const useProjected = isProvisional && previewItem != null && previewItem.projectedPoints != null;

    return {
      teamId: team.teamId,
      teamName: team.name,
      teamCode: team.shortCode,
      rank: useProjected ? previewItem!.projectedRank ?? standing?.rank ?? null : standing?.rank ?? null,
      sp: input.currentMatchdayNumber,
      diff: standing?.verhaeltnis ?? null,
      points: useProjected ? previewItem!.projectedPoints ?? standing?.points ?? null : standing?.points ?? null,
      isOwnTeam: team.teamId === input.ownTeamId,
      isProvisionalRow: useProjected,
    };
  });

  rows.sort((left, right) => {
    if (left.rank != null && right.rank != null && left.rank !== right.rank) {
      return left.rank - right.rank;
    }
    if (left.rank != null && right.rank == null) return -1;
    if (left.rank == null && right.rank != null) return 1;
    const rightPoints = right.points ?? Number.NEGATIVE_INFINITY;
    const leftPoints = left.points ?? Number.NEGATIVE_INFINITY;
    if (rightPoints !== leftPoints) return rightPoints - leftPoints;
    return left.teamName.localeCompare(right.teamName, "de");
  });

  const hinweisText = isProvisional
    ? "Vorläufig — Disziplin 2 dieses Spieltags steht noch aus, der Endstand kann sich noch ändern."
    : "Aktueller Saisonstand.";

  return { rows, isProvisional, hinweisText };
}

export type ArenaFixturesPanelRow = {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamCode: string;
  awayTeamCode: string;
  gespielt: boolean;
  /** z. B. "Basketball 2:0 · Hockey ausstehend" -- `null`, solange NICHTS an diesem Duell gewertet ist. */
  resultLabel: string | null;
  /** Exakt das Paar, das die Arena gerade zeigt (`heimTeamId`/`gastTeamId`, unabhaengig von der UI-Orientierung). */
  isOwnMatch: boolean;
  isRivalMatch: boolean;
};

export type ArenaFixturesPanelInput = {
  uebersicht: SpieltagsUebersicht | null;
  teamsById: ReadonlyMap<string, Pick<Team, "name" | "shortCode">>;
  heimTeamId: string;
  gastTeamId: string;
  /** `buildTeamRelationshipMap()` (`lib/foundation/team-relationship.ts`), optional. */
  relationshipByTeamId?: ReadonlyMap<string, TeamRelationshipKind> | null;
};

export type ArenaFixturesPanel = {
  rows: ArenaFixturesPanelRow[];
  matchdayLabel: string;
};

function resolveTeamDisplay(teamsById: ReadonlyMap<string, Pick<Team, "name" | "shortCode">>, teamId: string) {
  const team = teamsById.get(teamId);
  return { name: team?.name ?? teamId, code: team?.shortCode ?? teamId.slice(0, 3).toUpperCase() };
}

function buildFixtureResultLabel(paarung: SpieltagsPaarung): string | null {
  if (!paarung.gespielt) return null;
  return paarung.disziplinen
    .map((disziplin) =>
      disziplin.gespielt
        ? `${disziplin.disciplineName} ${disziplin.punkteHeim ?? "–"}:${disziplin.punkteGast ?? "–"}`
        : `${disziplin.disciplineName} ausstehend`,
    )
    .join(" · ");
}

function istRelationshipRival(
  relationshipByTeamId: ReadonlyMap<string, TeamRelationshipKind> | null | undefined,
  teamId: string,
): boolean {
  return relationshipByTeamId?.get(teamId) === "rival";
}

/**
 * Baut die kompakte Spieltags-Paarungsliste. `null`, wenn `uebersicht` fehlt (Modus nicht
 * verfuegbar, s. `istSpieltagsModusVerfuegbar()`, oder Spieltag unbekannt) -- die Arena zeigt dann
 * ihren eigenen "nicht verfuegbar"-Hinweis statt eines leeren Panels.
 */
export function buildArenaFixturesPanel(input: ArenaFixturesPanelInput): ArenaFixturesPanel | null {
  if (!input.uebersicht) return null;

  const rows: ArenaFixturesPanelRow[] = input.uebersicht.paarungen.map((paarung) => {
    const home = resolveTeamDisplay(input.teamsById, paarung.homeTeamId);
    const away = resolveTeamDisplay(input.teamsById, paarung.awayTeamId);
    const isOwnMatch =
      (paarung.homeTeamId === input.heimTeamId && paarung.awayTeamId === input.gastTeamId) ||
      (paarung.homeTeamId === input.gastTeamId && paarung.awayTeamId === input.heimTeamId);

    return {
      fixtureId: paarung.fixtureId,
      homeTeamId: paarung.homeTeamId,
      awayTeamId: paarung.awayTeamId,
      homeTeamName: home.name,
      homeTeamCode: home.code,
      awayTeamName: away.name,
      awayTeamCode: away.code,
      gespielt: paarung.gespielt,
      resultLabel: buildFixtureResultLabel(paarung),
      isOwnMatch,
      isRivalMatch:
        istRelationshipRival(input.relationshipByTeamId, paarung.homeTeamId) ||
        istRelationshipRival(input.relationshipByTeamId, paarung.awayTeamId),
    };
  });

  // Das eigene Duell zuerst, danach Rivalen-Spiele, danach der Rest in Spielplan-Reihenfolge --
  // genau die Prioritaet, die Chris' Mockup-Vorgabe nennt ("eigenes Match und ggf. ein besonders
  // relevantes Rivalen-Spiel hervorheben").
  const sortedRows = [...rows].sort((left, right) => {
    if (left.isOwnMatch !== right.isOwnMatch) return left.isOwnMatch ? -1 : 1;
    if (left.isRivalMatch !== right.isRivalMatch) return left.isRivalMatch ? -1 : 1;
    return 0;
  });

  return {
    rows: sortedRows,
    matchdayLabel: `Spieltag ${input.uebersicht.matchdayIndex + 1}`,
  };
}
