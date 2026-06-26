"use client";

import TeamDetailDrawer, { type TeamDetailDrawerData } from "@/app/foundation/TeamDetailDrawer";

export type TeamProfileClientProps = {
  data: TeamDetailDrawerData;
  onClose: () => void;
  onOpenPlayer: (playerId: string, activePlayerId: string) => void;
};

export default function TeamProfileClient({ data, onClose, onOpenPlayer }: TeamProfileClientProps) {
  return <TeamDetailDrawer variant="page" data={data} onClose={onClose} onOpenPlayer={onOpenPlayer} />;
}
