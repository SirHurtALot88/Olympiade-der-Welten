import type { FoundationReadMeta } from "@/lib/foundation/tabs/foundation-page-types";

type FoundationSourceBadgeProps = {
  readMeta: FoundationReadMeta;
  className?: string;
};

export function getFoundationSourceLabel(readMeta: FoundationReadMeta) {
  if (readMeta.readOnly) {
    return "Nur Ansicht";
  }
  if (readMeta.source === "prisma") {
    return "Referenzmodus";
  }
  return "Lokaler Spielstand";
}

export function FoundationSourceBadge({ readMeta, className = "" }: FoundationSourceBadgeProps) {
  const label = getFoundationSourceLabel(readMeta);
  return (
    <span
      className={`foundation-source-pill${readMeta.readOnly ? " is-readonly" : ""}${className ? ` ${className}` : ""}`}
      title={readMeta.readOnly ? "Schreibaktionen sind in diesem Modus deaktiviert." : undefined}
    >
      {label}
    </span>
  );
}
