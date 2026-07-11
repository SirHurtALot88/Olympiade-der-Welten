"use client";

import type { LeaguePlayerHeatPools } from "@/lib/foundation/player-league-heat";
import TeamDetailDrawer, { type TeamDetailDrawerData } from "@/app/foundation/TeamDetailDrawer";
import TeamProfileNewLook from "@/app/foundation/team-profile/TeamProfileNewLook";
import { useNewLook } from "@/lib/ui/new-look-preference";

export type TeamProfileClientProps = {
  data: TeamDetailDrawerData;
  onClose: () => void;
  onOpenPlayer: (playerId: string, activePlayerId: string) => void;
  onOpenContracts?: () => void;
  leagueHeatPools?: LeaguePlayerHeatPools;
};

export default function TeamProfileClient({
  data,
  onClose,
  onOpenPlayer,
  onOpenContracts,
  leagueHeatPools,
}: TeamProfileClientProps) {
  // "Neuer Look" (flag-gated, additiv): mit aktivem Runtime-Flag rendert die
  // Team-Profil-Seite die NewLook-Variante — ohne Flag bleibt alles wie bisher.
  const [newLook] = useNewLook();

  if (newLook) {
    return (
      <TeamProfileNewLook
        data={data}
        onClose={onClose}
        onOpenPlayer={onOpenPlayer}
        onOpenContracts={onOpenContracts}
        leagueHeatPools={leagueHeatPools}
      />
    );
  }

  return (
    <TeamDetailDrawer
      variant="page"
      data={data}
      onClose={onClose}
      onOpenPlayer={onOpenPlayer}
      onOpenContracts={onOpenContracts}
      leagueHeatPools={leagueHeatPools}
    />
  );
}
