"use client";

import type { LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import TeamDetailDrawer, { type TeamDetailDrawerData } from "@/app/foundation/TeamDetailDrawer";

export type TeamProfileClientProps = {
  data: TeamDetailDrawerData;
  onClose: () => void;
  onOpenPlayer: (playerId: string, activePlayerId: string) => void;
  leagueHeatPools?: LeaguePlayerHeatPools;
};

export default function TeamProfileClient({ data, onClose, onOpenPlayer, leagueHeatPools }: TeamProfileClientProps) {
  return (
    <TeamDetailDrawer
      variant="page"
      data={data}
      onClose={onClose}
      onOpenPlayer={onOpenPlayer}
      leagueHeatPools={leagueHeatPools}
    />
  );
}
