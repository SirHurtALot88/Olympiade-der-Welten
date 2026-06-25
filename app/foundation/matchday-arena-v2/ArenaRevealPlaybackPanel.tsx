"use client";

import { memo, type ReactNode } from "react";

import MatchdayArenaTimeline from "@/components/matchday-arena/MatchdayArenaTimeline";
import type { MATCHDAY_ARENA_PHASES } from "@/lib/season/matchday-arena-presenter";

type MatchdayArenaPhaseId = (typeof MATCHDAY_ARENA_PHASES)[number]["id"];

type ArenaRevealPlaybackPanelProps = {
  activePhase: MatchdayArenaPhaseId;
  onSelectPhase?: (phaseId: MatchdayArenaPhaseId) => void;
  controls: ReactNode;
  hint: ReactNode;
};

const ArenaRevealPlaybackPanel = memo(function ArenaRevealPlaybackPanel({
  activePhase,
  onSelectPhase,
  controls,
  hint,
}: ArenaRevealPlaybackPanelProps) {
  return (
    <div className="arena-v2-reveal-playback-panel" data-testid="arena-reveal-playback-panel">
      {controls}
      {hint}
      <MatchdayArenaTimeline activePhase={activePhase} onSelectPhase={onSelectPhase} />
    </div>
  );
});

export default ArenaRevealPlaybackPanel;
