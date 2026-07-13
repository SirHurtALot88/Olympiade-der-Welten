"use client";

import FoundationCreditsNewLook from "@/app/foundation/credits/FoundationCreditsNewLook";
import type { GameState } from "@/lib/data/olyDataTypes";
import { useCreditsViewModel } from "@/lib/foundation/credits/use-credits-view-model";

export type LoanOriginateOutcome = { ok: boolean; reason: string | null };

export type FoundationCreditsHostProps = {
  gameState: GameState;
  /** Active manager's own team id — fog of war: never another team's id. */
  teamId: string | null;
  /**
   * POST /api/finance/loan/originate + game-state refresh, wired by
   * `FoundationShellRouterBody` (mirrors `chooseTeamSponsor`'s
   * fetch-then-`loadSave` pattern). Falls back to a no-op "not available"
   * result if the shell hasn't wired a handler. `lenderTeamId` is `null`
   * for the bank offer, a team id for a team offer (Phase 3 — see
   * `lib/foundation/credits/loan-offers.ts`).
   */
  onBorrow?: (principal: number, termSeasons: number, lenderTeamId?: string | null) => Promise<LoanOriginateOutcome>;
};

export default function FoundationCreditsHost({ gameState, teamId, onBorrow }: FoundationCreditsHostProps) {
  const model = useCreditsViewModel(gameState, teamId);
  const team = gameState.teams.find((candidate) => candidate.teamId === teamId) ?? null;
  const teamName = team?.name ?? "Dein Team";

  return (
    <FoundationCreditsNewLook
      teamName={teamName}
      model={model}
      gameState={gameState}
      teamId={teamId}
      onBorrow={onBorrow ?? (async () => ({ ok: false, reason: "not_available" }))}
    />
  );
}
