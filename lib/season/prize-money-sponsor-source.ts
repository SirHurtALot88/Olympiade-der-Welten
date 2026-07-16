import type { GameState } from "@/lib/data/olyDataTypes";

export type PrizeMoneySponsorBasisSource = "prize_sheet" | "sponsor_contract" | "none";

export type PrizeMoneySponsorBasis = {
  source: PrizeMoneySponsorBasisSource;
  basis: number | null;
};

export function resolvePrizeMoneySponsorBasis(
  gameState: GameState,
  teamId: string,
  prizeSheetBasis: number | null,
): PrizeMoneySponsorBasis {
  if (prizeSheetBasis != null) {
    return { source: "prize_sheet", basis: prizeSheetBasis };
  }

  const contract = gameState.seasonState.sponsorContractsByTeamId?.[teamId];
  const baseComponent = contract?.components?.find((component) => component.kind === "base" || component.componentId === "base");
  const sponsorBasis = baseComponent?.rewardCash ?? null;
  if (sponsorBasis != null) {
    return { source: "sponsor_contract", basis: sponsorBasis };
  }

  return { source: "none", basis: null };
}
