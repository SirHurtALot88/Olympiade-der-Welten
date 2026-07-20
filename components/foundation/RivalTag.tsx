"use client";

import { joinClassNames } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import type { TeamRelationshipKind } from "@/lib/foundation/team-relationship";

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

const RELATIONSHIP_TAG_META: Record<
  TeamRelationshipKind,
  { modifier: string; icon: string; label: string; title: string }
> = {
  mine: { modifier: "is-mine", icon: "★", label: "Dein Team", title: "Von dir gesteuertes Team" },
  ally: { modifier: "is-ally", icon: "🤝", label: "Verbündet", title: "Verbündetes Team (positive Beziehung)" },
  rival: { modifier: "is-rival", icon: "⚔", label: "Rivale", title: "Rivale deines Teams" },
};

/**
 * Freund/Feind-Chip für die Matchday-Arena (blau=deine, grün=verbündet, rot=Rival).
 * Erweitert das `RivalTag`-Muster auf alle drei Beziehungs-Arten; teilt sich die
 * `.relationship-tag`-Basisklasse (Form/Grösse wie `.rival-tag`) und färbt per
 * Modifier über Tokens (`--nl-mine/--nl-ally/--nl-rival`). Rein additiv.
 */
export function RelationshipTag({
  kind,
  className,
}: {
  kind: TeamRelationshipKind;
  className?: string;
}) {
  const meta = RELATIONSHIP_TAG_META[kind];
  return (
    <span className={joinClassNames("relationship-tag", meta.modifier, className)} title={meta.title}>
      <span aria-hidden="true">{meta.icon}</span> {meta.label}
    </span>
  );
}
