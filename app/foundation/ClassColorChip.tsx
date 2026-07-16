"use client";

import { getClassColorClassName, getClassIconSrc } from "./classVisuals";

export { getClassColorClassName, getClassColorToken } from "./classVisuals";

export default function ClassColorChip({ className }: { className: string | null | undefined }) {
  const label = className ?? "—";
  const iconSrc = getClassIconSrc(className);

  return (
    <span className={`${getClassColorClassName(className)} class-color-chip-with-icon`}>
      {iconSrc ? (
        <img
          className="class-color-chip-icon"
          src={iconSrc}
          alt={label}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
      ) : null}
      <span>{label}</span>
    </span>
  );
}
