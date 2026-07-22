"use client";

import { useMemo, useState } from "react";

import {
  NlCard,
  NlDeltaChip,
  NlEmptyState,
  NlGauge,
  NlProgressBar,
  NlSubTabs,
  NL_TONE_VAR,
  StatChip,
  StatChipRow,
  formatNlNumber,
  useCountUp,
  type NlTone,
} from "@/components/foundation/new-look";
import {
  RarityPill,
  SponsorCrest,
  SponsorOfferCardNewLook,
} from "@/components/foundation/sponsor/SponsorOfferCardNewLook";
import { buildSponsorOfferPresentation, getSponsorComponentKindLabel } from "@/lib/sponsor/sponsor-offer-presenter";
import { getTeamObjectives } from "@/lib/board/team-season-objectives-service";
import { formatGameFlowBlocker } from "@/lib/foundation/game-flow-blocker-labels";
import {
  SPONSOR_CURVE_FAMILIES,
  SPONSOR_CURVE_SHAPES,
  SPONSOR_RARITIES,
  getSponsorCurveFamily,
  mapArchetypeToCurveShape,
} from "@/lib/sponsor/sponsor-curve-shapes";
import type { GameState, SponsorOffer, TeamSponsorContract } from "@/lib/data/olyDataTypes";

import type { FoundationSponsorsPanelProps } from "@/app/foundation/sponsors-v2/FoundationSponsorsPanel";

/** Vorzeichenbehaftete Cash-Formatierung für Sponsor-Events (Bonus/Malus). */
function formatSignedCash(formatCash: (value: number) => string, value: number) {
  const abs = formatCash(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${abs}`;
}

/**
 * Sponsor-Choice-Meldungen können entweder freundliche Sätze sein oder ein
 * roher Reason-Slug aus dem API-Fehlerpfad (z. B.
 * `phase_blocked:sponsor_choice:season_active`). Slug-artige Meldungen (ohne
 * Leerzeichen, aber mit `:`/`_`) werden durch den geteilten Blocker-Labeler in
 * freundliches Deutsch übersetzt; echte Sätze bleiben unverändert.
 */
function formatSponsorChoiceMessage(message: string): string {
  const looksLikeReasonSlug = !/\s/.test(message) && /[:_]/.test(message);
  return looksLikeReasonSlug ? formatGameFlowBlocker(message) : message;
}

type SponsorComponentKind = SponsorOffer["components"][number]["kind"];

/** Status-Wort + Farbton für ein Board-Ziel in der Sponsor-Abgleich-Liste. */
const BOARD_TARGET_STATUS_META: Record<string, { label: string; tone: NlTone }> = {
  completed: { label: "erfüllt", tone: "good" },
  at_risk: { label: "wackelt", tone: "warn" },
  open: { label: "offen", tone: "neutral" },
};

/**
 * Kompakte Board-Ziel-Liste über dem Angebotsraster, damit der Spieler bei der Sponsorenwahl direkt sieht,
 * welche Vorstandsziele diese Saison offen sind — und ob ein Sponsor-Sonderziel darauf einzahlt (dann
 * arbeitet EINE Aktion an beidem). Zieht dieselbe Quelle wie das Team-Profil (getTeamObjectives, auf
 * gameState memoisiert), also keine zusätzlichen Props/Fetches nötig.
 */
function SponsorBoardTargetsPanel({ gameState, teamId }: { gameState: GameState; teamId: string }) {
  const objectives = useMemo(() => getTeamObjectives(gameState, teamId), [gameState, teamId]);
  if (objectives.length === 0) {
    return null;
  }
  return (
    <NlCard className="nl-sponsor-boardtargets-card" eyebrow="Zum Abgleich" title="Board-Ziele diese Saison">
      <p className="nl-sponsor-boardtargets-hint">
        Deckt sich ein Sponsor-Sonderziel mit einem dieser Vorstandsziele, arbeitest du mit einer Aktion an beidem.
      </p>
      <ul className="nl-sponsor-boardtargets-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.35rem" }}>
        {objectives.map((objective) => {
          const meta = BOARD_TARGET_STATUS_META[objective.status] ?? BOARD_TARGET_STATUS_META.open!;
          return (
            <li
              key={objective.objectiveId}
              className="nl-sponsor-boardtarget"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span
                className="nl-sponsor-boardtarget-dot"
                aria-hidden="true"
                style={{ flex: "0 0 auto", width: 8, height: 8, borderRadius: 999, background: NL_TONE_VAR[meta.tone] }}
              />
              <span className="nl-sponsor-boardtarget-label" style={{ flex: "1 1 auto", minWidth: 0 }}>
                {objective.label}
              </span>
              {objective.targetValue != null && String(objective.targetValue).trim() !== "" ? (
                <span className="nl-sponsor-boardtarget-target nl-tnum" style={{ flex: "0 0 auto", opacity: 0.75 }}>
                  {String(objective.targetValue)}
                </span>
              ) : null}
              <span className="nl-sponsor-boardtarget-status" style={{ flex: "0 0 auto", color: NL_TONE_VAR[meta.tone], fontWeight: 600 }}>
                {meta.label}
              </span>
            </li>
          );
        })}
      </ul>
    </NlCard>
  );
}

/**
 * Segment-Reihenfolge + Farbe für das gestapelte Angebots-Cash-Chart
 * (Angebotsvergleich). Reihenfolge = Stapelung von unten (Basis) nach oben
 * (Sonderziel); Labels kommen aus `getSponsorComponentKindLabel`, damit sie
 * exakt zu den Angebotskarten passen.
 */
const SPONSOR_STACK_SEGMENTS: Array<{ kind: SponsorComponentKind; tone: NlTone }> = [
  { kind: "base", tone: "accent" },
  { kind: "rank", tone: "warn" },
  { kind: "improvement", tone: "spe" },
  { kind: "special", tone: "good" },
];

/**
 * "Neuer Look" Sponsoren — flag-gated, additiv (nur wenn `useNewLook` aktiv ist).
 *
 * Konsumiert exakt dieselben Props wie `FoundationSponsorsPanel` und läuft über
 * den echten Abschluss (`chooseTeamSponsor`).
 *
 * Laufzeit (`termSeasons`): NUR Anzeige, kein Selector — der Apply-Pfad
 * (`chooseTeamSponsor(offerId)` → POST /api/sponsor/choose) nimmt keine
 * Laufzeit an und rechnet serverseitig fest mit `termSeasons: 1`.
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
  // Rarität/Kurvenform robust auflösen (Back-Compat für alte Verträge; rarity wird bereits beim Laden aus
  // dem alten Sternrang zurückgefüllt, siehe save-repository.ts).
  const rarity = contract.rarity ?? "gewöhnlich";
  const shape = contract.curveShape ?? mapArchetypeToCurveShape(contract.archetype);
  const shapeLabel = SPONSOR_CURVE_SHAPES[shape].labelDe;
  const familyLabel = SPONSOR_CURVE_FAMILIES[getSponsorCurveFamily(shape)].labelDe;
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
          sponsorBrandId: contract.sponsorBrandId,
          sponsorParentBrandId: contract.sponsorParentBrandId,
          variantKey: contract.variantKey,
          termSeasons: contract.termSeasons,
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
            Aktiver Vertrag · {shapeLabel} · {familyLabel}
          </span>
          <RarityPill rarity={rarity} className="nl-sponsor-hero-rarity" />
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

type LeagueSponsorSort = "cash" | "sponsor" | "team" | "tier";

export default function FoundationSponsorsNewLook({
  gameState,
  selectedTeamName,
  selectedTeamCommercialRating,
  selectedTeamSponsorContract,
  selectedTeamSponsorOffers,
  sponsorChoiceMessage,
  sponsorChoiceBusy,
  selectedTeamCanManage,
  formatMoney,
  chooseTeamSponsor,
}: FoundationSponsorsPanelProps) {
  // "Neuer Look" Hooks laufen unconditionally vor jedem Return (dieser
  // Component hat kein weiteres Flag-Gate mehr — er wird nur gerendert,
  // wenn `useNewLook` im Parent bereits aktiv ist).
  const [ratingDetailsOpen, setRatingDetailsOpen] = useState(false);
  const [leagueSponsorSort, setLeagueSponsorSort] = useState<LeagueSponsorSort>("cash");

  // #76: Angebotsvergleich — echte Cash-Summe je Angebot (dieselbe Formel wie
  // in der Angebotskarte).
  const offerCashSummaries = useMemo(
    () =>
      selectedTeamSponsorOffers.map((offer) => {
        const totalCash = offer.components.reduce(
          (sum, component) => sum + (typeof component.rewardCash === "number" ? component.rewardCash : 0),
          0,
        );
        // Cash je Komponenten-Art (nur positive Beträge) für das gestapelte
        // Vergleichs-Chart — Segmente zerlegen den Gesamtbetrag in Basis /
        // Gewinnstufen / Tabellenziel / Sonderziel.
        const kindTotals = new Map<SponsorComponentKind, number>();
        for (const component of offer.components) {
          const cash = typeof component.rewardCash === "number" ? component.rewardCash : 0;
          if (cash <= 0) continue;
          kindTotals.set(component.kind, (kindTotals.get(component.kind) ?? 0) + cash);
        }
        const segments = SPONSOR_STACK_SEGMENTS.filter((seg) => (kindTotals.get(seg.kind) ?? 0) > 0).map((seg) => ({
          kind: seg.kind,
          label: getSponsorComponentKindLabel(seg.kind),
          tone: seg.tone,
          value: kindTotals.get(seg.kind) ?? 0,
        }));
        return { offerId: offer.offerId, name: offer.name, archetype: offer.archetype, totalCash, segments };
      }),
    [selectedTeamSponsorOffers],
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
        // Rarität/Kurvenform robust auflösen (Back-Compat für alte Verträge).
        rarity: contract ? (contract.rarity ?? "gewöhnlich") : null,
        curveShape: contract ? (contract.curveShape ?? mapArchetypeToCurveShape(contract.archetype)) : null,
        totalCash,
        // Golden Card = seltener Premium-Elite-Sponsor (Underdog-Glück). Der
        // Vertrag erbt `variantKey` vom Angebot (sponsor-offer-service), daher
        // ist das der verlaessliche Golden-Indikator auf Vertragsebene.
        isGolden: contract?.variantKey === "premium_elite",
      };
    });
  }, [gameState.teams, gameState.seasonState.sponsorContractsByTeamId]);
  const sortedLeagueSponsorRows = useMemo(() => {
    const list = [...leagueSponsorRows];
    list.sort((left, right) => {
      // Golden-Card-Sponsoren immer zuerst — unabhaengig vom Sortier-Modus.
      if (left.isGolden !== right.isGolden) {
        return left.isGolden ? -1 : 1;
      }
      if (leagueSponsorSort === "team") {
        return left.teamName.localeCompare(right.teamName, "de", { sensitivity: "base" });
      }
      if (leagueSponsorSort === "sponsor") {
        if (left.sponsorName == null && right.sponsorName == null) return 0;
        if (left.sponsorName == null) return 1;
        if (right.sponsorName == null) return -1;
        return left.sponsorName.localeCompare(right.sponsorName, "de", { sensitivity: "base" });
      }
      if (leagueSponsorSort === "tier") {
        const leftOrder = left.rarity ? SPONSOR_RARITIES[left.rarity].order : -1;
        const rightOrder = right.rarity ? SPONSOR_RARITIES[right.rarity].order : -1;
        return rightOrder - leftOrder;
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

  // KPI-Hero: Kommerz-Score, aktiver Sponsor, Cash/Saison des laufenden
  // Vertrags und Ø-Angebotswert der offenen Angebote — ausschließlich aus
  // bereits vorhandenen Daten (kein neuer Fetch/State).
  const activeContractCashTotal = useMemo(() => {
    if (!selectedTeamSponsorContract) return null;
    return selectedTeamSponsorContract.components.reduce(
      (sum, component) => sum + (typeof component.rewardCash === "number" ? component.rewardCash : 0),
      0,
    );
  }, [selectedTeamSponsorContract]);
  const avgOfferCashValue = useMemo(() => {
    if (offerCashSummaries.length === 0) return null;
    return offerCashSummaries.reduce((sum, entry) => sum + entry.totalCash, 0) / offerCashSummaries.length;
  }, [offerCashSummaries]);

  const animatedKpiScore = useCountUp(selectedTeamCommercialRating?.score ?? null);
  const animatedKpiContractCash = useCountUp(activeContractCashTotal);
  const animatedKpiAvgOfferCash = useCountUp(avgOfferCashValue);

  // Erwartete Rarität, direkt aus dem Kommerz-Rating.
  const expectationRarityLabel = selectedTeamCommercialRating
    ? SPONSOR_RARITIES[selectedTeamCommercialRating.rarityHint].labelDe
    : null;

  return (
    <div data-testid="foundation-sponsors">
      <section className="nl-sponsor" data-testid="team-sponsor-choice" id="sponsor-choice" data-new-look="true">
        <StatChipRow className="nl-sponsor-kpi-hero" aria-label="Sponsoren-Kennzahlen">
          <StatChip
            label="Kommerz-Score"
            value={
              selectedTeamCommercialRating
                ? formatNlNumber(animatedKpiScore ?? selectedTeamCommercialRating.score, 0)
                : "—"
            }
            sub={expectationRarityLabel ? `Erwartung: ${expectationRarityLabel}` : undefined}
            tone="accent"
          />
          <StatChip
            label="Aktiver Sponsor"
            value={selectedTeamSponsorContract ? "Ja" : "Nein"}
            sub={selectedTeamSponsorContract?.name}
            tone={selectedTeamSponsorContract ? "good" : "neutral"}
          />
          <StatChip
            label="Cash/Saison"
            value={
              activeContractCashTotal != null
                ? formatMoney(animatedKpiContractCash ?? activeContractCashTotal)
                : "—"
            }
            sub={activeContractCashTotal != null ? "aktiver Vertrag" : "kein Vertrag"}
            tone={activeContractCashTotal != null ? "good" : "neutral"}
          />
          <StatChip
            label="Ø-Angebotswert"
            value={avgOfferCashValue != null ? formatMoney(animatedKpiAvgOfferCash ?? avgOfferCashValue) : "—"}
            sub={avgOfferCashValue != null ? `${offerCashSummaries.length} Angebote` : undefined}
          />
        </StatChipRow>
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
                title={`Commercial Rating ${selectedTeamCommercialRating.score}/100 · Erwartung ${expectationRarityLabel ?? "—"}`}
              />
            ) : null
          }
        >
          <p className="nl-sponsor-header-hint">Drei Angebote pro Saison.</p>
          {selectedTeamCommercialRating ? (
            <div className="nl-sponsor-rating-drivers" aria-label="Kommerz-Rating Treiber">
              <NlProgressBar
                label="Historie"
                value={selectedTeamCommercialRating.breakdown.recentPerformance}
                max={100}
                tone="accent"
                format={(value) => formatNlNumber(value, 0)}
                title="Jüngste sportliche Performance"
              />
              <NlProgressBar
                label="Kader"
                value={selectedTeamCommercialRating.breakdown.rosterPotential}
                max={100}
                tone="accent"
                format={(value) => formatNlNumber(value, 0)}
                title="Kader-Potential"
              />
              <NlProgressBar
                label="Prestige"
                value={selectedTeamCommercialRating.breakdown.prestige}
                max={100}
                tone="accent"
                format={(value) => formatNlNumber(value, 0)}
                title="Prestige/Medaillenhistorie"
              />
              <small className="nl-sponsor-rating-hint">Erwartung: {expectationRarityLabel ?? "—"}</small>

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
                    <StatChip label="Qualitäts-Rang" value={`#${Math.round(selectedTeamCommercialRating.inputs.qualityRank)}`} tone="neutral" />
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
            {formatSponsorChoiceMessage(sponsorChoiceMessage)}
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
                <NlEmptyState title="Noch keine Sponsor-Events diese Saison." />
              )}
            </NlCard>
          </>
        ) : selectedTeamSponsorOffers.length > 0 ? (
          <>
            {/* #76: Angebotsvergleich — Cash-Gesamt pro Angebot */}
            {offerCashSummaries.length > 1 ? (
              <NlCard className="nl-sponsor-compare-card" eyebrow="Angebotsvergleich" title="Cash-Gesamt pro Angebot">
                <div className="nl-sponsor-stackchart">
                  <div
                    className="nl-sponsor-stackchart-cols"
                    role="img"
                    aria-label="Cash-Gesamt je Angebot, gestapelt nach Basis, Gewinnstufen, Tabellenziel und Sonderziel"
                  >
                    {offerCashSummaries.map((entry) => {
                      const maxTotal = Math.max(...offerCashSummaries.map((item) => item.totalCash), 1e-9);
                      const fillPct = Math.max(0, Math.min(100, (entry.totalCash / maxTotal) * 100));
                      return (
                        <div className="nl-sponsor-stackcol" key={entry.offerId}>
                          <span className="nl-sponsor-stackcol-total nl-tnum">{formatMoney(entry.totalCash)}</span>
                          <div className="nl-sponsor-stackcol-track">
                            <div
                              className="nl-sponsor-stackcol-bar"
                              style={{ height: `${fillPct}%` }}
                              title={entry.segments
                                .map((seg) => `${seg.label}: ${formatMoney(seg.value)}`)
                                .join(" · ")}
                            >
                              {entry.segments.map((seg) => (
                                <span
                                  key={seg.kind}
                                  className="nl-sponsor-stackseg"
                                  style={{ flexGrow: seg.value, background: NL_TONE_VAR[seg.tone] }}
                                  title={`${seg.label}: ${formatMoney(seg.value)}`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="nl-sponsor-stackcol-label" title={entry.name}>
                            {entry.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <ul className="nl-sponsor-stack-legend">
                    {SPONSOR_STACK_SEGMENTS.map((seg) => (
                      <li key={seg.kind}>
                        <span
                          className="nl-sponsor-stack-legend-dot"
                          style={{ background: NL_TONE_VAR[seg.tone] }}
                          aria-hidden="true"
                        />
                        {getSponsorComponentKindLabel(seg.kind)}
                      </li>
                    ))}
                  </ul>
                </div>
              </NlCard>
            ) : null}
            {selectedTeamSponsorOffers[0]?.teamId ? (
              <SponsorBoardTargetsPanel gameState={gameState} teamId={selectedTeamSponsorOffers[0].teamId} />
            ) : null}
            <div className="nl-sponsor-offer-grid">
              {selectedTeamSponsorOffers.map((offer) => {
                return (
                  <SponsorOfferCardNewLook
                    key={offer.offerId}
                    offer={offer}
                    gameState={gameState}
                    chooseBusy={sponsorChoiceBusy === offer.offerId}
                    canManage={selectedTeamCanManage}
                    isBestCashOffer={bestCashOfferId != null && offer.offerId === bestCashOfferId}
                    onChoose={() => void chooseTeamSponsor(offer.offerId)}
                    formatCash={formatMoney}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <NlEmptyState title="Noch keine Sponsor-Angebote für diese Saison geladen." />
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
                { id: "tier", label: "Rarität" },
                { id: "team", label: "Team" },
              ]}
            />
          }
        >
          <div className="nl-sponsor-league-grid" role="list" aria-label="Sponsoren aller Teams">
            {sortedLeagueSponsorRows.map((row) => {
              const isCurrent = row.teamName === selectedTeamName;
              const classes = [
                "nl-sponsor-league-item",
                isCurrent ? "is-current" : "",
                row.isGolden ? "is-golden" : "",
                row.sponsorName ? "" : "is-empty",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div key={row.teamId} role="listitem" className={classes}>
                  {row.isGolden ? (
                    <span className="nl-sponsor-league-golden-badge" title="Golden Card — seltener Premium-Sponsor">
                      ✦ Golden Card
                    </span>
                  ) : null}
                  <span className="nl-sponsor-league-crest">
                    {row.sponsorName && row.archetype ? (
                      <SponsorCrest name={row.sponsorName} archetype={row.archetype} />
                    ) : (
                      <span className="nl-sponsor-league-crest-empty" aria-hidden="true">
                        ✕
                      </span>
                    )}
                  </span>
                  <div className="nl-sponsor-league-body">
                    <div className="nl-sponsor-league-teamline">
                      <span className="nl-sponsor-league-code">{row.shortCode}</span>
                      <span className="nl-sponsor-league-teamname" title={row.teamName}>
                        {row.teamName}
                      </span>
                      {isCurrent ? <span className="nl-sponsor-league-you">Dein Team</span> : null}
                    </div>
                    {row.sponsorName ? (
                      <>
                        <span className="nl-sponsor-league-sponsor" title={row.sponsorName}>
                          {row.sponsorName}
                        </span>
                        <div className="nl-sponsor-league-meta">
                          {row.curveShape ? (
                            <span className={`nl-sponsor-league-chip is-${row.archetype ?? "neutral"}`}>
                              {SPONSOR_CURVE_SHAPES[row.curveShape].labelDe}
                            </span>
                          ) : null}
                          {row.rarity ? (
                            <RarityPill rarity={row.rarity} className="nl-sponsor-league-rarity" />
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <span className="nl-sponsor-league-sponsor is-empty">Kein Sponsor</span>
                    )}
                  </div>
                  <span className="nl-sponsor-league-cash nl-tnum">
                    {row.totalCash != null ? formatMoney(row.totalCash) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </NlCard>
      </section>
    </div>
  );
}
