"use client";

import { getClassColorClassName, getClassIconSrc } from "./classVisuals";

type ClassIconProps = {
  classNameValue: string | null | undefined;
  showLabel?: boolean;
  className?: string;
  iconClassName?: string;
};

export default function ClassIcon({
  classNameValue,
  showLabel = true,
  className = "",
  iconClassName = "",
}: ClassIconProps) {
  const label = classNameValue?.trim() || "—";
  const src = getClassIconSrc(classNameValue);
  const colorClassName = getClassColorClassName(classNameValue);

  return (
    <span
      className={`class-icon-chip ${colorClassName}${showLabel ? " has-label" : ""}${className ? ` ${className}` : ""}`}
      title={label}
    >
      {src ? (
        <img
          className={`class-icon${iconClassName ? ` ${iconClassName}` : ""}`}
          src={src}
          alt={label}
          width={32}
          height={32}
          loading="eager"
          decoding="async"
        />
      ) : null}
      {showLabel ? <span className="class-icon-label">{label}</span> : null}
    </span>
  );
}
