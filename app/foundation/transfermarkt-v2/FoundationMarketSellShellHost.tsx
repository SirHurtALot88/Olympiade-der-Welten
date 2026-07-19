"use client";

import type { Dispatch, SetStateAction } from "react";

import ClassColorChip from "@/app/foundation/ClassColorChip";
import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import {
  formatBoardTrustMoodLabel,
  formatBoardTrustPolicyLabel,
  formatDoctrinePersonaLabel,
  formatGmArchetypeLabel,
  formatGmPressureLabel,
  formatMatchdayShortLabel,
  formatReadinessAfterSellLabel,
  formatRosterRoleTagLabel,
  translateSellBlockingReason,
  translateSellWarning,
} from "@/app/foundation/transfermarkt-v2/transfer-sell-view-labels";
import type { Team } from "@/lib/data/olyDataTypes";
import { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";
import {
  useMarketSellDerivations,
  type MarketSellPlayerPerformance,
  type MarketSellPlayerRatingsById,
  type TransfermarktSellPreviewSubject,
  type TransfermarktSellSummary,
  type UseMarketSellDerivationsInput,
} from "@/lib/foundation/tabs/use-market-sell-derivations";
import { formatTransfermarktCurrency } from "@/lib/market/transfermarkt-formatting-contract";

function formatWholeNumber(value: number | null | undefined) {
  return formatLocalePoints(value, 0);
}

function formatPpsValue(value: number | null | undefined) {
  return formatLocalePoints(value, 1);
}

function formatSignedTransfermarktCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatTransfermarktCurrency(value)}`;
}

function getTransferTypePillClass(type: "buy" | "sell" | "contract_exit") {
  return `transfer-status-pill ${type === "buy" ? "is-ready" : "is-warning"}`;
}

export type FoundationMarketSellShellHostProps = {
  readMetaSource: "sqlite" | "prisma";
  selectedTeam: Team | null;
  marketSellPreview: TransfermarktSellSummary | null;
  marketSellSubject: TransfermarktSellPreviewSubject | null;
  marketSellBusy: boolean;
  marketSellError: string | null;
  marketSellSuccess: string | null;
  marketSellRiskAcknowledged: boolean;
  onMarketSellRiskAcknowledgedChange: Dispatch<SetStateAction<boolean>>;
  playerRatingsById: MarketSellPlayerRatingsById;
  playerSeasonPerformanceMap: Map<string, MarketSellPlayerPerformance>;
  derivationsInput: Omit<
    UseMarketSellDerivationsInput,
    | "marketSellPreview"
    | "marketSellSubject"
    | "playerRatingsById"
    | "playerSeasonPerformanceMap"
  >;
  closeMarketSellModal: () => void;
  confirmTransfermarktSell: () => void | Promise<void>;
};

/**
 * Market sell drilldown shell host (Strangler Phase 5.3). Mounts sell panel JSX
 * and scoped derivations only while `isMarketSellPanelOpen`.
 *
 * Layout: Entscheidungs-Zone zuerst (Hero-Preis, Team-Auswirkung, Board/GM),
 * Detail-Sektionen (Leistung, Vertrag, Historie, Gründe) als kompakte
 * Disclosure-Blöcke — alles erreichbar, nichts dominiert.
 */
export default function FoundationMarketSellShellHost({
  readMetaSource,
  selectedTeam,
  marketSellPreview,
  marketSellSubject,
  marketSellBusy,
  marketSellError,
  marketSellSuccess,
  marketSellRiskAcknowledged,
  onMarketSellRiskAcknowledgedChange,
  playerRatingsById,
  playerSeasonPerformanceMap,
  derivationsInput,
  closeMarketSellModal,
  confirmTransfermarktSell,
}: FoundationMarketSellShellHostProps) {
  const { marketSellPlayerContext } = useMarketSellDerivations({
    ...derivationsInput,
    marketSellPreview,
    marketSellSubject,
    playerRatingsById,
    playerSeasonPerformanceMap,
  });

  // Friction fix (Generalprobe #4): the confirm button was disabled with no
  // on-screen explanation. Surface the concrete reason near the button instead
  // of relying on a title/tooltip only, and always flag a minimum-roster caution
  // (a warning that makes selling unsafe even when technically still allowed).
  const rosterAtMinimum =
    (marketSellPreview?.warnings ?? []).some((warning) =>
      warning === "team_would_fall_under_7" ||
      warning === "team_would_fall_under_player_min",
    );
  const strongAckPending =
    (marketSellPreview?.coaching?.boardReaction.requiresStrongAcknowledgment ||
      (marketSellPreview?.coaching?.gmSoftBlockStarSell && (marketSellPreview?.coaching?.keepIntentScore ?? 0) >= 55)) &&
    !marketSellRiskAcknowledged;
  const sellDisabled =
    readMetaSource === "prisma" || !marketSellPreview?.canSell || marketSellBusy || strongAckPending;
  const sellDisabledReason = !sellDisabled
    ? null
    : readMetaSource === "prisma"
      ? "Im Referenzmodus bleibt der Verkauf gesperrt."
      : !marketSellPreview
        ? "Verkaufsvorschau wird noch geladen."
        : !marketSellPreview.canSell
          ? rosterAtMinimum
            ? "Kader ist am Minimum — verkaufen würde die Aufstellung unmöglich machen. Kaufe zuerst Ersatz, bevor du hier verkaufst."
            : (marketSellPreview.blockingReasons?.[0]
                ? translateSellBlockingReason(marketSellPreview.blockingReasons[0])
                : "Dieser Verkauf ist gerade noch blockiert.")
          : marketSellBusy
            ? "Der Verkauf wird gerade vorbereitet."
            : strongAckPending
              ? "Bitte bestätige zuerst die Board-/GM-Warnung oben, dann kannst du final verkaufen."
              : null;

  return (
    <section className="foundation-drilldown-page transfer-sell-page" data-testid="transfer-sell-page" aria-label="Verkaufsdialog">
      <header className="foundation-drilldown-header">
        <div className="stack">
          <span className="eyebrow">Verkauf</span>
          <h1>{marketSellPreview?.player?.name ?? marketSellSubject?.playerName ?? "Spieler verkaufen"}</h1>
          <p className="muted">Spielstand: {readMetaSource === "prisma" ? "Referenz" : "lokal"}</p>
        </div>
        <button className="secondary-button inline-button" type="button" onClick={closeMarketSellModal}>
          Zurück
        </button>
      </header>

      <div className="foundation-drilldown-body foundation-modal-body transfer-buy-modal-body">
        {(() => {
          const context = marketSellPlayerContext;
          const portraitSrc = marketSellSubject?.portraitUrl ?? null;
          const playerName = marketSellPreview?.player?.name ?? marketSellSubject?.playerName ?? "Unbekannt";
          const className = marketSellPreview?.player?.className ?? marketSellSubject?.className ?? "—";
          const race = marketSellPreview?.player?.race ?? marketSellSubject?.race ?? "—";
          const saleVsMarketValue =
            marketSellPreview?.salePrice != null && marketSellPreview.marketValueReference != null
              ? marketSellPreview.salePrice - marketSellPreview.marketValueReference
              : null;
          const buyoutCost = marketSellPreview?.buyoutCost ?? 0;
          const netProceeds = marketSellPreview?.netProceeds ?? marketSellPreview?.salePrice ?? null;
          const hasBuyout = buyoutCost > 0;
          const saleProfit = context?.saleProfit ?? marketSellPreview?.profit ?? null;

          return (
            <div className="transfer-buy-player-line transfer-sell-hero-line">
              <div className="transfer-modal-player-hero transfer-sell-hero">
                <OptimizedMediaImage
                  className="transfermarkt-portrait transfer-sell-portrait"
                  src={portraitSrc}
                  alt={playerName}
                  width={72}
                  height={72}
                  loading="lazy"
                  fetchPriority="low"
                  fallback={
                    <div
                      className="transfermarkt-portrait transfermarkt-portrait-placeholder transfer-sell-portrait"
                      aria-label={`${playerName} placeholder`}
                    >
                      {playerName.slice(0, 2).toUpperCase()}
                    </div>
                  }
                />
                <div className="transfer-modal-player-summary">
                  <div className="transfer-modal-player-head">
                    <strong>{playerName}</strong>
                    <div className="transfer-modal-player-meta">
                      <ClassColorChip className={className} />
                      <span className="muted">{race}</span>
                      <span className="pill">
                        {marketSellPreview?.team?.shortCode ?? selectedTeam?.shortCode ?? "—"} ·{" "}
                        {marketSellPreview?.team?.name ?? selectedTeam?.name ?? "Kein Team gewählt"}
                      </span>
                    </div>
                  </div>
                  <div className="transfer-modal-player-kpis transfer-sell-kpis">
                    <article className="transfer-modal-kpi is-money">
                      <span>Netto-Erlös</span>
                      <strong>{formatTransfermarktCurrency(netProceeds)}</strong>
                      <small className="muted">
                        Brutto {formatTransfermarktCurrency(marketSellPreview?.salePrice ?? null)}
                        {hasBuyout ? ` · Buyout ${formatTransfermarktCurrency(buyoutCost)}` : null}
                      </small>
                    </article>
                    <article className="transfer-modal-kpi">
                      <span>Verkaufspreis</span>
                      <strong>{formatTransfermarktCurrency(marketSellPreview?.salePrice ?? null)}</strong>
                      {hasBuyout ? (
                        <small className="text-negative">Buyout {formatTransfermarktCurrency(buyoutCost)} offen</small>
                      ) : (
                        <small className={saleVsMarketValue != null ? (saleVsMarketValue >= 0 ? "text-positive" : "text-negative") : undefined}>
                          vs. MW {saleVsMarketValue != null ? formatSignedTransfermarktCurrency(saleVsMarketValue) : "—"}
                        </small>
                      )}
                    </article>
                    <article className="transfer-modal-kpi">
                      <span>Faktor</span>
                      <strong>
                        {marketSellPreview?.saleFactor != null ? `${formatLocalePoints(marketSellPreview.saleFactor, 2)}x` : "—"}
                      </strong>
                      <small className="muted">auf den Marktwert</small>
                    </article>
                    <article className="transfer-modal-kpi">
                      <span>GuV Verkauf</span>
                      <strong className={saleProfit != null ? (saleProfit >= 0 ? "text-positive" : "text-negative") : undefined}>
                        {saleProfit != null ? formatSignedTransfermarktCurrency(saleProfit) : "—"}
                      </strong>
                      <small className="muted">Preis minus Einstieg</small>
                    </article>
                    <article className="transfer-modal-kpi">
                      <span>OVR</span>
                      <strong>{formatWholeNumber(context?.rating?.ovrNormalized ?? context?.player?.ovr ?? null)}</strong>
                      <small className="muted">
                        PPs {formatPpsValue(context?.rating?.ppsSeason ?? context?.performance?.totalPoints ?? null)}
                      </small>
                    </article>
                  </div>
                </div>
              </div>
              <span className={`transfer-status-pill${marketSellPreview?.canSell ? " is-ready" : " is-blocked"}`}>
                {readMetaSource === "prisma" ? "read-only" : marketSellPreview?.canSell ? "bereit" : "geblockt"}
              </span>
            </div>
          );
        })()}

        {marketSellError ? (
          <div className="transfer-feedback-banner is-error">
            <strong>Verkaufsvorschau blockiert</strong>
            <span>{marketSellError}</span>
          </div>
        ) : null}
        {marketSellSuccess ? (
          <div className="transfer-feedback-banner is-success">
            <strong>Verkauf erfolgreich</strong>
            <span>{marketSellSuccess}</span>
          </div>
        ) : null}

        {marketSellPreview ? (
          <>
            {marketSellPreview.blockingReasons.length || marketSellPreview.warnings.length ? (
              <div className="transfer-buy-meta-grid">
                {marketSellPreview.blockingReasons.length ? (
                  <div className="transfer-callout is-blocked">
                    <div className="transfer-callout-title">
                      <strong>Blockiert weil</strong>
                      <span className="muted">{marketSellPreview.blockingReasons.length}</span>
                    </div>
                    <ul className="warning-list">
                      {marketSellPreview.blockingReasons.map((reason) => (
                        <li key={reason}>{translateSellBlockingReason(reason)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {marketSellPreview.warnings.length ? (
                  <div className="transfer-callout is-warning">
                    <div className="transfer-callout-title">
                      <strong>Warnungen</strong>
                      <span className="muted">{marketSellPreview.warnings.length}</span>
                    </div>
                    <ul className="warning-list">
                      {marketSellPreview.warnings.map((warning) => (
                        <li key={warning}>{translateSellWarning(warning)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="transfer-modal-section">
              <div className="transfer-callout-title">
                <strong>Team-Auswirkung</strong>
                <span className="muted">Vorschau nach Verkauf</span>
              </div>
              <div className="metric-grid compact transfer-sell-metric-grid">
                <article className="metric-card">
                  <span>Cash</span>
                  <strong>
                    {formatTransfermarktCurrency(marketSellPreview.cashBefore)} → {formatTransfermarktCurrency(marketSellPreview.cashAfter)}
                  </strong>
                  <small className="muted">Netto-Erlös {formatTransfermarktCurrency(marketSellPreview.netProceeds ?? marketSellPreview.salePrice)}</small>
                </article>
                <article className="metric-card">
                  <span>Kader</span>
                  <strong>
                    {marketSellPreview.rosterBefore ?? "—"} → {marketSellPreview.rosterAfter ?? "—"}
                  </strong>
                  <small className="muted">Spieler im Team</small>
                </article>
                <article className="metric-card">
                  <span>Teamgehalt</span>
                  <strong>
                    {formatTransfermarktCurrency(marketSellPreview.teamSalaryBefore)} →{" "}
                    {formatTransfermarktCurrency(marketSellPreview.teamSalaryAfter)}
                  </strong>
                  <small className="text-positive">
                    Entlastung {formatTransfermarktCurrency(marketSellPreview.salaryReduction)}
                  </small>
                </article>
                <article className="metric-card">
                  <span>Aufstellung danach</span>
                  <strong>{formatReadinessAfterSellLabel(marketSellPreview.projectedReadinessAfterSell)}</strong>
                  <small className="muted">Aufstellungs-Check</small>
                </article>
              </div>
            </div>

            {marketSellPreview.coaching ? (
              <div className="transfer-modal-section" data-testid="transfer-sell-coaching-panel">
                <div className="transfer-callout-title">
                  <strong>Strategie & Board</strong>
                  <span className="muted">Doktrin: {formatDoctrinePersonaLabel(marketSellPreview.coaching.doctrinePersona)}</span>
                </div>
                <p className="muted">{marketSellPreview.coaching.strategyFitSummary}</p>
                <div className="metric-grid compact transfer-sell-metric-grid">
                  <article className="metric-card">
                    <span>Auto-Empfehlung</span>
                    <strong>{marketSellPreview.coaching.sellDecisionLabel ?? "—"}</strong>
                    <small>Priorität {marketSellPreview.coaching.sellPriority ?? "—"}</small>
                  </article>
                  <article className="metric-card">
                    <span>GM</span>
                    <strong>{marketSellPreview.coaching.gmName ?? "—"}</strong>
                    <small>
                      {formatGmArchetypeLabel(marketSellPreview.coaching.gmArchetype)} ·{" "}
                      {formatGmPressureLabel(marketSellPreview.coaching.gmPressureLevel)}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Board</span>
                    <strong>{marketSellPreview.coaching.boardReaction.title}</strong>
                    <small>
                      Stimmung {formatBoardTrustMoodLabel(marketSellPreview.coaching.boardTrustSmiley)} ·{" "}
                      {formatBoardTrustPolicyLabel(marketSellPreview.coaching.boardTrustPolicy)}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Marktsperre</span>
                    <strong>1 Saison</strong>
                    <small>{marketSellPreview.coaching.soldPlayerSeasonBanNote}</small>
                  </article>
                </div>
                {marketSellPreview.coaching.gmWarning ? (
                  <div className="transfer-feedback-banner is-warning">
                    <strong>GM-Hinweis</strong>
                    <span>{marketSellPreview.coaching.gmWarning}</span>
                    {marketSellPreview.coaching.gmDetail ? <small className="muted">{marketSellPreview.coaching.gmDetail}</small> : null}
                  </div>
                ) : null}
                {marketSellPreview.coaching.replacementSlot ? (
                  <div className="transfer-callout is-warning">
                    <strong>Nachfolger-Slot</strong>
                    <p>{marketSellPreview.coaching.replacementSlot.slotLabel}</p>
                    <small className="muted">
                      Budget bis {formatTransfermarktCurrency(marketSellPreview.coaching.replacementSlot.maxBuyPrice)} · Ziel-OVR{" "}
                      {marketSellPreview.coaching.replacementSlot.minOvrBand ?? "—"}
                    </small>
                  </div>
                ) : null}
                {/* Sichtbarkeit der Risiko-Bestätigung MUSS exakt der `strongAckPending`-
                    Bedingung oben entsprechen: sobald die Bestätigung den Verkauf sperrt,
                    muss die Checkbox auch erscheinen. Sonst gäbe es einen stillen Dead-End
                    (kritische Board-Reaktion + keepIntent < 55: gesperrt, aber ohne Checkbox
                    und ohne Weg nach vorn). Der keepIntent≥55-Gate gilt nur für den
                    GM-Soft-Block, nicht für die zwingende Board-Bestätigung. */}
                {marketSellPreview.coaching.boardReaction.requiresStrongAcknowledgment ||
                (marketSellPreview.coaching.gmSoftBlockStarSell &&
                  (marketSellPreview.coaching.keepIntentScore ?? 0) >= 55) ? (
                  <label className="transfer-sell-risk-ack">
                    <input
                      type="checkbox"
                      checked={marketSellRiskAcknowledged}
                      onChange={(event) => onMarketSellRiskAcknowledgedChange(event.target.checked)}
                    />
                    <span>
                      Ich bestätige den Verkauf trotz Board-/GM-Warnung ({marketSellPreview.coaching.boardReaction.title})
                    </span>
                  </label>
                ) : null}
                <details className="transfer-sell-disclosure">
                  <summary>
                    Gründe für & gegen den Verkauf
                    <span className="muted">
                      {marketSellPreview.coaching.reasonsToSell.length} dafür · {marketSellPreview.coaching.reasonsToKeep.length} dagegen
                    </span>
                  </summary>
                  <div className="transfer-sell-disclosure-body">
                    <div className="transfer-buy-meta-grid">
                      <div className="transfer-callout">
                        <strong>Gründe für Verkauf</strong>
                        {marketSellPreview.coaching.reasonsToSell.length ? (
                          <ul className="warning-list">
                            {marketSellPreview.coaching.reasonsToSell.map((reason) => (
                              <li key={`sell-${reason}`}>{reason}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted">Keine Verkaufsgründe.</p>
                        )}
                      </div>
                      <div className="transfer-callout">
                        <strong>Gründe dagegen</strong>
                        {marketSellPreview.coaching.reasonsToKeep.length ? (
                          <ul className="warning-list">
                            {marketSellPreview.coaching.reasonsToKeep.map((reason) => (
                              <li key={`keep-${reason}`}>{reason}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="muted">Keine Haltegründe.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            ) : null}

            <details className="transfer-sell-disclosure">
              <summary>
                Leistung & PP-Profil
                <span className="muted">
                  {marketSellPlayerContext?.performance?.appearances ?? 0} Einsätze · Season-PPs{" "}
                  {formatPpsValue(marketSellPlayerContext?.rating?.ppsSeason ?? marketSellPlayerContext?.performance?.totalPoints ?? null)}
                </span>
              </summary>
              <div className="transfer-sell-disclosure-body">
                <div className="metric-grid compact transfer-sell-metric-grid">
                  <article className="metric-card">
                    <span>OVR</span>
                    <strong>{formatWholeNumber(marketSellPlayerContext?.rating?.ovrNormalized ?? marketSellPlayerContext?.player?.ovr ?? null)}</strong>
                    <small>Rang {marketSellPlayerContext?.rating?.ovrRank ?? "—"}</small>
                  </article>
                  <article className="metric-card">
                    <span>MVS</span>
                    <strong>{formatPpsValue(marketSellPlayerContext?.rating?.mvs ?? null)}</strong>
                    <small>Rang {marketSellPlayerContext?.rating?.mvsRank ?? "—"}</small>
                  </article>
                  <article className="metric-card">
                    <span>Season PPs</span>
                    <strong>
                      {formatPpsValue(marketSellPlayerContext?.rating?.ppsSeason ?? marketSellPlayerContext?.performance?.totalPoints ?? null)}
                    </strong>
                    <small>Rang {marketSellPlayerContext?.rating?.ppsSeasonRank ?? "—"}</small>
                  </article>
                  <article className="metric-card">
                    <span>Einsätze</span>
                    <strong>{marketSellPlayerContext?.performance?.appearances ?? "—"}</strong>
                    <small>
                      Top 10 {marketSellPlayerContext?.performance?.top10Count ?? "—"} · MVP{" "}
                      {marketSellPlayerContext?.performance?.mvpCount ?? "—"}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Letzter Einsatz</span>
                    <strong>{marketSellPlayerContext?.performance?.latestDisciplineLabel ?? "—"}</strong>
                    <small>
                      Score {formatPpsValue(marketSellPlayerContext?.performance?.latestFinalScore ?? null)} · Rang{" "}
                      {marketSellPlayerContext?.performance?.latestRankInDiscipline ?? "—"}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Beste Diszi</span>
                    <strong>{marketSellPlayerContext?.performance?.bestDisciplineLabel ?? "—"}</strong>
                    <small>{formatPpsValue(marketSellPlayerContext?.performance?.bestDisciplineScore ?? null)} Score</small>
                  </article>
                </div>
                <div className="transfer-sell-area-grid">
                  {(marketSellPlayerContext?.areaRows ?? []).map((area) => (
                    <article className={`transfer-sell-area-card is-${area.tone}`} key={area.key}>
                      <span>{area.key}</span>
                      <strong>{formatPpsValue(area.value)}</strong>
                    </article>
                  ))}
                </div>
              </div>
            </details>

            <details className="transfer-sell-disclosure">
              <summary>
                Entwicklung & Vertrag
                <span className="muted">
                  MW {formatTransfermarktCurrency(marketSellPlayerContext?.currentMarketValue ?? marketSellPreview.marketValueReference)} · Gehalt{" "}
                  {formatTransfermarktCurrency(marketSellPlayerContext?.salary ?? marketSellPreview.activePlayer?.salary ?? null)}
                </span>
              </summary>
              <div className="transfer-sell-disclosure-body">
                <div className="metric-grid compact transfer-sell-metric-grid">
                  <article className="metric-card">
                    <span>MW aktuell</span>
                    <strong>
                      {formatTransfermarktCurrency(marketSellPlayerContext?.currentMarketValue ?? marketSellPreview.marketValueReference)}
                    </strong>
                    <small>
                      Kaderwert{" "}
                      {formatTransfermarktCurrency(
                        marketSellPlayerContext?.rosterMarketValue ?? marketSellPreview.activePlayer?.currentValue ?? null,
                      )}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>MW Delta</span>
                    <strong
                      className={
                        marketSellPlayerContext?.marketValueDelta != null
                          ? marketSellPlayerContext.marketValueDelta >= 0
                            ? "text-positive"
                            : "text-negative"
                          : undefined
                      }
                    >
                      {marketSellPlayerContext?.marketValueDelta != null
                        ? formatSignedTransfermarktCurrency(marketSellPlayerContext.marketValueDelta)
                        : "—"}
                    </strong>
                    <small>aktuell vs. Kaderwert</small>
                  </article>
                  <article className="metric-card">
                    <span>Kaufpreis</span>
                    <strong>
                      {formatTransfermarktCurrency(
                        marketSellPlayerContext?.purchasePrice ?? marketSellPreview.activePlayer?.purchasePrice ?? null,
                      )}
                    </strong>
                    <small>letzter Einstieg</small>
                  </article>
                  <article className="metric-card">
                    <span>GuV Verkauf</span>
                    <strong
                      className={
                        marketSellPlayerContext?.saleProfit != null
                          ? marketSellPlayerContext.saleProfit >= 0
                            ? "text-positive"
                            : "text-negative"
                          : undefined
                      }
                    >
                      {marketSellPlayerContext?.saleProfit != null ? formatSignedTransfermarktCurrency(marketSellPlayerContext.saleProfit) : "—"}
                    </strong>
                    <small>Preis minus Einstieg</small>
                  </article>
                  <article className="metric-card">
                    <span>Gehalt</span>
                    <strong>
                      {formatTransfermarktCurrency(marketSellPlayerContext?.salary ?? marketSellPreview.activePlayer?.salary ?? null)}
                    </strong>
                    <small
                      className={
                        marketSellPlayerContext?.salaryDelta != null
                          ? marketSellPlayerContext.salaryDelta <= 0
                            ? "text-positive"
                            : "text-negative"
                          : undefined
                      }
                    >
                      vs. normal{" "}
                      {marketSellPlayerContext?.salaryDelta != null ? formatSignedTransfermarktCurrency(marketSellPlayerContext.salaryDelta) : "—"}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Laufzeit</span>
                    <strong>{marketSellPreview.activePlayer?.contractLength ?? "—"}</strong>
                    <small>Rolle {formatRosterRoleTagLabel(marketSellPreview.activePlayer?.roleTag)}</small>
                  </article>
                </div>
              </div>
            </details>

            <details className="transfer-sell-disclosure">
              <summary>
                Einsätze, Diszis & Transferhistorie
                <span className="muted">
                  {marketSellPlayerContext?.recentMatchdays.length ?? 0} Spieltage · {marketSellPlayerContext?.topDisciplines.length ?? 0} Diszis ·{" "}
                  {marketSellPlayerContext?.transferEvents.length ?? 0} Transfers
                </span>
              </summary>
              <div className="transfer-sell-disclosure-body">
                <div className="transfer-sell-history-grid">
                  <div className="transfer-modal-section">
                    <div className="transfer-callout-title">
                      <strong>Letzte Einsätze</strong>
                      <span className="muted">{marketSellPlayerContext?.recentMatchdays.length ?? 0}</span>
                    </div>
                    {marketSellPlayerContext?.recentMatchdays.length ? (
                      <div className="transfer-sell-mini-table">
                        {marketSellPlayerContext.recentMatchdays.map((entry) => (
                          <div className="transfer-sell-mini-row" key={entry.matchdayId}>
                            <span>{formatMatchdayShortLabel(entry.matchdayId)}</span>
                            <strong>{formatPpsValue(entry.totalContribution)}</strong>
                            <small>
                              {entry.bestDisciplineLabel ?? "—"} · Score {formatPpsValue(entry.averageFinalScore)}
                            </small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted transfer-empty-hint">Noch keine Matchday-Historie für diesen Spieler.</p>
                    )}
                  </div>

                  <div className="transfer-modal-section">
                    <div className="transfer-callout-title">
                      <strong>Top-Diszis</strong>
                      <span className="muted">{marketSellPlayerContext?.topDisciplines.length ?? 0}</span>
                    </div>
                    {marketSellPlayerContext?.topDisciplines.length ? (
                      <div className="transfer-sell-mini-table">
                        {marketSellPlayerContext.topDisciplines.map((entry) => (
                          <div className="transfer-sell-mini-row" key={entry.disciplineId}>
                            <span>{entry.disciplineName}</span>
                            <strong>{formatPpsValue(entry.totalContribution)}</strong>
                            <small>
                              Ø Beitrag {formatPpsValue(entry.averageContribution)} · Ø Score {formatPpsValue(entry.averageFinalScore)}
                            </small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted transfer-empty-hint">Noch keine Disziplin-Historie verfügbar.</p>
                    )}
                  </div>

                  <div className="transfer-modal-section">
                    <div className="transfer-callout-title">
                      <strong>Transferhistorie</strong>
                      <span className="muted">{marketSellPlayerContext?.transferEvents.length ?? 0}</span>
                    </div>
                    {marketSellPlayerContext?.transferEvents.length ? (
                      <div className="transfer-sell-mini-table">
                        {marketSellPlayerContext.transferEvents.map((entry) => (
                          <div className="transfer-sell-mini-row" key={entry.id}>
                            <span className={getTransferTypePillClass(entry.type)}>{entry.label}</span>
                            <strong>{formatTransfermarktCurrency(entry.fee)}</strong>
                            <small>
                              {entry.seasonLabel} · {entry.fromTeam} → {entry.toTeam} · Gehalt {formatTransfermarktCurrency(entry.salary)}
                            </small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted transfer-empty-hint">Keine Transfers im Save gefunden.</p>
                    )}
                  </div>
                </div>
              </div>
            </details>
          </>
        ) : (
          <p className="muted transfer-empty-hint">Verkaufsvorschau wird geladen oder ist für diesen Kontext noch nicht verfügbar.</p>
        )}
      </div>

      {rosterAtMinimum ? (
        <p className="foundation-screen-action-reason" data-testid="transfer-sell-roster-min-note">
          Kader ist am Minimum — ein weiterer Verkauf würde die Aufstellung unmöglich machen. Kaufe zuerst Ersatz.
        </p>
      ) : null}

      <div className="foundation-modal-actions">
        <button className="secondary-button" type="button" onClick={closeMarketSellModal}>
          Abbrechen
        </button>
        <button
          className="primary-button"
          type="button"
          data-testid="transfer-sell-confirm-button"
          disabled={sellDisabled}
          title={sellDisabledReason ?? "Verkauf jetzt final bestätigen."}
          onClick={() => {
            void confirmTransfermarktSell();
          }}
        >
          {marketSellBusy ? "Verkauf läuft..." : "Verkauf bestätigen"}
        </button>
      </div>
      {sellDisabledReason ? (
        <p className="foundation-screen-action-reason" data-testid="transfer-sell-disabled-reason">
          Warum nicht: {sellDisabledReason}
        </p>
      ) : null}
    </section>
  );
}
