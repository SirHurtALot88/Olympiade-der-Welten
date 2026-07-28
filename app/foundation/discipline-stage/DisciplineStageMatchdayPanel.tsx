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

// Rang · Team · Diszi 1 · Diszi 2 · Spieltag (Σ) · Mutator · Gesamt.
// Header und Datenzeilen teilen sich EXAKT dieses Raster (sonst driften die Spalten).
const PANEL_GRID_COLUMNS = "84px 1fr 78px 78px 74px 84px 88px";

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

/**
 * Reihenfolge der Spieltags-Wertung (in-place, wie `Array.sort`).
 *
 * - **d2 aufgedeckt** → nach dem projizierten Endrang; der Spieltag ist fertig gewertet.
 * - **d2 noch verdeckt** → nach der GESAMT-Spalte dieses Spieltags, absteigend.
 *
 * Vorher wurde im zweiten Fall nach dem Saison-Rang VOR dem Spieltag sortiert. Am ersten
 * Spieltag ist dieser Rang aber nur die Startreihenfolge — die Tabelle wirkte dadurch
 * ungeordnet: das Team mit +21,1 stand unter dem mit +1,8.
 *
 * Nach der Gesamt-Spalte zu sortieren verrät nichts Zusätzliches: diese Zahlen stehen bereits
 * sichtbar in der Zeile, und die verdeckte Disziplin 2 geht per Konstruktion nicht in `total`
 * ein (nur aufgedeckte Seiten werden aufsummiert). Gleichstand fällt auf den Saison-Rang
 * zurück, damit die Reihenfolge stabil bleibt.
 */
/**
 * Projizierten Rang aus den Arena-Ergebnissen ableiten, wenn die Standings-Vorschau keinen
 * liefert.
 *
 * Die Vorschau liest das GESPEICHERTE Spieltagsergebnis. Solange der Spieltag nur in der
 * Arena läuft und noch nicht übernommen wurde, gibt es keins — die Vorschau meldet dann
 * `missing_result_for_matchday` und lässt `projectedPoints`/`projectedRank` leer. In der
 * Tabelle stand dadurch überall „–", und weil die Sortierung bei aufgedeckter Disziplin 2
 * genau an `projectedRank` hängt, fiel sie zusätzlich auf die Eingangsreihenfolge zurück.
 *
 * Die Arena kennt die Ergebnisse aber bereits. Hier wird daraus gerechnet:
 * `currentPoints + Spieltags-Punkte` → absteigend sortiert → Rang. Bewusst OHNE Mutator-PP,
 * denn die werden dem Spieler gutgeschrieben und nicht der Team-Tabelle (siehe Kopfzeile
 * des Panels). Gleichstand teilt sich den Rang (beide bekommen den kleineren), damit die
 * Rang-Differenz nicht willkürlich wird.
 *
 * Greift nur, wenn ein Rang fehlt — eine vorhandene Projektion aus der Vorschau bleibt
 * unangetastet, damit die gespeicherte Wahrheit immer Vorrang hat.
 */
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

export function sortMatchdayPanelRows<T extends { total: number; currentRank: number | null; projectedRank: number | null }>(
  rows: T[],
  d2Revealed: boolean,
): T[] {
  return rows.sort((a, b) => {
    if (d2Revealed) {
      return ((a.projectedRank ?? 999) - (b.projectedRank ?? 999)) || ((a.currentRank ?? 999) - (b.currentRank ?? 999));
    }
    return (b.total - a.total) || ((a.currentRank ?? 999) - (b.currentRank ?? 999));
  });
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
  const derivedProjectedRanks = resolveProjectedRanksFromMatchday(rows);
  for (const row of rows) {
    if (row.projectedRank == null) {
      row.projectedRank = derivedProjectedRanks.get(row.teamId) ?? null;
    }
  }

  sortMatchdayPanelRows(rows, d2Revealed);

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
            <div style={{ ...colHead, textAlign: "left" }}>Rang</div>
            <div style={{ ...colHead, textAlign: "left" }}>Team</div>
            {/* Disziplin-Spaltenkoepfe sind Schalter: Klick klappt die eingesetzten Spieler
                dieser Disziplin unter jeder Team-Zeile auf (hoechste PP zuerst). Verdeckte
                Disziplinen bleiben reine Beschriftung — sonst waere die Aufklappung ein
                Spoiler. */}
            {(["d1", "d2"] as const).map((side) => {
              const disc = side === "d1" ? d1 : d2;
              const label = disc?.displayName ?? (side === "d1" ? "Diszi 1" : "Diszi 2");
              const revealed = sideRevealed[side];
              const canExpand = expandable && revealed;
              const isOpen = expandedSide === side;
              if (!canExpand) {
                return (
                  <div key={side} style={colHead} title={disc?.displayName ?? (side === "d1" ? "Disziplin 1" : "Disziplin 2")}>
                    {revealed ? label : `${label} 🔒`}
                  </div>
                );
              }
              return (
                <button
                  key={side}
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setExpandedSide(isOpen ? null : side)}
                  title={`${label} — Spieler mit ihren PP ${isOpen ? "einklappen" : "aufklappen"}`}
                  style={{
                    ...colHead,
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    font: "inherit",
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: isOpen ? "var(--nl-accent)" : "var(--nl-mut)",
                  }}
                >
                  {label} {isOpen ? "▾" : "▸"}
                </button>
              );
            })}
            <div style={colHead} title="Spieltags-Punkte je Rang (Disziplin 1 + Disziplin 2)">Spieltag</div>
            <div style={colHead} title="Mutator-Bonus-PP (0,3er) — dem Spieler gutgeschrieben, separat vom Team-PP">
              ◆ Mutator
            </div>
            <div style={colHead} title="Gesamt = Spieltags-Punkte + Mutator-Bonus">Gesamt</div>
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
                {/* Rang vor → nach */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontVariantNumeric: "tabular-nums" }}>
                  <RankBadge rank={row.currentRank} dim={d2Revealed} />
                  {d2Revealed ? (
                    <>
                      <span style={{ color: "var(--nl-mut)", fontSize: 11 }}>→</span>
                      <RankBadge rank={row.projectedRank} />
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
                        {meta?.code ?? row.teamId}
                      </span>
                      {row.missingLineup ? (
                        <span
                          title="Team hat keine Aufstellung eingereicht — 0 Punkte sind kein echtes Ergebnis"
                          style={{ flex: "none", fontSize: 9.5, fontWeight: 800, color: "var(--nl-risk)", background: "color-mix(in srgb, var(--nl-risk) 16%, transparent)", border: "1px solid var(--nl-risk)", borderRadius: 6, padding: "1px 5px", whiteSpace: "nowrap" }}
                        >
                          keine Aufstellung
                        </span>
                      ) : null}
                      {rankDelta != null && rankDelta !== 0 ? (
                        <span
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
                    padding: "6px 10px 8px 94px",
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
