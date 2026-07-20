"use client";

import type { CSSProperties } from "react";

/** Ein Team im Saisonstand-Übergang: aktueller Rang → projizierter Rang. */
export type DisciplineStageStandingsDeltaItem = {
  teamId: string;
  currentRank: number | null;
  projectedRank: number | null;
};

/** Anzeige-Metadaten pro Team (Kürzel, Name, Wappen). */
export type DisciplineStageStandingsDeltaTeamMeta = {
  code: string;
  name: string;
  logoUrl: string | null;
};

export type DisciplineStageStandingsDeltaProps = {
  /** `briefingStandings.items`-Format aus dem Matchday-Arena-Base-Service. */
  items: Array<DisciplineStageStandingsDeltaItem>;
  /** Team-Metadaten für Wappen, Kürzel und Namen. */
  teamMetaById: Map<string, DisciplineStageStandingsDeltaTeamMeta>;
  /** Eigenes Team wird hervorgehoben. */
  ownTeamId?: string | null;
};

const DASH = "—";

// Sortierschlüssel: Teams ohne projizierten Rang wandern ans Ende.
function projectedSortKey(rank: number | null): number {
  return rank == null ? Number.POSITIVE_INFINITY : rank;
}

function formatRank(rank: number | null): string {
  return rank == null ? DASH : String(rank);
}

// Delta = Verbesserung im Rang (aktuell − projiziert): positiv = aufgestiegen.
function rankDelta(currentRank: number | null, projectedRank: number | null): number | null {
  if (currentRank == null || projectedRank == null) {
    return null;
  }
  return currentRank - projectedRank;
}

type DeltaTone = "good" | "risk" | "flat" | "unknown";

function deltaTone(delta: number | null): DeltaTone {
  if (delta == null) {
    return "unknown";
  }
  if (delta > 0) {
    return "good";
  }
  if (delta < 0) {
    return "risk";
  }
  return "flat";
}

function deltaColor(tone: DeltaTone): string {
  switch (tone) {
    case "good":
      return "var(--nl-good)";
    case "risk":
      return "var(--nl-risk)";
    default:
      return "var(--nl-mut)";
  }
}

function deltaLabel(tone: DeltaTone, delta: number | null): string {
  if (tone === "good" && delta != null) {
    return `▲${delta}`;
  }
  if (tone === "risk" && delta != null) {
    return `▼${Math.abs(delta)}`;
  }
  if (tone === "flat") {
    return "=";
  }
  return DASH;
}

const wrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid var(--nl-line)",
  borderRadius: "12px",
  background: "var(--nl-panel)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontVariantNumeric: "tabular-nums",
  fontSize: "0.85rem",
  color: "var(--nl-fg, var(--nl-mut-2))",
};

const headCellBase: CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: "0.72rem",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--nl-mut)",
  borderBottom: "1px solid var(--nl-line)",
  whiteSpace: "nowrap",
};

const cellBase: CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--nl-line-2, var(--nl-line))",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const logoStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  borderRadius: "6px",
  objectFit: "contain",
  display: "block",
  background: "var(--nl-panel-2)",
};

const logoPlaceholderStyle: CSSProperties = {
  ...logoStyle,
  border: "1px solid var(--nl-line)",
};

/**
 * Rank-Changes → Saisonstand für die Disziplin-Bühne.
 * Zeigt je Team den Übergang „aktuell → projiziert" mit farbigem Delta-Chip,
 * sortiert nach dem projizierten Saisonrang. Rein präsentational.
 */
export default function DisciplineStageStandingsDelta(props: DisciplineStageStandingsDeltaProps) {
  const { items, teamMetaById, ownTeamId } = props;

  const rows = [...items].sort((a, b) => {
    const byProjected = projectedSortKey(a.projectedRank) - projectedSortKey(b.projectedRank);
    if (byProjected !== 0) {
      return byProjected;
    }
    return projectedSortKey(a.currentRank) - projectedSortKey(b.currentRank);
  });

  return (
    <div style={wrapStyle} className="nl-tnum">
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ ...headCellBase, textAlign: "right", width: "1%" }} scope="col">
              #
            </th>
            <th style={headCellBase} scope="col">
              Team
            </th>
            <th style={{ ...headCellBase, textAlign: "center" }} scope="col">
              aktuell → projiziert
            </th>
            <th style={{ ...headCellBase, textAlign: "right" }} scope="col">
              Δ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => {
            const meta = teamMetaById.get(item.teamId);
            const isOwn = ownTeamId != null && item.teamId === ownTeamId;
            const delta = rankDelta(item.currentRank, item.projectedRank);
            const tone = deltaTone(delta);
            const chipColor = deltaColor(tone);
            const chipText = deltaLabel(tone, delta);

            const rowStyle: CSSProperties = isOwn
              ? {
                  background: "color-mix(in srgb, var(--nl-accent, var(--nl-good)) 12%, transparent)",
                  boxShadow: "inset 3px 0 0 0 var(--nl-accent, var(--nl-good))",
                }
              : {};

            const nameColor = isOwn ? "var(--nl-accent, var(--nl-fg, var(--nl-mut-2)))" : undefined;

            return (
              <tr key={item.teamId} style={rowStyle}>
                <td style={{ ...cellBase, textAlign: "right", fontWeight: 700 }}>
                  {formatRank(item.projectedRank)}
                </td>
                <td style={cellBase}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    {meta?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={meta.logoUrl} alt="" style={logoStyle} />
                    ) : (
                      <span style={logoPlaceholderStyle} aria-hidden="true" />
                    )}
                    <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.25 }}>
                      <span style={{ fontWeight: 700, color: nameColor }}>
                        {meta?.code ?? item.teamId}
                      </span>
                      {meta?.name ? (
                        <span style={{ fontSize: "0.72rem", color: "var(--nl-mut)" }}>{meta.name}</span>
                      ) : null}
                    </span>
                  </span>
                </td>
                <td style={{ ...cellBase, textAlign: "center", color: "var(--nl-mut)" }}>
                  <span style={{ fontWeight: 600, color: "var(--nl-fg, var(--nl-mut-2))" }}>
                    {formatRank(item.currentRank)}
                  </span>
                  <span style={{ margin: "0 6px", color: "var(--nl-mut)" }} aria-hidden="true">
                    →
                  </span>
                  <span style={{ fontWeight: 700, color: "var(--nl-fg, var(--nl-mut-2))" }}>
                    {formatRank(item.projectedRank)}
                  </span>
                </td>
                <td style={{ ...cellBase, textAlign: "right" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontWeight: 700,
                      fontSize: "0.78rem",
                      color: chipColor,
                      border: `1px solid color-mix(in srgb, ${chipColor} 45%, transparent)`,
                      background: `color-mix(in srgb, ${chipColor} 14%, transparent)`,
                    }}
                    title={
                      delta == null
                        ? "Kein projizierter Rangvergleich verfügbar"
                        : delta > 0
                          ? `${delta} Platz/Plätze gutgemacht`
                          : delta < 0
                            ? `${Math.abs(delta)} Platz/Plätze verloren`
                            : "Rang unverändert"
                    }
                  >
                    {chipText}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
