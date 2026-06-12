"use client";

import { MATCHDAY_ARENA_PHASES, type MatchdayArenaPhaseId } from "@/lib/season/matchday-arena-presenter";

export default function MatchdayArenaTimeline({
  activePhase,
  onSelectPhase,
}: {
  activePhase: MatchdayArenaPhaseId | null;
  onSelectPhase?: ((phaseId: MatchdayArenaPhaseId) => void) | null;
}) {
  const activeIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === activePhase);

  return (
    <ol className="matchday-arena-timeline" aria-label="Reveal Phasen">
      {MATCHDAY_ARENA_PHASES.map((phase, index) => {
        const stateClass =
          index < activeIndex
            ? "is-complete"
            : index === activeIndex
              ? "is-active"
              : "is-upcoming";

        return (
          <li key={phase.id} className={`matchday-arena-timeline-step ${stateClass}`.trim()}>
            <button
              className="matchday-arena-timeline-button"
              type="button"
              onClick={() => onSelectPhase?.(phase.id)}
              aria-pressed={index === activeIndex}
              title={`${phase.label} direkt anspringen`}
            >
              <span className="matchday-arena-timeline-dot" />
              <span className="matchday-arena-timeline-label">{phase.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
