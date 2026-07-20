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

import { teamPrimaryColor, floorTeamAccent } from "@/lib/foundation/team-colors";

export type MatchdayPanelTeamResult = {
  teamId: string;
  d1DisciplineId: string | null;
  d1Points: number | null;
  d2DisciplineId: string | null;
  d2Points: number | null;
  totalPoints: number | null;
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

export type MatchdayPanelTeamMeta = { code: string; name: string; logoUrl: string | null };

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
};

function ppText(value: number | null): string {
  if (value == null) return "–";
  return `+${value}`;
}

// Rang-Badge (klein, tabellarisch) — Gold/Silber/Bronze für die Top-3, gleiche
// Farbsprache wie die Arena-Leiter (warn/mut/Bronze-rgb, dezent hinterlegt).
function RankBadge({ rank, dim }: { rank: number | null; dim?: boolean }) {
  const medal = rank === 1 ? "var(--nl-warn)" : rank === 2 ? "var(--nl-mut)" : rank === 3 ? "rgb(205,127,50)" : null;
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
}: DisciplineStageMatchdayPanelProps) {
  const resultByTeam = new Map(teamResults.map((r) => [r.teamId, r]));

  // Zeilen aus den Standings ableiten (haben current/projected Rank + Punkte). PPs je
  // Disziplin werden korrekt auf d1/d2 gemappt — die Resolve-Preview liefert je Team
  // d1DisciplineId/d2DisciplineId, sodass die richtige Spalte gefüllt wird, egal in
  // welcher Reihenfolge die Engine sie ablegt.
  const rows = standings.map((s) => {
    const res = resultByTeam.get(s.teamId);
    const d1Pts = res ? (res.d1DisciplineId === d1?.disciplineId ? res.d1Points : res.d2DisciplineId === d1?.disciplineId ? res.d2Points : null) : null;
    const d2Pts = res ? (res.d1DisciplineId === d2?.disciplineId ? res.d1Points : res.d2DisciplineId === d2?.disciplineId ? res.d2Points : null) : null;
    return {
      teamId: s.teamId,
      currentRank: s.currentRank,
      projectedRank: s.projectedRank,
      pointsDelta: s.pointsDelta,
      projectedPoints: s.projectedPoints,
      d1Pts,
      d2Pts,
    };
  });

  // Sortierung: solange d2 verdeckt ist, nach Saison-Rang VOR dem Spieltag (kein Spoiler
  // durch die projizierte Reihenfolge). Ist d2 aufgedeckt, nach dem projizierten Endrang.
  rows.sort((a, b) => {
    const ra = (d2Revealed ? a.projectedRank : a.currentRank) ?? 999;
    const rb = (d2Revealed ? b.projectedRank : b.currentRank) ?? 999;
    return ra - rb;
  });

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
          Rang <b style={{ color: "var(--nl-ink)" }}>vor</b> → <b style={{ color: "var(--nl-ink)" }}>nach</b> dem Spieltag · beide Disziplinen gemeinsam gewertet
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 560 }}>
          {/* Kopfzeile */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "88px 1fr 96px 96px 74px",
              gap: 10,
              alignItems: "center",
              padding: "6px 10px",
              borderBottom: "1px solid var(--nl-line)",
            }}
          >
            <div style={{ ...colHead, textAlign: "left" }}>Rang</div>
            <div style={{ ...colHead, textAlign: "left" }}>Team</div>
            <div style={colHead} title={d1?.displayName ?? "Disziplin 1"}>
              {d1?.displayName ?? "Diszi 1"}
            </div>
            <div style={colHead} title={d2?.displayName ?? "Disziplin 2"}>
              {d2Revealed ? d2?.displayName ?? "Diszi 2" : "Diszi 2 🔒"}
            </div>
            <div style={colHead}>Σ PP</div>
          </div>

          {/* Zeilen */}
          {rows.map((row) => {
            const meta = teamMetaById.get(row.teamId);
            const isOwn = row.teamId === ownTeamId;
            const accent = floorTeamAccent(teamPrimaryColor(meta?.code));
            // Rang-Δ (vor → nach) nur zeigen, wenn der finale Rang aufgedeckt ist.
            const rankDelta = d2Revealed && row.currentRank != null && row.projectedRank != null ? row.currentRank - row.projectedRank : null;
            // Spieltags-Summe: nur die bereits aufgedeckten Disziplinen aufsummieren.
            const sum = (d1Revealed ? row.d1Pts ?? 0 : 0) + (d2Revealed ? row.d2Pts ?? 0 : 0);
            const sumShown = d1Revealed || d2Revealed;
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
                  gridTemplateColumns: "88px 1fr 96px 96px 74px",
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

                {/* d1 PP */}
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, fontSize: 13, color: "var(--nl-ink)" }}>
                  {d1Revealed ? ppText(row.d1Pts) : lockCell}
                </div>

                {/* d2 PP */}
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, fontSize: 13, color: "var(--nl-ink)" }}>
                  {d2Revealed ? ppText(row.d2Pts) : lockCell}
                </div>

                {/* Spieltags-Summe */}
                <div
                  style={{
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 900,
                    fontSize: 13.5,
                    color: sumShown ? "var(--nl-accent)" : "var(--nl-mut)",
                  }}
                >
                  {sumShown ? `+${sum}` : lockCell}
                </div>
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
