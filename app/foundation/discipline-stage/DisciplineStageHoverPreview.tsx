"use client";

// Kompakte, MAUS-verankerte Schnellvorschau für die Disziplin-Bühne. Wird beim
// Hover über ein Spieler-Token / eine Team-Bahn gezeigt (NICHT der volle rechte
// Drawer — der öffnet nur per Klick). Schwebt als `position:fixed` am Cursor,
// wird an den Viewport geklammert (nie off-screen, kippt bei Bedarf nach oben)
// und ist `pointer-events:none`, damit es den Hover nicht selbst stiehlt.
// Farben ausschließlich var(--nl-*)/hsl()/rgb()/color-mix() — kein Hex.

import type { GameState } from "@/lib/data/olyDataTypes";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import TeamMark from "@/app/foundation/discipline-stage/arena/TeamMark";
import { getTeamColor, teamHasSecondary } from "@/lib/foundation/team-colors";
import { fmt1 } from "./stage-format";

export type DisciplineStageHoverTarget =
  | { kind: "player"; id: string; x: number; y: number }
  | { kind: "team"; id: string; x: number; y: number }
  | null;

export type DisciplineStageHoverPreviewProps = {
  target: DisciplineStageHoverTarget;
  gameState: GameState;
  /** Kanonische Ratings (OVR/Rang/PP/MVS) je Spieler-ID — Quelle wie im Drawer. */
  ratingByPlayerId: Map<string, PlayerRatingContractRow>;
  /** In der aktuellen Disziplin eingesetzte Spieler je Team-ID (wie im Feld). */
  fieldedPlayerIdsByTeam?: Record<string, string[]>;
  /** Aktuelle Disziplin — für den Diszi-Wert der eingesetzten Spieler. */
  disciplineId?: string;
};

const PLAYER_W = 184;
const PLAYER_H = 252;
const TEAM_W = 250;
const TEAM_H_BASE = 118;
const FIELDED_ROW_H = 34;

// Cursor-nahe Position, an den Viewport geklammert; kippt nach oben, wenn unten
// kein Platz ist. Reine Präsentation, keine Slide-Animation (auch reduced-motion-fest).
function clampToViewport(x: number, y: number, w: number, h: number): { left: number; top: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // Standard: rechts neben dem Cursor. Wenn dort kein Platz ist (Hover nah am
  // rechten Rand, z.B. die Rangliste), nach LINKS neben den Cursor kippen —
  // sonst würde die Karte rechts aus dem Screen laufen.
  let left = x + 14;
  if (left + w > vw - 8) {
    left = x - w - 14;
  }
  left = Math.max(8, Math.min(left, vw - w - 8));
  let top = y + 16;
  if (top + h > vh - 8) {
    top = y - h - 12; // nach oben kippen
  }
  top = Math.max(8, Math.min(top, vh - h - 8));
  return { left, top };
}

function PlayerPreview({ gameState, target, ratingByPlayerId }: {
  gameState: GameState;
  target: { id: string; x: number; y: number };
  ratingByPlayerId: Map<string, PlayerRatingContractRow>;
}) {
  const player = gameState.players?.find((p) => p.id === target.id) ?? null;
  if (!player) return null;
  const row = ratingByPlayerId.get(player.id) ?? null;
  const portraitUrl = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl ?? null, player.portraitPath ?? null);
  const { left, top } = clampToViewport(target.x, target.y, PLAYER_W, PLAYER_H);
  return (
    <div style={{ position: "fixed", left, top, width: PLAYER_W, zIndex: 70, pointerEvents: "none" }}>
      <FoundationPlayerPortraitCard
        playerId={player.id}
        name={player.name}
        portraitUrl={portraitUrl}
        portraitInitials={player.name.slice(0, 2).toUpperCase()}
        playerOvr={row?.ovrNormalized ?? null}
        ovrRank={row?.ovrRank ?? null}
        playerPps={row?.ppsSeason ?? null}
        ppsRank={row?.ppsSeasonRank ?? null}
        playerMvs={row?.mvs ?? null}
        mvsRank={row?.mvsRank ?? null}
        pow={player.coreStats?.pow ?? null}
        spe={player.coreStats?.spe ?? null}
        men={player.coreStats?.men ?? null}
        soc={player.coreStats?.soc ?? null}
        leagueHeatPools={createEmptyLeaguePlayerHeatPools()}
        variant="team"
        context="roster"
        density="compact"
        known
        interactive={false}
      />
    </div>
  );
}

function TeamPreview({ gameState, target, ratingByPlayerId, fieldedPlayerIdsByTeam, disciplineId }: {
  gameState: GameState;
  target: { id: string; x: number; y: number };
  ratingByPlayerId: Map<string, PlayerRatingContractRow>;
  fieldedPlayerIdsByTeam?: Record<string, string[]>;
  disciplineId?: string;
}) {
  const team = gameState.teams?.find((t) => t.teamId === target.id) ?? null;
  if (!team) return null;
  const color = getTeamColor(team.shortCode);
  const hasSecondary = teamHasSecondary(team.shortCode);
  const logoUrl = getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null);
  const standing = gameState.seasonState?.standings?.[team.teamId] ?? null;
  const rank = standing?.rank ?? standing?.startplatz ?? null;
  const points = standing?.points ?? null;
  // In dieser Disziplin eingesetzte Spieler (wie beim Feld-Icon).
  const fieldedIds = (fieldedPlayerIdsByTeam?.[team.teamId] ?? []).filter(Boolean);
  const fielded = fieldedIds
    .map((pid) => gameState.players?.find((p) => p.id === pid) ?? null)
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const teamH = TEAM_H_BASE + (fielded.length > 0 ? 22 + fielded.length * FIELDED_ROW_H : 0);
  const { left, top } = clampToViewport(target.x, target.y, TEAM_W, teamH);
  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        width: TEAM_W,
        boxSizing: "border-box",
        zIndex: 70,
        pointerEvents: "none",
        padding: 12,
        borderRadius: 12,
        background: "var(--nl-panel)",
        border: "1px solid var(--nl-line)",
        boxShadow: "0 12px 32px color-mix(in srgb, var(--nl-bg) 74%, transparent)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <TeamMark
          src={logoUrl}
          alt={team.name}
          size={48}
          radius={11}
          placeholderColor={color.primary}
          placeholderSecondaryColor={hasSecondary ? color.secondary ?? null : null}
          placeholderLabel={team.shortCode}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {team.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--nl-mut)", fontWeight: 800, marginTop: 1 }}>{team.shortCode}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ fontSize: 11.5 }}>
              <span style={{ color: "var(--nl-mut)", fontWeight: 700 }}>Rang </span>
              <span style={{ fontWeight: 800 }}>{rank != null ? rank : "–"}</span>
            </span>
            <span style={{ fontSize: 11.5 }}>
              <span style={{ color: "var(--nl-mut)", fontWeight: 700 }}>Punkte </span>
              <span style={{ fontWeight: 800 }}>{typeof points === "number" ? fmt1(points) : "–"}</span>
            </span>
          </div>
        </div>
      </div>
      {fielded.length > 0 ? (
        <div style={{ marginTop: 10, borderTop: "1px solid var(--nl-line)", paddingTop: 8 }}>
          <div style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 6 }}>
            Eingesetzt
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {fielded.map((player) => {
              const row = ratingByPlayerId.get(player.id) ?? null;
              const portraitUrl = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl ?? null, player.portraitPath ?? null);
              const discVal = disciplineId
                ? player.currentDisciplineValues?.[disciplineId] ?? player.disciplineRatings?.[disciplineId] ?? null
                : null;
              return (
                <div key={player.id} style={{ display: "flex", alignItems: "center", gap: 8, fontVariantNumeric: "tabular-nums" }}>
                  {portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={portraitUrl} alt="" width={24} height={24} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flex: "none", border: "1px solid var(--nl-line)" }} />
                  ) : (
                    <span aria-hidden style={{ width: 24, height: 24, borderRadius: "50%", flex: "none", background: color.primary }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</span>
                  {discVal != null ? (
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--nl-accent)", flex: "none" }}>{fmt1(discVal)}</span>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--nl-mut)", flex: "none" }}>OVR {row?.ovrNormalized != null ? fmt1(row.ovrNormalized) : "–"}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function DisciplineStageHoverPreview({
  target,
  gameState,
  ratingByPlayerId,
  fieldedPlayerIdsByTeam,
  disciplineId,
}: DisciplineStageHoverPreviewProps): React.JSX.Element | null {
  if (!target) return null;
  if (target.kind === "player") {
    return <PlayerPreview gameState={gameState} target={target} ratingByPlayerId={ratingByPlayerId} />;
  }
  return (
    <TeamPreview
      gameState={gameState}
      target={target}
      ratingByPlayerId={ratingByPlayerId}
      fieldedPlayerIdsByTeam={fieldedPlayerIdsByTeam}
      disciplineId={disciplineId}
    />
  );
}
