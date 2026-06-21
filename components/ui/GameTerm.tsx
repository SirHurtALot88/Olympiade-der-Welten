"use client";

import type { ReactNode } from "react";

import { getGameEncyclopediaEntry, getGameTermTooltip } from "@/lib/ui/game-encyclopedia";

export { getGameTermTooltip } from "@/lib/ui/game-encyclopedia";

export function GameTerm({
  term,
  children,
  className,
}: {
  term: string;
  children?: ReactNode;
  className?: string;
}) {
  const tooltip = getGameTermTooltip(term);
  const entry = getGameEncyclopediaEntry(term);
  const openTerm = () => {
    if (!entry || typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("foundation:open-game-term", { detail: { termId: entry.id } }));
  };
  return (
    <span
      className={`game-term-help${className ? ` ${className}` : ""}`}
      role={entry ? "button" : undefined}
      tabIndex={entry ? 0 : undefined}
      data-game-term={entry?.id}
      title={tooltip ?? undefined}
      aria-label={tooltip ? `${term}: ${tooltip}` : term}
      onClick={openTerm}
      onKeyDown={(event) => {
        if (!entry || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        openTerm();
      }}
    >
      <span>{children ?? term}</span>
      {tooltip ? <span aria-hidden="true">?</span> : null}
    </span>
  );
}
