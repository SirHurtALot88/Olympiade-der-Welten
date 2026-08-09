"use client";

import type { ReactNode } from "react";

import {
  getPlayerStarTierClassName,
  getPlayerStarTierLabel,
  isHoloPlayerStarTier,
  type PlayerStarTier,
} from "@/lib/foundation/player-star-tier";

/**
 * Star-Tier-Rahmen für Portraits, die NICHT über `FoundationPlayerPortraitCard`
 * laufen — also die kleinen Inline-Bilder in Tabellen, Podien und Strips.
 *
 * Die große Portraitkarte leitet ihre Stufe selbst aus dem `ovrRank`-Prop ab;
 * wo das Bild dagegen als nacktes `<img>` gerendert wird, fehlt dieser Weg.
 * Diese Hülle schließt die Lücke, ohne dass jede Fundstelle die Tier-Logik
 * kopiert — der Aufrufer übergibt die fertig aufgelöste Stufe direkt als
 * `tier={getPlayerStarTier(ovrRank)}`. Für das Portrait zählt AUSSCHLIESSLICH
 * OVR (siehe `lib/foundation/player-star-tier.ts`).
 *
 * Ohne Stufe rendert die Hülle NUR die Kinder — kein zusätzliches Element,
 * kein veränderter Layoutfluss für die große Mehrheit der Spieler.
 */

export type PlayerStarFrameProps = {
  children: ReactNode;
  /** Fertige Stufe (`getPlayerStarTier(ovrRank)`), `null`/`undefined` ohne Rahmen. */
  tier?: PlayerStarTier | null;
  /** Zusätzliche Klasse für die Hülle (z. B. Form-/Größenanpassung der Fundstelle). */
  className?: string;
  /** Runde Portraits (Podium, Arena-Marken) statt der Standard-Kartenrundung. */
  shape?: "rounded" | "circle";
  /**
   * `"sm"` für 24–32px-Thumbnails: dünnerer Ring/Glow, sonst frisst der
   * Standard-2px-Ring bei so kleinen Bildern zu viel vom Portrait. Nur die
   * CSS-Stärke ändert sich, die Stufen-Logik bleibt identisch. Default
   * `"md"` (unverändert für alle bestehenden mittleren/großen Aufrufer).
   */
  size?: "sm" | "md";
};

export default function PlayerStarFrame({
  children,
  tier,
  className = "",
  shape = "rounded",
  size = "md",
}: PlayerStarFrameProps) {
  if (!tier) {
    return <>{children}</>;
  }

  const label = getPlayerStarTierLabel(tier);
  return (
    <span
      className={`nl-star-frame is-${shape}${size === "sm" ? " is-size-sm" : ""} ${getPlayerStarTierClassName(tier)}${
        isHoloPlayerStarTier(tier) ? " is-star-holo" : ""
      } ${className}`
        .replace(/\s+/g, " ")
        .trim()}
      data-star-tier={tier}
      title={label ?? undefined}
    >
      {children}
    </span>
  );
}
