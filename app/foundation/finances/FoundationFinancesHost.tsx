"use client";

import FoundationFinancesNewLook from "@/app/foundation/finances/FoundationFinancesNewLook";
import type { GameState } from "@/lib/data/olyDataTypes";
import { useFinancesViewModel } from "@/lib/foundation/finances/use-finances-view-model";

export type FoundationFinancesHostProps = {
  gameState: GameState;
  /** Active manager's own team id — fog of war: never another team's id. */
  teamId: string | null;
};

/**
 * Host/view split mirrors `FoundationCreditsHost` — read-only view, no
 * mutating actions, so no callback props are needed here (unlike Kredite's
 * `onBorrow`/`onEarlyPayoff`).
 */
export default function FoundationFinancesHost({ gameState, teamId }: FoundationFinancesHostProps) {
  const model = useFinancesViewModel(gameState, teamId);
  const team = gameState.teams.find((candidate) => candidate.teamId === teamId) ?? null;
  const teamName = team?.name ?? "Dein Team";

  return <FoundationFinancesNewLook teamName={teamName} model={model} />;
}
