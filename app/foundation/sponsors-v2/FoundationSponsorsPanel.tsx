"use client";

import FoundationSponsorsNewLook from "@/app/foundation/sponsors-v2/FoundationSponsorsNewLook";
import type { GameState, SponsorCommercialRating, SponsorOffer, TeamSponsorContract } from "@/lib/data/olyDataTypes";

export type FoundationSponsorsPanelProps = {
  gameState: GameState;
  selectedTeamName: string;
  selectedTeamCommercialRating: SponsorCommercialRating | null;
  selectedTeamSponsorContract: TeamSponsorContract | null;
  selectedTeamSponsorOffers: SponsorOffer[];
  sponsorChoiceMessage: string | null;
  sponsorChoiceBusy: string | null;
  selectedTeamCanManage: boolean;
  formatMoney: (value: number) => string;
  chooseTeamSponsor: (offerId: string) => void | Promise<void>;
  prizeFinanceTab: "sponsors" | "prize";
};

export default function FoundationSponsorsPanel(props: FoundationSponsorsPanelProps) {
  return <FoundationSponsorsNewLook {...props} />;
}
