"use client";

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type TooltipHeadingProps<T extends ElementType> = {
  as?: T;
  tooltip?: string | null;
  children: ReactNode;
  wrapperClassName?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "title">;

export function TooltipHeading<T extends ElementType = "h2">({
  as,
  tooltip,
  children,
  wrapperClassName,
  className,
  ...props
}: TooltipHeadingProps<T>) {
  const Tag = (as ?? "h2") as ElementType;

  return (
    <Tag className={className} {...props}>
      <span
        className={`tooltip-heading${wrapperClassName ? ` ${wrapperClassName}` : ""}`}
        title={tooltip ?? undefined}
      >
        <span>{children}</span>
        {tooltip ? (
          <span className="tooltip-heading-icon" aria-hidden="true">
            ?
          </span>
        ) : null}
      </span>
    </Tag>
  );
}
