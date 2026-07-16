"use client";

import { MATCHDAY_ARENA_PHASES, type MatchdayArenaPhaseId } from "@/lib/season/matchday-arena-presenter";

const PHASE_RAIL_ICONS: Record<MatchdayArenaPhaseId, string> = {
  slots: "S",
  push: "P",
  form: "F",
  mutator: "M",
  captain: "C",
  power: "P",
  final: "F",
  result: "R",
};

const PHASE_RAIL_SHORT_LABELS: Record<MatchdayArenaPhaseId, string> = {
  slots: "Slots",
  push: "Push",
  form: "Form",
  mutator: "Mut",
  captain: "Cap",
  power: "Pow",
  final: "Fin",
  result: "Ziel",
};

export default function MatchdayArenaTimeline({
  activePhase,
  onSelectPhase,
}: {
  activePhase: MatchdayArenaPhaseId | null;
  onSelectPhase?: ((phaseId: MatchdayArenaPhaseId) => void) | null;
}) {
  const activeIndex = MATCHDAY_ARENA_PHASES.findIndex((phase) => phase.id === activePhase);
  const progressPct =
    activeIndex <= 0
      ? MATCHDAY_ARENA_PHASES.length <= 1
        ? 0
        : (1 / (MATCHDAY_ARENA_PHASES.length - 1)) * 100
      : (activeIndex / (MATCHDAY_ARENA_PHASES.length - 1)) * 100;

  return (
    <div className="matchday-arena-timeline-rail" data-testid="matchday-arena-timeline-rail">
      <div className="matchday-arena-timeline-rail-track" aria-hidden="true">
        <span className="matchday-arena-timeline-rail-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <ol className="matchday-arena-timeline matchday-arena-timeline--rail is-labels-visible" aria-label="Reveal-Phasen">
        {MATCHDAY_ARENA_PHASES.map((phase, index) => {
          const stateClass =
            index < activeIndex ? "is-complete" : index === activeIndex ? "is-active" : "is-upcoming";
          const shortLabel = PHASE_RAIL_SHORT_LABELS[phase.id];

          return (
            <li key={phase.id} className={`matchday-arena-timeline-step ${stateClass}`.trim()}>
              <button
                className="matchday-arena-timeline-button"
                type="button"
                onClick={() => onSelectPhase?.(phase.id)}
                aria-pressed={index === activeIndex}
                title={`${phase.label} (${shortLabel}) direkt anspringen`}
              >
                <span className="matchday-arena-timeline-icon" aria-hidden="true">
                  {PHASE_RAIL_ICONS[phase.id]}
                </span>
                <span className="matchday-arena-timeline-dot" aria-hidden="true" />
                <span className="matchday-arena-timeline-short-label">{shortLabel}</span>
                <span className="matchday-arena-timeline-label">{phase.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
