"use client";

import { useMemo } from "react";
import { buildLeihPresentationForOffer } from "@/lib/sponsor/sponsor-leih-presenter";
import { SponsorLeihePanel } from "@/components/foundation/sponsor/SponsorLeihePanel";

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
import {
  buildOfferRankPayoutLadderPreview,
  buildSponsorOfferTermForecast,
  estimateExpectedPayout,
} from "@/lib/sponsor/sponsor-economy-calibration";
import { SponsorRankLadder } from "@/components/foundation/sponsor/SponsorRankLadder";
import { SponsorSeasonRankTable } from "@/components/foundation/sponsor/SponsorSeasonRankTable";
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
 * Laufzeit (`termSeasons`) ist kein Selector, aber seit Umsetzungsplan D auch keine feste 1-Saison-
 * Konstante mehr: sie wird beim Slate-Wurf je Angebot gewuerfelt (`rollSponsorOfferSlate`,
 * sponsor-tier-pool.ts, Mehrheit einjaehrig) und der Apply-Pfad (`chooseTeamSponsor` → POST
 * /api/sponsor/choose → `chooseSponsorOffer`) uebernimmt sie 1:1 vom gewaehlten Angebot. Der Betrag
 * bleibt dabei an die Konjunktur der jeweiligen Saison gekoppelt (Sockel eingefroren, Wertungsanteil
 * skaliert jede Saison neu) — siehe die Bedingungs-Zeile und den Laufzeit-Ausblick weiter unten.
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
  // Karten-Beschriftung: neue Angebote tragen ihre Karte im `sponsorV3`-Block. Nur Angebote aus
  // Spielstaenden von VOR dem Umbau haben noch eine der Legacy-Kurvenformen (bzw. gar keine, dann
  // wird sie aus dem Archetyp abgeleitet) — fuer die bleibt die alte Beschriftung stehen.
  const shape = offer.curveShape ?? mapArchetypeToCurveShape(offer.archetype);
  const shapeLabel = presentation.v3?.cardName ?? SPONSOR_CURVE_SHAPES[shape].labelDe;
  const familyLabel = presentation.v3
    ? presentation.v3.tiltPercent === 0
      ? "EV-neutral"
      : `${presentation.v3.tiltPercent > 0 ? "+" : ""}${presentation.v3.tiltPercent} % Hebel`
    : SPONSOR_CURVE_FAMILIES[getSponsorCurveFamily(shape)].labelDe;
  // P4 Baukasten: die Modul-Zusammensetzung des Angebots (Cash-Komponenten + evtl. Perk) fürs UI.
  const offerModules = describeSponsorOfferModules(offer);
  const offerPerk = offerModules.find((module) => module.kind === "perk") ?? null;
  const specialComponent = offer.components.find((component) => component.kind === "special") ?? null;
  // Die Gebäude-Leihe kommt fertig gerechnet aus der lib — die Karte formatiert nur. Jede Zahl
  // stammt aus derselben Quelle wie der Verzicht in der Leiter; eine zweite Rechnung hier waere
  // genau der Weg, auf dem Anzeige und Abrechnung in diesem Projekt schon auseinandergelaufen sind.
  const leihe = buildLeihPresentationForOffer(offer);
  // "overperformance" wird als eigene Zeile unter der Rang-Leiter gerendert (nicht als generische Kachel),
  // fließt aber weiter in die Gesamt-Summe (totalCash) ein.
  const standardComponents = offer.components.filter(
    (component) => component.kind !== "special" && component.kind !== "overperformance",
  );
  const baseCash = offer.components.find((component) => component.kind === "base")?.rewardCash ?? 0;
  // Audit #4: gelockte curveShape-Rang-Leiter (== Settlement) einmal bauen und in die Gewinnstufen-Leiter
  // reichen, damit die angezeigten Stufenbeträge der echten Auszahlung entsprechen.
  const offerRankPayoutLadder = useMemo(
    () => buildOfferRankPayoutLadderPreview(gameState, offer),
    [gameState, offer],
  );
  const totalCash = offer.components.reduce(
    (sum, component) => sum + (typeof component.rewardCash === "number" ? component.rewardCash : 0),
    0,
  );
  const termSeasons = offer.termSeasons ?? 1;
  // Ausblick ueber die Laufzeit: bei MEHRJAEHRIGEN Angeboten (2/3 Saisons) zeigt sich hier, was der
  // Vertrag an der AKTUELLEN Tabellenposition in jeder Saison der Laufzeit einbringen wuerde — die
  // Zahlen liegen bereits vor (Salary-Factor-Vorausschau, siehe buildSponsorOfferTermForecast).
  const termForecast = useMemo(() => buildSponsorOfferTermForecast(gameState, offer), [gameState, offer]);

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
            title="Vertragslaufzeit dieses Angebots — beim Abschluss nicht verhandelbar, aber je Angebot unterschiedlich."
          >
            Laufzeit {termSeasons} {termSeasons === 1 ? "Saison" : "Saisons"}
          </span>
        </div>
      </header>

      {termSeasons > 1 ? (
        <div className="nl-sponsor-term-outlook" data-testid="sponsor-term-outlook">
          {termForecast.length > 0 ? (
            <ul className="nl-sponsor-term-outlook-list" aria-label="Ausblick über die Vertragslaufzeit">
              {termForecast.map((entry, index) => {
                const vorjahr = index > 0 ? termForecast[index - 1] : null;
                const delta = vorjahr ? entry.payoutAtCurrentRank - vorjahr.payoutAtCurrentRank : null;
                return (
                  <li key={entry.seasonYear} className="nl-sponsor-term-outlook-row">
                    {/* Aufklappbar statt nur Hover: eine reine Hover-Tabelle waere per Tastatur und
                        auf dem Touchpad nicht erreichbar. Geoeffnet zeigt sie, was jeder Rang IN
                        DIESER Vertragssaison bringt — der Unterschied zwischen den Jahren ist genau
                        das, was die Zeile sonst nur als eine Zahl andeutet. */}
                    <details className="nl-sponsor-term-season">
                      <summary className="nl-sponsor-term-season-summary">
                        <span className="nl-sponsor-term-season-label">
                          Saison {entry.seasonYear}/{termSeasons}
                        </span>
                        <span className="nl-sponsor-term-season-numbers">
                          {delta != null && Math.abs(delta) >= 0.05 ? (
                            <em className="nl-tnum" data-direction={delta > 0 ? "up" : "down"}>
                              {delta > 0 ? "+" : "−"}
                              {formatCash(Math.abs(delta))}
                            </em>
                          ) : null}
                          <strong className="nl-tnum">{formatCash(entry.payoutAtCurrentRank)}</strong>
                        </span>
                      </summary>
                      <div className="nl-sponsor-term-season-detail">
                        <p className="nl-sponsor-term-season-factor">
                          {entry.factorSource === "vorausgewuerfelt" ? (
                            <>
                              Salary Factor dieser Saison <strong className="nl-tnum">{entry.salaryFactor.toFixed(2)}</strong>{" "}
                              — steht bereits fest.
                            </>
                          ) : (
                            <>
                              Für diese Saison ist der Salary Factor noch nicht gewürfelt. Gerechnet mit dem
                              Faktor bei Unterschrift (<strong className="nl-tnum">{entry.salaryFactor.toFixed(2)}</strong>).
                            </>
                          )}
                        </p>
                        <SponsorSeasonRankTable
                          rankPayouts={entry.rankPayouts}
                          currentTeamRank={currentTeamRank}
                          formatCash={formatCash}
                        />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <p className="nl-sponsor-term-condition">
            Sockel steht mit dem Startrang bei Unterschrift fest, der Wertungsanteil schwankt jede Saison
            neu mit dem Salary Factor.
          </p>
        </div>
      ) : null}

      {/* DAS GEBÄUDE — die eigentliche Entscheidung dieser Karte.
          Es steht bewusst VOR den Cash-Kacheln: wer diese Karte waehlt, waehlt sie wegen des
          Gebaeudes, und die niedrigere Auszahlung darunter ist die Folge, nicht der Anlass. Die
          Zeile „steckt bereits in der Auszahlung" ist keine Hoeflichkeit, sondern die Absicherung
          gegen das naheliegende Missverstaendnis, der Verzicht komme noch obendrauf. */}
      {leihe ? <SponsorLeihePanel leihe={leihe} formatCash={formatCash} variant="offer" /> : null}

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

      {/* SPONSORSYSTEM V3: die Kartenstruktur. Sie stellt VOR die Kacheln, was das Modell ausmacht
          und was die Kacheln nicht ausdruecken koennen: die garantierte Untergrenze, den Hebel
          gegen den eingefrorenen Erwartungsanker (man kann auch VERLIEREN) und beim Sonderziel den
          Sockelabzug, der immer faellig wird. */}
      {presentation.v3 ? (
        <div className="nl-sponsor-v2" data-testid="sponsor-v3-panel">
          <div className="nl-sponsor-v2-head">
            <span className="nl-sponsor-axis-chip is-neutral">{presentation.v3.cardName}</span>
            <small>{presentation.v3.cardNote}</small>
          </div>
          <ul className="nl-sponsor-v2-list">
            <li data-testid="sponsor-v3-floor">
              <span>Garantiert auf jedem Platz</span>
              <strong className="nl-tnum">{formatCash(presentation.v3.guaranteedFloor)}</strong>
            </li>
            <li data-testid="sponsor-v3-top">
              <span>Bei Titelgewinn (ohne Sonderziel)</span>
              <strong className="nl-tnum">{formatCash(presentation.v3.guaranteedTop)}</strong>
            </li>
            <li data-testid="sponsor-v3-anchor">
              <span>
                Erwartet auf Startrang {presentation.v3.startRank} <em>(Risiko ±{formatCash(presentation.v3.risk)})</em>
              </span>
              <strong className="nl-tnum">{formatCash(presentation.v3.anchor)}</strong>
            </li>
            {presentation.v3.goal ? (
              <li data-testid="sponsor-v3-goal">
                <span>
                  Sonderziel{" "}
                  <em>
                    ({presentation.v3.goal.difficultyLabel}, {Math.round(presentation.v3.goal.probability * 100)} % ·
                    Sockelabzug −{formatCash(presentation.v3.goal.upfrontCost)})
                  </em>
                </span>
                <strong className="nl-tnum">+{formatCash(presentation.v3.goal.payout)}</strong>
              </li>
            ) : null}
            {presentation.v3.advance ? (
              /* Die zweite Wahldimension. Ohne diese Zeile stuende der Vorschuss nirgends auf der
                 Karte — der Mensch waehlte dann schlechter informiert als die KI, die ihn bewertet. */
              <li data-testid="sponsor-v3-advance">
                <span>
                  Vorschuss bei Unterschrift{" "}
                  <em>(Gebuehr {formatCash(presentation.v3.advance.fee)}, am Saisonende verrechnet)</em>
                </span>
                <strong className="nl-tnum">+{formatCash(presentation.v3.advance.amount)}</strong>
              </li>
            ) : null}
          </ul>
          <div className="nl-sponsor-v2-range nl-tnum" data-testid="sponsor-v3-range">
            Spanne {formatCash(presentation.v3.minPayout)} – {formatCash(presentation.v3.maxPayout)}
            <small>
              {" "}schlechtester Fall: letzter Platz, Ziel verfehlt · bester Fall: Titel, Ziel erreicht
            </small>
          </div>
        </div>
      ) : null}

      <div className="nl-sponsor-negotiation" data-testid="nl-sponsor-negotiation">
        <div className="nl-sponsor-negotiation-live nl-tnum" aria-live="polite">
          {/* Unter V3 ist die reine Komponentensumme irrefuehrend: sie kennt den Sockelabzug des
              Sonderziels nicht und suggeriert einen Betrag, den es so nicht gibt. Angezeigt wird
              deshalb der ERWARTUNGSWERT der Karte — der fuer ALLE Karten eines Slates derselbe ist:
              die Wahl ist eine Risiko-Entscheidung, kein Etat-Upgrade. */}
          <span>
            {presentation.v3 ? "Erwartungswert" : "Gesamt"}{" "}
            <strong>{formatCash(presentation.v3 ? estimateExpectedPayout(offer) : totalCash)}</strong>
          </span>
        </div>
      </div>

      <div className="nl-sponsor-reward-tiles" aria-label="Vertragskomponenten">
        {standardComponents.map((component) => {
          // GEMELDET: „Basis braucht auch keine sau, man sieht ja platz 32 waere ja die basis!"
          // Stimmt — unter V3 ist die Basis definitionsgemaess der Betrag am letzten Platz, und der
          // steht als „Garantiert auf jedem Platz" schon oben auf der Karte. Eine eigene Kachel
          // dafuer sagt nichts Neues. Ohne V3-Block (Altangebote) bleibt sie, dort ist sie die
          // einzige Stelle, an der die Basis ueberhaupt steht.
          if (component.kind === "base" && presentation.v3) {
            return null;
          }
          if (component.kind === "rank") {
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
                {/* GEMELDET: „dann steht im mittleren bereich sehr viel ohne dass es wirklich mehr
                    aussagt als das drumherum … Ich brauche nicht noch mal sehen was man als meister
                    oder als letzter bekommt das sieht man ja!"

                    Er hatte recht: die Dauer-Leiter wiederholte ihre beiden Endpunkte woertlich aus
                    dem Block darueber — „Meister" == „Bei Titelgewinn", „Platz 32" == „Garantiert auf
                    jedem Platz" — und dazwischen lagen acht Zwischenschritte derselben Kurve. Unter V3
                    steht die Leiter deshalb nur noch auf Abruf; ohne V3-Block (Altangebote) bleibt sie
                    sichtbar, denn dort ist sie die einzige Quelle fuer die beiden Endpunkte. */}
                {presentation.v3 ? (
                  <details className="nl-sponsor-rank-ladder-disclosure" data-testid="sponsor-rank-ladder-disclosure">
                    <summary>Alle Gewinnstufen</summary>
                    <SponsorRankLadder
                      baseCash={baseCash}
                      rankLadder={offerRankPayoutLadder}
                      currentTeamRank={currentTeamRank}
                      formatCash={formatCash}
                    />
                  </details>
                ) : (
                  <SponsorRankLadder
                    baseCash={baseCash}
                    rankLadder={offerRankPayoutLadder}
                    currentTeamRank={currentTeamRank}
                    formatCash={formatCash}
                  />
                )}
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
                  {typeof component.rewardCash === "number" ? formatCash(component.rewardCash) : component.rewardCash}
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
