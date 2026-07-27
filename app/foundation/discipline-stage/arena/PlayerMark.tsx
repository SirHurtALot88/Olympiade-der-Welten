"use client";

import { useState } from "react";

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
  onClick?: (() => void) | null;
  title?: string;
};

export default function PlayerMark({ src, alt = "", size = 28, isOwn = false, relation = null, spotlight = false, medal = null, injury = false, onClick, title }: PlayerMarkProps) {
  const [failed, setFailed] = useState(false);
  const ring = markRingColor({ injury, spotlight, isOwn, relation });
  const ringWidth = injury || spotlight || isOwn ? 2 : 1;
  const medalTone = markMedalColor(medal);
  const showImg = Boolean(src) && !failed;
  const badge = Math.max(11, Math.round(size * 0.42));
  const injuryBadge = Math.max(11, Math.round(size * 0.44));

  return (
    <span
      onClick={onClick ?? undefined}
      title={injury ? `${title ? title + " · " : ""}Verletzt` : title}
      style={{
        position: "relative",
        width: size,
        height: size,
        flex: "none",
        display: "inline-block",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
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
