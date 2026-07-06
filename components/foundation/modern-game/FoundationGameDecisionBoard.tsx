"use client";

import type { ReactNode } from "react";

export type FoundationGameDecisionStat = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "cash" | "warning" | "ready" | "info";
};

type FoundationGameDecisionBoardProps = {
  title: string;
  subtitle?: string;
  stats: FoundationGameDecisionStat[];
  actions?: ReactNode;
  className?: string;
  testId?: string;
};

export default function FoundationGameDecisionBoard({
  title,
  subtitle,
  stats,
  actions,
  className = "",
  testId,
}: FoundationGameDecisionBoardProps) {
  return (
    <section
      className={`modern-game-decision-board${className ? ` ${className}` : ""}`}
      data-testid={testId}
      aria-label={title}
    >
      <div className="modern-game-decision-board-head">
        <div>
          <span className="modern-game-decision-kicker">{title}</span>
          {subtitle ? <p className="muted modern-game-decision-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="modern-game-decision-actions">{actions}</div> : null}
      </div>
      <div className="modern-game-decision-stats">
        {stats.map((stat) => (
          <article
            key={stat.id}
            className={`modern-game-decision-stat is-${stat.tone ?? "default"}`}
            title={stat.detail}
          >
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            {stat.detail ? <small>{stat.detail}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
