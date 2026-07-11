import type {
  SponsorNegotiationProfile,
  SponsorOffer,
  SponsorOfferComponent,
  SponsorTermSeasons,
  TeamSponsorContract,
} from "@/lib/data/olyDataTypes";

const TERM_MULTIPLIERS: Record<SponsorTermSeasons, number> = {
  1: 1.0,
  2: 1.0,
  3: 0.92,
};

const PROFILE_MULTIPLIERS: Record<SponsorNegotiationProfile, number> = {
  safe: 0.95,
  balanced: 1.0,
  ambitious: 1.08,
};

function roundCash(value: number) {
  return Number(value.toFixed(1));
}

export function getSponsorTermMultiplier(termSeasons: SponsorTermSeasons) {
  return TERM_MULTIPLIERS[termSeasons];
}

export function getSponsorProfileMultiplier(profile: SponsorNegotiationProfile) {
  return PROFILE_MULTIPLIERS[profile];
}

export function getSponsorNegotiationMultiplier(input: {
  termSeasons: SponsorTermSeasons;
  negotiationProfile: SponsorNegotiationProfile;
}) {
  return roundCash(getSponsorTermMultiplier(input.termSeasons) * getSponsorProfileMultiplier(input.negotiationProfile));
}

export function applySponsorNegotiationToComponents(input: {
  components: SponsorOfferComponent[];
  termSeasons: SponsorTermSeasons;
  negotiationProfile: SponsorNegotiationProfile;
  starTier?: number;
}): SponsorOfferComponent[] {
  const multiplier = getSponsorNegotiationMultiplier({
    termSeasons: input.termSeasons,
    negotiationProfile: input.negotiationProfile,
  });
  const rankRelax = input.negotiationProfile === "safe" ? 2 : input.negotiationProfile === "ambitious" ? -1 : 0;

  return input.components.map((component) => {
    const scaledReward = roundCash(component.rewardCash * multiplier);
    if (component.kind === "rank" && typeof component.targetValue === "number") {
      return {
        ...component,
        targetValue: Math.max(3, component.targetValue + rankRelax),
        rewardCash: scaledReward,
        penaltyCash: component.penaltyCash != null ? roundCash(component.penaltyCash * multiplier) : undefined,
      };
    }
    return {
      ...component,
      rewardCash: scaledReward,
      targetValue:
        component.kind === "base" && typeof component.targetValue === "number"
          ? scaledReward
          : component.targetValue,
      penaltyCash: component.penaltyCash != null ? roundCash(component.penaltyCash * multiplier) : undefined,
    };
  });
}

export function applySponsorNegotiationToOffer(
  offer: SponsorOffer,
  input: { termSeasons: SponsorTermSeasons; negotiationProfile: SponsorNegotiationProfile },
): SponsorOffer {
  const components = applySponsorNegotiationToComponents({
    components: offer.components,
    termSeasons: input.termSeasons,
    negotiationProfile: input.negotiationProfile,
    starTier: offer.starTier,
  });
  return {
    ...offer,
    components,
    termSeasons: input.termSeasons,
    negotiationProfile: input.negotiationProfile,
    demandProfile: input.negotiationProfile === "safe" ? "safe" : input.negotiationProfile === "ambitious" ? "ambitious" : offer.demandProfile,
    totalUpsideEstimate: roundCash(components.reduce((sum, component) => sum + component.rewardCash, 0)),
  };
}

export function applySponsorNegotiationToContract(
  contract: TeamSponsorContract,
  input: { termSeasons: SponsorTermSeasons; negotiationProfile: SponsorNegotiationProfile },
): TeamSponsorContract {
  const components = applySponsorNegotiationToComponents({
    components: contract.components,
    termSeasons: input.termSeasons,
    negotiationProfile: input.negotiationProfile,
    starTier: contract.starTier,
  });
  return {
    ...contract,
    components,
    termSeasons: input.termSeasons,
    seasonsRemaining: input.termSeasons,
    negotiationProfile: input.negotiationProfile,
    demandProfile: input.negotiationProfile === "safe" ? "safe" : input.negotiationProfile === "ambitious" ? "ambitious" : contract.demandProfile,
  };
}

export function defaultAiSponsorNegotiation(input: {
  cashPressure: number;
  ambition: number;
}): { termSeasons: SponsorTermSeasons; negotiationProfile: SponsorNegotiationProfile } {
  if (input.cashPressure >= 7) {
    return { termSeasons: 1, negotiationProfile: "safe" };
  }
  if (input.ambition >= 8) {
    return { termSeasons: 1, negotiationProfile: "ambitious" };
  }
  return { termSeasons: 1, negotiationProfile: "balanced" };
}
