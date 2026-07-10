import type { ReactNode } from "react";

export type FoundationCardVariant = "default" | "metric" | "decision" | "panel";

type FoundationCardProps = {
  variant?: FoundationCardVariant;
  className?: string;
  children: ReactNode;
  as?: "article" | "div" | "section";
  title?: string;
  "data-testid"?: string;
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
  title,
  "data-testid": testId,
}: FoundationCardProps) {
  return (
    <Tag className={`${VARIANT_CLASS[variant]}${className ? ` ${className}` : ""}`} title={title} data-testid={testId}>
      {children}
    </Tag>
  );
}
