"use client";

import { useEffect, useRef } from "react";
import PlayerMark from "./arena/PlayerMark";
import TeamMark from "./arena/TeamMark";
import { fmt1 } from "./stage-format";
import { getPlayerStarTier } from "@/lib/foundation/player-star-tier";

// Schmale Verletzungs-Zeile direkt unter der Top-Spieler-Zeile.
//
// Verletzungen liefen bisher nur durch den Ticker und den Spotlight-Banner vorbei —
// wer im falschen Moment nicht hinsah, erfuhr erst im Kader davon, dass es jemanden
// erwischt hat. Diese Zeile haelt den Stand fest, ohne Platz zu kosten: sie erscheint
// NUR, wenn es ueberhaupt Verletzte gibt, und bleibt eine Zeile hoch.
//
// Anti-Spoiler: die Aufrufseite fuellt sie ausschliesslich aus bereits AUFGEDECKTEN
// Slots (gleiche Quelle wie `revealedTopPlayers`) — eine noch nicht gelaufene
// Verletzung darf hier nicht vorab auftauchen.

export type DisciplineStageInjuredPlayer = {
  playerId: string | null;
  name: string;
  teamCode: string;
  logoUrl: string | null;
  portraitUrl: string | null;
  isOwn: boolean;
  /** Summe der Verletzungs-Abzuege auf den Score dieses Spielers (positiv notiert). */
  malus: number;
  /** Ligaweiter OVR-Rang — nur fuer den Star-Rahmen am Portrait. */
  ovrRank: number | null;
};

export type DisciplineStageInjuryRowProps = {
  players: DisciplineStageInjuredPlayer[];
  onOpenPlayer?: ((playerId: string) => void) | null;
  onPreviewPlayer?: ((playerId: string | null) => void) | null;
};

export default function DisciplineStageInjuryRow({ players, onOpenPlayer, onPreviewPlayer }: DisciplineStageInjuryRowProps) {
  const hoverTimer = useRef<number | null>(null);
  const clearHoverTimer = () => {
    if (hoverTimer.current != null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  useEffect(() => () => clearHoverTimer(), []);

  // Keine Verletzten = keine Zeile. Ein leerer Kasten waere hier reines Rauschen.
  if (players.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 8,
        background: "color-mix(in srgb, var(--nl-risk) 8%, var(--nl-panel))",
        border: "1px solid color-mix(in srgb, var(--nl-risk) 45%, var(--nl-line))",
        borderRadius: 12,
        padding: "7px 10px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          color: "var(--nl-risk)",
          fontWeight: 800,
          flex: "none",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <span aria-hidden>🚑</span>
        Verletzt · {players.length}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", overscrollBehaviorX: "contain", minWidth: 0, flex: 1 }}>
        {players.map((p) => {
          const clickable = Boolean(onOpenPlayer && p.playerId);
          const previewable = Boolean(onPreviewPlayer && p.playerId);
          return (
            <div
              key={`${p.teamCode}-${p.playerId ?? p.name}`}
              onClick={clickable ? () => onOpenPlayer!(p.playerId!) : undefined}
              onMouseEnter={
                previewable
                  ? () => {
                      clearHoverTimer();
                      hoverTimer.current = window.setTimeout(() => onPreviewPlayer!(p.playerId), 300);
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
              title={`${p.name} (${p.teamCode}) — Verletzung${p.malus > 0 ? ` · −${fmt1(p.malus)} auf den Score` : ""}${
                clickable ? " · Spieler-Karte öffnen" : ""
              }`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px 3px 4px",
                borderRadius: 999,
                flex: "0 0 auto",
                fontVariantNumeric: "tabular-nums",
                cursor: clickable ? "pointer" : "default",
                background: p.isOwn
                  ? "color-mix(in srgb, var(--nl-risk) 22%, transparent)"
                  : "color-mix(in srgb, var(--nl-risk) 12%, transparent)",
                border: p.isOwn
                  ? "1px solid var(--nl-risk)"
                  : "1px solid color-mix(in srgb, var(--nl-risk) 40%, transparent)",
              }}
            >
              <PlayerMark src={p.portraitUrl} size={20} isOwn={p.isOwn} injury starTier={getPlayerStarTier(p.ovrRank)} />
              <span style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.name}
              </span>
              <span style={{ fontSize: 10.5, color: "var(--nl-mut)", display: "inline-flex", alignItems: "center", gap: 3, flex: "none" }}>
                {p.logoUrl ? <TeamMark src={p.logoUrl} size={11} radius={3} /> : null}
                {p.teamCode}
              </span>
              {p.malus > 0 ? (
                <span style={{ fontSize: 11, fontWeight: 900, color: "var(--nl-risk)", flex: "none" }}>−{fmt1(p.malus)}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
