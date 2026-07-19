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

// Ringfarbe nach Priorität: 1) Spotlight 2) eigenes Team 3) Relation 4) Standard.
export function markRingColor(opts: { spotlight?: boolean; isOwn?: boolean; relation?: MarkRelation }): string {
  if (opts.spotlight) return "var(--nl-accent)";
  if (opts.isOwn) return "var(--nl-accent)";
  if (opts.relation === "ally") return MARK_ALLY_BLUE;
  if (opts.relation === "rival") return "var(--nl-risk)";
  return "var(--nl-line)";
}

// Medaillenfarbe (Badge, nicht Ring): Gold/Silber/Bronze.
export function markMedalColor(medal: MarkMedal): string | null {
  if (medal === "gold") return "var(--nl-warn)";
  if (medal === "silver") return "var(--nl-mut)";
  if (medal === "bronze") return "rgb(205,127,50)";
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
  onClick?: (() => void) | null;
  title?: string;
};

export default function PlayerMark({ src, alt = "", size = 28, isOwn = false, relation = null, spotlight = false, medal = null, onClick, title }: PlayerMarkProps) {
  const [failed, setFailed] = useState(false);
  const ring = markRingColor({ spotlight, isOwn, relation });
  const ringWidth = spotlight || isOwn ? 2 : 1;
  const medalTone = markMedalColor(medal);
  const showImg = Boolean(src) && !failed;
  const badge = Math.max(11, Math.round(size * 0.42));

  return (
    <span
      onClick={onClick ?? undefined}
      title={title}
      style={{
        position: "relative",
        width: size,
        height: size,
        flex: "none",
        display: "inline-block",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={alt}
          width={size}
          height={size}
          onError={() => setFailed(true)}
          style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block", border: `${ringWidth}px solid ${ring}`, boxShadow: spotlight ? `0 0 0 2px color-mix(in srgb, ${ring} 40%, transparent)` : undefined }}
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
    </span>
  );
}
