"use client";

import type { FacilitiesOverviewV2ClientProps } from "@/app/foundation/facilities-overview-v2/facilities-overview-v2-types";

function renderStars(level: number, maxLevel: number) {
  return Array.from({ length: maxLevel }, (_, index) => (
    <span key={`facility-star-${index}`} className={index < level ? "is-filled" : ""}>
      ★
    </span>
  ));
}

function formatMoney(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FacilitiesOverviewV2Client({
  teamName,
  teamCode,
  balance,
  facilityBudget,
  facilities,
  boardMessage,
  onOpenClassicTraining,
  onOpenHomeV2,
}: FacilitiesOverviewV2ClientProps) {
  return (
    <div className="facilities-overview-v2-shell" data-testid="foundation-facilities-overview-v2" id="foundation-facilities-overview-v2">
      <header className="facilities-overview-v2-header">
        <div>
          <span className="eyebrow">Facilities Overview V2</span>
          <h2>{teamName}</h2>
          <p className="muted">{teamCode} · Infrastruktur auf einen Blick</p>
        </div>
        <div className="facilities-overview-v2-actions">
          <button type="button" className="secondary-button" onClick={onOpenHomeV2}>
            Home V2
          </button>
          <button type="button" className="secondary-button" onClick={onOpenClassicTraining}>
            Training Classic
          </button>
        </div>
      </header>

      <div className="facilities-overview-v2-top">
        <article className="facilities-overview-v2-board-card">
          <span className="eyebrow">Board</span>
          <p>{boardMessage}</p>
        </article>
        <article className="facilities-overview-v2-finance-card">
          <span>Cash</span>
          <strong>{formatMoney(balance)}</strong>
          <small>Budget {formatMoney(facilityBudget)}</small>
        </article>
      </div>

      <div className="facilities-overview-v2-grid">
        {facilities.map((facility) => (
          <article key={facility.facilityId} className="facilities-overview-v2-card">
            <div className="facilities-overview-v2-card-head">
              <strong>{facility.label}</strong>
              <div className="home-v2-stars">{renderStars(facility.level, facility.maxLevel)}</div>
            </div>
            <p className="muted">{facility.description}</p>
            <p>{facility.effectDescription}</p>
            <small>Wartung {formatMoney(facility.upkeep)}</small>
          </article>
        ))}
      </div>
    </div>
  );
}
