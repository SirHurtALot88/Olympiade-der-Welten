import type { TeamArchetype } from "@/lib/data/olyDataTypes";

export type TransferEvaluation = {
  listingId: string;
  playerId: string;
  teamId: string;
  fitScore: number;
  needScore: number;
  budgetRisk: number;
  rosterPressure: number;
  overallScore: number;
  recommendedAction: "buy" | "watch" | "skip";
};

export type TransferAffordabilityStatus = "affordable" | "tight" | "too_expensive";
export type TransferRosterPressureStatus = "under_min" | "under_opt" | "at_or_above_opt";

export type TransferMarketSnapshot = {
  activeListings: number;
  averageAskingPrice: number;
};

export type TeamTransferLens = {
  archetype: TeamArchetype;
  budget: number;
  rosterCount: number;
  rosterLimit: number;
};
