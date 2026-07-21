"use client";

import { useMemo } from "react";

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
 * Portfolio-Kontext im Header (Wartung/Einnahmen-Summen, Ausbau-Fortschritt)
 * und das "Nächstes bestes Upgrade"-Ranking summieren/vergleichen exakt
 * dieselben Quellen wie das Karten-Grid (Props-Snapshot + Facility-Katalog).
 *
 * Bewusst NICHT klickbar in den Upgrade-Flow: die Props dieser Übersicht
 * enthalten keinen Navigations-/Upgrade-Handler (`FacilitiesOverviewV2ClientProps`
 * ist reiner Snapshot) — ein toter Klick würde nur so tun als ob.
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten in den Props gibt:
 * - kein Liga-Vergleich ("vs. andere Teams") — der Snapshot ist rein teambezogen.
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

type NextUpgradeCandidate = {
  facility: FacilitiesOverviewV2Snapshot;
  effectDescription: string;
  upgradeCost: number;
  /** Nur für Einnahmen-Gebäude: Einnahmen-Zuwachs der nächsten Stufe pro Saison. */
  incomeGain: number | null;
  /** Nur wenn der Netto-Zuwachs (Einnahmen minus Mehr-Unterhalt) positiv ist. */
  paybackSeasons: number | null;
};

/**
 * Portfolio-Aggregat aus exakt denselben Quellen wie das Karten-Grid:
 * `facility.upkeep` aus den Props, Einnahmen/Upgrade-Stufen aus dem Katalog.
 */
function buildFacilityPortfolio(facilities: FacilitiesOverviewV2Snapshot[]) {
  let totalUpkeep = 0;
  let totalIncome = 0;
  let builtCount = 0;
  const candidates: NextUpgradeCandidate[] = [];

  for (const facility of facilities) {
    if (facility.level > 0) {
      builtCount += 1;
    }
    if (facility.upkeep != null && Number.isFinite(facility.upkeep)) {
      totalUpkeep += facility.upkeep;
    }

    const catalogId = resolveCatalogFacilityId(facility.facilityId);
    const currentIncome =
      catalogId != null && facility.level > 0
        ? getFacilityLevelDefinition(catalogId, facility.level)?.seasonIncome ?? 0
        : 0;
    totalIncome += currentIncome;

    const nextDefinition =
      catalogId != null && facility.level < facility.maxLevel
        ? getFacilityLevelDefinition(catalogId, facility.level + 1)
        : null;
    if (nextDefinition) {
      const incomeGain = nextDefinition.seasonIncome != null ? nextDefinition.seasonIncome - currentIncome : null;
      const upkeepDelta = nextDefinition.seasonUpkeep - (facility.upkeep ?? 0);
      const netGain = incomeGain != null ? incomeGain - upkeepDelta : null;
      candidates.push({
        facility,
        effectDescription: nextDefinition.effectDescription,
        upgradeCost: nextDefinition.upgradeCost,
        incomeGain,
        paybackSeasons:
          netGain != null && netGain > 0 && nextDefinition.upgradeCost > 0 ? nextDefinition.upgradeCost / netGain : null,
      });
    }
  }

  // Ranking: Einnahmen-Upgrades nach Amortisationszeit (Kosten / Netto-Zuwachs),
  // alle übrigen nach günstigsten Ausbaukosten — beides echte Katalogzahlen.
  candidates.sort((left, right) => {
    if (left.paybackSeasons != null && right.paybackSeasons != null) {
      return left.paybackSeasons - right.paybackSeasons;
    }
    if (left.paybackSeasons != null) return -1;
    if (right.paybackSeasons != null) return 1;
    return left.upgradeCost - right.upgradeCost;
  });

  return { totalUpkeep, totalIncome, builtCount, candidates };
}

function NextBestUpgradeCard({
  candidates,
  facilityBudget,
}: {
  candidates: NextUpgradeCandidate[];
  facilityBudget: number | null;
}) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <NlCard
      className="nl-facility-overview-next"
      eyebrow="Investitions-Radar"
      title="Nächstes bestes Upgrade"
      data-testid="nl-facility-overview-next"
    >
      <ol className="nl-facility-overview-next-list" aria-label="Beste nächste Upgrades">
        {candidates.slice(0, 3).map((candidate, index) => {
          const { facility } = candidate;
          const affordable = facilityBudget != null ? candidate.upgradeCost <= facilityBudget : null;
          return (
            <li
              key={facility.facilityId}
              className={`nl-facility-overview-next-item${index === 0 ? " is-top" : ""}`}
            >
              <span className="nl-facility-overview-next-rank nl-tnum" aria-hidden="true">
                {index + 1}
              </span>
              <span className="nl-facility-overview-next-copy">
                <strong>
                  {facility.label}
                  <span className="nl-facility-overview-next-levels nl-tnum">
                    {" "}
                    · L{formatNlNumber(facility.level, 0)} → L{formatNlNumber(facility.level + 1, 0)}
                  </span>
                </strong>
                <span className="nl-facility-overview-next-effect">{candidate.effectDescription}</span>
                <small className="nl-tnum">
                  Kosten {formatTransfermarktCurrency(candidate.upgradeCost)}
                  {candidate.incomeGain != null
                    ? ` · ${candidate.incomeGain >= 0 ? "+" : ""}${formatTransfermarktCurrency(candidate.incomeGain)}/Saison`
                    : ""}
                  {candidate.paybackSeasons != null
                    ? ` · amortisiert in ~${formatNlNumber(candidate.paybackSeasons, 1)} Saisons`
                    : ""}
                </small>
              </span>
              {affordable != null ? (
                <span
                  className={`nl-facility-overview-next-badge ${affordable ? "is-affordable" : "is-over"}`}
                  title={
                    affordable
                      ? "Kosten liegen im aktuellen Gebäude-Budget"
                      : "Kosten übersteigen das aktuelle Gebäude-Budget"
                  }
                >
                  {affordable ? "Im Budget" : "Über Budget"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </NlCard>
  );
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
  const portfolio = useMemo(() => buildFacilityPortfolio(facilities), [facilities]);
  const netPerSeason = portfolio.totalIncome - portfolio.totalUpkeep;

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
        <StatChipRow className="nl-facility-overview-portfolio" label="Portfolio" aria-label="Gebäude-Portfolio pro Saison">
          <StatChip
            label="Einnahmen/Saison"
            value={formatTransfermarktCurrency(portfolio.totalIncome)}
            tone="good"
            title="Summe der aktuellen Saison-Einnahmen aller gebauten Einnahmen-Gebäude"
          />
          <StatChip
            label="Wartung/Saison"
            value={formatTransfermarktCurrency(portfolio.totalUpkeep)}
            tone="warn"
            title="Summe der Wartungskosten aller Gebäude (wie im Karten-Grid ausgewiesen)"
          />
          <StatChip
            label="Netto/Saison"
            value={`${netPerSeason > 0 ? "+" : ""}${formatTransfermarktCurrency(netPerSeason)}`}
            tone={netPerSeason >= 0 ? "good" : "risk"}
            title="Saison-Einnahmen minus Wartungskosten über alle Gebäude"
          />
        </StatChipRow>
        <NlProgressBar
          className="nl-facility-overview-build"
          label="Ausbau-Fortschritt"
          value={portfolio.builtCount}
          max={facilities.length || 1}
          tone="accent"
          format={(value, max) => `${formatNlNumber(value, 0)} von ${formatNlNumber(max, 0)} gebaut`}
          title={`${formatNlNumber(portfolio.candidates.length, 0)} Ausbaustufen offen`}
        />
        <p className="nl-facility-overview-board">{boardMessage}</p>
      </NlCard>

      <NextBestUpgradeCard candidates={portfolio.candidates} facilityBudget={facilityBudget} />

      <div className="nl-facility-overview-grid">
        {facilities.map((facility) => (
          <FacilityOverviewCard key={facility.facilityId} facility={facility} />
        ))}
      </div>
    </div>
  );
}
