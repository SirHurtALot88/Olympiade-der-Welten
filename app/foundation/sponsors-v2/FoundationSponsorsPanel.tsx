"use client";

import type { Dispatch, SetStateAction } from "react";

import FoundationSponsorsNewLook from "@/app/foundation/sponsors-v2/FoundationSponsorsNewLook";
import type { GameState, SponsorCommercialRating, SponsorNegotiationProfile, SponsorOffer, SponsorOfferComponent, SponsorRarity, SponsorTermSeasons, TeamSponsorContract } from "@/lib/data/olyDataTypes";

export type FoundationSponsorsPanelProps = {
  gameState: GameState;
  selectedTeamName: string;
  selectedTeamCommercialRating: SponsorCommercialRating | null;
  selectedTeamSponsorContract: TeamSponsorContract | null;
  selectedTeamSponsorOffers: SponsorOffer[];
  sponsorChoiceMessage: string | null;
  sponsorChoiceProfiles: Record<string, SponsorNegotiationProfile>;
  sponsorChoiceBusy: string | null;
  selectedTeamCanManage: boolean;
  formatMoney: (value: number) => string;
  applySponsorNegotiationToComponents: (input: {
    components: SponsorOfferComponent[];
    termSeasons: SponsorTermSeasons;
    negotiationProfile: SponsorNegotiationProfile;
    /** Etat-Dial (Rarität); optional bis zum vollständigen Cutover. */
    rarity?: SponsorRarity;
  }) => SponsorOfferComponent[];
  getSponsorNegotiationMultiplier: (input: {
    termSeasons: SponsorTermSeasons;
    negotiationProfile: SponsorNegotiationProfile;
  }) => number;
  setSponsorChoiceProfiles: Dispatch<SetStateAction<Record<string, SponsorNegotiationProfile>>>;
  chooseTeamSponsor: (offerId: string) => void | Promise<void>;
  prizeFinanceTab: "sponsors" | "prize";
};

export default function FoundationSponsorsPanel(props: FoundationSponsorsPanelProps) {
  return <FoundationSponsorsNewLook {...props} />;
}
