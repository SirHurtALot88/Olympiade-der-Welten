"use client";

import FoundationCreditsNewLook from "@/app/foundation/credits/FoundationCreditsNewLook";
import type { GameState } from "@/lib/data/olyDataTypes";
import { stubOnRepayLoan, stubOnTakeLoan, useCreditsViewModel } from "@/lib/foundation/credits/use-credits-view-model";

export type FoundationCreditsHostProps = {
  gameState: GameState;
  /** Active manager's own team id — fog of war: never another team's id. */
  teamId: string | null;
  /** Defaults to the stub in `use-credits-view-model.ts` until the parallel credit system is wired up. */
  onTakeLoan?: (offerId: string) => void;
  /** Defaults to the stub in `use-credits-view-model.ts` until the parallel credit system is wired up. */
  onRepayLoan?: (loanId: string) => void;
};

export default function FoundationCreditsHost({ gameState, teamId, onTakeLoan, onRepayLoan }: FoundationCreditsHostProps) {
  const model = useCreditsViewModel(gameState, teamId);
  const team = gameState.teams.find((candidate) => candidate.teamId === teamId) ?? null;
  const teamName = team?.name ?? "Dein Team";

  return (
    <FoundationCreditsNewLook
      teamName={teamName}
      model={model}
      onTakeLoan={onTakeLoan ?? stubOnTakeLoan}
      onRepayLoan={onRepayLoan ?? stubOnRepayLoan}
    />
  );
}
