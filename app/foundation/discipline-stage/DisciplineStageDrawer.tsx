"use client";

// Grafischer, statistik-reicher, TEAM-EINGEFÄRBTER (2-Farben) Schnell-Drawer für
// die Disziplin-Bühne. Öffnet als Overlay über der laufenden Arena (die im
// Hintergrund gemountet bleibt) und zeigt eine kompakte, in sich geschlossene
// Karte für einen Spieler oder ein Team. KEINE Navigation aus dem Drawer heraus
// (der Drawer IST die vollständige Schnellansicht) — alles wird defensiv aus
// `gameState` gelesen, fehlende Felder werden weggelassen.
//
// 2-Farben-Contract (auf dem Wurzelelement als CSS-Variablen gesetzt):
//   --team-a  = Primärfarbe (RAW)          → nur Crest + Header-Keil
//   --team-b  = Sekundärfarbe (RAW)        → nur Crest + Header-Keil
//   --accent  = floorTeamAccent(Primär)    → primäre UI-Rolle
//   --accent2 = floorTeamAccent(Sekundär)  → sekundäre, gedämpfte UI-Rolle
// Achsen (POW/SPE/MEN/SOC) und die Semantik (good/warn/risk, Gold-Ränge) werden
// NIE team-eingefärbt.

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { NlProgressBar } from "@/components/foundation/new-look/NlProgressBar";
import PlayerMark from "@/app/foundation/discipline-stage/arena/PlayerMark";
import TeamMark from "@/app/foundation/discipline-stage/arena/TeamMark";
import {
  buildPlayerDrawerDataFromGameState,
  type PlayerDetailDrawerData,
} from "@/lib/foundation/player-detail-drawer";
import {
  getCurrentMatchdayDisciplineSchedule,
  getTeamMatchdayLineupDraft,
} from "@/lib/foundation/matchday-lineup-readiness";
import { getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import { getTeamColor, teamHasSecondary, floorTeamAccent } from "@/lib/foundation/team-colors";
import { fmt1 } from "./stage-format";

export type DisciplineStageDrawerTarget =
  | { kind: "player"; playerId: string }
  | { kind: "team"; teamId: string }
  | null;

export type DisciplineStageDrawerProps = {
  target: DisciplineStageDrawerTarget;
  gameState: GameState;
  /** Aktuelle Disziplin — treibt die hervorgehobene Statistik und die Lineup-Seite. */
  disciplineId: string;
  onClose: () => void;
  /**
   * Bewusst NICHT verdrahtet: ein „Volles Profil" würde den User aus der
   * laufenden Arena werfen. Prop bleibt optional für Aufrufer-Kompatibilität.
   */
  onOpenFull?: (target: { kind: "player"; playerId: string } | { kind: "team"; teamId: string }) => void;
  /** Team-View: einen Spieler des Teams anwählen → Drawer wechselt auf Spieler (ohne Navigation). */
  onSelectPlayer?: ((playerId: string) => void) | null;
};

// ---------------------------------------------------------------------------
// Hilfsfunktionen (defensiv – gameState-Teilbäume können in alten Saves fehlen)
// ---------------------------------------------------------------------------

function findPlayer(gameState: GameState, playerId: string): Player | null {
  return gameState.players?.find((p) => p.id === playerId) ?? null;
}

function findTeam(gameState: GameState, teamId: string): Team | null {
  return gameState.teams?.find((t) => t.teamId === teamId) ?? null;
}

function findTeamOfPlayer(gameState: GameState, playerId: string): Team | null {
  const entry = gameState.rosters?.find((r) => r.playerId === playerId);
  if (!entry) return null;
  return findTeam(gameState, entry.teamId);
}

function playerOverall(p: Player): number | null {
  if (typeof p.ovr === "number") return p.ovr;
  if (typeof p.rating === "number") return p.rating;
  return null;
}

function disciplineName(gameState: GameState, disciplineId: string): string {
  return gameState.disciplines?.find((d) => d.id === disciplineId)?.name ?? disciplineId;
}

function rankLabel(rank: number | null | undefined): string | null {
  return rank != null && Number.isFinite(rank) ? `#${rank}` : null;
}

// CSS-Custom-Properties in ein Style-Objekt gießen (TS-freundlicher Cast).
function withVars(vars: Record<string, string>, rest?: React.CSSProperties): React.CSSProperties {
  return { ...(vars as unknown as React.CSSProperties), ...(rest ?? {}) };
}

type AxisMeta = { id: "pow" | "spe" | "men" | "soc"; label: string; tone: "pow" | "spe" | "men" | "soc"; coreKey: "pow" | "spe" | "men" | "soc" };
const AXES: AxisMeta[] = [
  { id: "pow", label: "POW", tone: "pow", coreKey: "pow" },
  { id: "spe", label: "SPE", tone: "spe", coreKey: "spe" },
  { id: "men", label: "MEN", tone: "men", coreKey: "men" },
  { id: "soc", label: "SOC", tone: "soc", coreKey: "soc" },
];

// ---------------------------------------------------------------------------
// Wiederverwendbare Style-Bausteine
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.13em",
  textTransform: "uppercase",
  color: "var(--nl-mut)",
  fontWeight: 800,
  marginBottom: 8,
};

function Section({
  title,
  accentRole,
  children,
  right,
}: {
  title: string;
  /** "primary" = --accent, "secondary" = --accent2, "neutral" = ungefärbt. */
  accentRole?: "primary" | "secondary" | "neutral";
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  const role = accentRole ?? "neutral";
  const border =
    role === "primary"
      ? "1px solid color-mix(in srgb, var(--accent) 45%, var(--nl-line))"
      : role === "secondary"
        ? "1px solid color-mix(in srgb, var(--accent2) 32%, var(--nl-line))"
        : "1px solid var(--nl-line)";
  const titleColor =
    role === "primary" ? "var(--accent)" : role === "secondary" ? "var(--accent2)" : "var(--nl-mut)";
  const bg =
    role === "primary"
      ? "color-mix(in srgb, var(--accent) 6%, var(--nl-bg))"
      : "var(--nl-bg)";
  return (
    <div style={{ background: bg, border, borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ ...labelStyle, color: titleColor, marginBottom: 8 }}>{title}</div>
        {right ?? null}
      </div>
      {children}
    </div>
  );
}

function TraitChip({ text, tone }: { text: string; tone: "good" | "risk" }) {
  const color = tone === "good" ? "var(--nl-good)" : "var(--nl-risk)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11.5,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 999,
        color,
        border: `1px solid ${color}`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      {tone === "good" ? "＋" : "−"} {text}
    </span>
  );
}

/** Achsen-Balken mit FESTEM Ton (nie team-eingefärbt) + Wert und optionalem Rang. */
function AxisBar({ meta, value, rank }: { meta: AxisMeta; value: number | null; rank: number | null }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 800 }}>
          {meta.label}
        </span>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{typeof value === "number" ? fmt1(value) : "–"}</span>
          {rankLabel(rank) ? <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--nl-mut)" }}>{rankLabel(rank)}</span> : null}
        </span>
      </div>
      <NlProgressBar value={typeof value === "number" ? value : 0} max={100} tone={meta.tone} showValue={false} />
    </div>
  );
}

/** Mini-Balken mit --accent-Füllung (Best-Disziplinen). NlProgressBar kann keine
 *  rohe Team-Farbe füllen (es nutzt Ton-Tokens), daher ein schlanker Eigenbalken. */
function AccentMiniBar({ value, max = 100 }: { value: number; max?: number }) {
  const ratio = Math.max(0, Math.min(1, value / (max > 0 ? max : 100)));
  return (
    <div style={{ height: 6, borderRadius: 999, background: "var(--nl-bg-2, var(--nl-bg))", border: "1px solid var(--nl-line)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.round(ratio * 1000) / 10}%`, borderRadius: "inherit", background: "var(--accent)" }} />
    </div>
  );
}

/** Kleine KPI-Kachel; `role="primary"` zieht --accent (Glow + Rahmen). */
function HeadlineTile({
  label,
  value,
  rank,
  role,
  big,
}: {
  label: string;
  value: string;
  rank?: string | null;
  role?: "primary" | "neutral";
  big?: boolean;
}) {
  const primary = role === "primary";
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        textAlign: "center",
        borderRadius: 10,
        padding: "8px 6px",
        background: primary ? "color-mix(in srgb, var(--accent) 12%, var(--nl-panel))" : "var(--nl-panel)",
        border: primary ? "1px solid color-mix(in srgb, var(--accent) 55%, var(--nl-line))" : "1px solid var(--nl-line)",
        boxShadow: primary ? "0 0 16px color-mix(in srgb, var(--accent) 22%, transparent)" : undefined,
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 700 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: big ? 24 : 18,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          marginTop: 2,
          color: primary ? "var(--accent)" : "var(--nl-ink)",
        }}
      >
        {value}
      </div>
      {rank ? <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--nl-mut)", marginTop: 1 }}>{rank}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inhalt: Spieler
// ---------------------------------------------------------------------------

function PlayerBody({
  gameState,
  playerId,
  disciplineId,
}: {
  gameState: GameState;
  playerId: string;
  disciplineId: string;
}) {
  const player = findPlayer(gameState, playerId);

  // Vollprofil-Datenbuilder wiederverwenden (konsistente Ränge, keine Neuberechnung).
  // Defensiv: schlägt der Builder fehl, greifen direkte gameState-Felder als Fallback.
  const data: PlayerDetailDrawerData | null = useMemo(() => {
    try {
      return buildPlayerDrawerDataFromGameState({ gameState, playerId, source: "sqlite" });
    } catch {
      return null;
    }
  }, [gameState, playerId]);

  if (!player) {
    return <div style={{ fontSize: 13, color: "var(--nl-mut)", fontStyle: "italic" }}>Spieler nicht gefunden.</div>;
  }

  const team = findTeamOfPlayer(gameState, playerId);
  const color = getTeamColor(team?.shortCode ?? null);
  const hasSecondary = teamHasSecondary(team?.shortCode ?? null);
  const portraitUrl = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl ?? null, player.portraitPath ?? null);
  const logoUrl = team ? getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null) : null;
  const roleLabel = player.referenceClass || player.className || null;
  const bracketLabel = player.bracketLabel || null;

  // Achsenwerte: Builder-Werte bevorzugt (mit Rang), sonst rohe coreStats.
  const axisById = new Map((data?.axisCards ?? []).map((c) => [c.id, c] as const));

  // Kopfzahlen.
  const ovr = data?.ovr ?? playerOverall(player);
  const ovrRank = data?.ovrRank ?? null;
  const pps = data?.pps ?? player.pps ?? null;
  const ppsRank = data?.ppsRank ?? null;
  const mvs = player.economyAfterUpgradePreview?.mvsUnchanged ?? data?.mvs ?? null;
  const mvsRank = data?.mvsRank ?? null;

  // Aktuelle Disziplin.
  const discEntry = (data?.disciplineValues ?? []).find((d) => d.id === disciplineId) ?? null;
  const currentDiscValue =
    discEntry?.value ?? player.currentDisciplineValues?.[disciplineId] ?? player.disciplineRatings?.[disciplineId] ?? null;
  const currentDiscRank = discEntry?.rank ?? null;

  // Beste Disziplinen (Builder liefert bereits absteigend sortiert) – Top-3.
  let best: Array<{ id: string; label: string; value: number; rank: number | null }> = (data?.disciplineValues ?? [])
    .filter((d) => typeof d.value === "number")
    .slice(0, 3)
    .map((d) => ({ id: d.id, label: d.label, value: d.value as number, rank: d.rank ?? null }));
  if (best.length === 0) {
    const src = player.currentDisciplineValues ?? player.disciplineRatings ?? {};
    best = Object.entries(src)
      .filter(([, v]) => typeof v === "number")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, v]) => ({ id, label: disciplineName(gameState, id), value: v, rank: null }));
  }

  const topPositive = (data?.traitsPositive ?? player.traitsPositive ?? []).slice(0, 4);
  const topNegative = (data?.traitsNegative ?? player.traitsNegative ?? []).slice(0, 2);
  const hasTraits = topPositive.length > 0 || topNegative.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Kopf – großes Portrait als Blickfang */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* --nl-accent lokal auf die Team-Farbe biegen → Portrait-Ring wird team-akzentuiert */}
        <span style={withVars({ "--nl-accent": "var(--accent)" }, { display: "inline-flex", flex: "none" })}>
          <PlayerMark src={portraitUrl} alt={player.name} size={84} spotlight title={player.name} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TeamMark
              src={logoUrl}
              alt={team?.name ?? ""}
              size={40}
              radius={9}
              placeholderColor={color.primary}
              placeholderSecondaryColor={hasSecondary ? color.secondary ?? null : null}
              placeholderLabel={team?.shortCode ?? null}
              title={team?.name ?? undefined}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {player.name}
              </div>
              {team ? (
                <div style={{ fontSize: 12, color: "var(--nl-mut)", marginTop: 1 }}>
                  <span style={{ fontWeight: 800 }}>{team.shortCode}</span> · {team.name}
                </div>
              ) : null}
            </div>
          </div>
          {(roleLabel || bracketLabel) ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {roleLabel ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "3px 9px",
                    borderRadius: 999,
                    color: "var(--accent)",
                    border: "1px solid color-mix(in srgb, var(--accent) 55%, var(--nl-line))",
                    background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                  }}
                >
                  {roleLabel}
                </span>
              ) : null}
              {bracketLabel ? (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, color: "var(--nl-mut)", border: "1px solid var(--nl-line)" }}>
                  {bracketLabel}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Aktuelle Disziplin (hervorgehoben, --accent) */}
      <Section title="Aktuelle Disziplin" accentRole="primary">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {disciplineName(gameState, disciplineId)}
          </span>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flex: "none" }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
              {typeof currentDiscValue === "number" ? fmt1(currentDiscValue) : "–"}
            </span>
            {rankLabel(currentDiscRank) ? (
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--nl-mut)" }}>{rankLabel(currentDiscRank)}</span>
            ) : null}
          </span>
        </div>
      </Section>

      {/* Kopfzahlen: OVR (groß, --accent), PP, MVS */}
      <div style={{ display: "flex", gap: 6 }}>
        <HeadlineTile label="OVR" value={ovr != null ? fmt1(ovr) : "–"} rank={rankLabel(ovrRank)} role="primary" big />
        <HeadlineTile label="PP" value={pps != null ? fmt1(pps) : "–"} rank={rankLabel(ppsRank)} />
        {mvs != null ? <HeadlineTile label="MVS" value={fmt1(mvs)} rank={rankLabel(mvsRank)} /> : null}
      </div>

      {/* Achsen (feste Töne, nie team-eingefärbt) */}
      <Section title="Kernwerte">
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {AXES.map((meta) => {
            const card = axisById.get(meta.id);
            const value = (card?.value ?? player.coreStats?.[meta.coreKey]) ?? null;
            const rank = card?.valueRank ?? null;
            return <AxisBar key={meta.id} meta={meta} value={value} rank={rank} />;
          })}
        </div>
      </Section>

      {/* Beste Disziplinen (--accent-Füllung) */}
      {best.length > 0 ? (
        <Section title="Beste Disziplinen" accentRole="primary">
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {best.map((d) => (
              <div key={d.id}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
                  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, flex: "none", fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)" }}>{fmt1(d.value)}</span>
                    {rankLabel(d.rank) ? <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--nl-mut)" }}>{rankLabel(d.rank)}</span> : null}
                  </span>
                </div>
                <AccentMiniBar value={d.value} />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Traits */}
      {hasTraits ? (
        <Section title="Wichtigste Traits">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {topPositive.map((t) => (
              <TraitChip key={`pos-${t}`} text={t} tone="good" />
            ))}
            {topNegative.map((t) => (
              <TraitChip key={`neg-${t}`} text={t} tone="risk" />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inhalt: Team
// ---------------------------------------------------------------------------

/** Eine kompakte Spielerzeile im Team-Lineup. */
function LineupRow({
  gameState,
  playerId,
  slotLabel,
  rank,
  railColor,
  unavailable,
  onSelectPlayer,
}: {
  gameState: GameState;
  playerId: string;
  slotLabel?: string | null;
  rank: number | null;
  /** Farbe des 2px-Rails links (Sektions-Marker). */
  railColor?: string | null;
  unavailable?: boolean;
  onSelectPlayer?: ((playerId: string) => void) | null;
}) {
  const player = findPlayer(gameState, playerId);
  if (!player) return null;
  const portraitUrl = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl ?? null, player.portraitPath ?? null);
  const ovr = playerOverall(player);
  const pps = player.pps ?? null;
  const clickable = Boolean(onSelectPlayer);
  return (
    <div
      onClick={clickable ? () => onSelectPlayer!(player.id) : undefined}
      title={clickable ? "Spieler-Karte anzeigen" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 8px",
        borderRadius: 9,
        cursor: clickable ? "pointer" : "default",
        borderLeft: railColor ? `2px solid ${railColor}` : "2px solid transparent",
        background: "var(--nl-panel)",
        opacity: unavailable ? 0.62 : 1,
      }}
    >
      <PlayerMark src={portraitUrl} alt={player.name} size={38} title={player.name} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {player.name}
          </span>
          {unavailable ? (
            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--nl-risk)", flex: "none" }}>✚</span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
          {slotLabel ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--nl-mut)", flex: "none" }}>{slotLabel}</span>
          ) : null}
          {/* Achsen-Pips (feste Töne, nie team-eingefärbt) */}
          <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 12 }}>
            {AXES.map((meta) => {
              const v = player.coreStats?.[meta.coreKey] ?? 0;
              const h = Math.max(2, Math.min(12, Math.round((v / 100) * 12)));
              return (
                <span
                  key={meta.id}
                  title={`${meta.label} ${fmt1(v)}`}
                  style={{ width: 4, height: h, borderRadius: 2, background: `var(--nl-${meta.tone})`, display: "inline-block" }}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "none", fontVariantNumeric: "tabular-nums" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 10, color: "var(--nl-mut)", fontWeight: 700 }}>OVR</span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{ovr != null ? fmt1(ovr) : "–"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {pps != null ? <span style={{ fontSize: 10.5, color: "var(--nl-mut)", fontWeight: 700 }}>PP {fmt1(pps)}</span> : null}
          {rankLabel(rank) ? (
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--nl-mut)", border: "1px solid var(--nl-line)", borderRadius: 999, padding: "1px 6px" }}>
              {rankLabel(rank)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TeamBody({
  gameState,
  teamId,
  disciplineId,
  onSelectPlayer,
}: {
  gameState: GameState;
  teamId: string;
  disciplineId: string;
  onSelectPlayer?: ((playerId: string) => void) | null;
}) {
  const team = findTeam(gameState, teamId);

  // Liga-weiter OVR-Rang (leichtgewichtig, einmal je Render) für die Rang-Badges.
  const ovrRankById = useMemo(() => {
    const sorted = (gameState.players ?? [])
      .map((p) => ({ id: p.id, ovr: playerOverall(p) }))
      .filter((x): x is { id: string; ovr: number } => x.ovr != null)
      .sort((a, b) => b.ovr - a.ovr);
    const m = new Map<string, number>();
    sorted.forEach((x, i) => m.set(x.id, i + 1));
    return m;
  }, [gameState.players]);

  if (!team) {
    return <div style={{ fontSize: 13, color: "var(--nl-mut)", fontStyle: "italic" }}>Team nicht gefunden.</div>;
  }

  const color = getTeamColor(team.shortCode);
  const hasSecondary = teamHasSecondary(team.shortCode);
  const logoUrl = getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null);

  const standing = gameState.seasonState?.standings?.[teamId] ?? null;
  const rank = standing?.rank ?? standing?.startplatz ?? null;
  const points = standing?.points ?? null;

  // Lineup-Kontext für diesen Spieltag (defensiv – Schedule/Draft können fehlen).
  const schedule = getCurrentMatchdayDisciplineSchedule(gameState);
  const draft = getTeamMatchdayLineupDraft(gameState, teamId);
  const entries = draft?.entries ?? [];

  const currentSide: "d1" | "d2" = schedule?.discipline1?.disciplineId === disciplineId ? "d1" : "d2";
  const otherSide: "d1" | "d2" = currentSide === "d1" ? "d2" : "d1";
  const otherDisciplineId =
    (currentSide === "d1" ? schedule?.discipline2?.disciplineId : schedule?.discipline1?.disciplineId) ?? null;

  const section1 = entries.filter((e) => e.disciplineSide === currentSide);
  const section2 = entries.filter((e) => e.disciplineSide === otherSide);
  const deployedIds = new Set(entries.map((e) => e.activePlayerId ?? e.playerId));
  const rosterIds = (gameState.rosters ?? []).filter((r) => r.teamId === teamId).map((r) => r.playerId);
  const benchIds = rosterIds.filter((id) => !deployedIds.has(id));

  const matchdayId = gameState.matchdayState?.matchdayId ?? "";
  const isUnavailable = (pid: string): boolean => {
    if (!matchdayId) return false;
    try {
      return getPlayerAvailabilityView(gameState, pid, teamId, matchdayId).isUnavailable;
    } catch {
      return false;
    }
  };

  const secondaryRail = "color-mix(in srgb, var(--accent2) 70%, transparent)";
  const hasLineupContext = Boolean(schedule || draft);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Kopf – großes Crest als Blickfang */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <TeamMark
          src={logoUrl}
          alt={team.name}
          size={72}
          radius={14}
          placeholderColor={color.primary}
          placeholderSecondaryColor={hasSecondary ? color.secondary ?? null : null}
          placeholderLabel={team.shortCode}
          title={team.name}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {team.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--nl-mut)", marginTop: 2, fontWeight: 800 }}>{team.shortCode}</div>
          {standing ? (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <div
                style={{
                  textAlign: "center",
                  borderRadius: 9,
                  padding: "5px 12px",
                  background: "color-mix(in srgb, var(--accent) 12%, var(--nl-panel))",
                  border: "1px solid color-mix(in srgb, var(--accent) 55%, var(--nl-line))",
                }}
              >
                <div style={{ fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 700 }}>
                  Saison-Rang
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
                  {rank != null ? rank : "–"}
                </div>
              </div>
              <div style={{ textAlign: "center", borderRadius: 9, padding: "5px 12px", background: "var(--nl-panel)", border: "1px solid var(--nl-line)" }}>
                <div style={{ fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 700 }}>
                  Punkte
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                  {typeof points === "number" ? fmt1(points) : "–"}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!hasLineupContext ? (
        <div style={{ fontSize: 12.5, color: "var(--nl-mut)", fontStyle: "italic", padding: "4px 2px" }}>
          Für diesen Spieltag liegt noch keine Aufstellung vor.
        </div>
      ) : null}

      {/* Sektion 1: In dieser Disziplin (--accent, primär) */}
      <Section title="In dieser Disziplin" accentRole="primary" right={<span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>{disciplineName(gameState, disciplineId)}</span>}>
        {section1.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {section1
              .slice()
              .sort((a, b) => a.slotIndex - b.slotIndex)
              .map((e) => {
                const pid = e.activePlayerId ?? e.playerId;
                return (
                  <LineupRow
                    key={`${e.disciplineSide}-${e.slotIndex}-${pid}`}
                    gameState={gameState}
                    playerId={pid}
                    slotLabel={`Slot ${e.slotIndex + 1}`}
                    rank={ovrRankById.get(pid) ?? null}
                    railColor="var(--accent)"
                    unavailable={isUnavailable(pid)}
                    onSelectPlayer={onSelectPlayer}
                  />
                );
              })}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--nl-mut)", fontStyle: "italic" }}>Keine Aufstellung für diese Disziplin.</div>
        )}
      </Section>

      {/* Sektion 2: Andere Disziplin (Spieltag) (--accent2, sekundär) */}
      {section2.length > 0 ? (
        <Section
          title="Andere Disziplin (Spieltag)"
          accentRole="secondary"
          right={
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent2)", border: "1px solid color-mix(in srgb, var(--accent2) 45%, var(--nl-line))", borderRadius: 999, padding: "2px 8px" }}>
              {otherDisciplineId ? disciplineName(gameState, otherDisciplineId) : "—"}
            </span>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {section2
              .slice()
              .sort((a, b) => a.slotIndex - b.slotIndex)
              .map((e) => {
                const pid = e.activePlayerId ?? e.playerId;
                return (
                  <LineupRow
                    key={`${e.disciplineSide}-${e.slotIndex}-${pid}`}
                    gameState={gameState}
                    playerId={pid}
                    slotLabel={`Slot ${e.slotIndex + 1}`}
                    rank={ovrRankById.get(pid) ?? null}
                    railColor={secondaryRail}
                    unavailable={isUnavailable(pid)}
                    onSelectPlayer={onSelectPlayer}
                  />
                );
              })}
          </div>
        </Section>
      ) : null}

      {/* Sektion 3: Ersatzbank (neutral) */}
      {benchIds.length > 0 ? (
        <Section title={`Ersatzbank (${benchIds.length})`} accentRole="neutral">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {benchIds.map((pid) => (
              <LineupRow
                key={pid}
                gameState={gameState}
                playerId={pid}
                rank={ovrRankById.get(pid) ?? null}
                unavailable={isUnavailable(pid)}
                onSelectPlayer={onSelectPlayer}
              />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer-Rahmen
// ---------------------------------------------------------------------------

export default function DisciplineStageDrawer({
  target,
  gameState,
  disciplineId,
  onSelectPlayer,
  onClose,
}: DisciplineStageDrawerProps): React.JSX.Element | null {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!target) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );
  useEffect(() => {
    if (!target) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [target, handleKeyDown]);

  const headerTitle = useMemo(() => {
    if (!target) return "";
    return target.kind === "player" ? "Spieler-Karte" : "Team-Karte";
  }, [target]);

  // 2-Farben-Contract: Team-Kürzel je nach Ziel bestimmen und CSS-Variablen ableiten.
  const themeVars = useMemo<Record<string, string>>(() => {
    let code: string | null = null;
    if (target?.kind === "player") {
      code = findTeamOfPlayer(gameState, target.playerId)?.shortCode ?? null;
    } else if (target?.kind === "team") {
      code = findTeam(gameState, target.teamId)?.shortCode ?? null;
    }
    const color = getTeamColor(code);
    const hasSecondary = teamHasSecondary(code);
    return {
      "--team-a": color.primary,
      "--team-b": hasSecondary ? color.secondary ?? "var(--nl-line-2)" : "var(--nl-line-2)",
      "--accent": floorTeamAccent(color.primary),
      "--accent2": hasSecondary && color.secondary ? floorTeamAccent(color.secondary) : "var(--nl-mut)",
    };
  }, [target, gameState]);

  if (!target) return null;

  const translate = entered || reducedMotion ? "0" : "100%";
  const transition = reducedMotion ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "color-mix(in srgb, var(--nl-bg) 62%, transparent)",
          opacity: entered || reducedMotion ? 1 : 0,
          transition: reducedMotion ? "none" : "opacity 220ms ease",
        }}
      />

      {/* Panel – trägt die vier Team-CSS-Variablen */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={headerTitle}
        style={withVars(themeVars, {
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(440px, 94vw)",
          zIndex: 60,
          background: "var(--nl-panel)",
          borderLeft: "1px solid var(--nl-line)",
          boxShadow: "-8px 0 32px color-mix(in srgb, var(--nl-bg) 70%, transparent)",
          display: "flex",
          flexDirection: "column",
          transform: `translateX(${translate})`,
          transition,
        })}
      >
        {/* Top-Hairline: links 0–55% --accent, rechts 55–100% --accent2 */}
        <div
          aria-hidden
          style={{
            height: 3,
            flex: "none",
            background: "linear-gradient(to right, var(--accent) 0 55%, var(--accent2) 55% 100%)",
          }}
        />

        {/* Kopfzeile mit diagonalem RAW-Team-Keil */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid var(--nl-line)",
            flex: "none",
            overflow: "hidden",
          }}
        >
          {/* kleiner diagonaler Keil (RAW ↙team-a / ↗team-b) */}
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 46,
              height: 46,
              opacity: 0.7,
              background: "linear-gradient(to top right, var(--team-a) 0 50%, var(--team-b) 50% 100%)",
              clipPath: "polygon(100% 0, 100% 100%, 0 0)",
              pointerEvents: "none",
            }}
          />
          <div style={{ ...labelStyle, marginBottom: 0 }}>{headerTitle}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            title="Schließen (Esc)"
            style={{
              position: "relative",
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "1px solid var(--nl-line)",
              background: "var(--nl-bg)",
              color: "var(--nl-mut)",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            ×
          </button>
        </div>

        {/* dünnes sekundäres Rail unter dem Header (--accent2, gedämpft) */}
        <div aria-hidden style={{ height: 2, flex: "none", background: "color-mix(in srgb, var(--accent2) 70%, transparent)" }} />

        {/* Scroll-Inhalt */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14 }}>
          {target.kind === "player" ? (
            <PlayerBody gameState={gameState} playerId={target.playerId} disciplineId={disciplineId} />
          ) : (
            <TeamBody gameState={gameState} teamId={target.teamId} disciplineId={disciplineId} onSelectPlayer={onSelectPlayer} />
          )}
        </div>
      </aside>
    </div>
  );
}
