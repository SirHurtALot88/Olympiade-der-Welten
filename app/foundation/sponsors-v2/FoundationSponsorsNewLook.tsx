"use client";

import { useMemo, useState } from "react";

import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlGauge,
  NlProgressBar,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlNumber,
} from "@/components/foundation/new-look";
import {
  SPONSOR_ARCHETYPE_META,
  SponsorCrest,
  SponsorOfferCardNewLook,
} from "@/components/foundation/sponsor/SponsorOfferCardNewLook";
import { buildSponsorOfferPresentation, getSponsorComponentKindLabel } from "@/lib/sponsor/sponsor-offer-presenter";
import type { GameState, SponsorOffer, TeamSponsorContract } from "@/lib/data/olyDataTypes";

import type { FoundationSponsorsPanelProps } from "@/app/foundation/sponsors-v2/FoundationSponsorsPanel";

/** Vorzeichenbehaftete Cash-Formatierung für Sponsor-Events (Bonus/Malus). */
function formatSignedCash(formatCash: (value: number) => string, value: number) {
  const abs = formatCash(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${abs}`;
}

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

function ActiveContractHero({
  contract,
  gameState,
  formatCash,
}: {
  contract: TeamSponsorContract;
  gameState: GameState;
  formatCash: (value: number) => string;
}) {
  const archetypeMeta = SPONSOR_ARCHETYPE_META[contract.archetype];
  const payoutTiles = buildContractPayoutTiles(contract);
  const paidCount = payoutTiles.filter((tile) => tile.paid).length;
  const termSeasons = contract.termSeasons ?? null;
  const seasonsDone =
    termSeasons != null && contract.seasonsRemaining != null
      ? Math.max(0, termSeasons - contract.seasonsRemaining)
      : null;

  // #22: Live-Ziel-Tracker für das Sonderziel des aktiven Vertrags — nutzt
  // denselben echten Presenter wie die Angebotskarten (`buildSpecialPresentation`
  // intern), angewendet auf die realen Vertragskomponenten/den echten
  // GameState. `flavor`/`totalUpsideEstimate` sind auf dem Vertrag nicht
  // gespeichert; totalUpsideEstimate wird real aus den Komponenten summiert,
  // flavor bleibt leer (fließt in keine hier gerenderte Ausgabe ein).
  const specialComponent = contract.components.find((component) => component.kind === "special") ?? null;
  const specialPresentation = specialComponent
    ? buildSponsorOfferPresentation({
        offer: {
          offerId: contract.offerId,
          seasonId: contract.seasonId,
          teamId: contract.teamId,
          archetype: contract.archetype,
          name: contract.name,
          flavor: "",
          components: contract.components,
          totalUpsideEstimate: contract.components.reduce(
            (sum, component) => sum + (typeof component.rewardCash === "number" ? component.rewardCash : 0),
            0,
          ),
          starTier: contract.starTier,
          sponsorBrandId: contract.sponsorBrandId,
          sponsorParentBrandId: contract.sponsorParentBrandId,
          variantKey: contract.variantKey,
          termSeasons: contract.termSeasons,
          negotiationProfile: contract.negotiationProfile,
          demandProfile: contract.demandProfile,
          teamQualityRank: contract.teamQualityRankAtSign,
        } satisfies SponsorOffer,
        gameState,
        teamId: contract.teamId,
      }).special
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

      {specialPresentation ? (
        <div className="nl-sponsor-hero-tracker" data-testid="nl-sponsor-active-tracker">
          <div className="nl-sponsor-hero-tracker-head">
            {specialPresentation.axisLabel ? (
              <span className={`nl-sponsor-axis-chip is-${specialPresentation.axisKey}`}>
                {specialPresentation.axisLabel}
              </span>
            ) : (
              <span className="nl-sponsor-axis-chip is-neutral">Ziel</span>
            )}
            <span className={`nl-sponsor-difficulty is-${specialPresentation.difficulty}`}>
              {specialPresentation.difficultyLabel}
            </span>
          </div>
          <strong className="nl-sponsor-hero-tracker-headline">{specialPresentation.headline}</strong>
          <small>{specialPresentation.detail}</small>
          {specialComponent ? (
            <span className="nl-sponsor-hero-tracker-reward nl-tnum">
              Bonus {formatCash(specialComponent.rewardCash)}
              {specialComponent.penaltyCash ? ` · Malus −${formatCash(specialComponent.penaltyCash)}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}
    </NlCard>
  );
}

type LeagueSponsorSort = "cash" | "sponsor" | "team";

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
  // "Neuer Look" Hooks laufen unconditionally vor jedem Return (dieser
  // Component hat kein weiteres Flag-Gate mehr — er wird nur gerendert,
  // wenn `useNewLook` im Parent bereits aktiv ist).
  const [ratingDetailsOpen, setRatingDetailsOpen] = useState(false);
  const [leagueSponsorSort, setLeagueSponsorSort] = useState<LeagueSponsorSort>("cash");

  // #76: Angebotsvergleich — echte Cash-Summe je Angebot unter dem aktuell
  // gewählten Verhandlungsprofil (dieselbe Formel wie in der Angebotskarte).
  const offerCashSummaries = useMemo(
    () =>
      selectedTeamSponsorOffers.map((offer) => {
        const negotiationProfile = sponsorChoiceProfiles[offer.offerId] ?? "balanced";
        const adjustedComponents = applySponsorNegotiationToComponents({
          components: offer.components,
          termSeasons: 1,
          negotiationProfile,
          starTier: offer.starTier,
        });
        const totalCash = adjustedComponents.reduce(
          (sum, component) => sum + (typeof component.rewardCash === "number" ? component.rewardCash : 0),
          0,
        );
        return { offerId: offer.offerId, name: offer.name, archetype: offer.archetype, totalCash };
      }),
    [selectedTeamSponsorOffers, sponsorChoiceProfiles, applySponsorNegotiationToComponents],
  );
  const bestCashOfferId = useMemo(() => {
    if (offerCashSummaries.length < 2) return null;
    return offerCashSummaries.reduce((best, entry) => (entry.totalCash > best.totalCash ? entry : best)).offerId;
  }, [offerCashSummaries]);

  // #21: Sponsor-Auszahlungs-Timeline aus den echten Saison-Events
  // (`gameState.seasonState.sponsorEvents`) — nur für das Team mit
  // aktivem Vertrag, da Events serverseitig nur bei bestehendem Vertrag
  // generiert werden.
  const activeContractTeamId = selectedTeamSponsorContract?.teamId ?? null;
  const sponsorPayoutEvents = useMemo(() => {
    if (!activeContractTeamId) return [];
    return (gameState.seasonState.sponsorEvents ?? [])
      .filter((event) => event.teamId === activeContractTeamId)
      .sort((left, right) => left.matchday - right.matchday || Date.parse(left.createdAt) - Date.parse(right.createdAt));
  }, [gameState.seasonState.sponsorEvents, activeContractTeamId]);

  // #78: Liga-Sponsorenübersicht — wer hat wen, aus `sponsorContractsByTeamId`
  // über alle Teams (`gameState.teams`), sortierbar.
  const leagueSponsorRows = useMemo(() => {
    const contracts = gameState.seasonState.sponsorContractsByTeamId ?? {};
    return gameState.teams.map((team) => {
      const contract = contracts[team.teamId] ?? null;
      const totalCash = contract
        ? contract.components.reduce(
            (sum, component) => sum + (typeof component.rewardCash === "number" ? component.rewardCash : 0),
            0,
          )
        : null;
      return {
        teamId: team.teamId,
        teamName: team.name,
        shortCode: team.shortCode,
        sponsorName: contract?.name ?? null,
        archetype: contract?.archetype ?? null,
        starTier: contract?.starTier ?? null,
        totalCash,
      };
    });
  }, [gameState.teams, gameState.seasonState.sponsorContractsByTeamId]);
  const sortedLeagueSponsorRows = useMemo(() => {
    const list = [...leagueSponsorRows];
    list.sort((left, right) => {
      if (leagueSponsorSort === "team") {
        return left.teamName.localeCompare(right.teamName, "de", { sensitivity: "base" });
      }
      if (leagueSponsorSort === "sponsor") {
        if (left.sponsorName == null && right.sponsorName == null) return 0;
        if (left.sponsorName == null) return 1;
        if (right.sponsorName == null) return -1;
        return left.sponsorName.localeCompare(right.sponsorName, "de", { sensitivity: "base" });
      }
      return (right.totalCash ?? -1) - (left.totalCash ?? -1);
    });
    return list;
  }, [leagueSponsorRows, leagueSponsorSort]);

  // #D12: Schwächster Treiber des Kommerz-Ratings. Die drei Treiber
  // (Historie/Kader/Prestige) summieren sich additiv zum Score
  // (buildSponsorCommercialRating: recentPerformance ≤ 55, rosterPotential ≤ 35,
  // prestige ≤ 20). Vergleich fair über den Füllgrad (Wert / Max-Beitrag) —
  // der Treiber mit dem geringsten Füllgrad hat das meiste Aufhol-Potenzial.
  // Fog-safe: ausschließlich Treiber/Rohdaten des eigenen (selektierten) Teams.
  const sponsorWeakestDriver = useMemo(() => {
    if (!selectedTeamCommercialRating) return null;
    const { breakdown, inputs } = selectedTeamCommercialRating;

    const rankLabel = inputs.avgWeightedRank != null ? `Ø Rang #${formatNlNumber(inputs.avgWeightedRank, 1)}` : null;

    // Kader-Untertreiber: schwächstes Perzentil/Kaderbreite → gezielter Tipp.
    const kaderParts = [
      { label: "Kaderwert", value: inputs.marketValuePercentile, hint: "steigere den Kader-Marktwert (Käufe/Entwicklung)" },
      { label: "Achsenprofil", value: inputs.axisPercentile, hint: "hebe das Achsenprofil (Training/Skills)" },
      { label: "Kaderbreite", value: inputs.depthScore, hint: "erweitere die Kaderbreite (mehr Spieler unter Vertrag)" },
    ];
    const weakestKaderPart = kaderParts.reduce((weakest, part) => (part.value < weakest.value ? part : weakest));

    const drivers = [
      {
        key: "recentPerformance",
        label: "Historie",
        value: breakdown.recentPerformance,
        maxContribution: 55,
        context: rankLabel ?? "jüngste Platzierung",
        suggestion: "verbessere deine Platzierung in der Liga",
      },
      {
        key: "rosterPotential",
        label: "Kader",
        value: breakdown.rosterPotential,
        maxContribution: 35,
        context: `${weakestKaderPart.label} ${formatNlNumber(weakestKaderPart.value, 0)}${weakestKaderPart.label === "Kaderbreite" ? "" : "%"}`,
        suggestion: weakestKaderPart.hint,
      },
      {
        key: "prestige",
        label: "Prestige",
        value: breakdown.prestige,
        maxContribution: 20,
        context: `Prestige-Score ${formatNlNumber(inputs.prestigeMedalScore, 1)}/20`,
        suggestion: "sammle Medaillen (Gold/Silber/Bronze) und Top-Platzierungen",
      },
    ];

    return drivers.reduce((weakest, driver) =>
      driver.value / driver.maxContribution < weakest.value / weakest.maxContribution ? driver : weakest,
    );
  }, [selectedTeamCommercialRating]);

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

              {/* #D12: Nudge zum schwächsten Rating-Treiber — echter Vergleich
                  über den Füllgrad (Wert/Max-Beitrag), eigene Team-Daten. */}
              {sponsorWeakestDriver ? (
                <div className="nl-sponsor-nudge" role="note" data-testid="nl-sponsor-weakest-driver">
                  <span className="nl-sponsor-nudge-icon" aria-hidden="true">
                    ↑
                  </span>
                  <span className="nl-sponsor-nudge-copy">
                    <strong>
                      Schwächster Treiber: {sponsorWeakestDriver.label} ({sponsorWeakestDriver.context})
                    </strong>
                    <small>
                      {sponsorWeakestDriver.suggestion} — um bessere Sponsor-Angebote zu bekommen.
                    </small>
                  </span>
                </div>
              ) : null}

              {/* #77: aufklappbares Treiber-Portal — echte Rohdaten aus commercialRating.inputs */}
              <button
                type="button"
                className="nl-sponsor-rating-toggle"
                aria-expanded={ratingDetailsOpen}
                onClick={() => setRatingDetailsOpen((current) => !current)}
              >
                {ratingDetailsOpen ? "Rohdaten verbergen" : "Rohdaten zeigen"}
              </button>
              {ratingDetailsOpen ? (
                <StatChipRow className="nl-sponsor-rating-inputs" aria-label="Kommerz-Rating Rohdaten">
                  {selectedTeamCommercialRating.inputs.lastSeasonRank != null ? (
                    <StatChip label="Letzte Saison" value={`#${selectedTeamCommercialRating.inputs.lastSeasonRank}`} tone="neutral" />
                  ) : null}
                  {selectedTeamCommercialRating.inputs.avgWeightedRank != null ? (
                    <StatChip
                      label="Ø Rang"
                      value={formatNlNumber(selectedTeamCommercialRating.inputs.avgWeightedRank, 1)}
                      tone="neutral"
                    />
                  ) : null}
                  {selectedTeamCommercialRating.inputs.qualityRank != null ? (
                    <StatChip label="Qualitäts-Rang" value={`#${selectedTeamCommercialRating.inputs.qualityRank}`} tone="neutral" />
                  ) : null}
                  <StatChip
                    label="MW-Perzentil"
                    value={`${formatNlNumber(selectedTeamCommercialRating.inputs.marketValuePercentile, 0)}%`}
                    tone="spe"
                  />
                  <StatChip
                    label="Achsen-Perzentil"
                    value={`${formatNlNumber(selectedTeamCommercialRating.inputs.axisPercentile, 0)}%`}
                    tone="pow"
                  />
                  <StatChip label="Kaderbreite" value={formatNlNumber(selectedTeamCommercialRating.inputs.depthScore, 0)} tone="men" />
                  <StatChip
                    label="Prestige-Score"
                    value={formatNlNumber(selectedTeamCommercialRating.inputs.prestigeMedalScore, 0)}
                    tone="soc"
                  />
                </StatChipRow>
              ) : null}
            </div>
          ) : null}
        </NlCard>

        {sponsorChoiceMessage ? (
          <div className="nl-sponsor-banner" role="status">
            {sponsorChoiceMessage}
          </div>
        ) : null}

        {selectedTeamSponsorContract ? (
          <>
            <ActiveContractHero contract={selectedTeamSponsorContract} gameState={gameState} formatCash={formatMoney} />
            {/* #21: Sponsor-Auszahlungs-Timeline aus echten Saison-Events */}
            <NlCard className="nl-sponsor-payout-card" eyebrow="Saison-Ereignisse" title="Sponsor-Auszahlungs-Timeline">
              {sponsorPayoutEvents.length ? (
                <div className="nl-sponsor-payout-timeline" role="list" aria-label="Sponsor-Ereignisse dieser Saison">
                  {sponsorPayoutEvents.map((event) => (
                    <div key={event.eventId} role="listitem" className={`nl-sponsor-payout-event is-${event.eventType}`}>
                      <span className="nl-sponsor-payout-matchday nl-tnum">MD {event.matchday}</span>
                      <span className="nl-sponsor-payout-copy">
                        <strong>{event.sponsorName}</strong>
                        <small>{event.message}</small>
                      </span>
                      <NlDeltaChip
                        value={event.cashDelta}
                        format={(value) => formatSignedCash(formatMoney, value)}
                        title={`${event.cashDelta >= 0 ? "Bonus" : "Malus"} · Status ${event.status}`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="nl-sponsor-empty">Noch keine Sponsor-Events diese Saison.</p>
              )}
            </NlCard>
          </>
        ) : selectedTeamSponsorOffers.length > 0 ? (
          <>
            {/* #76: Angebotsvergleich — Cash-Gesamt pro Angebot */}
            {offerCashSummaries.length > 1 ? (
              <NlCard className="nl-sponsor-compare-card" eyebrow="Angebotsvergleich" title="Cash-Gesamt pro Angebot">
                <NlBarChart
                  bars={offerCashSummaries.map((entry) => ({
                    label: entry.name.length > 10 ? `${entry.name.slice(0, 9)}…` : entry.name,
                    value: entry.totalCash,
                    tone: SPONSOR_ARCHETYPE_META[entry.archetype].tone,
                  }))}
                  format={(value) => formatMoney(value)}
                  aria-label="Cash-Gesamt Vergleich der aktuellen Sponsor-Angebote"
                  className="nl-sponsor-compare-chart"
                />
              </NlCard>
            ) : null}
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
                    isBestCashOffer={bestCashOfferId != null && offer.offerId === bestCashOfferId}
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
          </>
        ) : (
          <p className="nl-sponsor-empty">Noch keine Sponsor-Angebote für diese Saison geladen.</p>
        )}

        {/* #78: Liga-Sponsorenübersicht — wer hat wen, sortierbar */}
        <NlCard
          className="nl-sponsor-league-card"
          eyebrow="Liga"
          title={`Sponsorenübersicht · ${sortedLeagueSponsorRows.length} Teams`}
          actions={
            <NlSubTabs
              className="nl-sponsor-league-sort-tabs"
              aria-label="Liga-Sponsorenübersicht sortieren"
              activeId={leagueSponsorSort}
              onSelect={(id) => setLeagueSponsorSort(id as LeagueSponsorSort)}
              items={[
                { id: "cash", label: "Cash" },
                { id: "sponsor", label: "Sponsor" },
                { id: "team", label: "Team" },
              ]}
            />
          }
        >
          <div className="nl-sponsor-league-list" role="list" aria-label="Sponsoren aller Teams">
            {sortedLeagueSponsorRows.map((row) => (
              <div
                key={row.teamId}
                role="listitem"
                className={`nl-sponsor-league-row${row.teamName === selectedTeamName ? " is-current" : ""}`}
              >
                <span className="nl-sponsor-league-team">
                  <span className="nl-sponsor-league-code">{row.shortCode}</span>
                  <strong>{row.teamName}</strong>
                </span>
                {row.sponsorName ? (
                  <span className={`nl-sponsor-league-sponsor is-${row.archetype ?? "none"}`}>
                    {row.sponsorName}
                    {row.starTier ? ` · ★${row.starTier}` : ""}
                  </span>
                ) : (
                  <span className="nl-sponsor-league-sponsor is-empty">Kein Sponsor</span>
                )}
                <span className="nl-sponsor-league-cash nl-tnum">
                  {row.totalCash != null ? formatMoney(row.totalCash) : "—"}
                </span>
              </div>
            ))}
          </div>
        </NlCard>
      </section>
    </div>
  );
}
