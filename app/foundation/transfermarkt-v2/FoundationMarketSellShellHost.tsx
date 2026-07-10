"use client";

import type { Dispatch, SetStateAction } from "react";

import ClassColorChip from "@/app/foundation/ClassColorChip";
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

function formatSignedDisplayMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} €`;
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

          return (
            <div className="transfer-buy-player-line transfer-sell-hero-line">
              <div className="transfer-modal-player-hero transfer-sell-hero">
                {portraitSrc ? (
                  <img
                    className="transfermarkt-portrait transfer-sell-portrait"
                    src={portraitSrc}
                    alt={playerName}
                    width={72}
                    height={72}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                  />
                ) : (
                  <div
                    className="transfermarkt-portrait transfermarkt-portrait-placeholder transfer-sell-portrait"
                    aria-label={`${playerName} placeholder`}
                  >
                    {playerName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="transfer-modal-player-summary">
                  <div className="transfer-modal-player-head">
                    <strong>{playerName}</strong>
                    <div className="transfer-modal-player-meta">
                      <ClassColorChip className={className} />
                      <span className="muted">{race}</span>
                      <span className="pill">
                        {marketSellPreview?.team?.shortCode ?? selectedTeam?.shortCode ?? "—"} ·{" "}
                        {marketSellPreview?.team?.name ?? selectedTeam?.name ?? "Kein Team gewaehlt"}
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
                    {hasBuyout ? (
                      <article className="transfer-modal-kpi">
                        <span>Buyout</span>
                        <strong>{formatTransfermarktCurrency(buyoutCost)}</strong>
                        <small className="text-negative">Offener Vertrag</small>
                      </article>
                    ) : (
                      <article className="transfer-modal-kpi">
                        <span>Verkaufspreis</span>
                        <strong>{formatTransfermarktCurrency(marketSellPreview?.salePrice ?? null)}</strong>
                        <small className={saleVsMarketValue != null ? (saleVsMarketValue >= 0 ? "text-positive" : "text-negative") : undefined}>
                          vs. MW {saleVsMarketValue != null ? formatSignedTransfermarktCurrency(saleVsMarketValue) : "—"}
                        </small>
                      </article>
                    )}
                    <article className="transfer-modal-kpi">
                      <span>Faktor</span>
                      <strong>
                        {marketSellPreview?.saleFactor != null ? `${formatLocalePoints(marketSellPreview.saleFactor, 2)}x` : "—"}
                      </strong>
                    </article>
                    <article className="transfer-modal-kpi">
                      <span>PPs</span>
                      <strong>{formatPpsValue(context?.rating?.ppsSeason ?? context?.performance?.totalPoints ?? null)}</strong>
                    </article>
                    <article className="transfer-modal-kpi">
                      <span>OVR</span>
                      <strong>{formatWholeNumber(context?.rating?.ovrNormalized ?? context?.player?.ovr ?? null)}</strong>
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
            <div className="transfer-sell-layout">
              <div className="transfer-callout-title">
                <strong>Performance</strong>
                <span className="muted">
                  {marketSellPreview.team?.shortCode ?? "—"} · {marketSellPreview.team?.name ?? "—"}
                </span>
              </div>
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
                  <span>Einsaetze</span>
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
            </div>

            <div className="transfer-modal-section">
              <div className="transfer-callout-title">
                <strong>PP-Profil</strong>
                <span className="muted">aktive Season</span>
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

            <div className="transfer-modal-section">
              <div className="transfer-callout-title">
                <strong>Entwicklung & Vertrag</strong>
                <span className="muted">{marketSellPreview.transferCreated ? "geschrieben" : "Preview"}</span>
              </div>
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
                      ? formatSignedDisplayMoney(marketSellPlayerContext.marketValueDelta)
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
                    {marketSellPlayerContext?.saleProfit != null ? formatSignedDisplayMoney(marketSellPlayerContext.saleProfit) : "—"}
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
                    {marketSellPlayerContext?.salaryDelta != null ? formatSignedDisplayMoney(marketSellPlayerContext.salaryDelta) : "—"}
                  </small>
                </article>
                <article className="metric-card">
                  <span>Laufzeit</span>
                  <strong>{marketSellPreview.activePlayer?.contractLength ?? "—"}</strong>
                  <small>Rolle {marketSellPreview.activePlayer?.roleTag ?? "—"}</small>
                </article>
              </div>
            </div>

            <div className="transfer-sell-history-grid">
              <div className="transfer-modal-section">
                <div className="transfer-callout-title">
                  <strong>Letzte Einsaetze</strong>
                  <span className="muted">{marketSellPlayerContext?.recentMatchdays.length ?? 0}</span>
                </div>
                {marketSellPlayerContext?.recentMatchdays.length ? (
                  <div className="transfer-sell-mini-table">
                    {marketSellPlayerContext.recentMatchdays.map((entry) => (
                      <div className="transfer-sell-mini-row" key={entry.matchdayId}>
                        <span>{entry.matchdayId}</span>
                        <strong>{formatPpsValue(entry.totalContribution)}</strong>
                        <small>
                          {entry.bestDisciplineLabel ?? "—"} · Score {formatPpsValue(entry.averageFinalScore)}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted transfer-empty-hint">Noch keine Matchday-Historie fuer diesen Spieler.</p>
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
                  <p className="muted transfer-empty-hint">Noch keine Disziplin-Historie verfuegbar.</p>
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

            <div className="transfer-modal-section">
              <div className="transfer-callout-title">
                <strong>Team-Auswirkung</strong>
                <span className="muted">Preview</span>
              </div>
              <div className="metric-grid compact transfer-sell-metric-grid">
                <article className="metric-card">
                  <span>Netto-Erlös</span>
                  <strong>{formatTransfermarktCurrency(marketSellPreview.netProceeds ?? marketSellPreview.salePrice)}</strong>
                  <small className="muted">
                    Brutto {formatTransfermarktCurrency(marketSellPreview.salePrice)} · Buyout{" "}
                    {formatTransfermarktCurrency(marketSellPreview.buyoutCost ?? 0)}
                  </small>
                </article>
                <article className="metric-card">
                  <span>Verkaufspreis</span>
                  <strong>{formatTransfermarktCurrency(marketSellPreview.salePrice)}</strong>
                  {(() => {
                    const saleVsMarketValue =
                      marketSellPreview.salePrice != null && marketSellPreview.marketValueReference != null
                        ? marketSellPreview.salePrice - marketSellPreview.marketValueReference
                        : null;
                    return (
                      <small className={saleVsMarketValue != null ? (saleVsMarketValue >= 0 ? "text-positive" : "text-negative") : undefined}>
                        Faktor {marketSellPreview.saleFactor != null ? `${formatLocalePoints(marketSellPreview.saleFactor, 2)}x` : "—"} · vs. MW{" "}
                        {saleVsMarketValue != null ? formatSignedTransfermarktCurrency(saleVsMarketValue) : "—"}
                      </small>
                    );
                  })()}
                </article>
                {(marketSellPreview.buyoutCost ?? 0) > 0 ? (
                  <article className="metric-card">
                    <span>Buyout</span>
                    <strong>{formatTransfermarktCurrency(marketSellPreview.buyoutCost ?? null)}</strong>
                    <small className="text-negative">Offener Vertrag wird abgezogen</small>
                  </article>
                ) : null}
                <article className="metric-card">
                  <span>Gehaltsentlastung</span>
                  <strong>{formatTransfermarktCurrency(marketSellPreview.salaryReduction)}</strong>
                  <small>Sofort aus Teamgehalt raus</small>
                </article>
                <article className="metric-card">
                  <span>Cash</span>
                  <strong>
                    {formatTransfermarktCurrency(marketSellPreview.cashBefore)} → {formatTransfermarktCurrency(marketSellPreview.cashAfter)}
                  </strong>
                </article>
                <article className="metric-card">
                  <span>Kader</span>
                  <strong>
                    {marketSellPreview.rosterBefore ?? "—"} → {marketSellPreview.rosterAfter ?? "—"}
                  </strong>
                </article>
                <article className="metric-card">
                  <span>Teamgehalt</span>
                  <strong>
                    {formatTransfermarktCurrency(marketSellPreview.teamSalaryBefore)} →{" "}
                    {formatTransfermarktCurrency(marketSellPreview.teamSalaryAfter)}
                  </strong>
                </article>
                <article className="metric-card">
                  <span>Readiness</span>
                  <strong>{marketSellPreview.projectedReadinessAfterSell ?? "—"}</strong>
                </article>
              </div>
            </div>
            {marketSellPreview.coaching ? (
              <div className="transfer-modal-section" data-testid="transfer-sell-coaching-panel">
                <div className="transfer-callout-title">
                  <strong>Strategie & Board</strong>
                  <span className="muted">{marketSellPreview.coaching.doctrinePersona}</span>
                </div>
                <p className="muted">{marketSellPreview.coaching.strategyFitSummary}</p>
                <div className="metric-grid compact transfer-sell-metric-grid">
                  <article className="metric-card">
                    <span>Auto-Empfehlung</span>
                    <strong>{marketSellPreview.coaching.sellDecisionLabel ?? "—"}</strong>
                    <small>Prioritaet {marketSellPreview.coaching.sellPriority ?? "—"}</small>
                  </article>
                  <article className="metric-card">
                    <span>GM</span>
                    <strong>{marketSellPreview.coaching.gmName ?? "—"}</strong>
                    <small>
                      {marketSellPreview.coaching.gmPressureLevel} · {marketSellPreview.coaching.gmArchetype ?? "—"}
                    </small>
                  </article>
                  <article className="metric-card">
                    <span>Board</span>
                    <strong>{marketSellPreview.coaching.boardReaction.title}</strong>
                    <small>
                      {marketSellPreview.coaching.boardTrustSmiley ?? "—"} · {marketSellPreview.coaching.boardTrustPolicy ?? "—"}
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
                <div className="transfer-buy-meta-grid">
                  <div className="transfer-callout">
                    <strong>Gruende fuer Verkauf</strong>
                    {marketSellPreview.coaching.reasonsToSell.length ? (
                      <ul className="warning-list">
                        {marketSellPreview.coaching.reasonsToSell.map((reason) => (
                          <li key={`sell-${reason}`}>{reason}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Keine Verkaufsgruende.</p>
                    )}
                  </div>
                  <div className="transfer-callout">
                    <strong>Gruende dagegen</strong>
                    {marketSellPreview.coaching.reasonsToKeep.length ? (
                      <ul className="warning-list">
                        {marketSellPreview.coaching.reasonsToKeep.map((reason) => (
                          <li key={`keep-${reason}`}>{reason}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Keine Haltegruende.</p>
                    )}
                  </div>
                </div>
                {(marketSellPreview.coaching.boardReaction.requiresStrongAcknowledgment ||
                  marketSellPreview.coaching.gmSoftBlockStarSell) &&
                (marketSellPreview.coaching.keepIntentScore ?? 0) >= 55 ? (
                  <label className="transfer-sell-risk-ack">
                    <input
                      type="checkbox"
                      checked={marketSellRiskAcknowledged}
                      onChange={(event) => onMarketSellRiskAcknowledgedChange(event.target.checked)}
                    />
                    <span>
                      Ich bestaetige den Verkauf trotz Board-/GM-Warnung ({marketSellPreview.coaching.boardReaction.title})
                    </span>
                  </label>
                ) : null}
              </div>
            ) : null}
            <div className="transfer-buy-meta-grid">
              <div className="transfer-callout is-blocked">
                <div className="transfer-callout-title">
                  <strong>Blocking Reasons</strong>
                  <span className="muted">{marketSellPreview.blockingReasons.length}</span>
                </div>
                {marketSellPreview.blockingReasons.length ? (
                  <ul className="warning-list">
                    {marketSellPreview.blockingReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Keine blockierenden Gruende.</p>
                )}
              </div>
              <div className="transfer-callout is-warning">
                <div className="transfer-callout-title">
                  <strong>Warnings</strong>
                  <span className="muted">{marketSellPreview.warnings.length}</span>
                </div>
                {marketSellPreview.warnings.length ? (
                  <ul className="warning-list">
                    {marketSellPreview.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Keine Warnungen.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="muted transfer-empty-hint">Verkaufsvorschau wird geladen oder ist fuer diesen Kontext noch nicht verfuegbar.</p>
        )}
      </div>

      <div className="foundation-modal-actions">
        <button className="secondary-button" type="button" onClick={closeMarketSellModal}>
          Abbrechen
        </button>
        <button
          className="primary-button"
          type="button"
          data-testid="transfer-sell-confirm-button"
          disabled={
            readMetaSource === "prisma" ||
            !marketSellPreview?.canSell ||
            marketSellBusy ||
            ((marketSellPreview?.coaching?.boardReaction.requiresStrongAcknowledgment ||
              (marketSellPreview?.coaching?.gmSoftBlockStarSell && (marketSellPreview?.coaching?.keepIntentScore ?? 0) >= 55)) &&
              !marketSellRiskAcknowledged)
          }
          title={
            readMetaSource === "prisma"
              ? "Im Referenzmodus bleibt der Verkauf gesperrt."
              : !marketSellPreview?.canSell
                ? (marketSellPreview?.blockingReasons?.[0] ?? "Dieser Verkauf ist gerade noch blockiert.")
                : marketSellBusy
                  ? "Der Verkauf wird gerade vorbereitet."
                  : "Verkauf jetzt final bestätigen."
          }
          onClick={() => {
            void confirmTransfermarktSell();
          }}
        >
          {marketSellBusy ? "Verkauf laeuft..." : "Verkauf bestaetigen"}
        </button>
      </div>
    </section>
  );
}
