"use client";

import type { KeyboardEvent } from "react";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";

type MatchdayArenaPlayerCardProps = {
  rank?: number | null;
  portraitUrl?: string | null;
  playerName: string;
  teamName: string;
  className?: string | null;
  scoreLabel: string;
  pointsLabel?: string | null;
  contributionLabel?: string | null;
  badges?: string[];
  variant?: "default" | "compact";
  onOpen?: (() => void) | null;
};

export default function MatchdayArenaPlayerCard({
  rank,
  portraitUrl,
  playerName,
  teamName,
  className,
  scoreLabel,
  pointsLabel,
  contributionLabel,
  badges = [],
  variant = "default",
  onOpen,
}: MatchdayArenaPlayerCardProps) {
  const clickableProps =
    onOpen != null
      ? {
          onClick: onOpen,
          onDoubleClick: onOpen,
          role: "button" as const,
          tabIndex: 0,
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          },
        }
      : {};

  return (
    <article className={`matchday-arena-player-card is-${variant}`.trim()} {...clickableProps}>
      <div className="matchday-arena-player-card-head">
        {rank != null ? <span className="matchday-arena-player-rank">#{rank}</span> : null}
        {portraitUrl ? (
          <OptimizedMediaImage
            className="matchday-arena-player-portrait"
            src={portraitUrl}
            alt={playerName}
            width={52}
            height={52}
          />
        ) : (
          <span className="matchday-arena-player-portrait matchday-arena-player-portrait-fallback">—</span>
        )}
        <div className="matchday-arena-player-title">
          <strong>{playerName}</strong>
          <span>{teamName}</span>
          {className ? <span>{className}</span> : null}
        </div>
      </div>
      <div className="matchday-arena-player-card-metrics">
        <span className="matchday-arena-player-card-score">{scoreLabel}</span>
        {pointsLabel ? <span className="matchday-arena-player-card-points">{pointsLabel}</span> : null}
        {contributionLabel ? <span className="matchday-arena-player-card-contribution">{contributionLabel}</span> : null}
      </div>
      {badges.length ? (
        <div className="matchday-arena-player-card-badges">
          {badges.map((badge) => (
            <span key={`${playerName}-${badge}`} className="pill">
              {badge}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
