"use client";

import { useState } from "react";
import { markMedalColor, markRingColor, type MarkMedal, type MarkRelation } from "./PlayerMark";

// Zentrale Logo-Marke für die Disziplin-Bühne: abgerundetes Team-Logo (Rounded
// Rect statt Kreis) mit demselben RING-Prioritätssystem wie PlayerMark und
// optionaler Medaillen-BADGE (Eck-Pille, KEIN Ring). Farben via Tokens/rgb.

const MEDAL_SHORT: Record<NonNullable<MarkMedal>, string> = { gold: "1", silver: "2", bronze: "3" };

export type TeamMarkProps = {
  src?: string | null;
  alt?: string;
  size?: number;
  radius?: number;
  isOwn?: boolean;
  relation?: MarkRelation;
  spotlight?: boolean;
  medal?: MarkMedal;
  onClick?: (() => void) | null;
  title?: string;
};

export default function TeamMark({ src, alt = "", size = 22, radius = 5, isOwn = false, relation = null, spotlight = false, medal = null, onClick, title }: TeamMarkProps) {
  const [failed, setFailed] = useState(false);
  const ring = markRingColor({ spotlight, isOwn, relation });
  const ringWidth = spotlight || isOwn ? 2 : 1;
  const medalTone = markMedalColor(medal);
  const showImg = Boolean(src) && !failed;
  const badge = Math.max(10, Math.round(size * 0.5));

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
          style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", display: "block", border: `${ringWidth}px solid ${ring}`, boxShadow: spotlight ? `0 0 0 2px color-mix(in srgb, ${ring} 40%, transparent)` : undefined }}
        />
      ) : (
        <span
          aria-hidden
          style={{ width: size, height: size, borderRadius: radius, display: "block", background: "var(--nl-bg)", border: `${ringWidth}px solid ${ring}` }}
        />
      )}
      {medalTone ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -3,
            bottom: -3,
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
