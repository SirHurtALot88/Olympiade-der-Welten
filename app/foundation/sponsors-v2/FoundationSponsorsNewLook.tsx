"use client";

import { useMemo, useState } from "react";

import {
  NlCard,
  NlDeltaChip,
  NlEmptyState,
  NlGauge,
  NlProgressBar,
  NlTable,
  NL_TONE_VAR,
  StatChip,
  StatChipRow,
  formatNlNumber,
  useCountUp,
  type NlTableColumn,
  type NlTone,
} from "@/components/foundation/new-look";
import {
  RarityPill,
  SponsorCrest,
  SponsorOfferCardNewLook,
} from "@/components/foundation/sponsor/SponsorOfferCardNewLook";
import {
  buildSponsorOfferPresentation,
  computeSponsorCostCoverage,
  getSponsorComponentKindLabel,
  getSponsorCoverageTone,
  sortLeagueSponsorRows,
  type LeagueSponsorSort,
} from "@/lib/sponsor/sponsor-offer-presenter";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import {
  getTeamDisplaySalaryTotal,
  getTeamFacilityUpkeepTotal,
} from "@/lib/sponsor/sponsor-team-salary-display";
import { resolveSponsorSystemVersion } from "@/lib/sponsor/sponsor-v3-offer-service";
import { sponsorV4AxisLabel, type SponsorV4AxisKey } from "@/lib/sponsor/sponsor-v4-axes";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { computeApronLines, type ApronLines } from "@/lib/season/apron-service";
import { SponsorRankLadder } from "@/components/foundation/sponsor/SponsorRankLadder";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { getTeamObjectives } from "@/lib/board/team-season-objectives-service";
import {
  buildAnalyticsBoardGoalsLive,
  buildAnalyticsSponsorAxisLive,
} from "@/lib/facilities/analytics-live-progress";
import { formatGameFlowBlocker } from "@/lib/foundation/game-flow-blocker-labels";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";
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

/**
 * W3-Fix (Audit-Befund 2, Sponsoren): `contract.variantKey` ist ein interner
 * Katalog-Schlüssel (`lib/sponsor/sponsor-brand-variants.ts`) und stand roh
 * mit Unterstrichen im UI ("identity special" aus "identity_special"). Die
 * fünf bekannten Varianten bekommen ihren echten deutschen Namen (identisch
 * zum `flavorSuffix`-Kurztitel im Katalog); ein unbekannter künftiger
 * Schlüssel fällt auf Titelcase statt auf einen rohen Slug zurück — nie
 * wieder Unterstriche im UI.
 */
const SPONSOR_VARIANT_LABELS: Record<string, string> = {
  security_standard: "Sicherheits-Paket",
  performance_rank: "Leistungs-Paket",
  identity_special: "Identitäts-Paket",
  premium_elite: "Premium-Elite",
  regional_fan: "Fan-Paket",
};

function formatSponsorVariantLabel(variantKey: string | null | undefined): string | null {
  if (!variantKey) return null;
  return (
    SPONSOR_VARIANT_LABELS[variantKey] ??
    variantKey
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
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
  // ANALYTICS ROOM AB STUFE 4: Zwischenstand je Ziel, ab Stufe 5 zusaetzlich der Abstand zum
  // Zielwert. Ohne das Gebaeude ist die Liste leer und die Zeilen sehen aus wie bisher — Label,
  // Zielwert, Status. Reine Anzeige, gerechnet aus denselben Records, die das Board-Settlement liest.
  const liveById = useMemo(() => {
    return new Map(buildAnalyticsBoardGoalsLive(gameState, teamId).map((entry) => [entry.objectiveId, entry] as const));
  }, [gameState, teamId]);
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
          const live = liveById.get(objective.objectiveId) ?? null;
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
              {live?.stand != null ? (
                <span
                  className="nl-sponsor-boardtarget-live nl-tnum"
                  style={{ flex: "0 0 auto", opacity: 0.75 }}
                  title={live.text}
                  data-testid="nl-boardtarget-live"
                >
                  {`Stand ${live.stand}`}
                  {live.abstand != null
                    ? ` · ${objective.status === "completed" ? "Puffer" : "Abstand"} ${live.abstand}`
                    : ""}
                </span>
              ) : null}
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
 * Laufzeit (`termSeasons`): weiterhin kein Selector — der Spieler waehlt die Laufzeit nicht separat
 * aus. Seit Umsetzungsplan D ist sie aber auch keine feste 1-Saison-Konstante mehr: sie steht am
 * gewaehlten ANGEBOT (je Slot gewuerfelt, `rollSponsorOfferSlate` in sponsor-tier-pool.ts) und der
 * Apply-Pfad (`chooseTeamSponsor(offerId)` → POST /api/sponsor/choose → `chooseSponsorOffer`)
 * uebernimmt sie 1:1 vom Angebot. Der Betrag bleibt an die Konjunktur der Saison gekoppelt: der Sockel
 * friert beim Startrang zur Unterschrift ein, der Wertungsanteil skaliert jede Saison neu mit dem
 * dann aktuellen Salary Factor (`rerollSponsorV3TermsForNewSeason`, sponsor-v3-offer-service.ts).
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
  // Siehe SponsorOfferCardNewLook: die Modellkurve gewinnt, die Legacy-Kurvenform bleibt nur fuer
  // Vertraege aus Spielstaenden von vor der Umstellung.
  const shape = contract.curveShape ?? mapArchetypeToCurveShape(contract.archetype);
  const shapeLabel = contract.sponsorV3?.cardName ?? SPONSOR_CURVE_SHAPES[shape].labelDe;
  // Woran sich diese Karte von den anderen unterscheidet. Seit V4 ist das die ZIELACHSE — der
  // Tilt ist bei allen neuen Karten 0, "EV-neutral" stuende also auf jeder Karte und saegte
  // genau nichts aus. Altvertraege tragen weiterhin ihren Tilt.
  const axisKey = contract.sponsorV3?.axis?.key ?? null;
  // W3-Fix (Audit-Befund 2, Sponsoren): "EV-neutral" war Modell-Jargon
  // (Expected Value) ohne Übersetzung im UI. Klartext wie im freigegebenen
  // Mockup (prize.html): "ausgewogen" für Tilt 0, "Hebel" blieb bereits
  // deutsch und bleibt unverändert.
  const familyLabel = axisKey
    ? `Zielachse · ${sponsorV4AxisLabel(axisKey as SponsorV4AxisKey)}`
    : contract.sponsorV3
      ? contract.sponsorV3.tilt === 0
        ? "ausgewogenes Bonus/Malus-Profil"
        : `${contract.sponsorV3.tilt > 0 ? "+" : ""}${Math.round(contract.sponsorV3.tilt * 100)} % Hebel`
      : SPONSOR_CURVE_FAMILIES[getSponsorCurveFamily(shape)].labelDe;
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

  /**
   * DER LIVE-FORTSCHRITT AUF DER ZIELACHSE — freigeschaltet vom Analytics Room.
   *
   * Bis hierher stand auf dieser Karte nur, WAS die Achse verlangt (`specialPresentation.detail`,
   * aus den eingefrorenen Konditionen). WIE WEIT das Team ist, erfuhr es erst in der
   * Saisonabrechnung — obwohl die Rechnung dafuer jederzeit lief. Ohne Analytics Room ist der Wert
   * hier null und die Karte sieht aus wie vorher.
   */
  const axisLive = useMemo(
    () => buildAnalyticsSponsorAxisLive(gameState, contract.teamId),
    [gameState, contract.teamId],
  );

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
            {contract.variantKey ? `${formatSponsorVariantLabel(contract.variantKey)} · ` : ""}
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
          {axisLive ? (
            <small
              className={`nl-sponsor-hero-tracker-live${axisLive.belastbar ? "" : " is-unclear"}`}
              data-testid="nl-sponsor-axis-live"
              style={{ opacity: axisLive.belastbar ? 1 : 0.75 }}
            >
              {`Analytics Room L${axisLive.analyticsLevel} · ${axisLive.text}`}
            </small>
          ) : null}
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


export default function FoundationSponsorsNewLook({
  gameState,
  selectedTeamName,
  selectedTeamCommercialRating,
  selectedTeamSponsorContract,
  selectedTeamSponsorOffers,
  sponsorChoiceMessage,
  sponsorChoiceBusy,
  selectedTeamCanManage,
  formatMoney: formatMoneyProp,
  chooseTeamSponsor,
}: FoundationSponsorsPanelProps) {
  // "Neuer Look" Hooks laufen unconditionally vor jedem Return (dieser
  // Component hat kein weiteres Flag-Gate mehr — er wird nur gerendert,
  // wenn `useNewLook` im Parent bereits aktiv ist).
  //
  // W3-Fix (Audit-Befund 3, Sponsoren): der übergebene `formatMoney` (aus
  // `foundation-format-render-helpers.ts`) formatiert dieselben Zahlen wie
  // `formatTransfermarktCurrency`, hängt aber nirgends eine Einheit an —
  // "CASH/SAISON 63,5", "Ø-ANGEBOTSWERT 88,1" und die komplette Liga-Spalte
  // standen ohne "Mio" da. Diese Seite nutzt konsequent den App-weiten
  // Geld-Helfer statt der ungelabelten Variante; `formatMoneyProp` bleibt
  // ungenutzt (Prop-Vertrag unverändert), damit kein Aufrufer angefasst
  // werden muss.
  const formatSponsorMoney = formatTransfermarktCurrency;
  void formatMoneyProp;
  const [ratingDetailsOpen, setRatingDetailsOpen] = useState(false);
  const [leagueSponsorSort, setLeagueSponsorSort] = useState<LeagueSponsorSort>("cash");

  // Voraussichtliche Sponsor-Auszahlung je Team BEIM AKTUELLEN RANG (Basis +
  // freigeschaltete Rang-Meilensteine + erfüllte Sonderziele) — aus der
  // Settlement-Vorschau, also derselben rang-abhängigen Rechnung wie das echte
  // Season-End-Settlement. Bewusst NICHT die naive Summe aller Vertrags-
  // Komponenten (= maximal möglicher Vertragswert), die unabhängig vom
  // erreichten Rang war und damit "was verdient das Team wirklich" nicht zeigte.
  const sponsorProjectedByTeamId = useMemo(() => {
    const map = new Map<string, number>();
    try {
      for (const row of previewSponsorSettlement(gameState).rows) {
        // Saldiert, nicht geklammert: die Vorschuss-Verrechnung ist negativ und die Achse kann
        // es sein. Wer nur die positiven Zeilen zaehlt, zeigt eine Projektion, die es nicht gibt.
        map.set(row.teamId, (map.get(row.teamId) ?? 0) + row.cashDelta);
      }
    } catch {
      // Vorschau ist optional — ohne gültige Verträge bleibt die Projektion leer.
    }
    return map;
  }, [gameState]);

  // Aktueller Liga-Rang je Team (echte Standings) für die Auszahlungs-Erklärung.
  const teamRankByTeamId = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const row of buildTeamSeasonOverviewRows({ gameState })) {
      map.set(row.teamId, row.rank ?? null);
    }
    return map;
  }, [gameState]);

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

  // #78: Liga-Sponsorenübersicht — wer hat wen, über alle Teams
  // (`gameState.teams`), sortierbar. Liest den unterschriebenen Vertrag über
  // `getTeamSponsorContract`, damit nur der aktuell für DIESE Saison gültige
  // Sponsor angezeigt wird (der Helfer filtert abgelaufene/Vorsaison-Verträge
  // aus `sponsorContractsByTeamId` heraus — sonst würde ein Team fälschlich mit
  // seinem alten Sponsor der Vorsaison gelistet).
  // Detail-Fenster fuer den Sponsor EINES Teams (auch fremde Teams). Bisher war die Liga-Uebersicht
  // reine Anzeige: man sah, WER welchen Sponsor hat, aber nicht, woraus dessen Wert besteht — das gab
  // es nur fuer die eigenen Angebote.
  const [leagueDetailTeamId, setLeagueDetailTeamId] = useState<string | null>(null);

  // Apron — die zu Saisonbeginn eingefrorenen Gehaltslinien (siehe lib/season/apron-service.ts).
  // Bevorzugt der EINGEFRORENE Snapshot der laufenden Saison; nur Bestandsspielstände ohne Snapshot
  // (vor diesem Feature angelegt) fallen auf eine frische Berechnung zurück — deutlich markiert, damit
  // niemand eine "eingefrorene" Linie für bar nimmt, die es in diesem Save noch gar nicht gibt.
  const apronLines: ApronLines & { frozen: boolean } = useMemo(() => {
    const frozen = gameState.seasonState.apronLinesSnapshot;
    if (frozen && frozen.seasonId === gameState.season.id) {
      return { ...frozen, frozen: true };
    }
    return { ...computeApronLines(gameState), frozen: false };
  }, [gameState]);

  const leagueSponsorRows = useMemo(() => {
    return gameState.teams.map((team) => {
      const contract = getTeamSponsorContract(gameState, team.teamId);
      // Maximal möglicher Vertragswert (alle Komponenten) — nur noch als
      // Kontext-Tooltip, nicht mehr als Hauptzahl.
      const maxCash = contract
        ? contract.components.reduce(
            (sum, component) => sum + (typeof component.rewardCash === "number" ? component.rewardCash : 0),
            0,
          )
        : null;
      // Hauptzahl: voraussichtliche Auszahlung beim aktuellen Rang.
      const projectedCash = contract ? (sponsorProjectedByTeamId.get(team.teamId) ?? 0) : null;
      // EINNAHME UND KOSTEN NEBENEINANDER. Bis hierher beantwortete die Uebersicht nur "wer hat
      // welchen Sponsor" — nicht die Frage, die dahinter steht: traegt der Sponsor die Mannschaft
      // ueberhaupt? Der Betrag allein kann das nicht beantworten, solange die Kader unterschiedlich
      // teuer sind: 90 sind fuer einen Kader mit 84 Gehalt etwas anderes als fuer einen mit 48.
      const salaryTotal = getTeamDisplaySalaryTotal(gameState, team.teamId);
      const upkeepTotal = getTeamFacilityUpkeepTotal(gameState, team.teamId);
      const fixedCostTotal = Math.round((salaryTotal + upkeepTotal) * 10) / 10;
      const costCoverage = computeSponsorCostCoverage(projectedCash, fixedCostTotal);
      // Apron: über welcher der beiden eingefrorenen Linien liegt das Gehalt dieses Teams?
      const apronStatus: "unter" | "ueber_linie_1" | "ueber_linie_2" =
        salaryTotal > apronLines.line2 ? "ueber_linie_2" : salaryTotal > apronLines.line1 ? "ueber_linie_1" : "unter";
      return {
        salaryTotal,
        upkeepTotal,
        fixedCostTotal,
        costCoverage,
        apronStatus,
        teamId: team.teamId,
        teamName: team.name,
        shortCode: team.shortCode,
        sponsorName: contract?.name ?? null,
        archetype: contract?.archetype ?? null,
        // Rarität/Kurvenform robust auflösen (Back-Compat für alte Verträge).
        rarity: contract ? (contract.rarity ?? "gewöhnlich") : null,
        curveShape: contract ? (contract.curveShape ?? mapArchetypeToCurveShape(contract.archetype)) : null,
        projectedCash,
        maxCash,
        rank: teamRankByTeamId.get(team.teamId) ?? null,
        // Golden Card = seltener Premium-Elite-Sponsor (Underdog-Glück). Der
        // Vertrag erbt `variantKey` vom Angebot (sponsor-offer-service), daher
        // ist das der verlaessliche Golden-Indikator auf Vertragsebene.
        isGolden: contract?.variantKey === "premium_elite",
      };
    });
  }, [gameState, apronLines]);
  // Komponenten-Aufschluesselung des geoeffneten Teams — dieselbe Quelle wie das echte
  // Season-End-Settlement, damit das Fenster nicht eine andere Zahl zeigt als die Uebersicht.
  const leagueDetail = useMemo(() => {
    if (!leagueDetailTeamId) return null;
    const row = leagueSponsorRows.find((entry) => entry.teamId === leagueDetailTeamId) ?? null;
    if (!row) return null;
    const contract = getTeamSponsorContract(gameState, leagueDetailTeamId);
    let settlementRows: { kind: string; label: string; cashDelta: number; reason: string }[] = [];
    try {
      settlementRows = previewSponsorSettlement(gameState)
        .rows.filter((entry) => entry.teamId === leagueDetailTeamId)
        .map((entry) => ({ kind: entry.kind, label: entry.label, cashDelta: entry.cashDelta, reason: entry.reason }));
    } catch {
      settlementRows = [];
    }
    // Aufbau des Fensters spiegelt die Rechnung: Basis -> Gewinnstufen (grafisch) -> alles Weitere
    // (Verbesserung, Sonderziele) -> Summe. Die Rang-Zeile wird durch die Leiter ersetzt, statt sie
    // zusaetzlich als Textzeile zu wiederholen.
    const baseRow = settlementRows.find((entry) => entry.kind === "base") ?? null;
    const otherRows = settlementRows.filter((entry) => entry.kind !== "base" && entry.kind !== "rank");
    const rankLadder = contract?.lockedRankPayoutLadder ?? null;
    const baseCash = contract?.components.find((entry) => entry.kind === "base")?.rewardCash ?? 0;
    return { row, contract, baseRow, otherRows, rankLadder, baseCash };
  }, [leagueDetailTeamId, leagueSponsorRows, gameState]);

  const sortedLeagueSponsorRows = useMemo(
    () => sortLeagueSponsorRows(leagueSponsorRows, leagueSponsorSort),
    [leagueSponsorRows, leagueSponsorSort],
  );

  // W3-Fix (Audit-Befund 1, Sponsoren): volle Team-/Sponsornamen statt der
  // beidseitig gestutzten Karten ("Zero…" / "Jaguar La…") — als sortierbare
  // `NlTable` (geteiltes Primitiv, siehe velo-ui-Katalog), Sortier-Modus
  // bleibt exakt `sortLeagueSponsorRows`/`leagueSponsorSort`, jetzt über die
  // Spaltenköpfe statt separater Pillen bedienbar.
  type LeagueSponsorRow = (typeof sortedLeagueSponsorRows)[number];
  const leagueTableColumns: NlTableColumn<LeagueSponsorRow>[] = [
    {
      key: "team",
      label: "Team",
      sortable: true,
      className: "nl-sponsor-league-col-team",
    },
    {
      key: "sponsor",
      label: "Sponsor",
      sortable: true,
      className: "nl-sponsor-league-col-sponsor",
    },
    {
      key: "cash",
      label: "Cash/Saison",
      align: "right",
      sortable: true,
      tooltip: "Voraussichtliche Auszahlung beim aktuellen Rang",
    },
    {
      key: "coverage",
      label: "Fixkosten-Deckung",
      align: "right",
      tooltip: "Anteil der Gehälter + Unterhalt, den der Sponsor deckt. Unter 100 % zahlt das Team drauf.",
    },
    {
      key: "tier",
      label: "Rarität",
      sortable: true,
      className: "nl-sponsor-league-col-tier",
    },
  ];

  function renderLeagueTableCell(row: LeagueSponsorRow, column: NlTableColumn<LeagueSponsorRow>) {
    const isCurrent = row.teamName === selectedTeamName;
    switch (column.key) {
      case "team":
        return (
          <span className="nl-sponsor-league-teamcell">
            <span className="nl-sponsor-league-code">{row.shortCode}</span>
            <span className="nl-sponsor-league-teamname">{row.teamName}</span>
            {isCurrent ? <span className="nl-sponsor-league-you">Dein Team</span> : null}
            {row.isGolden ? (
              <span className="nl-sponsor-league-golden-badge" title="Golden Card — seltener Premium-Sponsor">
                ✦ Golden
              </span>
            ) : null}
          </span>
        );
      case "sponsor":
        return row.sponsorName ? (
          <span className="nl-sponsor-league-sponsorcell">
            <span className="nl-sponsor-league-crest">
              {row.archetype ? <SponsorCrest name={row.sponsorName} archetype={row.archetype} /> : null}
            </span>
            <span className="nl-sponsor-league-sponsorname">{row.sponsorName}</span>
            {row.curveShape ? (
              <span className={`nl-sponsor-league-chip is-${row.archetype ?? "neutral"}`}>
                {SPONSOR_CURVE_SHAPES[row.curveShape].labelDe}
              </span>
            ) : null}
            {row.rarity ? <RarityPill rarity={row.rarity} className="nl-sponsor-league-rarity" /> : null}
          </span>
        ) : (
          <span className="nl-sponsor-league-sponsorcell is-empty">— noch keiner —</span>
        );
      case "cash":
        return (
          <span
            className="nl-sponsor-league-cash nl-tnum"
            title={
              row.projectedCash != null
                ? `Voraussichtliche Auszahlung beim aktuellen Rang${
                    row.rank != null ? ` #${row.rank}` : ""
                  }${row.maxCash != null ? ` · max. Vertragswert ${formatSponsorMoney(row.maxCash)}` : ""}`
                : "Kein Sponsor unter Vertrag"
            }
          >
            {row.projectedCash != null ? formatSponsorMoney(row.projectedCash) : "—"}
          </span>
        );
      case "coverage":
        // Deckungsgrad: traegt der Sponsor die laufenden Kosten? Unter 100 % zahlt das Team drauf.
        // Die Farbe ist NICHT der einzige Traeger — der Prozentwert steht daneben.
        return row.costCoverage != null ? (
          <span
            className={`nl-sponsor-league-coverage nl-tnum is-${getSponsorCoverageTone(row.costCoverage)}`}
            title={`Sponsor deckt ${Math.round(row.costCoverage * 100)} % der Fixkosten · Gehälter ${formatSponsorMoney(
              row.salaryTotal,
            )}${row.upkeepTotal > 0 ? ` + Unterhalt ${formatSponsorMoney(row.upkeepTotal)}` : ""} = ${formatSponsorMoney(
              row.fixedCostTotal,
            )}`}
          >
            {Math.round(row.costCoverage * 100)} %
            {/* Apron: Text-Zusatz, Farbe ist NUR Verstärkung — wer über einer Linie liegt, gibt am
                Saisonende einen Teil des Überschusses ab. */}
            {row.apronStatus !== "unter" ? (
              <span
                className={`nl-sponsor-league-apron is-${row.apronStatus === "ueber_linie_2" ? "linie2" : "linie1"}`}
                title={`Gehalt ${formatSponsorMoney(row.salaryTotal)} liegt über der ${
                  row.apronStatus === "ueber_linie_2" ? "2." : "1."
                } Apron-Linie (${formatSponsorMoney(
                  row.apronStatus === "ueber_linie_2" ? apronLines.line2 : apronLines.line1,
                )}) — Abgabe am Saisonende möglich.`}
              >
                {" "}
                über {row.apronStatus === "ueber_linie_2" ? "2." : "1."} Linie
              </span>
            ) : null}
          </span>
        ) : (
          "—"
        );
      case "tier":
        return row.rarity ? <RarityPill rarity={row.rarity} /> : <span className="nl-tnum">—</span>;
      default:
        return null;
    }
  }

  const LEAGUE_SPONSOR_SORT_LABELS: Record<LeagueSponsorSort, string> = {
    cash: "Cash/Saison",
    sponsor: "Sponsor",
    tier: "Rarität",
    team: "Team",
  };
  // `sortLeagueSponsorRows` hat je Modus eine feste Richtung (kein Umschalten
  // pro Klick) — hier nur für den Pfeil in der Spaltenkopf-Anzeige gespiegelt.
  const LEAGUE_SPONSOR_SORT_DIRECTION: Record<LeagueSponsorSort, "asc" | "desc"> = {
    cash: "desc",
    sponsor: "asc",
    tier: "desc",
    team: "asc",
  };

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
    // Voraussichtliche Auszahlung beim aktuellen Rang (nicht der maximale
    // Vertragswert) — konsistent mit der Liga-Sponsorenübersicht.
    return sponsorProjectedByTeamId.get(selectedTeamSponsorContract.teamId) ?? 0;
  }, [selectedTeamSponsorContract, sponsorProjectedByTeamId]);
  // W3-Fix (Audit-Befund 4, Sponsoren): `selectedTeamSponsorOffers` wird
  // unabhängig vom Vertragsstatus geladen (lib/sponsor/sponsor-offer-read.ts)
  // — bei laufendem Vertrag rendert die Seite die Angebotskarten gar nicht
  // (Zweig weiter unten), trotzdem zeigte die KPI-Zeile weiterhin
  // "Ø-Angebotswert · N Angebote" für Angebote, die nirgends zu sehen waren.
  // Der KPI-Chip zeigt den Wert nur noch, wenn wirklich wählbare Angebote da
  // sind — kein Vertrag aktiv, und mindestens ein Angebot vorhanden.
  const avgOfferCashValue = useMemo(() => {
    if (selectedTeamSponsorContract) return null;
    if (offerCashSummaries.length === 0) return null;
    return offerCashSummaries.reduce((sum, entry) => sum + entry.totalCash, 0) / offerCashSummaries.length;
  }, [offerCashSummaries, selectedTeamSponsorContract]);

  // Aus dem SPIELSTAND gelesen, nicht aus der Umgebung: ein V1-Save bleibt V1, auch wenn der
  // Server gerade das neue Modell fuer neue Spiele vergibt.
  const sponsorSystemVersion = resolveSponsorSystemVersion(gameState);

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
                ? formatSponsorMoney(animatedKpiContractCash ?? activeContractCashTotal)
                : "—"
            }
            sub={activeContractCashTotal != null ? "beim aktuellen Rang" : "kein Vertrag"}
            tone={activeContractCashTotal != null ? "good" : "neutral"}
          />
          <StatChip
            label="Ø-Angebotswert"
            value={avgOfferCashValue != null ? formatSponsorMoney(animatedKpiAvgOfferCash ?? avgOfferCashValue) : "—"}
            sub={
              avgOfferCashValue != null
                ? `${offerCashSummaries.length} Angebote`
                : selectedTeamSponsorContract
                  ? "Vertrag aktiv · neue Angebote zum Saisonende"
                  : undefined
            }
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
          <p className="nl-sponsor-header-hint">
            Drei Angebote pro Saison.{" "}
            {/* WELCHES REGELWERK GILT — ausgeschrieben statt an Modulnamen ablesbar. Vorher musste
                man an der Angebotskarte erkennen, ob ein Spielstand nach altem oder neuem Recht
                laeuft (z. B. an einer "Ueberperformance"-Zeile). Das steht jetzt hier, gelesen aus
                dem Spielstand selbst. */}
            <span
              className="nl-sponsor-system-badge"
              data-testid="sponsor-system-badge"
              data-sponsor-system={sponsorSystemVersion}
              title={
                sponsorSystemVersion === 2
                  ? "Dieser Spielstand rechnet nach dem neuen Sponsormodell: Kurvenform × Klausel (Bonus und Malus) × Sonderziel nach Schwierigkeit."
                  : "Dieser Spielstand wurde vor der Umstellung angelegt und rechnet unveraendert nach dem alten Sponsormodell weiter."
              }
            >
              {sponsorSystemVersion === 2 ? "Sponsorsystem V2 (neu)" : "Sponsorsystem V1 (alt)"}
            </span>
          </p>
          {selectedTeamCommercialRating ? (
            <div className="nl-sponsor-rating-drivers" aria-label="Kommerz-Rating Treiber">
              <NlProgressBar
                label="Historie"
                value={selectedTeamCommercialRating.breakdown.recentPerformance}
                max={100}
                tone="accent"
                format={(value) => `${formatNlNumber(value, 0)} / 100`}
                title="Jüngste sportliche Performance"
              />
              <NlProgressBar
                label="Kader"
                value={selectedTeamCommercialRating.breakdown.rosterPotential}
                max={100}
                tone="accent"
                format={(value) => `${formatNlNumber(value, 0)} / 100`}
                title="Kader-Potential"
              />
              <NlProgressBar
                label="Prestige"
                value={selectedTeamCommercialRating.breakdown.prestige}
                max={100}
                tone="accent"
                format={(value) => `${formatNlNumber(value, 0)} / 100`}
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
            <ActiveContractHero contract={selectedTeamSponsorContract} gameState={gameState} formatCash={formatSponsorMoney} />
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
                        format={(value) => formatSignedCash(formatSponsorMoney, value)}
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
                          <span className="nl-sponsor-stackcol-total nl-tnum">{formatSponsorMoney(entry.totalCash)}</span>
                          <div className="nl-sponsor-stackcol-track">
                            <div
                              className="nl-sponsor-stackcol-bar"
                              style={{ height: `${fillPct}%` }}
                              title={entry.segments
                                .map((seg) => `${seg.label}: ${formatSponsorMoney(seg.value)}`)
                                .join(" · ")}
                            >
                              {entry.segments.map((seg) => (
                                <span
                                  key={seg.kind}
                                  className="nl-sponsor-stackseg"
                                  style={{ flexGrow: seg.value, background: NL_TONE_VAR[seg.tone] }}
                                  title={`${seg.label}: ${formatSponsorMoney(seg.value)}`}
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
                    formatCash={formatSponsorMoney}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <NlEmptyState title="Noch keine Sponsor-Angebote für diese Saison geladen." />
        )}

        {/* #78 + W3-Fix (Audit-Befund 1, Sponsoren): war ein 32-Karten-Raster mit
            beidseitig gestutzten Namen ("Zero…" / "Jaguar La…") — jetzt eine
            sortierbare Tabelle mit vollen Team- und Sponsornamen, wie im
            freigegebenen Mockup (prize.html). Sortierung wandert von den
            separaten NlSubTabs-Pillen auf klickbare Spaltenköpfe (dieselbe
            Quelle, `sortLeagueSponsorRows`/`leagueSponsorSort`). */}
        <NlCard
          className="nl-sponsor-league-card"
          eyebrow="Liga"
          title={`Sponsorenübersicht · ${sortedLeagueSponsorRows.length} Teams`}
        >
          <p className="nl-sponsor-league-table-hint">
            Sortiert nach {LEAGUE_SPONSOR_SORT_LABELS[leagueSponsorSort]} — Spaltenkopf klicken zum
            Umsortieren. Deine Zeile ist markiert.
          </p>
          <NlTable
            className="nl-sponsor-league-table"
            aria-label="Sponsoren aller Teams"
            data-testid="sponsor-league-table"
            columns={leagueTableColumns}
            rows={sortedLeagueSponsorRows}
            rowKey={(row) => row.teamId}
            rowClassName={(row) =>
              [row.teamName === selectedTeamName ? "is-current" : "", row.isGolden ? "is-golden" : ""]
                .filter(Boolean)
                .join(" ") || undefined
            }
            renderCell={renderLeagueTableCell}
            sortState={{ key: leagueSponsorSort, direction: LEAGUE_SPONSOR_SORT_DIRECTION[leagueSponsorSort] }}
            onSort={(key) => setLeagueSponsorSort(key as LeagueSponsorSort)}
            onRowClick={(row) => {
              // Jede Zeile mit Sponsor oeffnet dessen Details — auch fremder Teams.
              if (row.sponsorName) {
                setLeagueDetailTeamId(row.teamId);
              }
            }}
          />
          {/* Apron-Linien dieser Saison — zu Saisonbeginn eingefroren und ab da unveränderlich,
              genau deshalb hier sichtbar: eine Grenze, gegen die man kalkuliert, muss man kennen. */}
          <p className="nl-sponsor-league-apron-lines">
            Apron-Linien{apronLines.frozen ? " (eingefroren)" : " (noch nicht eingefroren — Vorschau)"}: Median-Gehalt{" "}
            {formatSponsorMoney(apronLines.medianSalary)} · 1. Linie {formatSponsorMoney(apronLines.line1)} · 2. Linie{" "}
            {formatSponsorMoney(apronLines.line2)}
            {apronLines.usedReferenceSalary ? " · Referenzgehalt (Liga noch ohne echte Gehälter)" : ""}
          </p>
        </NlCard>

        {/* Sponsor-Details eines beliebigen Teams — dieselbe Aufschluesselung, die es bisher nur fuer
            die eigenen Angebote gab. Quelle ist die Settlement-Vorschau, damit die Summe hier nicht
            von der Zahl in der Uebersicht abweichen kann. */}
        {leagueDetail ? (
          <div
            className="nl-sponsor-league-detail-backdrop"
            role="presentation"
            onClick={() => setLeagueDetailTeamId(null)}
          >
            <div
              className="nl-sponsor-league-detail"
              role="dialog"
              aria-modal="true"
              aria-label={`Sponsor-Details ${leagueDetail.row.teamName}`}
              data-testid="sponsor-league-detail"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="nl-sponsor-league-detail-head">
                <div>
                  <div className="nl-sponsor-league-detail-team">
                    <span className="nl-sponsor-league-code">{leagueDetail.row.shortCode}</span>
                    <span>{leagueDetail.row.teamName}</span>
                    {leagueDetail.row.rank != null ? (
                      <span className="nl-sponsor-league-detail-rank">Platz {leagueDetail.row.rank}</span>
                    ) : null}
                  </div>
                  <div className="nl-sponsor-league-detail-sponsor">{leagueDetail.row.sponsorName}</div>
                </div>
                <button
                  type="button"
                  className="nl-sponsor-league-detail-close"
                  onClick={() => setLeagueDetailTeamId(null)}
                  aria-label="Schliessen"
                >
                  ✕
                </button>
              </div>

              <div className="nl-sponsor-league-detail-meta">
                {leagueDetail.row.curveShape ? (
                  <span className={`nl-sponsor-league-chip is-${leagueDetail.row.archetype ?? "neutral"}`}>
                    {SPONSOR_CURVE_SHAPES[leagueDetail.row.curveShape].labelDe}
                  </span>
                ) : null}
                {leagueDetail.row.rarity ? <RarityPill rarity={leagueDetail.row.rarity} /> : null}
                {leagueDetail.row.isGolden ? (
                  <span className="nl-sponsor-league-golden-badge">✦ Golden Card</span>
                ) : null}
              </div>

              {leagueDetail.baseRow || leagueDetail.rankLadder || leagueDetail.otherRows.length > 0 ? (
                <>
                  {leagueDetail.baseRow ? (
                    <ul className="nl-sponsor-league-detail-list">
                      <li>
                        <span className="nl-sponsor-league-detail-label" title={leagueDetail.baseRow.reason}>
                          {leagueDetail.baseRow.label}
                        </span>
                        <span className="nl-tnum">{formatSponsorMoney(leagueDetail.baseRow.cashDelta)}</span>
                      </li>
                    </ul>
                  ) : null}

                  {/* Gewinnstufen grafisch statt als gequetschte Textzeile — dieselbe Leiter wie auf
                      der eigenen Angebotskarte, inkl. Hervorhebung der aktuell erreichten Stufe. */}
                  {leagueDetail.rankLadder && leagueDetail.rankLadder.length > 0 ? (
                    <div className="nl-sponsor-league-detail-section">
                      <div className="nl-sponsor-league-detail-section-head">
                        <span>Gewinnstufen</span>
                        {leagueDetail.row.rank != null ? (
                          <small className="nl-sponsor-rank-current-hint">Aktuell #{leagueDetail.row.rank}</small>
                        ) : null}
                      </div>
                      <SponsorRankLadder
                        baseCash={leagueDetail.baseCash}
                        rankLadder={leagueDetail.rankLadder}
                        currentTeamRank={leagueDetail.row.rank}
                        formatCash={formatSponsorMoney}
                      />
                    </div>
                  ) : null}

                  {/* Sonderziele/Verbesserung darunter: damit sichtbar wird, woraus sich die Summe
                      unten zusammensetzt. */}
                  {leagueDetail.otherRows.length > 0 ? (
                    <div className="nl-sponsor-league-detail-section">
                      <div className="nl-sponsor-league-detail-section-head">
                        <span>Sonderziele</span>
                      </div>
                      <ul className="nl-sponsor-league-detail-list">
                        {leagueDetail.otherRows.map((component, index) => (
                          <li key={`${component.label}-${index}`}>
                            <span className="nl-sponsor-league-detail-label" title={component.reason}>
                              {component.label}
                            </span>
                            <span className="nl-tnum">{formatSponsorMoney(component.cashDelta)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="nl-sponsor-league-detail-empty">
                  Für diesen Vertrag liegt keine Auszahlungs-Aufschlüsselung vor.
                </p>
              )}

              <div className="nl-sponsor-league-detail-total">
                <span>Auszahlung beim aktuellen Platz</span>
                <span className="nl-tnum">
                  {leagueDetail.row.projectedCash != null ? formatSponsorMoney(leagueDetail.row.projectedCash) : "—"}
                </span>
              </div>
              {/* Bewusst KEIN "max. Vertragswert" hier: dieser Wert ist die Summe der
                  `component.rewardCash`, die laut sponsor-offer-service nur ein Anzeige-Cap je
                  Baustein ist. Die tatsaechliche Auszahlung an einem guten Platz liegt regelmaessig
                  DARUEBER (beobachtet: 89,5 bei "max" 60,8) — nebeneinander gestellt widerspricht
                  sich das sichtbar. Der Tooltip der Uebersichtszeile fuehrt den Wert weiterhin, das
                  ist Bestandsverhalten und hier nicht Thema. */}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
