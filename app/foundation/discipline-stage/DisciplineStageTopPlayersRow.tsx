"use client";

import { useEffect, useRef } from "react";
import type { DisciplineStageTopPlayer } from "./DisciplineStageTopPlayers";
import { fmt1 } from "./stage-format";
import PlayerMark from "./arena/PlayerMark";
import TeamMark from "./arena/TeamMark";

// Horizontale Top-Spieler-Zeile unter der Arena (statt linker Spalte), damit die
// Arena die volle Breite bekommt. Sortiert nach Player-Points (kommt bereits
// sortiert rein), pro Chip: Rang · Portrait · Name · PP groß, (Score) klein.

export type DisciplineStageTopPlayersRowProps = {
  players: DisciplineStageTopPlayer[];
  onOpenPlayer?: ((playerId: string) => void) | null;
  /** Hover-Vorschau: nach kurzer Verzögerung playerId, beim Verlassen null. */
  onPreviewPlayer?: ((playerId: string | null) => void) | null;
  playerIdByRow?: (string | null)[];
  limit?: number;
};

export default function DisciplineStageTopPlayersRow({ players, onOpenPlayer, onPreviewPlayer, playerIdByRow, limit = 10 }: DisciplineStageTopPlayersRowProps) {
  const shown = players.slice(0, limit);
  const hoverTimer = useRef<number | null>(null);
  const clearHoverTimer = () => {
    if (hoverTimer.current != null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  useEffect(() => () => clearHoverTimer(), []);
  return (
    <div style={{ marginTop: 12, background: "var(--nl-panel)", border: "1px solid var(--nl-line)", borderRadius: 14, padding: 10 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 8 }}>
        Top-{limit} Spieler · nach Player-Points
      </div>
      {shown.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--nl-mut)", fontStyle: "italic" }}>Noch keine Werte.</div>
      ) : (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", overscrollBehaviorX: "contain", paddingBottom: 2 }}>
          {shown.map((p, index) => {
            const playerId = playerIdByRow?.[index] ?? null;
            const clickable = Boolean(onOpenPlayer && playerId);
            const previewable = Boolean(onPreviewPlayer && playerId);
            return (
              <div
                key={`${p.rank}-${p.name}-${p.teamCode}`}
                onClick={clickable ? () => onOpenPlayer!(playerId!) : undefined}
                onMouseEnter={
                  previewable
                    ? () => {
                        clearHoverTimer();
                        hoverTimer.current = window.setTimeout(() => onPreviewPlayer!(playerId), 300);
                      }
                    : undefined
                }
                onMouseLeave={
                  previewable
                    ? () => {
                        clearHoverTimer();
                        onPreviewPlayer!(null);
                      }
                    : undefined
                }
                title={clickable ? "Spieler-Karte öffnen" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 10,
                  flex: "0 0 auto",
                  fontVariantNumeric: "tabular-nums",
                  cursor: clickable ? "pointer" : "default",
                  background: p.isOwn ? "color-mix(in srgb, var(--nl-accent) 14%, transparent)" : "color-mix(in srgb, var(--nl-line) 22%, transparent)",
                  border: p.isOwn ? "1px solid var(--nl-accent)" : "1px solid var(--nl-line)",
                }}
              >
                <span style={{ fontWeight: 800, color: "var(--nl-mut)", fontSize: 12.5, width: 18, textAlign: "right" }}>{p.rank}</span>
                <PlayerMark src={p.portraitUrl} size={28} isOwn={p.isOwn} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.isMvp ? "⭐ " : ""}
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--nl-mut)", display: "flex", alignItems: "center", gap: 4 }}>
                    {p.logoUrl ? <TeamMark src={p.logoUrl} size={12} radius={3} /> : null}
                    {p.teamCode}
                  </div>
                </div>
                <div style={{ textAlign: "right", flex: "none", paddingLeft: 4 }}>
                  {p.points != null ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--nl-accent)" }}>{fmt1(p.points)} PP</div>
                      <div style={{ fontSize: 10.5, color: "var(--nl-mut)" }}>(Score {fmt1(p.score)})</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--nl-accent)" }}>{fmt1(p.score)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
