"use client";

export type NlMedalKind = "gold" | "silver" | "bronze";

export type NlMedalBadgeProps = {
  kind: NlMedalKind;
  /** Anzahl der Medaillen; ohne Angabe nur das Abzeichen. */
  count?: number;
  title?: string;
  className?: string;
};

const MEDAL_LABELS: Record<NlMedalKind, string> = {
  gold: "Gold",
  silver: "Silber",
  bronze: "Bronze",
};

/** Gold-/Silber-/Bronze-Abzeichen mit optionalem Zähler. */
export function NlMedalBadge({ kind, count, title, className }: NlMedalBadgeProps) {
  const label = MEDAL_LABELS[kind] ?? MEDAL_LABELS.bronze;
  const showCount = count != null && Number.isFinite(count);

  return (
    <span
      className={["nl-medal", `is-${kind}`, className ?? ""].filter(Boolean).join(" ")}
      title={title ?? (showCount ? `${count}× ${label}` : label)}
      aria-label={showCount ? `${count}× ${label}` : label}
    >
      <span className="nl-medal-disc" aria-hidden="true" />
      {showCount ? <span className="nl-medal-count nl-tnum">{count}</span> : null}
    </span>
  );
}

export default NlMedalBadge;
