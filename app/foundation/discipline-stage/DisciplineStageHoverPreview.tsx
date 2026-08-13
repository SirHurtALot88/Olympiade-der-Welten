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
import { getPlayerPortraitBrowserUrl, getPlayerPortraitInitials, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import type { PlayerRatingContractRow } from "@/lib/foundation/player-rating-contract";
import TeamMark from "@/app/foundation/discipline-stage/arena/TeamMark";
import type { StageLiveResultsByTeam } from "@/app/foundation/discipline-stage/arena/DisciplineStageNativeArena";
import { getTeamColor, teamHasSecondary } from "@/lib/foundation/team-colors";
import PlayerStarFrame from "@/components/foundation/player-portrait-card/PlayerStarFrame";
import { getPlayerStarTier, getPlayerStarTierLabel } from "@/lib/foundation/player-star-tier";
import { hasVisibleMutatorPoints, resolveAwardedPlayerPoints } from "@/lib/foundation/player-points-total";
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
        portraitInitials={getPlayerPortraitInitials(player.name)}
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

function TeamPreview({ gameState, target, ratingByPlayerId, fieldedPlayerIdsByTeam, liveResultsByTeam, ppByPlayerId }: {
  gameState: GameState;
  target: { id: string; x: number; y: number };
  /** Kanonische Ratings — liefert OVR und Liga-Rang fuer die Top-3-Zeile. */
  ratingByPlayerId: Map<string, PlayerRatingContractRow>;
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
  /**
   * Die drei staerksten Spieler des Teams nach OVR — unabhaengig davon, wer in
   * DIESER Disziplin aufgestellt ist. Beantwortet beim Ueberfliegen der Liste
   * die Frage "wer sind hier eigentlich die Stars?", die die Eingesetzt-Liste
   * nicht beantwortet (dort steht nur, wer heute laeuft).
   *
   * Kein Spoiler: OVR ist eine Saison-Kennzahl und steht ohnehin in Kader,
   * Tabelle und Drawer — anders als die Disziplin-Ergebnisse, die der Reveal
   * schuetzt. Deshalb ist die Zeile auch nicht an `liveResultsByTeam` gebunden.
   */
  const topByOvr = (gameState.rosters ?? [])
    .filter((entry) => entry.teamId === team.teamId)
    .map((entry) => {
      const player = gameState.players?.find((candidate) => candidate.id === entry.playerId) ?? null;
      if (!player) return null;
      const rating = ratingByPlayerId.get(player.id) ?? null;
      const ovr = rating?.ovrNormalized ?? null;
      if (ovr == null || !Number.isFinite(ovr)) return null;
      return { player, ovr, ovrRank: rating?.ovrRank ?? null };
    })
    .filter((entry): entry is { player: NonNullable<typeof entry>["player"]; ovr: number; ovrRank: number | null } =>
      Boolean(entry),
    )
    .sort((left, right) => right.ovr - left.ovr || left.player.name.localeCompare(right.player.name, "de"))
    .slice(0, 3);
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
      {topByOvr.length > 0 ? (
        <div style={{ marginTop: 10, borderTop: "1px solid var(--nl-line)", paddingTop: 8 }}>
          <div style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 6 }}>
            Top 3 · OVR
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {topByOvr.map((entry) => {
              const portraitUrl = getPlayerPortraitBrowserUrl(
                entry.player.id,
                entry.player.portraitUrl ?? null,
                entry.player.portraitPath ?? null,
              );
              const tier = getPlayerStarTier(entry.ovrRank);
              const tierLabel = getPlayerStarTierLabel(tier);
              return (
                <div
                  key={entry.player.id}
                  title={`${entry.player.name} — OVR ${fmt1(entry.ovr)}${
                    entry.ovrRank != null ? ` · Liga-Rang #${entry.ovrRank}` : ""
                  }${tierLabel ? ` · ${tierLabel}` : ""}`}
                  style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
                >
                  <PlayerStarFrame tier={tier} shape="circle">
                    {portraitUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={portraitUrl}
                        alt=""
                        width={38}
                        height={38}
                        style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", display: "block", border: "1px solid var(--nl-line)" }}
                      />
                    ) : (
                      <span aria-hidden style={{ width: 38, height: 38, borderRadius: "50%", display: "block", background: color.primary }} />
                    )}
                  </PlayerStarFrame>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      maxWidth: "100%",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.player.name}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 900, color: "var(--nl-accent)", fontVariantNumeric: "tabular-nums" }}>
                    {fmt1(entry.ovr)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {fielded.length > 0 ? (
        <div style={{ marginTop: 10, borderTop: "1px solid var(--nl-line)", paddingTop: 8 }}>
          <div style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800, marginBottom: 6 }}>
            Eingesetzt
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {fielded.map((player) => {
              const pp = ppByPlayerId?.get(player.id) ?? null;
              const awardedPp = pp
                ? resolveAwardedPlayerPoints({ pointsAwarded: pp.pp, mutatorPpsBonus: pp.mutatorPp })
                : null;
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
                        {/* FINALER Score (`pp.score` = `finalPlayerScore` der Engine), nicht
                            `live.net` aus der Arena-Simulation. Genau daraus werden die PP
                            innerhalb des Teams anteilig verteilt
                            (`distributeRankPointsToPlayers`, pointSource
                            `rank_to_points_final_score_share`) — sie sind also monoton in
                            diesem Wert. Stand hier die Arena-Zahl, sah die Reihenfolge
                            widerspruechlich aus: ein Spieler mit sichtbar hoeherem Wert
                            konnte weniger PP haben, weil der PP-Wert von einer anderen
                            Groesse kam als die angezeigte. */}
                        <span
                          title={`Finaler Score ${fmt1(pp.score)} — daraus werden die Team-PP anteilig verteilt${
                            Math.abs(pp.score - live.net) >= 0.05
                              ? ` · Arena-Zwischenstand war ${fmt1(live.net)}`
                              : ""
                          }`}
                          style={{ fontSize: 11.5, fontWeight: 800, color: "var(--nl-mut)", flex: "none" }}
                        >
                          {fmt1(pp.score)}
                        </span>
                        {/* GESAMTE gutgeschriebene PP — Anteil an den Team-Punkten PLUS
                            Mutator-Aufschlag, genau die Zahl, die der Saison-Ledger bucht
                            (`season-points-ledger.ts`). Vorher stand hier nur der Anteil und
                            der Aufschlag daneben in Klammern: aus "0,2 PP (+0,6 Mut)" musste
                            man sich die tatsaechlichen 0,8 selbst zusammenrechnen. Die
                            Klammer bleibt als AUFSCHLUESSELUNG stehen, nicht als Zusatzposten. */}
                        <span
                          title={
                            hasVisibleMutatorPoints(pp.mutatorPp)
                              ? `${fmt1(awardedPp)} Player-Points · ${fmt1(pp.pp)} Anteil an den Team-Punkten + ${fmt1(pp.mutatorPp!)} aus Disziplin-Mutatoren · Score ${fmt1(pp.score)}`
                              : `${fmt1(awardedPp)} Player-Points · kein Mutator-Anteil · Score ${fmt1(pp.score)}`
                          }
                          style={{ fontSize: 12, fontWeight: 900, color: "var(--nl-accent)", flex: "none" }}
                        >
                          {fmt1(awardedPp)} PP
                        </span>
                        {hasVisibleMutatorPoints(pp.mutatorPp) ? (
                          <span
                            title="Darin enthalten: der Aufschlag aus den Mutatoren dieser Disziplin"
                            style={{ fontSize: 10.5, fontWeight: 700, color: "var(--nl-good)", flex: "none" }}
                          >
                            (inkl. {pp.mutatorPp! > 0 ? "+" : "−"}{fmt1(Math.abs(pp.mutatorPp!))} Mut)
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
        ratingByPlayerId={ratingByPlayerId}
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
