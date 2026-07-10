"use client";

import FacilitiesOverviewV2NewLook from "@/app/foundation/facilities-overview-v2/FacilitiesOverviewV2NewLook";
import { useNewLook } from "@/lib/ui/new-look-preference";
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

export default function FacilitiesOverviewV2Client(props: FacilitiesOverviewV2ClientProps) {
  // "Neuer Look" Flag-Gate (additiv): Flag an => neue Gebäude-Übersicht mit
  // denselben Props; Flag aus => bestehendes Layout unverändert.
  const [newLook] = useNewLook();
  if (newLook) return <FacilitiesOverviewV2NewLook {...props} />;

  const { teamName, teamCode, balance, facilityBudget, facilities, boardMessage } = props;

  return (
    <div className="facilities-overview-v2-shell" data-testid="foundation-facilities-overview-v2" id="foundation-facilities-overview-v2">
      <header className="facilities-overview-v2-header">
        <div>
          <span className="eyebrow">Gebäude</span>
          <h2>{teamName}</h2>
          <p className="home-v2-hero-meta-line">{teamCode}</p>
        </div>
        <div className="facilities-overview-v2-actions" />
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
            <div className="facilities-overview-v2-maintenance-card">
              <span>Wartung / Saison</span>
              <strong>{formatMoney(facility.upkeep)}</strong>
            </div>
            {facility.level < facility.maxLevel ? (
              <div className="facilities-overview-v2-upgrade-preview">
                <span>Upgrade Vorschau</span>
                <strong>L{facility.level} → L{facility.level + 1}</strong>
                <small>Stärkere Facility-Wirkung</small>
              </div>
            ) : null}
            <small>Wartung {formatMoney(facility.upkeep)}</small>
          </article>
        ))}
      </div>
    </div>
  );
}
