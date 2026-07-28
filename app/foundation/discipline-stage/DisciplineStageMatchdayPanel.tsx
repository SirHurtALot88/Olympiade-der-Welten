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
};

function ppText(value: number | null): string {
  if (value == null) return "–";
  if (Math.abs(value) < 0.05) return "0";
  return `+${value.toFixed(1)}`;
}

// Tagesrang · Saison-Rang · Team · Diszi 1 · Diszi 2 · Spieltag (Σ) · Mutator · Gesamt.
// Header und Datenzeilen teilen sich EXAKT dieses Raster (sonst driften die Spalten).
const PANEL_GRID_COLUMNS = "58px 128px 1fr 78px 78px 74px 84px 88px";

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
}: DisciplineStageMatchdayPanelProps) {
  // Ausgeklappte Disziplin-Spalte (null = keine). Hook steht vor jedem fruehen Return.
  const [expandedSide, setExpandedSide] = useState<"d1" | "d2" | null>(null);
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
      total: sum + mutPp,
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
        <div style={{ minWidth: 720 }}>
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
            {sortButton("matchday", "Spieltag", "Platzierung nur nach der Leistung dieses Spieltags", "left")}
            {sortButton("season", "Saison-Rang", "Saison-Rang vor dem Spieltag → projizierter Rang danach", "left")}
            {sortButton("team", "Team", "Teamname", "left")}
            {/* Disziplin-Spalten: das Label sortiert nach dieser Disziplin, das Chevron daneben
                klappt die eingesetzten Spieler mit ihren PP auf. Zwei getrennte Schalter, damit
                Sortieren und Aufklappen sich nicht denselben Klick teilen. Verdeckte Disziplinen
                bleiben reine Beschriftung — beides waere dort ein Spoiler. */}
            {(["d1", "d2"] as const).map((side) => {
              const disc = side === "d1" ? d1 : d2;
              const label = disc?.displayName ?? (side === "d1" ? "Diszi 1" : "Diszi 2");
              const revealed = sideRevealed[side];
              if (!revealed) {
                return (
                  <div key={side} style={colHead} title={disc?.displayName ?? (side === "d1" ? "Disziplin 1" : "Disziplin 2")}>
                    {label} 🔒
                  </div>
                );
              }
              const isOpen = expandedSide === side;
              return (
                <div key={side} style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                  {sortButton(side, label, `${label} — Punkte dieser Disziplin`)}
                  {expandable ? (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setExpandedSide(isOpen ? null : side)}
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
                </div>
              );
            })}
            {sortButton("sum", "Punkte", "Spieltags-Punkte je Rang (Disziplin 1 + Disziplin 2)")}
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
            // Spieler der aufgeklappten Disziplin fuer dieses Team (leer, wenn nichts offen).
            const sidePlayers = expandedSide ? playersByTeam?.get(row.teamId)?.[expandedSide] ?? [] : [];
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
            return (
              <Fragment key={row.teamId}>
              <div
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
                  gap: 10,
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
                  style={{ display: "flex", alignItems: "center", fontVariantNumeric: "tabular-nums" }}
                >
                  <RankBadge rank={matchdayRank} />
                </div>

                {/* Saison-Rang vor → nach */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontVariantNumeric: "tabular-nums" }}>
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

                {/* Team */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  {meta?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={meta.logoUrl}
                      alt=""
                      width={22}
                      height={22}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                      style={{ width: 22, height: 22, borderRadius: 5, objectFit: "cover", flex: "none", border: `1.5px solid ${accent}` }}
                    />
                  ) : (
                    <span
                      aria-hidden
                      style={{ width: 22, height: 22, borderRadius: 5, flex: "none", background: "var(--nl-bg)", border: `1.5px solid ${accent}` }}
                    />
                  )}
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
                  </div>
                </div>

                {/* d1 PP */}
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, fontSize: 13, color: "var(--nl-ink)" }}>
                  {d1Revealed ? ppText(row.d1Pts) : lockCell}
                </div>

                {/* d2 PP */}
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, fontSize: 13, color: "var(--nl-ink)" }}>
                  {d2Revealed ? ppText(row.d2Pts) : lockCell}
                </div>

                {/* Spieltags-Punkte (Σ d1 + d2, ohne Mutator) */}
                <div
                  style={{
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 800,
                    fontSize: 13,
                    color: sumShown ? "var(--nl-ink)" : "var(--nl-mut)",
                  }}
                >
                  {sumShown ? ppText(sum) : lockCell}
                </div>

                {/* Mutator-Bonus (0,3er) — spielergenau, separat vom Team-PP. */}
                <div
                  title={mutatorTitle}
                  style={{
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
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 900,
                    fontSize: 13.5,
                    color: sumShown ? "var(--nl-accent)" : "var(--nl-mut)",
                  }}
                >
                  {sumShown ? ppText(total) : lockCell}
                </div>
              </div>

              {/* Aufgeklappte Disziplin: die eingesetzten Spieler dieses Teams, hoechste PP
                  zuerst. Die PP-Zahl ist gegen ALLE Spieler der Disziplin heat-gefaerbt
                  (rot schwach → gelb Mittelfeld → gruen stark), dieselbe Baender-Skala wie
                  im Saisonstand. Der Score steht als Herkunft daneben. */}
              {expandedSide && sidePlayers.length > 0 ? (
                <div
                  data-testid={`matchday-panel-players-${row.teamId}-${expandedSide}`}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    padding: "6px 10px 8px 206px",
                    borderBottom: "1px solid var(--nl-line)",
                    background: "color-mix(in srgb, var(--nl-panel-2) 60%, transparent)",
                  }}
                >
                  {sidePlayers.map((entry) => {
                    const heat = entry.pp != null ? getPoolHeatClass(entry.pp, ppPoolBySide[expandedSide]) : "";
                    return (
                      <span
                        key={entry.playerId}
                        className={heat ? `matchday-panel-player ${heat}` : "matchday-panel-player"}
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
                </div>
              ) : null}
            </Fragment>
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
