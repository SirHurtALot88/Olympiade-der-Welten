"use client";

import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";

import type { FacilityRowView } from "@/app/foundation/facilities-v2/facilities-v2-types";
import {
  FacilityLevelStrip,
  formatFacilityStatusLabel,
  formatLocaleNumber,
  getFacilityHealthTone,
} from "@/app/foundation/facilities-v2/facility-ui-shared";

type FacilityGridCardProps = {
  facility: FacilityRowView;
  selected: boolean;
  onSelect: () => void;
};

export default function FacilityGridCard({ facility, selected, onSelect }: FacilityGridCardProps) {
  const tone = getFacilityHealthTone(facility);

  return (
    <button
      type="button"
      className={`facilities-v2-card is-${tone}${selected ? " is-selected" : ""}`}
      data-testid={`facilities-v2-card-${facility.id}`}
      onClick={onSelect}
    >
      <div className="facilities-v2-card-head">
        <strong>{facility.name}</strong>
        <span className="facilities-v2-card-level">{formatFacilityStatusLabel(facility)}</span>
      </div>
      <FacilityLevelStrip facilityId={facility.id} level={facility.level} />
      <div className="facilities-v2-card-stats">
        <span title="Effizienz">{facility.level > 0 ? `${formatLocaleNumber(facility.efficiencyPct, 0)}%` : "—"}</span>
        <span title="Unterhalt">{formatTransfermarktCurrency(facility.currentUpkeep)}</span>
        <span title="Netto">{formatTransfermarktCurrency(facility.currentIncome - facility.currentUpkeep)}</span>
      </div>
    </button>
  );
}
