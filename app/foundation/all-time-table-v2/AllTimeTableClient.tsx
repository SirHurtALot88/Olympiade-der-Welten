"use client";

import HistorieEwigeTabelle from "@/components/foundation/historie/HistorieEwigeTabelle";
import type { HistorieHostBasis } from "@/components/foundation/historie/HistorieArchiv";
import type { AllTimeTableModel } from "@/lib/foundation/all-time-table";

export type AllTimeTableClientProps = Omit<HistorieHostBasis, "onOpenTeam"> & {
  model: AllTimeTableModel | null;
  selectedTeamId: string | null;
  seasonLabel: string;
  onOpenTeam: (teamId: string) => void;
};

/** Reiter „Ewige Tabelle" der Historie (Mockup 18.11.). */
export default function AllTimeTableClient({ model, gameState, ownTeamId, selectedTeamId, onOpenTeam, onWechsel, onOpenSaisonstand }: AllTimeTableClientProps) {
  return (
    <HistorieEwigeTabelle
      model={model}
      gameState={gameState}
      ownTeamId={ownTeamId ?? selectedTeamId}
      onOpenTeam={onOpenTeam}
      onWechsel={onWechsel}
      onOpenSaisonstand={onOpenSaisonstand}
    />
  );
}
