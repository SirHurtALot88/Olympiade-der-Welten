import type { GameState, SponsorOffer, TeamSponsorContract } from "@/lib/data/olyDataTypes";

export function getTeamSponsorContract(gameState: GameState, teamId: string): TeamSponsorContract | null {
  const contract = gameState.seasonState.sponsorContractsByTeamId?.[teamId] ?? null;
  if (!contract) {
    return null;
  }
  if ((contract.seasonsRemaining ?? 1) <= 0) {
    return null;
  }
  if (contract.seasonId !== gameState.season.id) {
    return null;
  }
  return contract;
}

export function getTeamSponsorOffers(gameState: GameState, teamId: string): SponsorOffer[] {
  const offers = gameState.seasonState.sponsorOffersByTeamId?.[teamId] ?? [];
  return offers.filter((offer) => offer.seasonId === gameState.season.id);
}
