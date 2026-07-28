"use client";

// Kompakte, MAUS-verankerte Schnellvorschau für die Disziplin-Bühne. Wird beim
// Hover über ein Spieler-Token / eine Team-Bahn gezeigt (NICHT der volle rechte
// Drawer — der öffnet nur per Klick). Schwebt als `position:fixed` am Cursor,
// wird an den Viewport geklammert (nie off-screen, kippt bei Bedarf nach oben)
// und ist `pointer-events:none`, damit es den Hover nicht selbst stiehlt.
// Farben ausschließlich var(--nl-*)/hsl()/rgb()/color-mix() — kein Hex.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GameState } from "@/lib/data/olyDataTypes";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import TeamMark from "@/app/foundation/discipline-stage/arena/TeamMark";
import type { StageLiveResultsByTeam } from "@/app/foundation/discipline-stage/arena/DisciplineStageNativeArena";
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
  /**
   * ANTI-SPOILER: Live-Ergebnisse der im laufenden Reveal BEREITS aufgedeckten
   * Spieler (aus der Arena gemeldet, exakt dieselbe Quelle wie im Team-Drawer).
   * Nur wer hier steht, darf in der Hovercard einen Punktwert zeigen — alle
   * anderen bleiben „noch offen". Fehlt die Prop, zeigt die Karte GAR KEINE
   * Werte (sicherer Default statt Spoiler).
   */
  liveResultsByTeam?: StageLiveResultsByTeam;
  /**
   * Vergebene Player-Points je Spieler-ID (mit dem Score, aus dem sie stammen). Wird erst
   * NACH Abschluss der Disziplin gesetzt — vorher wäre die PP-Vergabe ein Spoiler. Greift
   * nur für Spieler, die `liveResultsByTeam` ohnehin schon aufgedeckt hat.
   */
  ppByPlayerId?: Map<string, { pp: number | null; score: number; mutatorPp?: number | null }> | null;
};

const PLAYER_W = 184;
const TEAM_W = 250;

// Cursor-verankerte, am SICHTBAREN Viewport geklammerte Karte. Klammert NACH dem
// Render anhand der ECHTEN Größe (getBoundingClientRect) statt einer Schätzung —
// so kann eine hohe/variable Karte (z.B. Team-Vorschau mit Aufstellungsliste) nie
// mehr teilweise aus dem Bild laufen. Nutzt documentElement.clientWidth/Height
// (ohne Scrollbar). Erst unsichtbar an der Schätzposition, dann exakt gesetzt.
function AnchoredCard({ x, y, width, cardStyle, children }: {
  x: number;
  y: number;
  width: number;
  cardStyle?: React.CSSProperties;
  children: React.ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof document === "undefined") return;
    const rect = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    const w = rect.width || width;
    const h = rect.height || 0;
    let left = x + 14;
    if (left + w > vw - 8) left = x - w - 14; // nahe rechtem Rand nach links kippen
    left = Math.max(8, Math.min(left, vw - w - 8));
    let top = y + 16;
    top = Math.min(top, vh - h - 8); // Unterkante klemmen statt über den Cursor springen
    top = Math.max(8, top);
    setPos({ left, top });
  }, [x, y, width]);
  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: pos ? pos.left : x + 14,
        top: pos ? pos.top : y + 16,
        width,
        // Hoch genug, um IMMER über Rangliste/ENDSTAND-Panel zu liegen — sonst scheint
        // deren Text durch die (eigentlich deckende) Karte und sie wirkt „transparent".
        zIndex: 1000,
        pointerEvents: "none",
        // Sehr hohe Karte nie über die Fensterkanten hinaus: auf Viewport-Höhe deckeln.
        maxHeight: "calc(100vh - 16px)",
        overflowY: "auto",
        visibility: pos ? "visible" : "hidden",
        ...cardStyle,
      }}
    >
      {children}
    </div>
  );
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
  return (
    <AnchoredCard
      x={target.x}
      y={target.y}
      width={PLAYER_W}
      // Deckende Unterlage wie bei TeamPreview: die Portrait-Karte selbst ist nur ~0.9 deckend
      // (is-full-art-Verlauf), ohne diese Fläche scheint die Rangliste/ENDSTAND dahinter durch und
      // die Hover-Karte wirkt „transparent" (nichts lesbar). var(--nl-panel) füllt die Lücken.
      cardStyle={{
        borderRadius: 16,
        background: "var(--nl-panel)",
        color: "var(--nl-ink)",
        boxShadow: "0 12px 32px color-mix(in srgb, var(--nl-bg) 74%, transparent)",
      }}
    >
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
    </AnchoredCard>
  );
}

function TeamPreview({ gameState, target, fieldedPlayerIdsByTeam, liveResultsByTeam, ppByPlayerId }: {
  gameState: GameState;
  target: { id: string; x: number; y: number };
  fieldedPlayerIdsByTeam?: Record<string, string[]>;
  liveResultsByTeam?: StageLiveResultsByTeam;
  /** Vergebene Player-Points je Spieler — null, solange die Disziplin noch läuft. */
  ppByPlayerId?: Map<string, { pp: number | null; score: number; mutatorPp?: number | null }> | null;
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
  // ANTI-SPOILER (gleiche Konvention wie Feld-Hovercard/Team-Drawer): NUR Spieler,
  // die der Reveal schon aufgedeckt hat, dürfen eine Zahl zeigen. Die Liste kommt
  // aus `liveResultsByTeam` — die Arena meldet dort ausschließlich Slots
  // 0…thrownSlot. Alle übrigen Eingesetzten bleiben mit Namen sichtbar (die
  // Aufstellung ist kein Geheimnis), aber ohne Wert → „noch offen".
  const revealedByPlayerId = new Map(
    (liveResultsByTeam?.[team.teamId] ?? []).map((r) => [r.playerId, r] as const),
  );
  return (
    <AnchoredCard
      x={target.x}
      y={target.y}
      width={TEAM_W}
      cardStyle={{
        boxSizing: "border-box",
        padding: 12,
        borderRadius: 12,
        background: "var(--nl-panel)",
        color: "var(--nl-ink)",
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
              const pp = ppByPlayerId?.get(player.id) ?? null;
              const portraitUrl = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl ?? null, player.portraitPath ?? null);
              const live = revealedByPlayerId.get(player.id) ?? null;
              return (
                <div key={player.id} title={live ? `Grundwert ${fmt1(live.base)}` : "Noch nicht aufgedeckt"} style={{ display: "flex", alignItems: "center", gap: 8, fontVariantNumeric: "tabular-nums", opacity: live ? 1 : 0.72 }}>
                  {portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={portraitUrl} alt="" width={24} height={24} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flex: "none", border: "1px solid var(--nl-line)" }} />
                  ) : (
                    <span aria-hidden style={{ width: 24, height: 24, borderRadius: "50%", flex: "none", background: color.primary }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</span>
                  {/* Anti-Spoiler bleibt führend: eine Zahl gibt es NUR für aufgedeckte Spieler.
                      Ist die Disziplin fertig gewertet, sind die vergebenen PP die eigentliche
                      Währung — sie stehen dann vorn, der Score bleibt als Herkunft daneben. */}
                  {live ? (
                    pp?.pp != null ? (
                      <>
                        {/* Gesamtscore ZUERST — er erklaert die Reihenfolge. Dahinter die PP als
                            eigentliche Waehrung, und in Klammern der Anteil, den die
                            Disziplin-Mutatoren beigesteuert haben: ohne ihn bleibt unerklaerlich,
                            warum zwei Spieler mit aehnlichem Score verschieden viele PP bekommen. */}
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--nl-mut)", flex: "none" }}>{fmt1(live.net)}</span>
                        <span
                          title={
                            pp.mutatorPp != null && Math.abs(pp.mutatorPp) >= 0.05
                              ? `${fmt1(pp.pp)} Player-Points · davon ${fmt1(pp.mutatorPp)} aus Disziplin-Mutatoren · Score ${fmt1(pp.score)}`
                              : `${fmt1(pp.pp)} Player-Points · kein Mutator-Anteil · Score ${fmt1(pp.score)}`
                          }
                          style={{ fontSize: 12, fontWeight: 900, color: "var(--nl-accent)", flex: "none" }}
                        >
                          {fmt1(pp.pp)} PP
                        </span>
                        {pp.mutatorPp != null && Math.abs(pp.mutatorPp) >= 0.05 ? (
                          <span
                            title="Anteil an den Player-Points, der aus den Mutatoren dieser Disziplin stammt"
                            style={{ fontSize: 10.5, fontWeight: 700, color: "var(--nl-good)", flex: "none" }}
                          >
                            ({pp.mutatorPp > 0 ? "+" : "−"}{fmt1(Math.abs(pp.mutatorPp))} Mut)
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--nl-accent)", flex: "none" }}>{fmt1(live.net)}</span>
                    )
                  ) : (
                    <span style={{ fontSize: 10.5, fontStyle: "italic", color: "var(--nl-mut-2)", flex: "none" }}>noch offen</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </AnchoredCard>
  );
}

export default function DisciplineStageHoverPreview({
  target,
  gameState,
  ratingByPlayerId,
  fieldedPlayerIdsByTeam,
  liveResultsByTeam,
  ppByPlayerId,
}: DisciplineStageHoverPreviewProps): React.JSX.Element | null {
  // Erst nach dem Mount in document.body portalen (SSR-fest) — so kann kein
  // ancestor-`transform` die `position:fixed`-Verankerung kapern (analog zum Drawer).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!target || !mounted || typeof document === "undefined") return null;
  const content =
    target.kind === "player" ? (
      <PlayerPreview gameState={gameState} target={target} ratingByPlayerId={ratingByPlayerId} />
    ) : (
      <TeamPreview
        gameState={gameState}
        target={target}
        fieldedPlayerIdsByTeam={fieldedPlayerIdsByTeam}
        liveResultsByTeam={liveResultsByTeam}
        ppByPlayerId={ppByPlayerId}
      />
    );
  // WICHTIG: `is-new-look` MUSS am Portal-Wurzelknoten hängen. Die --nl-*-Tokens sind
  // in globals.css ausschließlich unter `.is-new-look` definiert (die Klasse sitzt auf
  // <main>), das Portal hängt aber direkt an <body> — also AUSSERHALB. Ohne die Klasse
  // war `background: var(--nl-panel)` schlicht ungültig → die Karte blieb durchsichtig
  // und die Rangtabelle darunter schien durch (unlesbar).
  return createPortal(<div className="is-new-look">{content}</div>, document.body);
}
