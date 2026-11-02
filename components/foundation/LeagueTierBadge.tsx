"use client";

import { joinClassNames } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import {
  formatLeagueTierLabel,
  formatLeagueTierShortLabel,
  getLeagueLevel,
} from "@/lib/season/league-history";

type LeagueTierBadgeProps = {
  /** Liga-Kennung im Schema `liga<N>`; `null`/fehlend → nichts rendern (Manager Mode / keine Trennung). */
  tier: string | null | undefined;
  /** Saison-Name fuer den Hover-Text („Season 1: Liga 2"). */
  seasonLabel?: string | null;
  className?: string;
};

/**
 * Kleiner „L1"/„L2"-Chip fuer historische Saison-Zeilen (Team- und Spieler-Drawer, Teamprofil,
 * Saisonstand) — Chris, 02.11.: „in Season 1, in welcher Liga haben sie denn gespielt zu dem
 * Zeitpunkt". Teilt sich Form und Farben mit dem bestehenden `ranks-league-badge` im Ranks-Reiter,
 * damit dieselbe Liga ueberall gleich aussieht. Liga 3+ (noch nicht im Spiel) bekommt eine eigene,
 * neutrale Farbe statt still auf Liga 2 zu fallen.
 */
export function LeagueTierBadge({ tier, seasonLabel, className }: LeagueTierBadgeProps) {
  const label = formatLeagueTierLabel(tier);
  if (!label) return null;
  const level = getLeagueLevel(tier);
  const levelClass = level === 1 ? "is-liga1" : level === 2 ? "is-liga2" : "is-liga-n";
  return (
    <span
      className={joinClassNames("ranks-league-badge", "league-tier-badge", levelClass, className)}
      title={seasonLabel ? `${seasonLabel}: ${label}` : label}
      aria-label={seasonLabel ? `${seasonLabel} in ${label}` : label}
      data-league-tier={tier ?? undefined}
    >
      {formatLeagueTierShortLabel(tier)}
    </span>
  );
}

export default LeagueTierBadge;
