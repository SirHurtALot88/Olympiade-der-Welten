"use client";

import { CLASS_COLOR_LEGEND } from "@/app/foundation/classVisuals";
import { PLAYER_STAR_TIERS } from "@/lib/foundation/player-star-tier";

/**
 * Kleine Legende für die Rahmen der Spieler-Portraitkarten (Fable-UI/UX-Brainstorm 14.11.,
 * Abschnitt 6 + Vorschlag 9: „nirgends steht, wofür diese Farbe steht").
 *
 * Eine Karte trägt bis zu drei unabhängige Rand-Signale, und sie sagen verschiedene Dinge:
 *  1. Leuchtender Außenrahmen Bronze → Diamant: ligaweiter OVR-Rang (Top 50/25/10/3), siehe
 *     `lib/foundation/player-star-tier.ts`. Gold und Diamant tragen zusätzlich den Glanz.
 *  2. Farbstreifen am linken Rand: Klassengruppe des Spielers (Rot/Grün/Blau/Gelb), Quelle ist
 *     dieselbe Zuordnung wie im CSS (`classVisuals.ts`).
 *  3. Nur Home: Gold/Silber/Bronze-Rand für Platz 1–3 innerhalb DEINER Top-6 — nicht ligaweit.
 *
 * Nichts davon wird hier berechnet; die Legende liest die bestehenden Tabellen, damit sie nicht
 * von den Rahmen selbst abdriften kann.
 */

export type PortraitFrameLegendProps = {
  /** `"home"` ergänzt den positionsbasierten Rand der Top-6-Kacheln. */
  variant?: "teams" | "home";
  className?: string;
};

const TIER_ORDER = [...PLAYER_STAR_TIERS].reverse();

export default function PortraitFrameLegend({ variant = "teams", className = "" }: PortraitFrameLegendProps) {
  return (
    <div
      className={`nl-frame-legend ${className}`.trim()}
      role="group"
      aria-label="Legende der Kartenränder"
      data-testid="portrait-frame-legend"
    >
      <span
        className="nl-frame-legend-group"
        title="Leuchtender Außenrahmen: ligaweiter OVR-Rang des Spielers. Gold und Diamant glänzen zusätzlich."
      >
        <span className="nl-frame-legend-label">Rahmen = Liga-OVR</span>
        {TIER_ORDER.map((entry) => (
          <span key={entry.tier} className="nl-frame-legend-item" title={entry.label}>
            <i className={`nl-frame-legend-swatch is-ring is-${entry.tier}`} aria-hidden="true" />
            {entry.shortLabel}
          </span>
        ))}
      </span>
      <span
        className="nl-frame-legend-group"
        title="Farbstreifen am linken Kartenrand: Klassengruppe des Spielers."
      >
        <span className="nl-frame-legend-label">Streifen links = Klasse</span>
        {CLASS_COLOR_LEGEND.map((entry) => (
          <span key={entry.token} className="nl-frame-legend-item" title={entry.classes.join(" · ")}>
            <i className={`nl-frame-legend-swatch is-stripe is-${entry.token}`} aria-hidden="true" />
            {entry.classes.join(" / ")}
          </span>
        ))}
      </span>
      {variant === "home" ? (
        <span
          className="nl-frame-legend-group"
          title="Gold, Silber und Bronze als Kartenrand der Plätze 1–3 in deinem eigenen Top-6-Kader (nicht ligaweit)."
        >
          <span className="nl-frame-legend-label">Goldrand Platz 1–3 = dein Top-6</span>
        </span>
      ) : null}
    </div>
  );
}
