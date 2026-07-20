"use client";

import type { DisciplineHighlightCandidate } from "@/lib/resolve/legacy-matchday-resolve-types";

export type DisciplineStageHighlightMeta = { code: string; name: string; logoUrl: string | null };

export type DisciplineStageHighlightsProps = {
  candidates: DisciplineHighlightCandidate[];
  teamMetaById: Map<string, DisciplineStageHighlightMeta>;
  playerNameById: Map<string, string>;
  ownTeamId?: string | null;
};

const HIGHLIGHT_META: Record<string, { icon: string; label: string; tone: string }> = {
  best_player_discipline: { icon: "⭐", label: "Bester Spieler", tone: "var(--nl-warn)" },
  strongest_team_score: { icon: "🏆", label: "Stärkstes Team", tone: "var(--nl-good)" },
  closest_score_gap: { icon: "⚔️", label: "Engster Abstand", tone: "var(--nl-accent)" },
  missing_lineup_warning: { icon: "⚠️", label: "Fehlende Aufstellung", tone: "var(--nl-risk)" },
  injury_event: { icon: "🚑", label: "Verletzung", tone: "var(--nl-risk)" },
};

function describe(
  candidate: DisciplineHighlightCandidate,
  teamMetaById: Map<string, DisciplineStageHighlightMeta>,
  playerNameById: Map<string, string>,
): string {
  if (candidate.shortSummary && candidate.shortSummary.trim()) {
    return candidate.shortSummary.trim();
  }
  const teamCode = candidate.teamId ? teamMetaById.get(candidate.teamId)?.code ?? candidate.teamId : null;
  const playerName = candidate.playerId ? playerNameById.get(candidate.playerId) ?? null : null;
  const relatedCode = candidate.relatedTeamId
    ? teamMetaById.get(candidate.relatedTeamId)?.code ?? candidate.relatedTeamId
    : null;
  const parts = [playerName, teamCode ? `· ${teamCode}` : null, relatedCode ? `vs ${relatedCode}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : (HIGHLIGHT_META[candidate.highlightType]?.label ?? "Highlight");
}

export default function DisciplineStageHighlights({
  candidates,
  teamMetaById,
  playerNameById,
  ownTeamId,
}: DisciplineStageHighlightsProps) {
  const sorted = [...candidates].sort((a, b) => b.importanceScore - a.importanceScore).slice(0, 6);
  if (sorted.length === 0) {
    return null;
  }

  return (
    <div style={{ background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 10 }}>
        Highlights
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
        {sorted.map((candidate, index) => {
          const meta = HIGHLIGHT_META[candidate.highlightType] ?? { icon: "✨", label: "Highlight", tone: "var(--nl-accent)" };
          const isOwn = Boolean(ownTeamId && candidate.teamId === ownTeamId);
          return (
            <div
              key={`${candidate.highlightType}-${candidate.playerId ?? candidate.teamId ?? index}`}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--nl-bg)",
                border: `1px solid ${isOwn ? "var(--nl-accent)" : "var(--nl-line)"}`,
              }}
            >
              <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>{meta.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800, color: meta.tone }}>
                  {meta.label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, overflowWrap: "anywhere" }}>
                  {describe(candidate, teamMetaById, playerNameById)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
