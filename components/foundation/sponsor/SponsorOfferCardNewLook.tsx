"use client";

import { useMemo } from "react";

import type {
  GameState,
  SponsorArchetype,
  SponsorOffer,
  SponsorOfferComponent,
  SponsorRarity,
} from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import {
  buildSponsorOfferPresentation,
  buildSponsorRankTierRows,
  getSponsorComponentKindLabel,
  type SponsorChallengeDifficulty,
} from "@/lib/sponsor/sponsor-offer-presenter";
import {
  SPONSOR_CURVE_FAMILIES,
  SPONSOR_CURVE_SHAPES,
  SPONSOR_RARITIES,
  getSponsorCurveFamily,
  mapArchetypeToCurveShape,
} from "@/lib/sponsor/sponsor-curve-shapes";
import { describeSponsorOfferModules } from "@/lib/sponsor/sponsor-modules";
import { NlDeltaChip, type NlTone } from "@/components/foundation/new-look";

/**
 * "Neuer Look" Sponsor-Angebotskarte — flag-gated, additiv. Wird nur von
 * `FoundationSponsorsNewLook` gerendert; die bestehende `SponsorOfferCard`
 * bleibt unverändert der Flag-aus-Pfad.
 *
 * Nutzt ausschließlich die echten Werte/Handler aus den Props:
 * `offer.components` (die echten Vertragskomponenten) und `onChoose` (echter
 * Sponsor-Wahl-Flow).
 *
 * Laufzeit (`termSeasons`) ist bewusst NUR Anzeige: der echte Apply-Pfad
 * (`chooseTeamSponsor` → POST /api/sponsor/choose → `chooseSponsorOffer`)
 * akzeptiert keine Laufzeit und rechnet serverseitig fest mit 1 Saison —
 * ein Selector hätte keinerlei Wirkung.
 */

export type SponsorOfferCardNewLookProps = {
  offer: SponsorOffer;
  gameState: GameState;
  chooseBusy: boolean;
  canManage: boolean;
  onChoose: () => void;
  formatCash: (value: number) => string;
  /** #76: markiert dieses Angebot als Cash-stärkstes der aktuellen Saisonauswahl. */
  isBestCashOffer?: boolean;
};

export const SPONSOR_ARCHETYPE_META: Record<SponsorArchetype, { label: string; tone: NlTone }> = {
  security: { label: "Sicherheit", tone: "men" },
  performance: { label: "Performance", tone: "pow" },
  identity: { label: "Identität", tone: "soc" },
};

/**
 * Diablo-style Raritäts-Pill — färbt sich anhand der Loot-Farbe
 * (`SPONSOR_RARITIES[rarity].colorHex`: gewöhnlich grau, magisch blau, selten
 * gold, legendär orange) und zeigt das deutsche Raritäts-Label. Klein & lokal
 * gehalten (kein neues Modul), damit `FoundationSponsorsNewLook` es mitnutzen
 * kann.
 */
export function RarityPill({ rarity, className }: { rarity: SponsorRarity; className?: string }) {
  const meta = SPONSOR_RARITIES[rarity];
  return (
    <span
      className={`nl-sponsor-rarity-pill${className ? ` ${className}` : ""}`}
      data-rarity={rarity}
      style={{ color: meta.colorHex, borderColor: meta.colorHex, background: `${meta.colorHex}22` }}
      title={`Rarität: ${meta.labelDe}`}
      aria-label={`Rarität: ${meta.labelDe}`}
    >
      {meta.labelDe}
    </span>
  );
}

function difficultyClassName(difficulty: SponsorChallengeDifficulty) {
  return `nl-sponsor-difficulty is-${difficulty}`;
}

/** Generiertes Wappen/Monogramm aus dem Sponsor-Namen (kein Fake-Logo-Asset). */
export function SponsorCrest({ name, archetype }: { name: string; archetype: SponsorArchetype }) {
  const monogram =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span className={`nl-sponsor-crest is-${archetype}`} aria-hidden="true">
      <svg viewBox="0 0 40 44" focusable="false" aria-hidden="true">
        <path d="M20 2 37 9v13c0 10-7 17-17 20C10 39 3 32 3 22V9l17-7Z" fill="currentColor" opacity="0.22" />
        <path
          d="M20 2 37 9v13c0 10-7 17-17 20C10 39 3 32 3 22V9l17-7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
      <span className="nl-sponsor-crest-monogram">{monogram}</span>
    </span>
  );
}

type SponsorRewardKind = SponsorOfferComponent["kind"];

/** Konsistente Inline-SVG-Icons für die Reward-Kacheln (Basis/Gewinnstufen/Tabellenziel/Sonderziel). */
function SponsorRewardIcon({ kind }: { kind: SponsorRewardKind }) {
  const shared = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    "aria-hidden": true as const,
    focusable: false as const,
    className: "nl-sponsor-reward-icon",
  };
  switch (kind) {
    case "base":
      // Münze (Basis)
      return (
        <svg {...shared}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 4.5v7M5.8 6.4c0-.9 1-1.5 2.2-1.5s2.2.6 2.2 1.5S9.2 8 8 8s-2.2.6-2.2 1.6 1 1.5 2.2 1.5 2.2-.6 2.2-1.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "rank":
      // Podest (Gewinnstufen)
      return (
        <svg {...shared}>
          <path d="M6 6h4v8H6V6ZM1.5 9H6v5H1.5V9ZM10 11h4.5v3H10v-3Z" fill="currentColor" />
        </svg>
      );
    case "improvement":
      // Aufwärts-Pfeil (Tabellenziel/Verbesserung)
      return (
        <svg {...shared}>
          <path d="M2 12.5 7 7l3 3 4-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 4.6H14v3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "clause":
      // Schild (Klausel/Abstiegs-Malus)
      return (
        <svg {...shared}>
          <path d="M8 1.5 13.5 4v4.5c0 3.5-2.6 5.4-5.5 6.5C5.1 13.9 2.5 12 2.5 8.5V4L8 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M5.5 8h5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    default:
      // Zielscheibe (Sonderziel)
      return (
        <svg {...shared}>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="8" r="1.1" fill="currentColor" />
        </svg>
      );
  }
}

/**
 * Kompakte Anzeige eines mehrstufigen Bonusziels (TEIL B): Stufen-Leiter mit
 * anteiliger Auszahlung je Stufe (`fraction` × Bonus) plus optionaler
 * Spotlight-Hinweis (Beliebtheits-Impuls bei Erfüllung). Rein additiv — fehlt
 * `stages`, wird nichts gerendert (binäres Ziel bleibt wie gehabt).
 */
function SponsorStageLadder({
  component,
  formatCash,
}: {
  component: SponsorOfferComponent;
  formatCash: (value: number) => string;
}) {
  const stages = component.stages;
  const hasStages = Array.isArray(stages) && stages.length > 0;
  const hasSpotlight = typeof component.spotlightBonus === "number" && component.spotlightBonus > 0;
  if (!hasStages && !hasSpotlight) {
    return null;
  }
  return (
    <div className="nl-sponsor-stage-ladder" data-testid="sponsor-stage-ladder">
      {hasStages ? (
        <ul className="nl-sponsor-stage-list">
          {stages!.map((stage) => (
            <li key={stage.label} className="nl-sponsor-stage-rung">
              <span className="nl-sponsor-stage-rung-label">{stage.label}</span>
              <span className="nl-sponsor-stage-rung-payout nl-tnum">
                {Math.round(stage.fraction * 100)}% · {formatCash(component.rewardCash * stage.fraction)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {hasSpotlight ? (
        <span className="nl-sponsor-stage-spotlight" title="Erfüllung gibt zusätzlich einen Beliebtheits-Impuls (Spotlight) für die Folge-Saison.">
          ✦ Spotlight bei Erfüllung
        </span>
      ) : null}
    </div>
  );
}

export function SponsorOfferCardNewLook({
  offer,
  gameState,
  chooseBusy,
  canManage,
  onChoose,
  formatCash,
  isBestCashOffer = false,
}: SponsorOfferCardNewLookProps) {
  const presentation = buildSponsorOfferPresentation({ offer, gameState, teamId: offer.teamId });
  // Rarität/Kurvenform robust auflösen — Back-Compat für alte Saves ohne die
  // neuen Felder (Legacy archetype wird gemappt; rarity wird bereits beim Laden
  // aus dem alten Sternrang zurückgefüllt, siehe save-repository.ts).
  // Fallback konservativ auf „gewöhnlich" (deckungsgleich mit Settlement) statt „magisch" — sonst rendert
  // jedes Angebot ohne rarity-Feld (Alt-Save vor der Rarity-Migration) fälschlich als Magisch.
  const rarity = offer.rarity ?? "gewöhnlich";
  const shape = offer.curveShape ?? mapArchetypeToCurveShape(offer.archetype);
  const shapeLabel = SPONSOR_CURVE_SHAPES[shape].labelDe;
  const familyLabel = SPONSOR_CURVE_FAMILIES[getSponsorCurveFamily(shape)].labelDe;
  // P4 Baukasten: die Modul-Zusammensetzung des Angebots (Cash-Komponenten + evtl. Perk) fürs UI.
  const offerModules = describeSponsorOfferModules(offer);
  const offerPerk = offerModules.find((module) => module.kind === "perk") ?? null;
  const specialComponent = offer.components.find((component) => component.kind === "special") ?? null;
  // "overperformance" wird als eigene Zeile unter der Rang-Leiter gerendert (nicht als generische Kachel),
  // fließt aber weiter in die Gesamt-Summe (totalCash) ein.
  const standardComponents = offer.components.filter(
    (component) => component.kind !== "special" && component.kind !== "overperformance",
  );
  const baseCash = offer.components.find((component) => component.kind === "base")?.rewardCash ?? 0;
  const totalCash = offer.components.reduce(
    (sum, component) => sum + (typeof component.rewardCash === "number" ? component.rewardCash : 0),
    0,
  );
  const termSeasons = offer.termSeasons ?? 1;

  // #79: aktuell erreichte Gewinnstufe live hervorheben — echter Liga-Rang
  // des Teams (`buildTeamSeasonOverviewRows`), keine erfundene Platzierung.
  const currentTeamRank = useMemo(() => {
    const rows = buildTeamSeasonOverviewRows({ gameState });
    return rows.find((row) => row.teamId === offer.teamId)?.rank ?? null;
  }, [gameState, offer.teamId]);

  return (
    <article
      className={`nl-sponsor-offer is-${offer.archetype}${presentation.isChallenge ? " is-challenge" : ""}${presentation.isGolden ? " is-golden" : ""}`}
      data-testid={`sponsor-offer-${shape}`}
      data-rarity={rarity}
      data-challenge={presentation.isChallenge ? "true" : "false"}
      data-golden={presentation.isGolden ? "true" : "false"}
    >
      <header className="nl-sponsor-offer-head">
        <SponsorCrest name={offer.name} archetype={offer.archetype} />
        <div className="nl-sponsor-offer-title">
          <span className="nl-sponsor-offer-kicker">
            {shapeLabel}
            {` · ${familyLabel}`}
            {offer.demandProfile ? ` · ${offer.demandProfile}` : ""}
          </span>
          <strong>{offer.name}</strong>
          <small>{offer.flavor}</small>
        </div>
        <div className="nl-sponsor-offer-badges">
          <RarityPill rarity={rarity} />
          {/* P4 Baukasten: Modul-Anzahl als Rarity-Wertigkeits-Signal; Perk-Chip (Spotlight ×2) bei legendär/golden. */}
          {offerModules.length > 0 ? (
            <span
              className="nl-sponsor-module-chip"
              data-testid="sponsor-module-chip"
              title={`Baukasten: ${offerModules.map((module) => module.labelDe).join(" · ")}`}
            >
              {offerModules.length} Module
            </span>
          ) : null}
          {offerPerk ? (
            <span className="nl-sponsor-module-chip is-perk" data-testid="sponsor-perk-chip" title="Perk: verdoppelter Beliebtheits-Impuls (Spotlight) bei erfülltem Sonderziel.">
              ✦ {offerPerk.labelDe}
            </span>
          ) : null}
          {presentation.offerBadge ? (
            <span
              className={`nl-sponsor-offer-badge${presentation.isGolden ? " is-golden" : ""}`}
              title={
                presentation.isGolden
                  ? "Golden Card — seltener Glücks-Sponsor mit geboostetem Rang-Payout und Bonus-Ziel."
                  : undefined
              }
            >
              {presentation.isGolden ? "✦ " : ""}
              {presentation.offerBadge}
            </span>
          ) : null}
          {isBestCashOffer ? (
            <span className="nl-sponsor-offer-badge is-cash-best" title="Höchste Cash-Summe im aktuellen Angebotsvergleich">
              Bestes Cash-Angebot
            </span>
          ) : null}
          <span
            className="nl-sponsor-term-chip"
            title="Vertragslaufzeit dieses Angebots. Aktuell vergeben Sponsoren feste 1-Saison-Verträge — die Laufzeit ist beim Abschluss nicht verhandelbar."
          >
            Laufzeit {termSeasons} {termSeasons === 1 ? "Saison" : "Saisons"}
          </span>
        </div>
      </header>

      {presentation.isChallenge && presentation.special ? (
        <div className="nl-sponsor-challenge" data-testid="sponsor-challenge-panel">
          <div className="nl-sponsor-challenge-head">
            {presentation.special.axisLabel ? (
              <span className={`nl-sponsor-axis-chip is-${presentation.special.axisKey}`}>
                {presentation.special.axisLabel}
              </span>
            ) : (
              <span className="nl-sponsor-axis-chip is-neutral">Ziel</span>
            )}
            <span className={difficultyClassName(presentation.special.difficulty)}>
              {presentation.special.difficultyLabel}
            </span>
          </div>
          <strong>{presentation.special.headline}</strong>
          <small>{presentation.special.detail}</small>
          {specialComponent ? (
            <div className="nl-sponsor-challenge-reward nl-tnum">
              Bonus {formatCash(specialComponent.rewardCash)}
              {specialComponent.penaltyCash ? ` · Malus −${formatCash(specialComponent.penaltyCash)}` : ""}
            </div>
          ) : null}
          {specialComponent ? <SponsorStageLadder component={specialComponent} formatCash={formatCash} /> : null}
        </div>
      ) : null}

      <div className="nl-sponsor-negotiation" data-testid="nl-sponsor-negotiation">
        <div className="nl-sponsor-negotiation-live nl-tnum" aria-live="polite">
          <span>
            Gesamt <strong>{formatCash(totalCash)}</strong>
          </span>
        </div>
      </div>

      <div className="nl-sponsor-reward-tiles" aria-label="Vertragskomponenten">
        {standardComponents.map((component) => {
          if (component.kind === "rank") {
            const tierRows = buildSponsorRankTierRows({
              baseCash,
              rankCash: component.rewardCash,
              includeFloorRung: true,
            });
            // #79: höchste Stufe, deren Rang-Schwelle der aktuelle Liga-Rang
            // erfüllt (Meilensteine sind aufsteigend schwerer sortiert).
            let currentTierIndex = -1;
            if (currentTeamRank != null) {
              tierRows.forEach((row, index) => {
                if (currentTeamRank <= row.rankAt) {
                  currentTierIndex = index;
                }
              });
            }
            return (
              <div key={component.componentId} className="nl-sponsor-reward-tile is-rank">
                <div className="nl-sponsor-reward-tile-head">
                  <SponsorRewardIcon kind="rank" />
                  <span>{getSponsorComponentKindLabel(component.kind)}</span>
                  <strong className="nl-tnum">{formatCash(component.rewardCash)}</strong>
                  {currentTeamRank != null ? (
                    <small className="nl-sponsor-rank-current-hint">Aktuell #{currentTeamRank}</small>
                  ) : null}
                </div>
                <ul className="nl-sponsor-rank-ladder" data-testid="sponsor-rank-tier-list">
                  {/* #? Meister (höchste Stufe) oben anzeigen — die Leiter wird von
                      stark→schwach gerendert, während rankAt-Index/Balkenbreite an der
                      Tier-Stärke (Meister = voller Balken) hängen bleiben. */}
                  {tierRows
                    .map((row, tierIndex) => ({ row, tierIndex }))
                    .reverse()
                    .map(({ row, tierIndex }) => {
                      const isReached = currentTierIndex >= 0 && tierIndex <= currentTierIndex;
                      const isCurrent = tierIndex === currentTierIndex;
                      return (
                      <li
                        key={row.label}
                        className={`nl-sponsor-rank-rung${isReached ? " is-reached" : ""}${isCurrent ? " is-current" : ""}`}
                      >
                        <span
                          className="nl-sponsor-rank-rung-bar"
                          aria-hidden="true"
                          style={{ width: `${Math.round(((tierIndex + 1) / tierRows.length) * 100)}%` }}
                        />
                        <span className="nl-sponsor-rank-rung-label">
                          {row.label}
                          {isCurrent ? <span className="nl-sponsor-rank-rung-live">● aktuell</span> : null}
                        </span>
                        <span className="nl-sponsor-rank-rung-payout nl-tnum">{formatCash(row.absolutePayout)}</span>
                      </li>
                      );
                    })}
                </ul>
                {/* P3 — Überperformance-Modul (familien-differenziert) als konkrete, bezifferte Zeile unter der
                    Rang-Leiter: Rate je Platz über dem Erwartungsrang + Cap, exakt die beim Signieren
                    eingefrorenen Werte (Anzeige == Settlement). Sponsoren OHNE das Modul (Sicherheits-Familie
                    oder Team ohne Luft nach oben) zeigen die Zeile gar nicht — Abwesenheit ist ehrlich. */}
                {(() => {
                  const overperf = offer.components.find((entry) => entry.kind === "overperformance");
                  if (!overperf) return null;
                  const expectedRank = typeof overperf.targetValue === "number" ? overperf.targetValue : null;
                  return (
                    <div className="nl-sponsor-overperf-hint" data-testid="sponsor-overperf-hint">
                      <span className="nl-sponsor-overperf-icon" aria-hidden="true">
                        ✦
                      </span>
                      <span>
                        <strong>
                          Überperformance: +{overperf.ratePerUnitC != null ? formatCash(overperf.ratePerUnitC) : "?"} je Platz
                        </strong>{" "}
                        {expectedRank != null
                          ? `über deinem Erwartungsrang #${expectedRank} — max ${formatCash(overperf.rewardCash)}.`
                          : `über deiner Erwartung — max ${formatCash(overperf.rewardCash)}.`}
                      </span>
                    </div>
                  );
                })()}
              </div>
            );
          }
          return (
            <div key={component.componentId} className={`nl-sponsor-reward-tile is-${component.kind}`}>
              <div className="nl-sponsor-reward-tile-head">
                <SponsorRewardIcon kind={component.kind} />
                <span>{getSponsorComponentKindLabel(component.kind)}</span>
                <strong className="nl-tnum">
                  {/* P4b — Klausel: statt des (0-)Rewards den eingefrorenen Malus zeigen. */}
                  {component.kind === "clause" && component.penaltyCash
                    ? `−${formatCash(component.penaltyCash)}`
                    : typeof component.rewardCash === "number"
                      ? formatCash(component.rewardCash)
                      : component.rewardCash}
                </strong>
              </div>
              <small>{component.label}</small>
            </div>
          );
        })}
        {!presentation.isChallenge && specialComponent ? (
          <div className="nl-sponsor-reward-tile is-special">
            <div className="nl-sponsor-reward-tile-head">
              <SponsorRewardIcon kind="special" />
              <span>Sonderziel</span>
              <strong className="nl-tnum">{formatCash(specialComponent.rewardCash)}</strong>
            </div>
            <small>{specialComponent.label}</small>
            <SponsorStageLadder component={specialComponent} formatCash={formatCash} />
            {specialComponent.penaltyCash ? (
              <NlDeltaChip
                value={-specialComponent.penaltyCash}
                format={(n) => formatCash(Math.abs(n))}
                title="Malus bei verfehltem Sonderziel"
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="primary-button inline-button nl-sponsor-choose"
        data-testid="sponsor-choose-button"
        disabled={chooseBusy || !canManage}
        onClick={onChoose}
      >
        {chooseBusy ? "Speichert…" : presentation.isChallenge ? "Challenge wählen" : "Wählen"}
      </button>
    </article>
  );
}
