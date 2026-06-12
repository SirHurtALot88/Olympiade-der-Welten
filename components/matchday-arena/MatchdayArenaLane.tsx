"use client";

import { useLayoutEffect, useRef } from "react";

import type { MatchdayArenaPhaseBreakdownItem } from "@/lib/season/matchday-arena-presenter";

type MatchdayArenaLaneProps = {
  rank: number;
  teamName: string;
  teamLogoUrl?: string | null;
  scoreLabel: string;
  deltaLabel?: string | null;
  rankShiftLabel?: string | null;
  pointsLabel?: string | null;
  widthPct: number;
  tone: "current" | "manual" | "ai" | "passive";
  isLeader?: boolean;
  hasPenalty?: boolean;
  breakdownItems?: MatchdayArenaPhaseBreakdownItem[];
};

export default function MatchdayArenaLane({
  rank,
  teamName,
  teamLogoUrl,
  scoreLabel,
  deltaLabel,
  rankShiftLabel,
  pointsLabel,
  widthPct,
  tone,
  isLeader = false,
  hasPenalty = false,
  breakdownItems = [],
}: MatchdayArenaLaneProps) {
  const laneRef = useRef<HTMLElement | null>(null);
  const previousTopRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const node = laneRef.current;
    if (!node) {
      return;
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const currentTop = node.getBoundingClientRect().top;
    const previousTop = previousTopRef.current;

    if (!prefersReducedMotion && previousTop != null) {
      const deltaY = previousTop - currentTop;
      if (Math.abs(deltaY) > 1) {
        node.style.transition = "none";
        node.style.transform = `translateY(${deltaY}px)`;

        requestAnimationFrame(() => {
          node.style.transition =
            "transform 760ms cubic-bezier(0.22, 1, 0.36, 1), background 320ms ease, border-color 320ms ease";
          node.style.transform = "translateY(0)";
        });
      }
    }

    previousTopRef.current = currentTop;
  }, [rank, scoreLabel, deltaLabel, widthPct]);

  return (
    <article
      ref={laneRef}
      className={`matchday-arena-lane is-${tone}${isLeader ? " is-leader" : ""}${hasPenalty ? " has-penalty" : ""}`.trim()}
    >
      <div className="matchday-arena-lane-meta">
        <span className="matchday-arena-lane-rank">#{rank}</span>
        {teamLogoUrl ? (
          <img className="matchday-arena-lane-logo" src={teamLogoUrl} alt={`${teamName} Logo`} />
        ) : (
          <span className="matchday-arena-lane-logo matchday-arena-lane-logo-fallback">—</span>
        )}
        <strong>{teamName}</strong>
      </div>
      <div className="matchday-arena-lane-track-wrap">
        <div className="matchday-arena-lane-track">
          <div className="matchday-arena-lane-bar" style={{ width: `${widthPct}%` }} />
        </div>
        {breakdownItems.length ? (
          <div className="matchday-arena-lane-breakdown">
            {breakdownItems.map((item) => (
              <span
                key={`${teamName}-${item.id}`}
                className={`matchday-arena-lane-breakdown-item is-${item.tone}`}
                title={`${item.label}: ${item.valueLabel}`}
              >
                <strong>{item.label}</strong> {item.valueLabel}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="matchday-arena-lane-stats">
        <span className="matchday-arena-lane-score">{scoreLabel}</span>
        {deltaLabel ? <span className="matchday-arena-lane-delta">{deltaLabel}</span> : <span className="matchday-arena-lane-delta">—</span>}
        {rankShiftLabel ? <span className="matchday-arena-lane-rank-shift">{rankShiftLabel}</span> : null}
        {pointsLabel ? <span className="matchday-arena-lane-points">{pointsLabel}</span> : null}
      </div>
    </article>
  );
}
