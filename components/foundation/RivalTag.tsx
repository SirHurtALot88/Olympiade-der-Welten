"use client";

import { joinClassNames } from "@/lib/foundation/tabs/foundation-page-module-helpers";

type RivalTagProps = {
  className?: string;
};

/**
 * Kleiner, wiederverwendbarer "⚔ Rivale"-Chip für die Rivalen-Hervorhebung des
 * aktiven Teams in Ranglisten (Ranks-Matrix, Saisonstand — später auch Disziplin-Szenen).
 * Rein additiv: markiert eine Zeile/Zelle, ohne bestehende Farbschemata zu verändern.
 */
export function RivalTag({ className }: RivalTagProps) {
  return (
    <span className={joinClassNames("rival-tag", className)} title="Rivale deines Teams">
      <span aria-hidden="true">⚔</span> Rivale
    </span>
  );
}
