"use client";

import type { KeyboardEvent } from "react";

import FoundationPlayerPortraitCard from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitCard";
import { createEmptyLeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";

type MatchdayArenaPlayerCardProps = {
  rank?: number | null;
  portraitUrl?: string | null;
  portraitInitials?: string;
  playerId?: string;
  playerName: string;
  teamName: string;
  className?: string | null;
  scoreLabel: string;
  pointsLabel?: string | null;
  contributionLabel?: string | null;
  axisStats?: Array<{
    axis: "POW" | "SPE" | "MEN" | "SOC";
    value: number | null;
  }>;
  badges?: string[];
  variant?: "default" | "compact";
  onOpen?: (() => void) | null;
};

export default function MatchdayArenaPlayerCard({
  rank,
  portraitUrl,
  portraitInitials = "—",
  playerId = "arena-player",
  playerName,
  teamName,
  className,
  scoreLabel,
  pointsLabel,
  contributionLabel,
  axisStats = [],
  badges = [],
  variant = "default",
  onOpen,
}: MatchdayArenaPlayerCardProps) {
  const pow = axisStats.find((entry) => entry.axis === "POW")?.value ?? null;
  const spe = axisStats.find((entry) => entry.axis === "SPE")?.value ?? null;
  const men = axisStats.find((entry) => entry.axis === "MEN")?.value ?? null;
  const soc = axisStats.find((entry) => entry.axis === "SOC")?.value ?? null;

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
    <article className={`matchday-arena-player-card is-portrait-card is-${variant}`.trim()} {...clickableProps}>
      <FoundationPlayerPortraitCard
        playerId={playerId}
        name={playerName}
        portraitUrl={portraitUrl ?? null}
        portraitInitials={portraitInitials}
        playerOvr={null}
        playerMvs={null}
        pow={pow}
        spe={spe}
        men={men}
        soc={soc}
        leagueHeatPools={createEmptyLeaguePlayerHeatPools()}
        variant="team"
        context="arenaReveal"
        density={variant === "compact" ? "compact" : "full"}
        subMeta={[teamName, className].filter(Boolean).join(" · ")}
        highlight={badges[0] ?? null}
        contextData={{
          arena: {
            rank: rank ?? null,
            scoreLabel,
            pointsLabel: pointsLabel ?? null,
            contributionLabel: contributionLabel ?? null,
          },
        }}
        interactive={false}
        onOpen={onOpen ?? undefined}
        footerSlot={
          badges.length > 1 ? (
            <div className="matchday-arena-player-card-badges">
              {badges.slice(1).map((badge) => (
                <span key={`${playerName}-${badge}`} className="pill">
                  {badge}
                </span>
              ))}
            </div>
          ) : null
        }
      />
    </article>
  );
}
