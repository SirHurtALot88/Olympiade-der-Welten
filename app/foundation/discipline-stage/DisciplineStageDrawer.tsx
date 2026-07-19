"use client";

// Kompakter, rein präsentationaler Drawer für die Disziplin-Bühne.
// Öffnet als Overlay über der laufenden Arena (die im Hintergrund gemountet bleibt) und
// zeigt eine Kurz-Karte für einen Spieler oder ein Team. KEINE Navigation, KEINE Fetches —
// alles wird defensiv aus `gameState` gelesen. Fehlende Felder werden weggelassen.

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import type { GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { fmt1 } from "./stage-format";

export type DisciplineStageDrawerTarget =
  | { kind: "player"; playerId: string }
  | { kind: "team"; teamId: string }
  | null;

export type DisciplineStageDrawerProps = {
  target: DisciplineStageDrawerTarget;
  gameState: GameState;
  onClose: () => void;
  onOpenFull?: (target: { kind: "player"; playerId: string } | { kind: "team"; teamId: string }) => void;
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

/** Team eines Spielers über die Roster-Zuordnung ermitteln (falls vorhanden). */
function findTeamOfPlayer(gameState: GameState, playerId: string): Team | null {
  const entry = gameState.rosters?.find((r) => r.playerId === playerId);
  if (!entry) return null;
  return findTeam(gameState, entry.teamId);
}

/** Spieler eines Teams (über Roster). */
function findRosterPlayers(gameState: GameState, teamId: string): Player[] {
  const ids = new Set((gameState.rosters ?? []).filter((r) => r.teamId === teamId).map((r) => r.playerId));
  return (gameState.players ?? []).filter((p) => ids.has(p.id));
}

/** Gesamt-Rating eines Spielers: OVR bevorzugt, sonst rating. */
function playerOverall(p: Player): number | null {
  if (typeof p.ovr === "number") return p.ovr;
  if (typeof p.rating === "number") return p.rating;
  return null;
}

/** Anzeigename einer Disziplin über die Disziplin-Liste, sonst die ID. */
function disciplineName(gameState: GameState, disciplineId: string): string {
  return gameState.disciplines?.find((d) => d.id === disciplineId)?.name ?? disciplineId;
}

// ---------------------------------------------------------------------------
// Wiederverwendbare Style-Bausteine (nur --nl-* Tokens, keine rohen Hex-Farben)
// ---------------------------------------------------------------------------

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.13em",
  textTransform: "uppercase",
  color: "var(--nl-mut)",
  fontWeight: 800,
  marginBottom: 8,
};

const cardStyle: React.CSSProperties = {
  background: "var(--nl-bg)",
  border: "1px solid var(--nl-line)",
  borderRadius: 12,
  padding: 12,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{title}</div>
      {children}
    </div>
  );
}

function AxisTile({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: "var(--nl-panel)",
        border: "1px solid var(--nl-line)",
        borderRadius: 10,
        padding: "8px 6px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
        {typeof value === "number" ? fmt1(value) : "–"}
      </div>
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

// ---------------------------------------------------------------------------
// Inhalt: Spieler
// ---------------------------------------------------------------------------

function PlayerBody({ gameState, playerId }: { gameState: GameState; playerId: string }) {
  const player = findPlayer(gameState, playerId);
  if (!player) {
    return <div style={{ fontSize: 13, color: "var(--nl-mut)", fontStyle: "italic" }}>Spieler nicht gefunden.</div>;
  }

  const team = findTeamOfPlayer(gameState, playerId);
  const portraitUrl = getPlayerPortraitBrowserUrl(player.id, player.portraitUrl ?? null, player.portraitPath ?? null);
  const overall = playerOverall(player);

  // Position/Archetyp: referenceClass bevorzugt, sonst className.
  const roleLabel = player.referenceClass || player.className || null;

  const topPositive = (player.traitsPositive ?? []).slice(0, 4);
  const topNegative = (player.traitsNegative ?? []).slice(0, 2);
  const hasTraits = topPositive.length > 0 || topNegative.length > 0;

  // Disziplin-Werte: aktuelle Werte bevorzugt, sonst statische Ratings. Top-5 absteigend.
  const disciplineSource = player.currentDisciplineValues ?? player.disciplineRatings ?? {};
  const topDisciplines = Object.entries(disciplineSource)
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Kopf */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portraitUrl}
            alt=""
            width={56}
            height={56}
            style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flex: "none", border: "1px solid var(--nl-line)" }}
          />
        ) : (
          <span
            aria-hidden
            style={{ width: 56, height: 56, borderRadius: "50%", flex: "none", background: "var(--nl-bg)", border: "1px solid var(--nl-line)" }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {player.name}
          </div>
          {team ? (
            <div style={{ fontSize: 12, color: "var(--nl-mut)", marginTop: 2 }}>
              <span style={{ fontWeight: 700 }}>{team.shortCode}</span> · {team.name}
            </div>
          ) : null}
          {roleLabel ? (
            <div style={{ fontSize: 11.5, color: "var(--nl-mut)", marginTop: 1 }}>{roleLabel}</div>
          ) : null}
        </div>
      </div>

      {/* Achsen + Gesamt */}
      <Section title="Kernwerte">
        <div style={{ display: "flex", gap: 6 }}>
          <AxisTile label="Power" value={player.coreStats?.pow} />
          <AxisTile label="Speed" value={player.coreStats?.spe} />
          <AxisTile label="Mental" value={player.coreStats?.men} />
          <AxisTile label="Social" value={player.coreStats?.soc} />
        </div>
        {overall != null ? (
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 10 }}>
            <span style={{ fontSize: 12, color: "var(--nl-mut)", fontWeight: 700 }}>Gesamt-Rating (OVR)</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--nl-accent)", fontVariantNumeric: "tabular-nums" }}>
              {fmt1(overall)}
            </span>
          </div>
        ) : null}
      </Section>

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

      {/* Disziplin-Ratings Top-5 */}
      {topDisciplines.length > 0 ? (
        <Section title="Beste Disziplinen">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {topDisciplines.map(([id, value]) => (
              <div key={id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {disciplineName(gameState, id)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--nl-accent)", fontVariantNumeric: "tabular-nums", flex: "none" }}>
                  {fmt1(value)}
                </span>
              </div>
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

function TeamBody({ gameState, teamId }: { gameState: GameState; teamId: string }) {
  const team = findTeam(gameState, teamId);
  if (!team) {
    return <div style={{ fontSize: 13, color: "var(--nl-mut)", fontStyle: "italic" }}>Team nicht gefunden.</div>;
  }

  const logoUrl = getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null);
  const standing = gameState.seasonState?.standings?.[teamId] ?? null;
  const roster = findRosterPlayers(gameState, teamId);

  const topPlayers = [...roster]
    .sort((a, b) => (playerOverall(b) ?? 0) - (playerOverall(a) ?? 0))
    .slice(0, 3);

  const rank = standing?.rank ?? standing?.startplatz ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Kopf */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            width={48}
            height={48}
            style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flex: "none", border: "1px solid var(--nl-line)" }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              flex: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--nl-bg)",
              border: "1px solid var(--nl-line)",
              fontWeight: 800,
              fontSize: 15,
              color: "var(--nl-mut)",
            }}
          >
            {team.shortCode}
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {team.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--nl-mut)", marginTop: 2, fontWeight: 700 }}>{team.shortCode}</div>
        </div>
      </div>

      {/* Saison-Tabelle */}
      {standing ? (
        <Section title="Saison">
          <div style={{ display: "flex", gap: 6 }}>
            <div
              style={{
                flex: 1,
                background: "var(--nl-panel)",
                border: "1px solid var(--nl-line)",
                borderRadius: 10,
                padding: "8px 6px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 700 }}>
                Platz
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {rank != null ? rank : "–"}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                background: "var(--nl-panel)",
                border: "1px solid var(--nl-line)",
                borderRadius: 10,
                padding: "8px 6px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nl-mut)", fontWeight: 700 }}>
                Punkte
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: "var(--nl-accent)", fontVariantNumeric: "tabular-nums" }}>
                {typeof standing.points === "number" ? fmt1(standing.points) : "–"}
              </div>
            </div>
          </div>
        </Section>
      ) : null}

      {/* Kader */}
      <Section title="Kader">
        <div style={{ fontSize: 12.5, color: "var(--nl-mut)", marginBottom: topPlayers.length > 0 ? 8 : 0 }}>
          {roster.length} {roster.length === 1 ? "Spieler" : "Spieler"} im Kader
        </div>
        {topPlayers.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11, color: "var(--nl-mut)", fontWeight: 700 }}>Top nach Rating</div>
            {topPlayers.map((p, i) => {
              const ovr = playerOverall(p);
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span style={{ color: "var(--nl-mut)", fontWeight: 800, marginRight: 6 }}>{i + 1}</span>
                    {p.name}
                  </span>
                  {ovr != null ? (
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--nl-accent)", fontVariantNumeric: "tabular-nums", flex: "none" }}>
                      {fmt1(ovr)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawer-Rahmen
// ---------------------------------------------------------------------------

export default function DisciplineStageDrawer({
  target,
  gameState,
  onClose,
  onOpenFull,
}: DisciplineStageDrawerProps): React.JSX.Element | null {
  // `prefers-reduced-motion` respektieren (Client-seitig ermittelt).
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Sanftes Einfahren: nach Mount von 0 → 1 animieren.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!target) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [target]);

  // Escape schließt.
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

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={headerTitle}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(420px, 92vw)",
          zIndex: 60,
          background: "var(--nl-panel)",
          borderLeft: "1px solid var(--nl-line)",
          boxShadow: "-8px 0 32px color-mix(in srgb, var(--nl-bg) 70%, transparent)",
          display: "flex",
          flexDirection: "column",
          transform: `translateX(${translate})`,
          transition,
        }}
      >
        {/* Kopfzeile */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid var(--nl-line)",
            flex: "none",
          }}
        >
          <div style={labelStyle}>{headerTitle}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            title="Schließen (Esc)"
            style={{
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

        {/* Scroll-Inhalt */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14 }}>
          {target.kind === "player" ? (
            <PlayerBody gameState={gameState} playerId={target.playerId} />
          ) : (
            <TeamBody gameState={gameState} teamId={target.teamId} />
          )}
        </div>

        {/* Fußzeile: Volles Profil */}
        {onOpenFull ? (
          <div style={{ padding: 12, borderTop: "1px solid var(--nl-line)", flex: "none" }}>
            <button
              type="button"
              onClick={() => onOpenFull(target)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--nl-line)",
                background: "var(--nl-bg)",
                color: "var(--nl-ink)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Volles Profil öffnen
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
