"use client";

import type { ReactNode } from "react";

import { type LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import {
  getBestPlayerStarTier,
  getPlayerStarTierClassName,
  getPlayerStarTierLabel,
  isHoloPlayerStarTier,
  resolveLeagueRankFromPool,
  type PlayerStarTier,
} from "@/lib/foundation/player-star-tier";

/**
 * Star-Tier-Rahmen für Portraits, die NICHT über `FoundationPlayerPortraitCard`
 * laufen — also die kleinen Inline-Bilder in Tabellen, Podien und Strips.
 *
 * Die große Portraitkarte leitet ihre Stufe selbst aus den Rang-Props ab; wo
 * das Bild dagegen als nacktes `<img>` gerendert wird, fehlt dieser Weg. Diese
 * Hülle schließt die Lücke, ohne dass jede Fundstelle die Tier-Logik kopiert.
 *
 * Zwei Wege, die Stufe zu bestimmen — je nachdem, was die Ansicht zur Hand hat:
 *  - `tier` direkt, wenn die Ränge schon aufgelöst vorliegen
 *  - `metrics` + `leagueHeatPools`, wenn nur Werte und Pools da sind (dann wird
 *    der ligaweite Rang genauso abgeleitet wie in der Spielertabelle)
 *
 * Ohne Stufe rendert die Hülle NUR die Kinder — kein zusätzliches Element,
 * kein veränderter Layoutfluss für die große Mehrheit der Spieler.
 */

export type PlayerStarFrameProps = {
  children: ReactNode;
  /** Fertige Stufe — hat Vorrang vor `metrics`. */
  tier?: PlayerStarTier | null;
  /** Kennzahlen des Spielers; zusammen mit `leagueHeatPools` wird daraus die Stufe abgeleitet. */
  metrics?: { ovr?: number | null; pps?: number | null; mvs?: number | null };
  leagueHeatPools?: LeaguePlayerHeatPools;
  /** Zusätzliche Klasse für die Hülle (z. B. Form-/Größenanpassung der Fundstelle). */
  className?: string;
  /** Runde Portraits (Podium, Arena-Marken) statt der Standard-Kartenrundung. */
  shape?: "rounded" | "circle";
};

export default function PlayerStarFrame({
  children,
  tier,
  metrics,
  leagueHeatPools,
  className = "",
  shape = "rounded",
}: PlayerStarFrameProps) {
  const resolvedTier =
    tier ??
    (metrics && leagueHeatPools
      ? getBestPlayerStarTier(
          resolveLeagueRankFromPool(metrics.ovr, leagueHeatPools.ovr),
          resolveLeagueRankFromPool(metrics.pps, leagueHeatPools.pps),
          resolveLeagueRankFromPool(metrics.mvs, leagueHeatPools.mvs),
        )
      : null);

  if (!resolvedTier) {
    return <>{children}</>;
  }

  const label = getPlayerStarTierLabel(resolvedTier);
  return (
    <span
      className={`nl-star-frame is-${shape} ${getPlayerStarTierClassName(resolvedTier)}${
        isHoloPlayerStarTier(resolvedTier) ? " is-star-holo" : ""
      } ${className}`
        .replace(/\s+/g, " ")
        .trim()}
      data-star-tier={resolvedTier}
      title={label ?? undefined}
    >
      {children}
    </span>
  );
}
