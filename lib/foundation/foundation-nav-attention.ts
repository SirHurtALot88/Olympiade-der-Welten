import type { GameState } from "@/lib/data/olyDataTypes";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import { getTeamSponsorContract, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";

export type FoundationNavAttentionMap = Partial<Record<FoundationViewId, boolean>>;

export function buildFoundationNavAttention(input: {
  gameState: GameState;
  activeManagerTeamId: string | null;
  canManageActiveTeam: boolean;
}): FoundationNavAttentionMap {
  const attention: FoundationNavAttentionMap = {};

  if (!input.activeManagerTeamId || !input.canManageActiveTeam) {
    return attention;
  }

  const sponsorContract = getTeamSponsorContract(input.gameState, input.activeManagerTeamId);
  if (!sponsorContract) {
    const sponsorOffers = getTeamSponsorOffers(input.gameState, input.activeManagerTeamId);
    const introStep = input.gameState.seasonState.newGameFlow?.steps?.find((step) => step.stepId === "choose_sponsor");
    const sponsorStepOpen = introStep?.status === "open" || introStep == null;
    if (sponsorOffers.length > 0 || sponsorStepOpen) {
      attention.prize = true;
    }
  }

  return attention;
}
