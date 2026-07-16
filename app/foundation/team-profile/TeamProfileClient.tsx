"use client";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import type { TeamDetailDrawerData } from "@/app/foundation/TeamDetailDrawer";
import TeamProfileNewLook from "@/app/foundation/team-profile/TeamProfileNewLook";

export type TeamProfileClientProps = {
  data: TeamDetailDrawerData;
  onClose: () => void;
  onOpenPlayer: (playerId: string, activePlayerId: string) => void;
  onOpenContracts?: () => void;
  leagueHeatPools?: LeaguePlayerHeatPools;
  /** Voller GameState — die Team-Profil-Seite liegt außerhalb des FoundationStateProvider. */
  gameState?: GameState | null;
};

export default function TeamProfileClient({
  data,
  onClose,
  onOpenPlayer,
  onOpenContracts,
  leagueHeatPools,
  gameState,
}: TeamProfileClientProps) {
  return (
    <TeamProfileNewLook
      data={data}
      onClose={onClose}
      onOpenPlayer={onOpenPlayer}
      onOpenContracts={onOpenContracts}
      leagueHeatPools={leagueHeatPools}
      gameState={gameState}
    />
  );
}
