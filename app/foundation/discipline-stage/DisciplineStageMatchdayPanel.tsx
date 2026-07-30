"use client";

// =====================================================================================
// Team-Matchday-PP-Panel (Ticket 205)
// =====================================================================================
//
// Die „Spieltags-Wertung" unter der Arena. Ein Spieltag = ZWEI Disziplinen (d1 + d2),
// die gemeinsam betrachtet werden. Das Panel zeigt je Team:
//   • die in Disziplin 1 & 2 gesammelten Player-Points (PPs),
//   • die Spieltags-Summe,
//   • den Saison-Rang VOR dem Spieltag → projizierten Rang NACH dem Spieltag (mit Pfeil).
//
// Spoiler-Schutz: d2 (und der finale Saison-Rang, der d2 einrechnet) bleiben verdeckt,
// solange man noch nicht bei d2 angekommen bzw. d2 nicht abgeschlossen ist. Vorher steht
// dort ein Schloss — man sieht schon, dass es „gemeinsam" gewertet wird, aber nicht das
// Ergebnis. Das eigene Team ist durchgehend hervorgehoben.
//
// Rein visuell/lesend — keine Engine-Logik. Werte kommen 1:1 aus der Resolve-Preview
// (teamResults) und der Standings-Preview (items).

import { Fragment, useState } from "react";

import { getPoolHeatClass } from "@/lib/foundation/player-league-heat";
import {
  describeMatchdaySideModifiers,
  type MatchdayFormTone,
  type MatchdayTeamModifiers,
  type MatchdayTeamSideModifiers,
} from "@/lib/foundation/matchday-team-modifiers";
import { teamPrimaryColor, floorTeamAccent } from "@/lib/foundation/team-colors";

export type MatchdayPanelTeamResult = {
  teamId: string;
  d1DisciplineId: string | null;
  d1Points: number | null;
  d2DisciplineId: string | null;
  d2Points: number | null;
  totalPoints: number | null;
  // A2: Team hat für diesen Spieltag keine Aufstellung eingereicht — die 0 Punkte
  // sind kein echtes Ergebnis und müssen sichtbar markiert werden.
  missingLineup?: boolean;
};

export type MatchdayPanelStandingRow = {
  teamId: string;
  currentRank: number | null;
  projectedRank: number | null;
  currentPoints: number | null;
  projectedPoints: number | null;
  pointsDelta: number | null;
};

export type MatchdayPanelDiscipline = { disciplineId: string; displayName: string };

// Mutator-PP (die „0,3er") pro Team, getrennt nach Disziplin-Seite, MIT Spieler-
// Zuordnung (1:1 dem Spieler gutgeschrieben, der sie geholt hat — kein Team-Split).
export type MatchdayPanelMutatorPlayer = { name: string; pp: number };
export type MatchdayPanelMutatorEntry = {
  d1Pp: number;
  d2Pp: number;
  d1Players: MatchdayPanelMutatorPlayer[];
  d2Players: MatchdayPanelMutatorPlayer[];
};

export type MatchdayPanelTeamMeta = { code: string; name: string; logoUrl: string | null };

/** Ein eingesetzter Spieler einer Disziplin — Basis der ausklappbaren Spalten. */
export type MatchdayPanelPlayerRow = {
  playerId: string;
  name: string;
  /** Dem Spieler gutgeschriebene Player-Points (null, solange nicht gewertet). */
  pp: number | null;
  /** Beitrag zum Team-Score — die Zahl, nach der die Arena animiert. */
  score: number | null;
  /** Mutator-Anteil an den PP (separat ausgewiesen, weil er dem Spieler gehoert). */
  mutatorPp: number | null;
};

export type DisciplineStageMatchdayPanelProps = {
  teamResults: MatchdayPanelTeamResult[];
  standings: MatchdayPanelStandingRow[];
  d1: MatchdayPanelDiscipline | null;
  d2: MatchdayPanelDiscipline | null;
  /** d1-PPs sichtbar (Disziplin 1 abgeschlossen bzw. bereits im Rücken). */
  d1Revealed: boolean;
  /** d2-PPs + finaler Saison-Rang sichtbar (Disziplin 2 abgeschlossen). */
  d2Revealed: boolean;
  teamMetaById: Map<string, MatchdayPanelTeamMeta>;
  ownTeamId: string | null;
  onOpenTeam?: ((teamId: string) => void) | null;
  onHoverTeam?: ((teamId: string | null) => void) | null;
  /** Mutator-PP (0,3er) je Team, spielergenau — separat vom Team-PP ausgewiesen. */
  mutatorByTeam?: Map<string, MatchdayPanelMutatorEntry> | null;
  /**
   * Eingesetzte Spieler je Team und Disziplin-Seite, nach PP absteigend. Speist die
   * ausklappbaren Disziplin-Spalten. Fehlt die Prop, bleiben die Spaltenköpfe reine
   * Beschriftung (kein Aufklappen).
   */
  playersByTeam?: Map<string, { d1: MatchdayPanelPlayerRow[]; d2: MatchdayPanelPlayerRow[] }> | null;
  /**
   * Womit ein Team in den Spieltag gegangen ist: Captain gesetzt (ja/nein) und die
   * eingesetzten Formkarten je Disziplin-Seite. Werte stammen 1:1 aus der Resolve-
   * Preview — die Wertung zeigt also das, was tatsaechlich angewandt wurde.
   */
  modifiersByTeam?: Map<string, MatchdayTeamModifiers> | null;
};

// Farbe der Form-Chips nach Richtung: positiv gruen, negativ rot, sonst neutral. Genau
// diese Richtung ist die Aussage — z. B. "Team ging mit negativer Form in eine Diszi,
// in der es eigentlich fuehrt".
const FORM_TONE_COLOR: Record<MatchdayFormTone, string> = {
  positive: "var(--nl-good)",
  negative: "var(--nl-risk)",
  neutral: "var(--nl-mut)",
  none: "var(--nl-mut)",
};

/** Captain- und Form-Chips einer Disziplin-Seite (nur was gesetzt war wird gezeigt). */
function SideModifierChips({ side, label }: { side: MatchdayTeamSideModifiers | null; label: string }) {
  if (side == null || (!side.captainUsed && side.formCardLabel == null)) return null;
  const title = `${label} — ${describeMatchdaySideModifiers(side)}`;
  const chip = {
    flex: "none" as const,
    fontSize: 9,
    fontWeight: 800,
    borderRadius: 5,
    padding: "0 4px",
    whiteSpace: "nowrap" as const,
    lineHeight: "14px",
  };
  return (
    <span title={title} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span style={{ ...chip, fontSize: 8.5, color: "var(--nl-mut)" }}>{label}</span>
      {side.captainUsed ? (
        <span
          style={{
            ...chip,
            color: "var(--nl-gold)",
            background: "color-mix(in srgb, var(--nl-gold) 14%, transparent)",
            border: "1px solid color-mix(in srgb, var(--nl-gold) 45%, transparent)",
          }}
        >
          © {side.captainName ?? "Captain"}
        </span>
      ) : null}
      {side.formCardLabel != null ? (
        <span
          style={{
            ...chip,
            color: FORM_TONE_COLOR[side.formTone],
            background: `color-mix(in srgb, ${FORM_TONE_COLOR[side.formTone]} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${FORM_TONE_COLOR[side.formTone]} 40%, transparent)`,
          }}
        >
          {side.formCardLabel}
        </span>
      ) : null}
    </span>
  );
}

function ppText(value: number | null): string {
  if (value == null) return "–";
  if (Math.abs(value) < 0.05) return "0";
  return `+${value.toFixed(1)}`;
}

// Header, Team-Zeilen UND Disziplin-Zeilen teilen sich EXAKT dieses Raster (sonst driften
// die Spalten gegeneinander).
/**
 * Neun Spalten: Rang · S-Rang · Wappen · Team · Punkte · Form · Captain · Mutator · Gesamt.
 *
 * Die beiden Disziplin-Spalten sind entfallen. Sie zeigten dieselbe Aufteilung, die
 * darunter ohnehin als Spieler-Gruppen je Seite stand — zwei parallele Achsen fuer
 * denselben Sachverhalt. Jetzt traegt die Team-Zeile die Summe und darunter steht je
 * Disziplin eine eigene Zeile mit denselben Groessen.
 *
 * Captain steht direkt hinter Form, weil beides dieselbe Frage beantwortet: was hat das
 * Team an eigenen Entscheidungen in diese Disziplin gelegt. Genau das war sonst nur als
 * Chip am Teamnamen zu sehen — man sah DASS ein Captain gesetzt war, aber nicht, was er
 * gebracht hat. Bei einem Team mit Captain UND negativer Formkarte liest sich das ohne
 * Zahlen widerspruechlich.
 *
 * Die Breiten sind so gewaehlt, dass die Kopf-Beschriftung samt Sortierpfeil in EINE
 * Zeile passt: "◆ MUTATOR ▼" ist in Versalien mit Sperrung das laengste Label und ist an
 * 80 px umgebrochen — die Raute rutschte auf eine eigene Zeile und schob das Wort nach
 * unten, wodurch die vier Koepfe nicht mehr auf einer Linie standen.
 *
 * Das Wappen hat eine EIGENE Spalte, weil es ueber den ganzen Team-Block laeuft
 * (Team-Zeile + Disziplin-Zeilen). Steckte es wie vorher in der Team-Spalte, koennte es
 * nur so hoch werden wie die erste Zeile.
 */
const PANEL_GRID_COLUMNS = "56px 112px 56px 1fr 70px 76px 78px 92px 84px";

/** Spaltenindizes (1-basiert) — die Zellen des Team-Blocks werden explizit gesetzt. */
const COL = {
  rank: 1,
  seasonRank: 2,
  crest: 3,
  team: 4,
  points: 5,
  form: 6,
  captain: 7,
  mutator: 8,
  total: 9,
} as const;

/**
 * Das Wappen fuellt die Hoehe des Team-Blocks — gedeckelt.
 *
 * Ohne `maxHeight` waechst es mit: sobald die Spieler-Chips umbrechen (schmales Fenster,
 * grosser Kader), wird aus dem Wappen ein meterhoher Balken. `contain` statt `cover`,
 * damit ein quadratisches Wappen nicht oben und unten abgeschnitten wird.
 */
const CREST_STYLE = {
  width: "100%",
  height: "100%",
  minHeight: 22,
  maxHeight: 66,
  borderRadius: 6,
  background: "var(--nl-bg)",
} as const;

// Rang-Badge (klein, tabellarisch) — Gold/Silber/Bronze für die Top-3, gleiche
// Farbsprache wie die Arena-Leiter (warn/mut/Bronze-rgb, dezent hinterlegt).
function RankBadge({ rank, dim }: { rank: number | null; dim?: boolean }) {
  const medal = rank === 1 ? "var(--nl-gold)" : rank === 2 ? "var(--nl-silver)" : rank === 3 ? "var(--nl-bronze)" : null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 26,
        height: 22,
        padding: "0 6px",
        borderRadius: 6,
        fontSize: 12.5,
        fontWeight: 900,
        fontVariantNumeric: "tabular-nums",
        color: medal ?? "var(--nl-ink)",
        background: medal ? `color-mix(in srgb, ${medal} 16%, transparent)` : "var(--nl-bg)",
        border: `1px solid ${medal ?? "var(--nl-line)"}`,
        opacity: dim ? 0.55 : 1,
      }}
    >
      {rank == null ? "–" : rank}
    </span>
  );
}

/** Sortierbare Spalten der Spieltags-Wertung. */
export type MatchdayPanelSortKey =
  | "matchday"
  | "season"
  | "team"
  | "d1"
  | "d2"
  | "sum"
  | "form"
  | "captain"
  | "mutator"
  | "total";

export type MatchdayPanelSort = { key: MatchdayPanelSortKey; dir: "asc" | "desc" };

/**
 * Standard-Sortierung: das SPIELTAGSERGEBNIS (Gesamt-Spalte), absteigend.
 *
 * Bewusst nicht der Saison-Rang: das Panel heisst "Spieltags-Wertung" und beantwortet die
 * Frage "wer war heute gut". Der Saison-Rang steht als eigene Spalte daneben und laesst
 * sich per Klick zur Sortierung machen.
 */
export const MATCHDAY_PANEL_DEFAULT_SORT: MatchdayPanelSort = { key: "total", dir: "desc" };

type SortableRow = {
  teamId: string;
  teamName: string;
  currentRank: number | null;
  projectedRank: number | null;
  d1Pts: number | null;
  d2Pts: number | null;
  sum: number;
  mutPp: number;
  /**
   * Formkarten-Beitrag der AUFGEDECKTEN Disziplinen, summiert. Bewusst eine eigene
   * Spalte statt nur der Chips am Teamnamen: nur so laesst sich die Tabelle danach
   * ordnen und die Frage beantworten, ob der Kartensatz an diesem Spieltag gepasst
   * hat. Der Wert ist bereits in den Disziplin-Punkten enthalten — er wird hier
   * nicht addiert, sondern nur ausgewiesen.
   */
  formPp: number;
  captainPp: number;
  total: number;
};

/** Vergleichswert einer Spalte. Fehlende Zahlen sortieren immer ans Ende (nie nach vorn). */
function sortValue(row: SortableRow, key: MatchdayPanelSortKey): number | string {
  switch (key) {
    case "season":
      return row.projectedRank ?? row.currentRank ?? Number.POSITIVE_INFINITY;
    case "team":
      return row.teamName;
    case "d1":
      return row.d1Pts ?? Number.NEGATIVE_INFINITY;
    case "d2":
      return row.d2Pts ?? Number.NEGATIVE_INFINITY;
    case "sum":
      return row.sum;
    case "mutator":
      return row.mutPp;
    case "form":
      return row.formPp;
    case "captain":
      return row.captainPp;
    case "matchday":
    case "total":
    default:
      return row.total;
  }
}

/**
 * Reihenfolge der Spieltags-Wertung (in-place, wie `Array.sort`).
 *
 * Frueher fest verdrahtet: bei verdeckter Disziplin 2 nach der Gesamt-Spalte, sonst nach dem
 * projizierten Saison-Rang. Beides ohne Zutun des Spielers — und der zweite Fall liess die
 * Tabelle wie die Saisontabelle aussehen, obwohl sie den Spieltag zeigt.
 *
 * Jetzt bestimmt `sort` die Spalte, Standard ist das Spieltagsergebnis
 * (MATCHDAY_PANEL_DEFAULT_SORT). Rang-Spalten sortieren aufsteigend "gut zuerst" (Rang 1
 * oben), Punkte-Spalten absteigend — die Richtung steckt in `dir` und wird vom Aufrufer
 * beim Spaltenklick umgeschaltet.
 *
 * Gleichstand faellt auf die Gesamt-Spalte und dann auf den Teamnamen zurueck, damit die
 * Reihenfolge stabil bleibt und nicht bei jedem Render springt.
 */
export function sortMatchdayPanelRows<T extends SortableRow>(rows: T[], sort: MatchdayPanelSort = MATCHDAY_PANEL_DEFAULT_SORT): T[] {
  const factor = sort.dir === "asc" ? 1 : -1;
  return rows.sort((left, right) => {
    const a = sortValue(left, sort.key);
    const b = sortValue(right, sort.key);
    const primary =
      typeof a === "string" || typeof b === "string"
        ? String(a).localeCompare(String(b), "de-DE") * (sort.dir === "asc" ? 1 : -1)
        : (a as number) < (b as number)
          ? -1 * factor
          : (a as number) > (b as number)
            ? 1 * factor
            : 0;
    if (primary !== 0) return primary;
    if (right.total !== left.total) return right.total - left.total;
    return left.teamName.localeCompare(right.teamName, "de-DE");
  });
}

export function resolveMatchdayRanks<T extends { teamId: string; total: number }>(rows: T[]): Map<string, number> {
  const ranks = new Map<string, number>();
  const sorted = [...rows].sort((left, right) => right.total - left.total);
  let lastTotal: number | null = null;
  let lastRank = 0;
  sorted.forEach((row, index) => {
    const rank = lastTotal != null && row.total === lastTotal ? lastRank : index + 1;
    ranks.set(row.teamId, rank);
    lastTotal = row.total;
    lastRank = rank;
  });
  return ranks;
}

export function resolveProjectedRanksFromMatchday<
  T extends { teamId: string; currentPoints: number | null; sum: number; projectedRank: number | null },
>(rows: T[]): Map<string, number> {
  const projected = rows
    .map((row) => ({
      teamId: row.teamId,
      points: row.currentPoints != null && Number.isFinite(row.currentPoints) ? row.currentPoints + row.sum : null,
    }))
    .filter((entry): entry is { teamId: string; points: number } => entry.points != null);

  const ranks = new Map<string, number>();
  const sorted = [...projected].sort((left, right) => right.points - left.points);
  let lastPoints: number | null = null;
  let lastRank = 0;
  sorted.forEach((entry, index) => {
    const rank = lastPoints != null && entry.points === lastPoints ? lastRank : index + 1;
    ranks.set(entry.teamId, rank);
    lastPoints = entry.points;
    lastRank = rank;
  });
  return ranks;
}

export default function DisciplineStageMatchdayPanel({
  teamResults,
  standings,
  d1,
  d2,
  d1Revealed,
  d2Revealed,
  teamMetaById,
  ownTeamId,
  onOpenTeam,
  onHoverTeam,
  mutatorByTeam,
  playersByTeam,
  modifiersByTeam,
}: DisciplineStageMatchdayPanelProps) {
  // Ausgeklappte Disziplin-Spalte (null = keine). Hook steht vor jedem fruehen Return.
  // `null` heisst hier "noch nichts angefasst" — dann entscheidet `autoExpandedSide` unten.
  // Erst ein Klick auf einen Spaltenkopf macht die Wahl explizit (`expandTouched`).
  const [expandedSide, setExpandedSide] = useState<"d1" | "d2" | null>(null);
  const [expandTouched, setExpandTouched] = useState(false);
  // Sortierung der Tabelle. Standard ist das SPIELTAGSERGEBNIS, nicht der Saison-Rang —
  // das Panel beantwortet die Frage "wer war heute gut".
  const [tableSort, setTableSort] = useState<MatchdayPanelSort>(MATCHDAY_PANEL_DEFAULT_SORT);
  const resultByTeam = new Map(teamResults.map((r) => [r.teamId, r]));

  // Zeilen aus den Standings ableiten (haben current/projected Rank + Punkte). PPs je
  // Disziplin werden korrekt auf d1/d2 gemappt — die Resolve-Preview liefert je Team
  // d1DisciplineId/d2DisciplineId, sodass die richtige Spalte gefüllt wird, egal in
  // welcher Reihenfolge die Engine sie ablegt.
  const rows = standings.map((s) => {
    const res = resultByTeam.get(s.teamId);
    const d1Pts = res ? (res.d1DisciplineId === d1?.disciplineId ? res.d1Points : res.d2DisciplineId === d1?.disciplineId ? res.d2Points : null) : null;
    const d2Pts = res ? (res.d1DisciplineId === d2?.disciplineId ? res.d1Points : res.d2DisciplineId === d2?.disciplineId ? res.d2Points : null) : null;
    // Spieltags-Summe + Mutator-PP: nur die AUFGEDECKTEN Disziplinen zählen. Beides wird
    // hier statt erst im Row-Render bestimmt, damit die Sortierung denselben Wert nutzt,
    // der später in der Gesamt-Spalte steht (Anzeige == Sortierschlüssel).
    const sum = (d1Revealed ? d1Pts ?? 0 : 0) + (d2Revealed ? d2Pts ?? 0 : 0);
    const mut = mutatorByTeam?.get(s.teamId);
    const mutPp = (d1Revealed ? mut?.d1Pp ?? 0 : 0) + (d2Revealed ? mut?.d2Pp ?? 0 : 0);
    // Formkarten-Beitrag der aufgedeckten Seiten. Gleiche Aufdeck-Regel wie bei
    // Punkten und Mutator — eine verdeckte Disziplin darf hier nichts verraten.
    const mods = modifiersByTeam?.get(s.teamId);
    const formPp =
      (d1Revealed ? mods?.d1?.formModifier ?? 0 : 0) + (d2Revealed ? mods?.d2?.formModifier ?? 0 : 0);
    // Captain-Beitrag der aufgedeckten Seiten — dieselbe Aufdeck-Regel wie bei Punkten,
    // Form und Mutator. `captainBonus` ist null, wenn kein Captain in dieser Diszi stand.
    const captainPp =
      (d1Revealed ? mods?.d1?.captainBonus ?? 0 : 0) + (d2Revealed ? mods?.d2?.captainBonus ?? 0 : 0);
    return {
      teamId: s.teamId,
      teamName: teamMetaById.get(s.teamId)?.name ?? teamMetaById.get(s.teamId)?.code ?? s.teamId,
      currentRank: s.currentRank,
      projectedRank: s.projectedRank,
      currentPoints: s.currentPoints,
      pointsDelta: s.pointsDelta,
      projectedPoints: s.projectedPoints,
      d1Pts,
      d2Pts,
      sum,
      mutPp,
      formPp,
      captainPp,
      total: sum + mutPp,
      // Dieselben vier Groessen NOCH EINMAL je Disziplin — daraus baut die Ansicht die
      // Zeilen unter dem Team. Die Team-Zeile bleibt die Summe, die Disziplin-Zeilen
      // zeigen, woher sie kommt. Verdeckte Seiten liefern null statt 0: "noch nicht
      // aufgedeckt" ist etwas anderes als "null Punkte".
      bySide: {
        d1: {
          points: d1Revealed ? d1Pts ?? 0 : null,
          form: d1Revealed ? mods?.d1?.formModifier ?? 0 : null,
          captain: d1Revealed ? mods?.d1?.captainBonus ?? 0 : null,
          mutator: d1Revealed ? mut?.d1Pp ?? 0 : null,
          total: d1Revealed ? (d1Pts ?? 0) + (mut?.d1Pp ?? 0) : null,
        },
        d2: {
          points: d2Revealed ? d2Pts ?? 0 : null,
          form: d2Revealed ? mods?.d2?.formModifier ?? 0 : null,
          captain: d2Revealed ? mods?.d2?.captainBonus ?? 0 : null,
          mutator: d2Revealed ? mut?.d2Pp ?? 0 : null,
          total: d2Revealed ? (d2Pts ?? 0) + (mut?.d2Pp ?? 0) : null,
        },
      },
      missingLineup: res?.missingLineup ?? false,
    };
  });

  // Fehlt die gespeicherte Projektion (Spieltag noch nicht übernommen), aus den
  // Arena-Ergebnissen ableiten — sonst stünde überall „–" und die Sortierung fiele
  // auf die Eingangsreihenfolge zurück.
  // Tagesrang aus der Gesamt-Spalte — unabhaengig von der Saison-Tabelle.
  const matchdayRanks = resolveMatchdayRanks(rows);
  const derivedProjectedRanks = resolveProjectedRanksFromMatchday(rows);
  for (const row of rows) {
    if (row.projectedRank == null) {
      row.projectedRank = derivedProjectedRanks.get(row.teamId) ?? null;
    }
  }

  sortMatchdayPanelRows(rows, tableSort);

  // Ausgeklappte Disziplin-Spalte (null = keine). Bewusst nur EINE zur Zeit: zwei
  // gleichzeitig aufgeklappte Spalten verdoppeln die Zeilenhoehe und man verliert den
  // Vergleich zwischen den Teams, um den es hier geht.
  const expandable = playersByTeam != null;
  const sideRevealed: Record<"d1" | "d2", boolean> = { d1: d1Revealed, d2: d2Revealed };

  /**
   * Die eingesetzten Spieler mit ihren PP sind der interessanteste Teil der Tabelle —
   * sie waren aber hinter einem Klick auf den Spaltenkopf versteckt und standardmaessig
   * zugeklappt, sodass die Spalte schlicht nicht existent wirkte. Jetzt klappt die zuletzt
   * gewertete Disziplin von selbst auf (d2, sobald aufgedeckt, sonst d1). Der Spaltenkopf
   * bleibt der Umschalter: sobald man ihn einmal benutzt, gilt ausschliesslich die eigene
   * Wahl — auch das bewusste Zuklappen.
   */
  const autoExpandedSide: "d1" | "d2" | null = d2Revealed ? "d2" : d1Revealed ? "d1" : null;
  const openSide: "d1" | "d2" | null = expandTouched ? expandedSide : expandable ? autoExpandedSide : null;

  /**
   * WELCHE Disziplinen unter der Teamzeile stehen.
   *
   * Der Kopf-Chevron bleibt der Umschalter: hat man ihn einmal benutzt, gilt
   * ausschliesslich die eigene Wahl (genau eine Seite, oder bewusst zugeklappt).
   *
   * Ohne eigene Wahl standen bisher nur die Spieler der ZULETZT gewerteten
   * Disziplin da — nach D2 war D1 damit unsichtbar, obwohl beide Disziplinen in
   * dieselbe Spieltags-Summe eingehen. Im Default zeigt die Tabelle deshalb jetzt
   * ALLE aufgedeckten Seiten, D1 oben, D2 darunter, jede mit ihrem
   * Disziplin-Namen davor. Verdeckte Seiten bleiben weg — das waere ein Spoiler.
   */
  const openSides: Array<"d1" | "d2"> = expandTouched
    ? openSide
      ? [openSide]
      : []
    : expandable
      ? (["d1", "d2"] as const).filter((side) => sideRevealed[side])
      : [];

  // Liga-Vergleichspool je Seite fuer die Heat-Faerbung der Spieler-PP: verglichen wird
  // gegen ALLE eingesetzten Spieler dieser Disziplin, nicht nur gegen die des eigenen
  // Teams — sonst waere der beste Spieler jedes Teams automatisch gruen.
  const ppPoolBySide: Record<"d1" | "d2", number[]> = { d1: [], d2: [] };
  if (playersByTeam) {
    for (const sides of playersByTeam.values()) {
      for (const key of ["d1", "d2"] as const) {
        for (const entry of sides[key]) {
          if (entry.pp != null && Number.isFinite(entry.pp)) ppPoolBySide[key].push(entry.pp);
        }
      }
    }
  }

  if (rows.length === 0) return null;

  const colHead: React.CSSProperties = {
    fontSize: 10.5,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--nl-mut)",
    fontWeight: 800,
    textAlign: "right",
  };
  const lockCell = (
    <span style={{ color: "var(--nl-mut)", fontWeight: 800 }} title="Erst nach Disziplin 2 — kein Spoiler">
      🔒
    </span>
  );

  /**
   * Spaltenkopf als Sortier-Schalter. Erneuter Klick auf dieselbe Spalte dreht die Richtung.
   * Rang-Spalten starten aufsteigend (Rang 1 oben), Zahlen-Spalten absteigend (viel oben) —
   * beim ersten Klick also gleich die Leserichtung, die man erwartet.
   */
  const sortButton = (key: MatchdayPanelSortKey, label: string, title: string, align: "left" | "right" = "right") => {
    const active = tableSort.key === key;
    const defaultDir: "asc" | "desc" = key === "season" || key === "matchday" || key === "team" ? "asc" : "desc";
    return (
      <button
        type="button"
        title={`${title} — nach dieser Spalte sortieren`}
        aria-sort={active ? (tableSort.dir === "asc" ? "ascending" : "descending") : "none"}
        onClick={() =>
          setTableSort((current) =>
            current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir },
          )
        }
        style={{
          ...colHead,
          textAlign: align,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          font: "inherit",
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          // Ohne `nowrap` bricht die laengste Beschriftung ("◆ MUTATOR ▼") in ihrer Spalte
          // um: die Raute landet auf einer eigenen Zeile und schiebt das Wort nach unten —
          // die Zahlenspalten-Koepfe standen dadurch nicht mehr auf einer Linie.
          whiteSpace: "nowrap",
          color: active ? "var(--nl-accent)" : "var(--nl-mut)",
        }}
      >
        {label}
        {active ? (tableSort.dir === "asc" ? " ▲" : " ▼") : ""}
      </button>
    );
  };

  return (
    <div style={{ background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800 }}>
          Spieltags-Wertung · Saisonstand
        </div>
        <div style={{ fontSize: 11.5, color: "var(--nl-mut)" }}>
          Rang <b style={{ color: "var(--nl-ink)" }}>vor</b> → <b style={{ color: "var(--nl-ink)" }}>nach</b> dem Spieltag · beide Disziplinen gemeinsam gewertet · <span style={{ color: "var(--nl-warn)" }}>◆ Mutator-PP</span> dem Spieler gutgeschrieben
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        {/* Untergrenze angehoben (720 → 880): die Spieler-Chips teilen sich die
            Team-Spalte jetzt mit dem Disziplin-Label. Darunter blieben davon keine 100 px
            uebrig und jeder Chip stand auf einer eigenen Zeile. */}
        <div style={{ minWidth: 960 }}>
          {/* Kopfzeile */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: PANEL_GRID_COLUMNS,
              gap: 10,
              alignItems: "center",
              padding: "6px 10px",
              borderBottom: "1px solid var(--nl-line)",
            }}
          >
            {/* Kurze Beschriftungen: "Spieltag"/"Saison-Rang" waren fuer die
                Spaltenbreiten zu lang und ueberlappten sich im Kopf. */}
            {sortButton("matchday", "Rang", "Platzierung nur nach der Leistung dieses Spieltags", "left")}
            {sortButton("season", "S-Rang", "Saison-Rang vor dem Spieltag → projizierter Rang danach", "left")}
            {/* Wappen-Spalte — im Kopf ohne Beschriftung. */}
            <div />
            {/* Team-Spalte traegt jetzt auch die Disziplin-Schalter: die eigenen
                Disziplin-SPALTEN sind entfallen, das Sortieren nach einer einzelnen
                Disziplin soll aber bleiben. Der Pfeil klappt die Spieler der Seite auf. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
              {sortButton("team", "Team", "Teamname", "left")}
              {(["d1", "d2"] as const).map((side) => {
                const disc = side === "d1" ? d1 : d2;
                const label = disc?.displayName ?? (side === "d1" ? "Diszi 1" : "Diszi 2");
                if (!sideRevealed[side]) {
                  return (
                    <span key={side} style={{ fontSize: 10.5, color: "var(--nl-mut-2)" }} title={label}>
                      {label} 🔒
                    </span>
                  );
                }
                const isOpen = openSides.includes(side);
                const otherSide = side === "d1" ? "d2" : "d1";
                return (
                  <span key={side} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    {sortButton(side, label, `${label} — nach den Punkten dieser Disziplin sortieren`, "left")}
                    {expandable ? (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => {
                          setExpandTouched(true);
                          // Stehen BEIDE Seiten offen (Default), nimmt ein Klick nur diese
                          // eine weg und laesst die andere stehen.
                          if (isOpen) {
                            setExpandedSide(openSides.length > 1 && sideRevealed[otherSide] ? otherSide : null);
                            return;
                          }
                          setExpandedSide(side);
                        }}
                        title={`Spieler mit ihren PP ${isOpen ? "einklappen" : "aufklappen"}`}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          fontSize: 10,
                          lineHeight: 1,
                          color: isOpen ? "var(--nl-accent)" : "var(--nl-mut-2)",
                        }}
                      >
                        {isOpen ? "▾" : "▸"}
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
            {sortButton("sum", "Punkte", "Spieltags-Punkte je Rang (Disziplin 1 + Disziplin 2)")}
            {sortButton(
              "form",
              "Form",
              "Beitrag der eingesetzten Formkarten in den aufgedeckten Disziplinen. Bereits in den Disziplin-Punkten enthalten — hier nur ausgewiesen, damit sichtbar ist, ob der Kartensatz gepasst hat. Die gespielten Karten stehen als Chips am Teamnamen.",
            )}
            {sortButton(
              "captain",
              "Captain",
              "Beitrag des eingesetzten Captains in den aufgedeckten Disziplinen. Wie die Form bereits in den Disziplin-Punkten enthalten — hier ausgewiesen, damit sichtbar ist, was die Captain-Entscheidung gebracht hat. Steht kein Captain in der Diszi, bleibt die Zelle leer.",
            )}
            {sortButton("mutator", "◆ Mutator", "Mutator-Bonus-PP (0,3er) — dem Spieler gutgeschrieben, separat vom Team-PP")}
            {sortButton("total", "Gesamt", "Gesamt = Spieltags-Punkte + Mutator-Bonus")}
          </div>

          {/* Zeilen */}
          {rows.map((row) => {
            const meta = teamMetaById.get(row.teamId);
            const isOwn = row.teamId === ownTeamId;
            const accent = floorTeamAccent(teamPrimaryColor(meta?.code));
            // Rang-Δ (vor → nach) nur zeigen, wenn der finale Rang aufgedeckt ist.
            const rankDelta = d2Revealed && row.currentRank != null && row.projectedRank != null ? row.currentRank - row.projectedRank : null;
            // Spieltags-Summe, Mutator-PP und Gesamt kommen aus der Zeile (oben berechnet),
            // damit die Gesamt-Spalte exakt der Sortierschlüssel ist.
            const { sum, mutPp, total } = row;
            // Eine Zeile je AUFGEDECKTER Disziplin — sie traegt links die eingesetzten
            // Spieler und rechts die Aufschluesselung der Punkte. Vorher waren das zwei
            // getrennte Zeilen uebereinander: eine mit den Zahlen, eine mit den Chips.
            // Dieselbe Disziplin zweimal untereinander zu lesen war die Doppelung.
            //
            // Die Zahlen haengen NICHT am Aufklappen (der Pfeil steuert nur die Chips),
            // die Zeile steht also auch eingeklappt.
            const openSideRows = (["d1", "d2"] as const)
              .filter((side) => sideRevealed[side])
              .map((side) => ({
                side,
                players: openSides.includes(side) ? playersByTeam?.get(row.teamId)?.[side] ?? [] : [],
              }));
            const sumShown = d1Revealed || d2Revealed;
            // Tagesrang erst zeigen, wenn ueberhaupt etwas gewertet ist — sonst waere er
            // eine erfundene Reihenfolge auf lauter Nullen.
            const matchdayRank = sumShown ? matchdayRanks.get(row.teamId) ?? null : null;
            const mut = mutatorByTeam?.get(row.teamId);
            const mutPlayers = [...(d1Revealed ? mut?.d1Players ?? [] : []), ...(d2Revealed ? mut?.d2Players ?? [] : [])];
            const hasMut = mutPp > 0.0001;
            const mutatorTitle = hasMut
              ? mutPlayers.map((p) => `${p.name} +${p.pp.toFixed(1)} PP`).join(" · ")
              : "Kein Mutator-Bonus in den aufgedeckten Disziplinen.";
            // Zeile 1 ist das Team, danach je Disziplin eine — das Wappen laeuft ueber alle.
            const blockRowCount = 1 + openSideRows.length;
            return (
              <div
                key={row.teamId}
                onClick={() => {
                  if (onOpenTeam && row.teamId) onOpenTeam(row.teamId);
                }}
                onMouseEnter={() => {
                  if (onHoverTeam && row.teamId) onHoverTeam(row.teamId);
                }}
                onMouseLeave={() => {
                  if (onHoverTeam) onHoverTeam(null);
                }}
                style={{
                  display: "grid",
                  gridTemplateColumns: PANEL_GRID_COLUMNS,
                  columnGap: 10,
                  // Kein Zeilenabstand: die Disziplin-Zeilen sollen als Fortsetzung des
                  // Teams lesen, nicht als eigene Eintraege.
                  rowGap: 0,
                  alignItems: "center",
                  padding: "7px 10px",
                  borderBottom: "1px solid var(--nl-line)",
                  cursor: onOpenTeam ? "pointer" : "default",
                  background: isOwn ? "color-mix(in srgb, var(--nl-accent) 12%, transparent)" : "transparent",
                  borderLeft: isOwn ? "3px solid var(--nl-accent)" : "3px solid transparent",
                  borderRadius: isOwn ? 6 : 0,
                }}
              >
                {/* Tagesrang — nur die Leistung DIESES Spieltags. */}
                <div
                  title={`Spieltags-Rang ${matchdayRank ?? "–"} — nur nach der Leistung dieses Spieltags`}
                  style={{ gridColumn: COL.rank, gridRow: 1, display: "flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}
                >
                  <RankBadge rank={matchdayRank} />
                </div>

                {/* Saison-Rang vor → nach */}
                <div style={{ gridColumn: COL.seasonRank, gridRow: 1, display: "flex", alignItems: "center", gap: 4, fontVariantNumeric: "tabular-nums" }}>
                  <RankBadge rank={row.currentRank} dim={d2Revealed} />
                  {d2Revealed ? (
                    <>
                      <span style={{ color: "var(--nl-mut)", fontSize: 11 }}>→</span>
                      <RankBadge rank={row.projectedRank} />
                      {/* Rang-Aenderung gehoert neben den Rang, nicht neben den Teamnamen —
                          sie beschreibt schliesslich den Rang. */}
                      {rankDelta != null && rankDelta !== 0 ? (
                        <span
                          title={`${rankDelta > 0 ? "Plätze gutgemacht" : "Plätze verloren"}: ${Math.abs(rankDelta)}`}
                          style={{
                            fontSize: 11.5,
                            fontWeight: 900,
                            fontVariantNumeric: "tabular-nums",
                            color: rankDelta > 0 ? "var(--nl-good)" : "var(--nl-risk)",
                          }}
                        >
                          {rankDelta > 0 ? `▲${rankDelta}` : `▼${Math.abs(rankDelta)}`}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>

                {/* Wappen — laeuft ueber den GANZEN Team-Block (Team-Zeile + Disziplin-
                    Zeilen). `contain` statt `cover`: bei dieser Hoehe wuerde `cover` einem
                    quadratischen Wappen oben und unten die Haelfte abschneiden. */}
                <div
                  style={{
                    gridColumn: COL.crest,
                    gridRow: `1 / span ${blockRowCount}`,
                    alignSelf: "stretch",
                    display: "flex",
                    alignItems: "center",
                    padding: "1px 0",
                    // Ueber der Toenung der Disziplin-Zeilen, nicht darunter: die liegt
                    // spaeter im DOM und wuerde dem Wappen sonst die unteren zwei Drittel
                    // einfaerben.
                    zIndex: 1,
                  }}
                >
                  {meta?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={meta.logoUrl}
                      alt=""
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                      style={{ ...CREST_STYLE, objectFit: "contain", border: `1.5px solid ${accent}` }}
                    />
                  ) : (
                    <span aria-hidden style={{ ...CREST_STYLE, border: `1.5px solid ${accent}` }} />
                  )}
                </div>

                {/* Team */}
                <div style={{ gridColumn: COL.team, gridRow: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span
                        style={{
                          fontWeight: isOwn ? 900 : 700,
                          fontSize: 13,
                          color: isOwn ? "var(--nl-accent)" : "var(--nl-ink)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {isOwn ? "★ " : ""}
                        {meta?.name ?? meta?.code ?? row.teamId}
                      </span>
                      {meta?.name && meta?.code ? (
                        <span style={{ flex: "none", fontSize: 10.5, fontWeight: 700, color: "var(--nl-mut)" }}>{meta.code}</span>
                      ) : null}
                      {row.missingLineup ? (
                        <span
                          title="Team hat keine Aufstellung eingereicht — 0 Punkte sind kein echtes Ergebnis"
                          style={{ flex: "none", fontSize: 9.5, fontWeight: 800, color: "var(--nl-risk)", background: "color-mix(in srgb, var(--nl-risk) 16%, transparent)", border: "1px solid var(--nl-risk)", borderRadius: 6, padding: "1px 5px", whiteSpace: "nowrap" }}
                        >
                          keine Aufstellung
                        </span>
                      ) : null}
                    </div>
                    {/* Captain + Formkarten je Seite. d2 bleibt bis zur Aufdeckung
                        verborgen — die Aufstellung ist selbst ein Spoiler. */}
                    {(() => {
                      const mods = modifiersByTeam?.get(row.teamId);
                      if (!mods) return null;
                      const showD1 = d1Revealed && mods.d1 != null;
                      const showD2 = d2Revealed && mods.d2 != null;
                      if (!showD1 && !showD2) return null;
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          {showD1 ? <SideModifierChips side={mods.d1} label={d1?.displayName ?? "D1"} /> : null}
                          {showD2 ? <SideModifierChips side={mods.d2} label={d2?.displayName ?? "D2"} /> : null}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Die beiden Disziplin-Spalten sind entfallen — ihre Werte stehen jetzt in
                    den Disziplin-Zeilen unter dem Team, dort samt Form, Mutator und Gesamt. */}

                {/* Spieltags-Punkte (Σ d1 + d2, ohne Mutator) */}
                <div
                  style={{
                    gridColumn: COL.points,
                    gridRow: 1,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 800,
                    fontSize: 13,
                    color: sumShown ? "var(--nl-ink)" : "var(--nl-mut)",
                  }}
                >
                  {sumShown ? ppText(sum) : lockCell}
                </div>

                {/* Formkarten-Beitrag der aufgedeckten Seiten. Grau bei 0, damit die
                    Spalte nicht mit Nullen zuschreit; Ton nach Richtung, weil eine
                    negative Karte genauso eine Aussage ist wie eine positive. */}
                <div
                  title={
                    row.formPp === 0
                      ? "Keine Formkarte in den aufgedeckten Disziplinen"
                      : `Formkarten-Beitrag: ${row.formPp > 0 ? "+" : ""}${row.formPp.toFixed(1)} — bereits in den Disziplin-Punkten enthalten`
                  }
                  style={{
                    gridColumn: COL.form,
                    gridRow: 1,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 800,
                    fontSize: 13,
                    color:
                      row.formPp > 0.05
                        ? "var(--nl-good)"
                        : row.formPp < -0.05
                          ? "var(--nl-risk)"
                          : "var(--nl-mut)",
                  }}
                >
                  {sumShown ? (Math.abs(row.formPp) < 0.05 ? "0" : `${row.formPp > 0 ? "+" : ""}${row.formPp.toFixed(1)}`) : lockCell}
                </div>

                {/* Captain-Beitrag der aufgedeckten Seiten. Gold wie der Captain-Chip am
                    Teamnamen, damit beides als dieselbe Sache lesbar ist. Ohne gesetzten
                    Captain steht ein Strich statt einer 0 — "nicht gesetzt" ist etwas
                    anderes als "hat nichts gebracht". */}
                <div
                  title={
                    row.captainPp === 0
                      ? "Kein Captain in den aufgedeckten Disziplinen"
                      : `Captain-Beitrag: ${row.captainPp > 0 ? "+" : ""}${row.captainPp.toFixed(1)} — bereits in den Disziplin-Punkten enthalten`
                  }
                  style={{
                    gridColumn: COL.captain,
                    gridRow: 1,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 800,
                    fontSize: 13,
                    color: Math.abs(row.captainPp) > 0.05 ? "var(--nl-gold)" : "var(--nl-mut)",
                  }}
                >
                  {sumShown
                    ? Math.abs(row.captainPp) < 0.05
                      ? "–"
                      : `${row.captainPp > 0 ? "+" : ""}${row.captainPp.toFixed(1)}`
                    : lockCell}
                </div>

                {/* Mutator-Bonus (0,3er) — spielergenau, separat vom Team-PP. */}
                <div
                  title={mutatorTitle}
                  style={{
                    gridColumn: COL.mutator,
                    gridRow: 1,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 800,
                    fontSize: 13,
                    color: hasMut ? "var(--nl-warn)" : "var(--nl-mut)",
                  }}
                >
                  {sumShown ? (hasMut ? `◆ +${mutPp.toFixed(1)}` : "–") : lockCell}
                </div>

                {/* Gesamt = Spieltags-Punkte + Mutator-Bonus */}
                <div
                  style={{
                    gridColumn: COL.total,
                    gridRow: 1,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 900,
                    fontSize: 13.5,
                    color: sumShown ? "var(--nl-accent)" : "var(--nl-mut)",
                  }}
                >
                  {sumShown ? ppText(total) : lockCell}
                </div>

                {/* EINE Zeile je aufgedeckter Disziplin: links die eingesetzten Spieler,
                    rechts die Aufschluesselung derselben vier Groessen wie oben
                    (Punkte · Form · Mutator · Gesamt). Vorher standen beide untereinander —
                    dieselbe Disziplin zweimal zu lesen war die Doppelung.

                    Die Zahlen stehen immer; der Chevron im Kopf schaltet nur die
                    Spieler-Chips zu. Die PP-Zahl der Chips ist gegen ALLE Spieler der
                    Disziplin heat-gefaerbt (rot schwach → gelb Mittelfeld → gruen stark),
                    dieselbe Baender-Skala wie im Saisonstand; der Score steht daneben. */}
                {openSideRows.map(({ side, players: sidePlayers }, sideIndex) => {
                  const disc = side === "d1" ? d1 : d2;
                  const gridRow = 2 + sideIndex;
                  const values = row.bySide[side];
                  const cell = {
                    gridRow,
                    textAlign: "right" as const,
                    fontVariantNumeric: "tabular-nums" as const,
                    fontSize: 12,
                    fontWeight: 700,
                    zIndex: 1,
                  };
                  return (
                    <Fragment key={`${row.teamId}-side-${side}`}>
                      {/* Toenung als eigene, ueber alle Spalten gelegte Flaeche — sonst
                          blitzten die Spaltenabstaende durch den Zeilenhintergrund. */}
                      <div
                        aria-hidden
                        style={{
                          gridColumn: "1 / -1",
                          gridRow,
                          background: "color-mix(in srgb, var(--nl-panel-2) 50%, transparent)",
                          borderRadius: 6,
                        }}
                      />
                      <div
                        data-testid={`matchday-panel-side-${row.teamId}-${side}`}
                        style={{
                          gridColumn: COL.team,
                          gridRow,
                          zIndex: 1,
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 6,
                          minWidth: 0,
                          padding: "3px 0",
                        }}
                      >
                        <span
                          title={disc?.displayName ?? (side === "d1" ? "Disziplin 1" : "Disziplin 2")}
                          style={{
                            flex: "none",
                            display: "inline-flex",
                            alignItems: "baseline",
                            gap: 5,
                            fontSize: 11,
                            color: "var(--nl-mut)",
                          }}
                        >
                          <span style={{ fontWeight: 900, letterSpacing: "0.06em" }}>{side.toUpperCase()}</span>
                          <span>{disc?.displayName ?? (side === "d1" ? "Disziplin 1" : "Disziplin 2")}</span>
                        </span>
                        <span
                          data-testid={`matchday-panel-players-${row.teamId}-${side}`}
                          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, minWidth: 0 }}
                        >
                          {sidePlayers.map((entry) => {
                            const heat = entry.pp != null ? getPoolHeatClass(entry.pp, ppPoolBySide[side]) : "";
                            return (
                              <span
                                key={entry.playerId}
                                className={heat ? `matchday-panel-player ${heat}` : "matchday-panel-player"}
                                // `entry.pp` ist die GESAMTE Gutschrift inkl. Mutator-Aufschlag —
                                // "davon" ist hier also korrekt, seit die Summe angezeigt wird.
                                title={`${entry.name} · ${entry.pp != null ? `${entry.pp.toFixed(1)} PP` : "keine PP"}${
                                  entry.score != null ? ` · Score ${entry.score.toFixed(1)}` : ""
                                }${entry.mutatorPp ? ` · davon ◆ ${entry.mutatorPp.toFixed(1)} Mutator` : ""}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "baseline",
                                  gap: 5,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  border: "1px solid var(--nl-line)",
                                  fontSize: 11.5,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                <strong style={{ fontWeight: 700 }}>{entry.name}</strong>
                                <em style={{ fontStyle: "normal", fontWeight: 900, color: "var(--nl-accent)" }}>
                                  {entry.pp != null ? `${entry.pp.toFixed(1)} PP` : "–"}
                                </em>
                                {entry.score != null ? (
                                  <em style={{ fontStyle: "normal", color: "var(--nl-mut)" }}>({entry.score.toFixed(1)})</em>
                                ) : null}
                                {entry.mutatorPp ? (
                                  <em style={{ fontStyle: "normal", color: "var(--nl-warn)", fontWeight: 700 }}>◆</em>
                                ) : null}
                              </span>
                            );
                          })}
                        </span>
                      </div>
                      <div style={{ ...cell, gridColumn: COL.points, color: "var(--nl-ink)" }}>{ppText(values.points)}</div>
                      <div
                        style={{
                          ...cell,
                          gridColumn: COL.form,
                          color:
                            (values.form ?? 0) > 0.05
                              ? "var(--nl-good)"
                              : (values.form ?? 0) < -0.05
                                ? "var(--nl-risk)"
                                : "var(--nl-mut)",
                        }}
                      >
                        {values.form == null ? "–" : Math.abs(values.form) < 0.05 ? "0" : ppText(values.form)}
                      </div>
                      <div
                        style={{
                          ...cell,
                          gridColumn: COL.captain,
                          color: Math.abs(values.captain ?? 0) > 0.05 ? "var(--nl-gold)" : "var(--nl-mut)",
                        }}
                      >
                        {values.captain == null || Math.abs(values.captain) < 0.05 ? "–" : ppText(values.captain)}
                      </div>
                      <div
                        style={{
                          ...cell,
                          gridColumn: COL.mutator,
                          color: (values.mutator ?? 0) > 0.0001 ? "var(--nl-warn)" : "var(--nl-mut)",
                        }}
                      >
                        {values.mutator == null ? "–" : values.mutator > 0.0001 ? `◆ ${ppText(values.mutator)}` : "–"}
                      </div>
                      <div style={{ ...cell, gridColumn: COL.total, fontWeight: 900, color: "var(--nl-accent)" }}>
                        {ppText(values.total)}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {!d2Revealed ? (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--nl-mut)", display: "flex", alignItems: "center", gap: 6 }}>
          <span>🔒</span>
          <span>
            Disziplin 2 {d2 ? `(${d2.displayName})` : ""} und der finale Saison-Rang bleiben verdeckt, bis der Spieltag komplett ausgewertet ist – kein Spoiler.
          </span>
        </div>
      ) : null}
    </div>
  );
}
