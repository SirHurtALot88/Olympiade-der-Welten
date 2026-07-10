import type { ReactNode } from "react";

export type FoundationCardVariant = "default" | "metric" | "decision" | "panel";

type FoundationCardProps = {
  variant?: FoundationCardVariant;
  className?: string;
  children: ReactNode;
  as?: "article" | "div" | "section";
  "data-testid"?: string;
  /** Rendered as the native HTML `title` attribute (hover tooltip) on the card element. */
  title?: string;
};

const VARIANT_CLASS: Record<FoundationCardVariant, string> = {
  default: "foundation-card",
  metric: "foundation-card is-metric",
  decision: "foundation-card is-decision",
  panel: "foundation-card is-panel",
};

export function FoundationCard({
  variant = "default",
  className = "",
  children,
  as: Tag = "article",
  "data-testid": testId,
  title,
}: FoundationCardProps) {
  return (
    <Tag className={`${VARIANT_CLASS[variant]}${className ? ` ${className}` : ""}`} data-testid={testId} title={title}>
      {children}
    </Tag>
  );
}
