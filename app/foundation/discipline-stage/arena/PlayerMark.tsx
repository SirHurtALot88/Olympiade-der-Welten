"use client";

import { useState } from "react";

import {
  getPlayerStarTierLabel,
  isHoloPlayerStarTier,
  type PlayerStarTier,
} from "@/lib/foundation/player-star-tier";

// Zentrale Portrait-Marke für die Disziplin-Bühne: rundes Spielerbild mit
// einheitlichem RING-Prioritätssystem (ein Ring, höchste Priorität gewinnt) und
// optionaler Medaillen-BADGE (Eck-Pille, KEIN Ring). Alle Farben als
// var(--nl-*)/hsl()/rgb() — kein Hex (Design-Token-Lint bleibt sauber).

export type MarkRelation = "ally" | "rival" | null;
export type MarkMedal = "gold" | "silver" | "bronze" | null;

// Ruhiges Blau für Verbündete — Border-Ton, nie Füllung.
export const MARK_ALLY_BLUE = "hsl(210 70% 60%)";

// Ringfarbe nach Priorität: 1) Verletzung 2) Spotlight 3) eigenes Team 4) Relation 5) Standard.
// Verletzung gewinnt IMMER — das ist der ganze Punkt des optischen Feedbacks: ein
// verletzter Spieler darf nie als "normal aktiv" (Accent-Ring) durchgehen.
export function markRingColor(opts: { injury?: boolean; spotlight?: boolean; isOwn?: boolean; relation?: MarkRelation }): string {
  if (opts.injury) return "var(--nl-risk)";
  if (opts.spotlight) return "var(--nl-accent)";
  if (opts.isOwn) return "var(--nl-accent)";
  if (opts.relation === "ally") return MARK_ALLY_BLUE;
  if (opts.relation === "rival") return "var(--nl-risk)";
  return "var(--nl-line)";
}

// Medaillenfarbe (Badge, nicht Ring): Gold/Silber/Bronze.
export function markMedalColor(medal: MarkMedal): string | null {
  if (medal === "gold") return "var(--nl-gold)";
  if (medal === "silver") return "var(--nl-silver)";
  if (medal === "bronze") return "var(--nl-bronze)";
  return null;
}

// Star-Tier-Farbe (ligaweite Top-Riege, siehe lib/foundation/player-star-tier.ts).
// Bewusst NICHT Teil der Ring-Prioritätskette: der innere Ring trägt weiterhin
// Verletzung/Spotlight/eigenes Team/Relation — die Star-Stufe kommt als
// ZUSÄTZLICHER Außenring dazu. Sonst müsste man sich zwischen "das ist meiner"
// und "das ist ein Star" entscheiden, und in der Arena braucht man beides.
export function markStarTierColor(tier: PlayerStarTier | null | undefined): string | null {
  if (tier === "diamond") return "var(--nl-diamond)";
  if (tier === "gold") return "var(--nl-gold)";
  if (tier === "silver") return "var(--nl-silver)";
  if (tier === "bronze") return "var(--nl-bronze)";
  return null;
}

const MEDAL_SHORT: Record<NonNullable<MarkMedal>, string> = { gold: "1", silver: "2", bronze: "3" };

export type PlayerMarkProps = {
  src?: string | null;
  alt?: string;
  size?: number;
  isOwn?: boolean;
  relation?: MarkRelation;
  spotlight?: boolean;
  medal?: MarkMedal;
  // Verletzung (same-day, aktueller Spieltag): erzwingt den Risk-Ring (höchste
  // Priorität, siehe markRingColor) + eine eigene Eck-Badge (Gegenecke zur
  // Medaille, damit beide gleichzeitig sichtbar bleiben) + einen dauerhaft
  // pulsierenden Außenring — DAS ist das "wirklich optisch sehen"-Feedback,
  // nicht nur der einmalige Ticker-/Flug-Text.
  injury?: boolean;
  // Ligaweite Top-Riege (Top 50/25/10/3) — rendert einen zusätzlichen
  // Außenring in der Tier-Farbe, ohne den inneren Ring zu verdrängen.
  starTier?: PlayerStarTier | null;
  onClick?: (() => void) | null;
  title?: string;
};

export default function PlayerMark({ src, alt = "", size = 28, isOwn = false, relation = null, spotlight = false, medal = null, injury = false, starTier = null, onClick, title }: PlayerMarkProps) {
  const [failed, setFailed] = useState(false);
  const ring = markRingColor({ injury, spotlight, isOwn, relation });
  const ringWidth = injury || spotlight || isOwn ? 2 : 1;
  const medalTone = markMedalColor(medal);
  const starTone = markStarTierColor(starTier);
  const starTierLabel = getPlayerStarTierLabel(starTier);
  // Bei kleinen Marken (Einsatzlisten, Top-Spieler-Chips, 24–32px) frisst der
  // sonst 2px breite Star-Ring zu viel vom Portrait — dort dünner und näher
  // am Bild. Mittlere/große Marken (Kopf-Portrait im Drawer, Spotlight)
  // bleiben unverändert.
  const starRingWidth = size < 36 ? 1 : 2;
  const starRingInset = injury ? -(starRingWidth * 3 + 1) : -(starRingWidth + 1);
  const showImg = Boolean(src) && !failed;
  const badge = Math.max(11, Math.round(size * 0.42));
  const injuryBadge = Math.max(11, Math.round(size * 0.44));

  return (
    <span
      onClick={onClick ?? undefined}
      title={[title, injury ? "Verletzt" : null, starTierLabel].filter(Boolean).join(" · ") || undefined}
      style={{
        position: "relative",
        width: size,
        height: size,
        flex: "none",
        display: "inline-block",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      {starTone ? (
        // Star-Ring außen um den regulären Ring. Bei Verletzung sitzt der
        // pulsierende Risk-Ring auf derselben Höhe — dann rückt der Star-Ring
        // eine Stufe weiter nach außen, damit beide sichtbar bleiben.
        <span
          aria-hidden
          className={`arena-mark-star-ring is-${starTier}${isHoloPlayerStarTier(starTier) ? " is-star-holo" : ""}`}
          style={{
            position: "absolute",
            inset: starRingInset,
            borderRadius: "50%",
            border: `${starRingWidth}px solid ${starTone}`,
            boxShadow: `0 0 ${starRingWidth === 1 ? 4 : 6}px color-mix(in srgb, ${starTone} 45%, transparent)`,
            pointerEvents: "none",
          }}
        />
      ) : null}
      {injury ? (
        // Dauerhaft pulsierender Außenring — persistentes Signal, solange die
        // Marke sichtbar ist (kein Timeout, kein Ausblenden).
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            border: "2px solid var(--nl-risk)",
            opacity: 0.6,
            animation: "olyGlowPulse 1.3s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      ) : null}
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={alt}
          width={size}
          height={size}
          onError={() => setFailed(true)}
          style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block", border: `${ringWidth}px solid ${ring}`, boxShadow: spotlight || injury ? `0 0 0 2px color-mix(in srgb, ${ring} 40%, transparent)` : undefined }}
        />
      ) : (
        <span
          aria-hidden
          style={{ width: size, height: size, borderRadius: "50%", display: "block", background: "var(--nl-bg)", border: `${ringWidth}px solid ${ring}` }}
        />
      )}
      {medalTone ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            minWidth: badge,
            height: badge,
            padding: "0 3px",
            borderRadius: 99,
            display: "grid",
            placeItems: "center",
            fontSize: Math.max(8, Math.round(badge * 0.62)),
            fontWeight: 900,
            color: "var(--nl-bg)",
            background: medalTone,
            border: "1px solid var(--nl-bg)",
            boxSizing: "border-box",
          }}
        >
          {MEDAL_SHORT[medal!]}
        </span>
      ) : null}
      {injury ? (
        <span
          aria-hidden
          title="Verletzt"
          style={{
            position: "absolute",
            left: -2,
            top: -2,
            minWidth: injuryBadge,
            height: injuryBadge,
            padding: "0 3px",
            borderRadius: 99,
            display: "grid",
            placeItems: "center",
            fontSize: Math.max(9, Math.round(injuryBadge * 0.66)),
            fontWeight: 900,
            color: "var(--nl-bg)",
            background: "var(--nl-risk)",
            border: "1px solid var(--nl-bg)",
            boxSizing: "border-box",
          }}
        >
          +
        </span>
      ) : null}
    </span>
  );
}
