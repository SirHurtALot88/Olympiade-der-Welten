"use client";

import type { SponsorNegotiationProfile, SponsorOffer, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  buildSponsorOfferPresentation,
  getSponsorComponentKindLabel,
  type SponsorChallengeDifficulty,
} from "@/lib/sponsor/sponsor-offer-presenter";

type SponsorOfferCardProps = {
  offer: SponsorOffer;
  gameState: GameState;
  adjustedComponents: SponsorOfferComponent[];
  negotiationProfile: SponsorNegotiationProfile;
  multiplier: number;
  chooseBusy: boolean;
  canManage: boolean;
  onNegotiationProfileChange: (profile: SponsorNegotiationProfile) => void;
  onChoose: () => void;
  formatCash: (value: number) => string;
};

function difficultyClassName(difficulty: SponsorChallengeDifficulty) {
  return `sponsor-difficulty sponsor-difficulty-${difficulty}`;
}

export function SponsorOfferCard({
  offer,
  gameState,
  adjustedComponents,
  negotiationProfile,
  multiplier,
  chooseBusy,
  canManage,
  onNegotiationProfileChange,
  onChoose,
  formatCash,
}: SponsorOfferCardProps) {
  const presentation = buildSponsorOfferPresentation({ offer, gameState, teamId: offer.teamId });
  const specialComponent = adjustedComponents.find((component) => component.kind === "special") ?? null;
  const standardComponents = adjustedComponents.filter((component) => component.kind !== "special");

  return (
    <article
      className={`metric-card teams-summary-card sponsor-offer-card${presentation.isChallenge ? " sponsor-offer-card-challenge" : ""}`}
      data-testid={`sponsor-offer-${offer.archetype}`}
      data-challenge={presentation.isChallenge ? "true" : "false"}
    >
      <div className="sponsor-offer-card-head">
        <span>
          {offer.archetype.toUpperCase()}
          {offer.starTier ? ` · ★${offer.starTier}` : ""}
          {offer.demandProfile ? ` · ${offer.demandProfile}` : ""}
        </span>
        {presentation.offerBadge ? <span className="sponsor-offer-badge">{presentation.offerBadge}</span> : null}
      </div>
      <strong>{offer.name}</strong>
      <small className="muted">{offer.flavor}</small>

      {presentation.isChallenge && presentation.special ? (
        <div className="sponsor-challenge-panel" data-testid="sponsor-challenge-panel">
          <div className="sponsor-challenge-panel-head">
            {presentation.special.axisLabel ? (
              <span className={`sponsor-axis-chip sponsor-axis-${presentation.special.axisKey}`}>
                {presentation.special.axisLabel}
              </span>
            ) : (
              <span className="sponsor-axis-chip sponsor-axis-neutral">Ziel</span>
            )}
            <span className={difficultyClassName(presentation.special.difficulty)}>
              {presentation.special.difficultyLabel}
            </span>
          </div>
          <strong className="sponsor-challenge-title">{presentation.special.headline}</strong>
          <small className="muted">{presentation.special.detail}</small>
          {specialComponent ? (
            <div className="sponsor-challenge-reward">
              Bonus {formatCash(specialComponent.rewardCash)}
              {specialComponent.penaltyCash ? ` · Malus −${formatCash(specialComponent.penaltyCash)}` : ""}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="stack compact sponsor-choice-controls">
        <label className="muted">
          Profil
          <select
            value={negotiationProfile}
            onChange={(event) => onNegotiationProfileChange(event.target.value as SponsorNegotiationProfile)}
          >
            <option value="safe">Sicher (−5 %)</option>
            <option value="balanced">Ausgewogen</option>
            <option value="ambitious">Ambitioniert (+8 %)</option>
          </select>
        </label>
        <small className="muted">Cash-Faktor ×{multiplier.toFixed(2)} · 1 Saison</small>
      </div>

      <ul className="muted sponsor-offer-component-list">
        {standardComponents.map((component) => (
          <li key={component.componentId}>
            <span className="sponsor-component-kind">{getSponsorComponentKindLabel(component.kind)}</span>
            {component.label}: {typeof component.rewardCash === "number" ? formatCash(component.rewardCash) : component.rewardCash}
          </li>
        ))}
        {!presentation.isChallenge && specialComponent ? (
          <li key={specialComponent.componentId}>
            <span className="sponsor-component-kind">Sonderziel</span>
            {specialComponent.label}: {formatCash(specialComponent.rewardCash)}
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        className="primary-button inline-button"
        data-testid="sponsor-choose-button"
        disabled={chooseBusy || !canManage}
        onClick={onChoose}
      >
        {chooseBusy ? "Speichert…" : presentation.isChallenge ? "Challenge wählen" : "Wählen"}
      </button>
    </article>
  );
}
