"use client";

import type { Dispatch, SetStateAction } from "react";

import { SponsorOfferCard } from "@/components/foundation/sponsor/SponsorOfferCard";
import type { GameState, SponsorCommercialRating, SponsorNegotiationProfile, SponsorOffer, SponsorOfferComponent, SponsorTermSeasons, TeamSponsorContract } from "@/lib/data/olyDataTypes";

type FoundationSponsorsPanelProps = {
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
    starTier?: number;
  }) => SponsorOfferComponent[];
  getSponsorNegotiationMultiplier: (input: {
    termSeasons: SponsorTermSeasons;
    negotiationProfile: SponsorNegotiationProfile;
  }) => number;
  setSponsorChoiceProfiles: Dispatch<SetStateAction<Record<string, SponsorNegotiationProfile>>>;
  chooseTeamSponsor: (offerId: string) => void | Promise<void>;
  prizeFinanceTab: "sponsors" | "prize";
};

export default function FoundationSponsorsPanel({
  gameState,
  selectedTeamName,
  selectedTeamCommercialRating,
  selectedTeamSponsorContract,
  selectedTeamSponsorOffers,
  sponsorChoiceMessage,
  sponsorChoiceProfiles,
  sponsorChoiceBusy,
  selectedTeamCanManage,
  formatMoney,
  applySponsorNegotiationToComponents,
  getSponsorNegotiationMultiplier,
  setSponsorChoiceProfiles,
  chooseTeamSponsor,
  prizeFinanceTab,
}: FoundationSponsorsPanelProps) {
  return (
    <div data-testid="foundation-sponsors">
      <section
        className="panel team-sponsor-panel prize-sponsors-panel"
        data-testid="team-sponsor-choice"
        id="sponsor-choice"
      >
      <div className="prize-v2-shell">
        <section className="prize-v2-hero">
          <div className="prize-v2-hero-copy">
            <span className="prize-v2-kicker">Sponsoren</span>
            <h2>{selectedTeamName}</h2>
            <p>Drei Angebote pro Saison — Sterne-Tier, Basis, Platzierung, Verbesserung und Sonderziel.</p>
            {selectedTeamCommercialRating ? (
              <p className="muted">
                Commercial Rating {selectedTeamCommercialRating.score}/100 · Erwartung ★{selectedTeamCommercialRating.tierHint}
                {" · "}Historie {selectedTeamCommercialRating.breakdown.recentPerformance.toFixed(0)} · Kader{" "}
                {selectedTeamCommercialRating.breakdown.rosterPotential.toFixed(0)} · Prestige{" "}
                {selectedTeamCommercialRating.breakdown.prestige.toFixed(0)}
              </p>
            ) : null}
          </div>
        </section>

        {sponsorChoiceMessage ? <div className="status-banner is-success">{sponsorChoiceMessage}</div> : null}

        {selectedTeamSponsorContract ? (
          <div className="teams-summary-grid history-summary-grid">
            <article className="metric-card teams-summary-card">
              <span>
                AKTIV{selectedTeamSponsorContract.starTier ? ` · ★${selectedTeamSponsorContract.starTier}` : ""}
                {selectedTeamSponsorContract.termSeasons ? ` · ${selectedTeamSponsorContract.termSeasons} Saison` : ""}
              </span>
              <strong>{selectedTeamSponsorContract.name}</strong>
              <small className="muted">
                {selectedTeamSponsorContract.variantKey ? `${selectedTeamSponsorContract.variantKey.replace(/_/g, " ")} · ` : ""}
                {selectedTeamSponsorContract.components.length} Vertragskomponenten
                {selectedTeamSponsorContract.negotiationProfile
                  ? ` · Profil ${selectedTeamSponsorContract.negotiationProfile}`
                  : ""}
              </small>
            </article>
          </div>
        ) : selectedTeamSponsorOffers.length > 0 ? (
          <div className="teams-summary-grid history-summary-grid">
            {selectedTeamSponsorOffers.map((offer) => {
              const negotiationProfile = sponsorChoiceProfiles[offer.offerId] ?? "balanced";
              const adjustedComponents = applySponsorNegotiationToComponents({
                components: offer.components,
                termSeasons: 1,
                negotiationProfile,
                starTier: offer.starTier,
              });
              const multiplier = getSponsorNegotiationMultiplier({ termSeasons: 1, negotiationProfile });
              return (
                <SponsorOfferCard
                  key={offer.offerId}
                  offer={offer}
                  gameState={gameState}
                  adjustedComponents={adjustedComponents}
                  negotiationProfile={negotiationProfile}
                  multiplier={multiplier}
                  chooseBusy={sponsorChoiceBusy === offer.offerId}
                  canManage={selectedTeamCanManage}
                  onNegotiationProfileChange={(profile) =>
                    setSponsorChoiceProfiles((current) => ({
                      ...current,
                      [offer.offerId]: profile,
                    }))
                  }
                  onChoose={() => void chooseTeamSponsor(offer.offerId)}
                  formatCash={formatMoney}
                />
              );
            })}
          </div>
        ) : (
          <p className="muted">Noch keine Sponsor-Angebote für diese Saison geladen.</p>
        )}
      </div>
    </section>
    </div>
  );
}
