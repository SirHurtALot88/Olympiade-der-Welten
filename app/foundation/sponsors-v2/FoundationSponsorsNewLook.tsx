"use client";

import { NlCard, NlGauge, NlProgressBar, formatNlNumber } from "@/components/foundation/new-look";
import {
  SPONSOR_ARCHETYPE_META,
  SponsorCrest,
  SponsorOfferCardNewLook,
} from "@/components/foundation/sponsor/SponsorOfferCardNewLook";
import { getSponsorComponentKindLabel } from "@/lib/sponsor/sponsor-offer-presenter";
import type { TeamSponsorContract } from "@/lib/data/olyDataTypes";

import type { FoundationSponsorsPanelProps } from "@/app/foundation/sponsors-v2/FoundationSponsorsPanel";

/**
 * "Neuer Look" Sponsoren — flag-gated, additiv (nur wenn `useNewLook` aktiv ist).
 *
 * Konsumiert exakt dieselben Props wie `FoundationSponsorsPanel` und läuft über
 * dieselben echten Pfade: Profil-State (`sponsorChoiceProfiles` /
 * `setSponsorChoiceProfiles`), echte Verhandlungs-Mathematik
 * (`applySponsorNegotiationToComponents`, `getSponsorNegotiationMultiplier`)
 * und der echte Abschluss (`chooseTeamSponsor`).
 *
 * Laufzeit (`termSeasons`): NUR Anzeige, kein Selector — der Apply-Pfad
 * (`chooseTeamSponsor(offerId)` → POST /api/sponsor/choose) nimmt keine
 * Laufzeit an und rechnet serverseitig fest mit `termSeasons: 1`. Deshalb
 * bleibt auch die Verhandlungs-Vorschau bei `termSeasons: 1` (Parität zum
 * echten Abschluss).
 */

type ContractPayoutTile = {
  key: string;
  label: string;
  detail: string;
  paid: boolean;
};

/** Echte Auszahlungslage aus `contract.components` + `contract.payouts`. */
function buildContractPayoutTiles(contract: TeamSponsorContract): ContractPayoutTile[] {
  const tiles: ContractPayoutTile[] = [];
  for (const component of contract.components) {
    if (component.kind === "base") {
      tiles.push({
        key: `${component.componentId}-first`,
        label: "Basis 1. Rate",
        detail: component.label,
        paid: contract.payouts.baseFirstPaid === true,
      });
      tiles.push({
        key: `${component.componentId}-second`,
        label: "Basis 2. Rate",
        detail: component.label,
        paid: contract.payouts.baseSecondPaid === true,
      });
      continue;
    }
    const paid =
      component.kind === "rank"
        ? contract.payouts.rankPaid === true
        : component.kind === "improvement"
          ? contract.payouts.improvementPaid === true
          : contract.payouts.specialPaid === true;
    tiles.push({
      key: component.componentId,
      label: getSponsorComponentKindLabel(component.kind),
      detail: `${component.label} · Ziel ${component.targetValue}`,
      paid,
    });
  }
  return tiles;
}

function ActiveContractHero({ contract }: { contract: TeamSponsorContract }) {
  const archetypeMeta = SPONSOR_ARCHETYPE_META[contract.archetype];
  const payoutTiles = buildContractPayoutTiles(contract);
  const paidCount = payoutTiles.filter((tile) => tile.paid).length;
  const termSeasons = contract.termSeasons ?? null;
  const seasonsDone =
    termSeasons != null && contract.seasonsRemaining != null
      ? Math.max(0, termSeasons - contract.seasonsRemaining)
      : null;

  return (
    <NlCard className={`nl-sponsor-hero is-${contract.archetype}`} data-testid="nl-sponsor-active-contract">
      <div className="nl-sponsor-hero-main">
        <SponsorCrest name={contract.name} archetype={contract.archetype} />
        <div className="nl-sponsor-hero-copy">
          <span className="nl-sponsor-hero-kicker">
            Aktiver Vertrag · {archetypeMeta.label}
            {contract.starTier ? ` · ★${contract.starTier}` : ""}
            {contract.negotiationProfile ? ` · Profil ${contract.negotiationProfile}` : ""}
          </span>
          <strong className="nl-sponsor-hero-name">{contract.name}</strong>
          <small>
            {contract.variantKey ? `${contract.variantKey.replace(/_/g, " ")} · ` : ""}
            {contract.components.length} Vertragskomponenten
            {contract.startRank != null ? ` · Start-Rang ${contract.startRank}` : ""}
          </small>
        </div>
        {termSeasons != null ? (
          <span className="nl-sponsor-term-chip" title="Vertragslaufzeit">
            {seasonsDone != null ? `Saison ${Math.min(seasonsDone + 1, termSeasons)}/${termSeasons}` : `${termSeasons} Saison${termSeasons === 1 ? "" : "s"}`}
          </span>
        ) : null}
      </div>

      <NlProgressBar
        className="nl-sponsor-hero-progress"
        label="Ausgezahlte Vertragsbausteine"
        value={paidCount}
        max={payoutTiles.length}
        tone="accent"
        format={(value, max) => `${formatNlNumber(value, 0)} / ${formatNlNumber(max, 0)}`}
      />

      <div className="nl-sponsor-hero-tiles">
        {payoutTiles.map((tile) => (
          <span
            key={tile.key}
            className={`nl-sponsor-hero-tile${tile.paid ? " is-paid" : ""}`}
            title={tile.detail}
          >
            {tile.paid ? "✓ " : ""}
            {tile.label}
          </span>
        ))}
      </div>
    </NlCard>
  );
}

export default function FoundationSponsorsNewLook({
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
}: FoundationSponsorsPanelProps) {
  return (
    <div data-testid="foundation-sponsors">
      <section className="nl-sponsor" data-testid="team-sponsor-choice" id="sponsor-choice" data-new-look="true">
        <NlCard
          className="nl-sponsor-header-card"
          eyebrow="Sponsoren"
          title={selectedTeamName}
          actions={
            selectedTeamCommercialRating ? (
              <NlGauge
                value={selectedTeamCommercialRating.score}
                max={100}
                label="Kommerz"
                tone="accent"
                format={(value) => `${formatNlNumber(value, 0)}`}
                title={`Commercial Rating ${selectedTeamCommercialRating.score}/100 · Erwartung ★${selectedTeamCommercialRating.tierHint}`}
              />
            ) : null
          }
        >
          <p className="nl-sponsor-header-hint">
            Drei Angebote pro Saison — Sterne-Tier, Basis, Platzierung, Verbesserung und Sonderziel.
          </p>
          {selectedTeamCommercialRating ? (
            <div className="nl-sponsor-rating-drivers" aria-label="Kommerz-Rating Treiber">
              <NlProgressBar
                label="Historie"
                value={selectedTeamCommercialRating.breakdown.recentPerformance}
                max={100}
                tone="men"
                format={(value) => formatNlNumber(value, 0)}
                title="Jüngste sportliche Performance"
              />
              <NlProgressBar
                label="Kader"
                value={selectedTeamCommercialRating.breakdown.rosterPotential}
                max={100}
                tone="spe"
                format={(value) => formatNlNumber(value, 0)}
                title="Kader-Potential"
              />
              <NlProgressBar
                label="Prestige"
                value={selectedTeamCommercialRating.breakdown.prestige}
                max={100}
                tone="soc"
                format={(value) => formatNlNumber(value, 0)}
                title="Prestige/Medaillenhistorie"
              />
              <small className="nl-sponsor-rating-hint">Erwartung ★{selectedTeamCommercialRating.tierHint}</small>
            </div>
          ) : null}
        </NlCard>

        {sponsorChoiceMessage ? <div className="status-banner is-success">{sponsorChoiceMessage}</div> : null}

        {selectedTeamSponsorContract ? (
          <ActiveContractHero contract={selectedTeamSponsorContract} />
        ) : selectedTeamSponsorOffers.length > 0 ? (
          <div className="nl-sponsor-offer-grid">
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
                <SponsorOfferCardNewLook
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
          <p className="nl-sponsor-empty">Noch keine Sponsor-Angebote für diese Saison geladen.</p>
        )}
      </section>
    </div>
  );
}
