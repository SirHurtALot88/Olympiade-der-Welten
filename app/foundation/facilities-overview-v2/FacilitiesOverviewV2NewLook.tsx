"use client";

import { NlCard, NlProgressBar, NlSparkline, StatChip, StatChipRow, formatNlNumber } from "@/components/foundation/new-look";
import { FACILITY_CATALOG, getFacilityLevelDefinition, type FacilityId } from "@/lib/facilities/facility-catalog";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";

import type {
  FacilitiesOverviewV2ClientProps,
  FacilitiesOverviewV2Snapshot,
} from "@/app/foundation/facilities-overview-v2/facilities-overview-v2-types";

/**
 * "Neuer Look" Gebäude-Übersicht — flag-gated, additiv (nur wenn `useNewLook` aktiv).
 *
 * Gegenüber dem Bestand: die doppelte "Wartung"-Zeile ist dedupliziert, alle
 * Geldwerte laufen über EINEN Formatter (`formatTransfermarktCurrency`), und die
 * Upgrade-Vorschau zeigt den echten Effekt + die echten Kosten der nächsten
 * Stufe aus dem Facility-Katalog (`getFacilityLevelDefinition`).
 *
 * Bewusst NICHT klickbar in den Upgrade-Flow: die Props dieser Übersicht
 * enthalten keinen Navigations-/Upgrade-Handler (`FacilitiesOverviewV2ClientProps`
 * ist reiner Snapshot) — ein toter Klick würde nur so tun als ob.
 */

function resolveCatalogFacilityId(facilityId: string): FacilityId | null {
  const entry = FACILITY_CATALOG.find((catalogEntry) => catalogEntry.facilityId === facilityId);
  return entry ? entry.facilityId : null;
}

/** Nur für Cash-Einkommens-Gebäude (`effectType === "season_income"`) hat der Katalog eine echte L1→L5 Einnahmen-Kurve. */
function resolveIncomeCurve(catalogId: FacilityId | null): number[] | null {
  if (catalogId == null) return null;
  const entry = FACILITY_CATALOG.find((catalogEntry) => catalogEntry.facilityId === catalogId);
  if (!entry || entry.effectType !== "season_income") return null;
  const values = entry.levels.map((level) => level.seasonIncome ?? 0);
  return values.every((value) => value === 0) ? null : values;
}

function FacilityOverviewCard({ facility }: { facility: FacilitiesOverviewV2Snapshot }) {
  const catalogId = resolveCatalogFacilityId(facility.facilityId);
  const nextDefinition =
    catalogId != null && facility.level < facility.maxLevel
      ? getFacilityLevelDefinition(catalogId, facility.level + 1)
      : null;
  const incomeCurve = resolveIncomeCurve(catalogId);
  const currentIncome =
    catalogId != null && facility.level > 0 ? getFacilityLevelDefinition(catalogId, facility.level)?.seasonIncome ?? null : null;

  return (
    <NlCard
      className="nl-facility-overview-card"
      eyebrow={facility.level <= 0 ? "Nicht gebaut" : `Level ${facility.level}/${facility.maxLevel}`}
      title={facility.label}
    >
      <NlProgressBar
        className="nl-facility-overview-level"
        label="Ausbau"
        value={facility.level}
        max={facility.maxLevel}
        tone={facility.level <= 0 ? "neutral" : "accent"}
        format={(value, max) => `L${formatNlNumber(value, 0)} / L${formatNlNumber(max, 0)}`}
      />
      <p className="nl-facility-overview-desc">{facility.description}</p>
      <p className="nl-facility-overview-effect">{facility.effectDescription}</p>
      {/* Eine konsolidierte Wartungszeile (vorher doppelt gerendert). */}
      <div className="nl-facility-overview-upkeep nl-tnum">
        <span>Wartung / Saison</span>
        <strong>{formatTransfermarktCurrency(facility.upkeep)}</strong>
      </div>
      {incomeCurve ? (
        <div className="nl-facility-overview-income-curve" data-testid="nl-facility-overview-income-curve">
          <span className="nl-facility-overview-income-curve-label">Einnahmen-Progression L1→L{facility.maxLevel}</span>
          <NlSparkline
            points={incomeCurve}
            tone="good"
            aria-label={`Saison-Einnahmen je Ausbaustufe für ${facility.label}`}
          />
          <small className="nl-tnum">
            {facility.level > 0 && currentIncome != null
              ? `Aktuell L${facility.level}: ${formatTransfermarktCurrency(currentIncome)}/Saison`
              : "Noch nicht gebaut"}
          </small>
        </div>
      ) : null}
      {nextDefinition ? (
        <div className="nl-facility-overview-upgrade" data-testid="nl-facility-overview-upgrade">
          <span className="nl-facility-overview-upgrade-kicker">
            Upgrade L{facility.level} → L{facility.level + 1}
          </span>
          <strong>{nextDefinition.effectDescription}</strong>
          <small className="nl-tnum">
            Kosten {formatTransfermarktCurrency(nextDefinition.upgradeCost)} · Unterhalt danach{" "}
            {formatTransfermarktCurrency(nextDefinition.seasonUpkeep)}
          </small>
        </div>
      ) : facility.level >= facility.maxLevel ? (
        <div className="nl-facility-overview-upgrade is-max">
          <span className="nl-facility-overview-upgrade-kicker">Max-Level erreicht</span>
        </div>
      ) : null}
    </NlCard>
  );
}

export default function FacilitiesOverviewV2NewLook({
  teamName,
  teamCode,
  balance,
  facilityBudget,
  facilities,
  boardMessage,
}: FacilitiesOverviewV2ClientProps) {
  return (
    <div
      className="nl-facility-overview"
      data-testid="foundation-facilities-overview-v2"
      id="foundation-facilities-overview-v2"
      data-new-look="true"
    >
      <NlCard className="nl-facility-overview-header" eyebrow={teamCode} title={`Gebäude · ${teamName}`}>
        <StatChipRow aria-label="Finanzen">
          <StatChip label="Cash" value={formatTransfermarktCurrency(balance)} tone="soc" />
          <StatChip label="Budget" value={formatTransfermarktCurrency(facilityBudget)} tone="accent" />
        </StatChipRow>
        <p className="nl-facility-overview-board">{boardMessage}</p>
      </NlCard>

      <div className="nl-facility-overview-grid">
        {facilities.map((facility) => (
          <FacilityOverviewCard key={facility.facilityId} facility={facility} />
        ))}
      </div>
    </div>
  );
}
